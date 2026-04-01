"""
Appointment booking tool functions for the AI booking agent.

Each function is async, opens its own DB session, and returns a plain dict:
  {"ok": True,  "data": ...}  on success
  {"ok": False, "error": "..."}  on validation failure or not-found

The agent calls these directly — no FastAPI dependency injection involved.
"""
import uuid
import logging
from datetime import date, time, datetime, timedelta
from typing import Optional

from sqlalchemy import text

from app.database import AsyncSessionLocal
from app.services.email_service import (
    fire_and_forget,
    send_booking_confirmation,
    send_cancellation_email,
    send_reschedule_email,
)
from app.utils.date_parser import resolve_date

log = logging.getLogger(__name__)

# How often slots are offered (barber moves to next slot every N minutes)
SLOT_INTERVAL_MINUTES = 30


# ── Response helpers ──────────────────────────────────────────────────────────

def _ok(data) -> dict:
    return {"ok": True, "data": data}


def _err(message: str) -> dict:
    return {"ok": False, "error": message}


# ── Date / time helpers ───────────────────────────────────────────────────────

def _parse_date(s: str) -> Optional[date]:
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _parse_time(s: str) -> Optional[time]:
    """Accept 'HH:MM' or 'HH:MM:SS'."""
    try:
        return time.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _to_min(t: time) -> int:
    """Convert a time object to minutes-since-midnight."""
    return t.hour * 60 + t.minute


def _from_min(m: int) -> time:
    """Convert minutes-since-midnight back to a time object."""
    return time(hour=m // 60, minute=m % 60)


def _fmt_time(t: time) -> str:
    return t.strftime("%H:%M")


def _fmt_date(d: date) -> str:
    """E.g. 'Saturday, March 29'."""
    return d.strftime("%A, %B %-d")


def _validate_appointment_date(date_str: str) -> tuple[bool, str, Optional[date]]:
    """
    Validate that *date_str* is a parseable future date within the 60-day booking window.

    Returns:
        (is_valid, message, date_object)
        - is_valid=False  → message is a user-friendly error; date_object is None.
        - is_valid=True   → message is "Valid"; date_object is the parsed date.
    """
    try:
        appointment_date = date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return (
            False,
            f"I couldn't understand the date '{date_str}'. "
            "Please use a format like 'April 5, 2026' or '2026-04-05'.",
            None,
        )

    today = date.today()
    if appointment_date < today:
        return (
            False,
            f"The date {appointment_date.strftime('%B %d, %Y')} is in the past. "
            "Please choose a future date.",
            None,
        )

    cutoff = today + timedelta(days=60)
    if appointment_date > cutoff:
        return (
            False,
            f"I can only book up to 60 days in advance. "
            f"Please choose a date before {cutoff.strftime('%B %d, %Y')}.",
            None,
        )

    return True, "Valid", appointment_date


# ─────────────────────────────────────────────────────────────────────────────
# 1. get_services
# ─────────────────────────────────────────────────────────────────────────────

async def get_services() -> dict:
    """Return all active services sorted by price."""
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(text(
            "SELECT id, name, description, duration_minutes, price "
            "FROM services WHERE is_active = TRUE ORDER BY price"
        ))).mappings().all()

    return _ok([
        {
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "duration_minutes": r["duration_minutes"],
            "price": float(r["price"]),
        }
        for r in rows
    ])


# ─────────────────────────────────────────────────────────────────────────────
# 2. get_barbers
# ─────────────────────────────────────────────────────────────────────────────

async def get_barbers(specialty: Optional[str] = None, name: Optional[str] = None) -> dict:
    """
    Return active barbers, optionally filtered by specialty or looked up by name.

    If *name* is provided, a case-insensitive search is performed. When no match
    is found, the response includes found=False plus the full list of active barbers
    so the agent can immediately show the customer what's available.
    """
    async with AsyncSessionLocal() as db:
        if specialty:
            # JSONB @> containment: specialties @> '["fade"]'
            rows = (await db.execute(
                text(
                    "SELECT id, name, email, specialties "
                    "FROM barbers "
                    "WHERE is_active = TRUE "
                    "  AND specialties @> CAST(:spec AS jsonb) "
                    "ORDER BY name"
                ),
                {"spec": f'["{specialty}"]'},
            )).mappings().all()
        else:
            rows = (await db.execute(text(
                "SELECT id, name, email, specialties "
                "FROM barbers WHERE is_active = TRUE ORDER BY name"
            ))).mappings().all()

    all_barbers = [
        {
            "id": r["id"],
            "name": r["name"],
            "email": r["email"],
            "specialties": r["specialties"],
        }
        for r in rows
    ]

    if name:
        # Case-insensitive partial match
        name_lower = name.lower()
        matches = [b for b in all_barbers if name_lower in b["name"].lower()]
        if not matches:
            return _ok({
                "found": False,
                "message": f"No barber named '{name}' found.",
                "available_barbers": all_barbers,
            })
        return _ok({"found": True, "available_barbers": matches})

    return _ok(all_barbers)


# ─────────────────────────────────────────────────────────────────────────────
# 3. get_available_slots
# ─────────────────────────────────────────────────────────────────────────────

async def get_available_slots(
    barber_id: int,
    date: str,
    service_id: int,
) -> dict:
    """
    Return available start times for a barber/service/date combination.

    Algorithm:
      1. Resolve barber's working hours for that day-of-week.
      2. Fetch existing (non-cancelled) appointments to detect occupied blocks.
      3. Walk SLOT_INTERVAL_MINUTES steps across the working window; skip any
         slot whose [start, start+duration) overlaps an occupied block.
      4. For today, also skip slots whose start time has already passed.
    """
    # Resolve relative date expressions ("this Saturday", "tomorrow", etc.)
    date = resolve_date(date)

    is_valid, msg, appt_date = _validate_appointment_date(date)
    if not is_valid:
        return _err(msg)

    dow = appt_date.weekday()  # 0 = Monday … 6 = Sunday

    async with AsyncSessionLocal() as db:
        # ── barber schedule ──────────────────────────────────────────────────
        sched = (await db.execute(
            text(
                "SELECT start_time, end_time, is_available "
                "FROM barber_schedules "
                "WHERE barber_id = :bid AND day_of_week = :dow"
            ),
            {"bid": barber_id, "dow": dow},
        )).mappings().one_or_none()

        if sched is None or not sched["is_available"]:
            day_name = appt_date.strftime("%A")
            return _ok({
                "available": False,
                "message": f"Barber #{barber_id} does not work on {day_name}s.",
                "slots": [],
            })

        # ── service duration ─────────────────────────────────────────────────
        svc = (await db.execute(
            text(
                "SELECT id, name, duration_minutes FROM services "
                "WHERE id = :sid AND is_active = TRUE"
            ),
            {"sid": service_id},
        )).mappings().one_or_none()

        if svc is None:
            return _err(f"Service #{service_id} not found or is inactive.")

        duration = svc["duration_minutes"]

        # ── existing bookings ────────────────────────────────────────────────
        booked_rows = (await db.execute(
            text(
                "SELECT start_time, end_time FROM appointments "
                "WHERE barber_id = :bid "
                "  AND appointment_date = :d "
                "  AND status != 'cancelled'"
            ),
            {"bid": barber_id, "d": appt_date},
        )).mappings().all()

    booked: list[tuple[int, int]] = [
        (_to_min(r["start_time"]), _to_min(r["end_time"]))
        for r in booked_rows
    ]

    # ── minimum start for today ──────────────────────────────────────────────
    now_min: Optional[int] = None
    if appt_date == datetime.now().date():
        n = datetime.now()
        now_min = n.hour * 60 + n.minute  # must be strictly after this

    work_start = _to_min(sched["start_time"])
    work_end   = _to_min(sched["end_time"])

    slots: list[str] = []
    cursor = work_start

    while cursor + duration <= work_end:
        slot_end = cursor + duration

        # Skip past slots when checking today
        if now_min is not None and cursor <= now_min:
            cursor += SLOT_INTERVAL_MINUTES
            continue

        # Check overlap: slot [cursor, slot_end) vs booked [bs, be)
        # Overlap iff cursor < be AND slot_end > bs
        overlaps = any(cursor < be and slot_end > bs for bs, be in booked)

        if not overlaps:
            slots.append(_fmt_time(_from_min(cursor)))

        cursor += SLOT_INTERVAL_MINUTES

    return _ok({
        "available": True,
        "date": date,
        "barber_id": barber_id,
        "service": {"id": svc["id"], "name": svc["name"], "duration_minutes": duration},
        "working_hours": (
            f"{_fmt_time(sched['start_time'])} – {_fmt_time(sched['end_time'])}"
        ),
        "slots": slots,
        "message": (
            f"{len(slots)} slot(s) available."
            if slots
            else "No slots available for this date. Try a different day."
        ),
    })


# ─────────────────────────────────────────────────────────────────────────────
# 4. book_appointment
# ─────────────────────────────────────────────────────────────────────────────

async def book_appointment(
    customer_id: str,       # UUID string from JWT
    barber_id: int,
    service_id: int,
    date: str,              # "YYYY-MM-DD"
    time: str,              # "HH:MM"
    customer_email: str = "",
    customer_name: str = "",
) -> dict:
    """
    Book an appointment inside a single DB transaction.
    Validates: date is future, time within working hours, no overlap.
    The UNIQUE constraint on (barber_id, appointment_date, start_time)
    provides a final race-condition safety net.
    """
    # ── input validation ─────────────────────────────────────────────────────
    try:
        uuid.UUID(customer_id)
    except (ValueError, AttributeError):
        return _err("Invalid customer ID.")

    # Resolve relative date expressions then validate
    date = resolve_date(date)
    is_valid, msg, appt_date = _validate_appointment_date(date)
    if not is_valid:
        return _err(msg)

    appt_time = _parse_time(time)
    if appt_time is None:
        return _err(f"Invalid time '{time}'. Use HH:MM format.")

    async with AsyncSessionLocal() as db:
        async with db.begin():
            # ── service ──────────────────────────────────────────────────────
            svc = (await db.execute(
                text(
                    "SELECT id, name, duration_minutes, price FROM services "
                    "WHERE id = :sid AND is_active = TRUE"
                ),
                {"sid": service_id},
            )).mappings().one_or_none()

            if svc is None:
                return _err(f"Service #{service_id} not found or is inactive.")

            duration  = svc["duration_minutes"]
            start_m   = _to_min(appt_time)
            end_m     = start_m + duration
            end_time  = _from_min(end_m)

            # ── barber ───────────────────────────────────────────────────────
            barber = (await db.execute(
                text(
                    "SELECT id, name FROM barbers "
                    "WHERE id = :bid AND is_active = TRUE"
                ),
                {"bid": barber_id},
            )).mappings().one_or_none()

            if barber is None:
                return _err(f"Barber #{barber_id} not found or is inactive.")

            # ── working hours ────────────────────────────────────────────────
            dow = appt_date.weekday()
            sched = (await db.execute(
                text(
                    "SELECT start_time, end_time, is_available "
                    "FROM barber_schedules "
                    "WHERE barber_id = :bid AND day_of_week = :dow"
                ),
                {"bid": barber_id, "dow": dow},
            )).mappings().one_or_none()

            if sched is None or not sched["is_available"]:
                return _err(
                    f"{barber['name']} does not work on "
                    f"{appt_date.strftime('%A')}s."
                )

            work_start = _to_min(sched["start_time"])
            work_end   = _to_min(sched["end_time"])

            if start_m < work_start or end_m > work_end:
                return _err(
                    f"Requested time is outside {barber['name']}'s working hours "
                    f"({_fmt_time(sched['start_time'])} – "
                    f"{_fmt_time(sched['end_time'])})."
                )

            # ── conflict check (SELECT FOR UPDATE to close the race window) ──
            conflict = (await db.execute(
                text(
                    "SELECT id FROM appointments "
                    "WHERE barber_id = :bid "
                    "  AND appointment_date = :d "
                    "  AND status != 'cancelled' "
                    "  AND start_time < :end_t "
                    "  AND end_time   > :start_t "
                    "FOR UPDATE"
                ),
                {
                    "bid": barber_id, "d": appt_date,
                    "start_t": appt_time, "end_t": end_time,
                },
            )).one_or_none()

            if conflict is not None:
                return _err(
                    "That time slot is no longer available. "
                    "Please choose another slot."
                )

            # ── insert ───────────────────────────────────────────────────────
            row = (await db.execute(
                text(
                    "INSERT INTO appointments "
                    "  (customer_id, barber_id, service_id, "
                    "   appointment_date, start_time, end_time, status) "
                    "VALUES "
                    "  (:cid, :bid, :sid, :d, :start_t, :end_t, 'confirmed') "
                    "RETURNING id, created_at"
                ),
                {
                    "cid": customer_id, "bid": barber_id, "sid": service_id,
                    "d": appt_date, "start_t": appt_time, "end_t": end_time,
                },
            )).mappings().one()

    result = _ok({
        "appointment_id": row["id"],
        "customer_id": customer_id,
        "barber": barber["name"],
        "service": svc["name"],
        "price": float(svc["price"]),
        "date": date,
        "start_time": time,
        "end_time": _fmt_time(end_time),
        "duration_minutes": duration,
        "status": "confirmed",
        "created_at": row["created_at"].isoformat(),
        "message": (
            f"Booked! See you on {_fmt_date(appt_date)} at {time} "
            f"with {barber['name']} for a {svc['name']}."
        ),
    })

    if customer_email:
        fire_and_forget(
            send_booking_confirmation(customer_email, customer_name or "there", result["data"])
        )

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 5. get_my_appointments
# ─────────────────────────────────────────────────────────────────────────────

async def get_my_appointments(customer_id: str) -> dict:
    """Return all upcoming confirmed appointments for this customer."""
    try:
        uuid.UUID(customer_id)
    except (ValueError, AttributeError):
        return _err("Invalid customer ID.")

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            text(
                "SELECT "
                "  a.id, a.appointment_date, a.start_time, a.end_time, "
                "  a.status, a.notes, "
                "  b.name AS barber_name, "
                "  s.name AS service_name, s.price, s.duration_minutes "
                "FROM appointments a "
                "JOIN barbers  b ON b.id = a.barber_id "
                "JOIN services s ON s.id = a.service_id "
                "WHERE a.customer_id = :cid "
                "  AND a.status = 'confirmed' "
                "  AND a.appointment_date >= CURRENT_DATE "
                "ORDER BY a.appointment_date, a.start_time"
            ),
            {"cid": customer_id},
        )).mappings().all()

    if not rows:
        return _ok({
            "appointments": [],
            "count": 0,
            "message": "You have no upcoming appointments.",
        })

    return _ok({
        "appointments": [
            {
                "id": r["id"],
                "date": r["appointment_date"].isoformat(),
                "start_time": _fmt_time(r["start_time"]),
                "end_time": _fmt_time(r["end_time"]),
                "barber": r["barber_name"],
                "service": r["service_name"],
                "price": float(r["price"]),
                "duration_minutes": r["duration_minutes"],
                "status": r["status"],
                "notes": r["notes"],
            }
            for r in rows
        ],
        "count": len(rows),
    })


# ─────────────────────────────────────────────────────────────────────────────
# 6. cancel_appointment
# ─────────────────────────────────────────────────────────────────────────────

async def cancel_appointment(
    appointment_id: int,
    customer_id: str,
    customer_email: str = "",
    customer_name: str = "",
) -> dict:
    """
    Cancel an appointment.
    Checks: appointment exists, belongs to this customer, is still confirmed.
    """
    try:
        uuid.UUID(customer_id)
    except (ValueError, AttributeError):
        return _err("Invalid customer ID.")

    async with AsyncSessionLocal() as db:
        async with db.begin():
            row = (await db.execute(
                text(
                    "SELECT "
                    "  a.id, a.customer_id, a.status, "
                    "  a.appointment_date, a.start_time, "
                    "  b.name AS barber_name, "
                    "  s.name AS service_name "
                    "FROM appointments a "
                    "JOIN barbers  b ON b.id = a.barber_id "
                    "JOIN services s ON s.id = a.service_id "
                    "WHERE a.id = :appt_id"
                ),
                {"appt_id": appointment_id},
            )).mappings().one_or_none()

            if row is None:
                return _err(f"Appointment #{appointment_id} not found.")

            if str(row["customer_id"]) != customer_id:
                return _err("You can only cancel your own appointments.")

            if row["status"] == "cancelled":
                return _err("This appointment is already cancelled.")

            if row["status"] in ("completed", "no_show"):
                return _err(
                    f"Cannot cancel a {row['status'].replace('_', ' ')} appointment."
                )

            await db.execute(
                text(
                    "UPDATE appointments SET status = 'cancelled' "
                    "WHERE id = :appt_id"
                ),
                {"appt_id": appointment_id},
            )

    cancelled_details = {
        "barber": row["barber_name"],
        "service": row["service_name"],
        "date": row["appointment_date"].isoformat(),
        "start_time": _fmt_time(row["start_time"]),
    }

    result = _ok({
        "cancelled": True,
        "appointment_id": appointment_id,
        **cancelled_details,
        "message": (
            f"Cancelled your {row['service_name']} with {row['barber_name']} "
            f"on {_fmt_date(row['appointment_date'])} at "
            f"{_fmt_time(row['start_time'])}."
        ),
    })

    if customer_email:
        fire_and_forget(
            send_cancellation_email(customer_email, customer_name or "there", cancelled_details)
        )

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 7. reschedule_appointment
# ─────────────────────────────────────────────────────────────────────────────

async def reschedule_appointment(
    appointment_id: int,
    customer_id: str,
    new_date: str,          # "YYYY-MM-DD"
    new_time: str,          # "HH:MM"
    customer_email: str = "",
    customer_name: str = "",
) -> dict:
    """
    Move an appointment to a new date/time.
    Validates ownership, new slot availability, and working hours.
    Runs entirely in a single transaction.
    """
    try:
        uuid.UUID(customer_id)
    except (ValueError, AttributeError):
        return _err("Invalid customer ID.")

    new_date = resolve_date(new_date)  # handle relative expressions ("next Saturday")
    appt_date = _parse_date(new_date)
    if appt_date is None:
        return _err(f"Invalid date '{new_date}'. Use YYYY-MM-DD format.")
    if appt_date < datetime.now().date():
        return _err("Cannot reschedule to a past date.")

    appt_time = _parse_time(new_time)
    if appt_time is None:
        return _err(f"Invalid time '{new_time}'. Use HH:MM format.")

    async with AsyncSessionLocal() as db:
        async with db.begin():
            # ── fetch the appointment with joined details ─────────────────────
            row = (await db.execute(
                text(
                    "SELECT "
                    "  a.id, a.customer_id, a.barber_id, a.service_id, a.status, "
                    "  a.appointment_date AS old_date, a.start_time AS old_start_time, "
                    "  b.name AS barber_name, "
                    "  s.name AS service_name, s.duration_minutes "
                    "FROM appointments a "
                    "JOIN barbers  b ON b.id = a.barber_id "
                    "JOIN services s ON s.id = a.service_id "
                    "WHERE a.id = :appt_id"
                ),
                {"appt_id": appointment_id},
            )).mappings().one_or_none()

            if row is None:
                return _err(f"Appointment #{appointment_id} not found.")

            if str(row["customer_id"]) != customer_id:
                return _err("You can only reschedule your own appointments.")

            if row["status"] != "confirmed":
                return _err(
                    f"Cannot reschedule a {row['status'].replace('_', ' ')} appointment."
                )

            # ── same date/time check ──────────────────────────────────────────
            if appt_date == row["old_date"] and appt_time == row["old_start_time"]:
                return _err(
                    f"Your appointment is already scheduled for {_fmt_date(appt_date)} "
                    f"at {new_time}. No changes were made."
                )

            barber_id = row["barber_id"]
            duration  = row["duration_minutes"]
            start_m   = _to_min(appt_time)
            end_m     = start_m + duration
            new_end   = _from_min(end_m)

            # ── barber schedule on the new day ────────────────────────────────
            dow = appt_date.weekday()
            sched = (await db.execute(
                text(
                    "SELECT start_time, end_time, is_available "
                    "FROM barber_schedules "
                    "WHERE barber_id = :bid AND day_of_week = :dow"
                ),
                {"bid": barber_id, "dow": dow},
            )).mappings().one_or_none()

            if sched is None or not sched["is_available"]:
                return _err(
                    f"{row['barber_name']} does not work on "
                    f"{appt_date.strftime('%A')}s."
                )

            work_start = _to_min(sched["start_time"])
            work_end   = _to_min(sched["end_time"])

            if start_m < work_start or end_m > work_end:
                return _err(
                    f"Requested time is outside {row['barber_name']}'s working hours "
                    f"({_fmt_time(sched['start_time'])} – "
                    f"{_fmt_time(sched['end_time'])})."
                )

            # ── conflict check (exclude the appointment being rescheduled) ────
            conflict = (await db.execute(
                text(
                    "SELECT id FROM appointments "
                    "WHERE barber_id = :bid "
                    "  AND appointment_date = :d "
                    "  AND id != :appt_id "
                    "  AND status != 'cancelled' "
                    "  AND start_time < :end_t "
                    "  AND end_time   > :start_t "
                    "FOR UPDATE"
                ),
                {
                    "bid": barber_id, "d": appt_date,
                    "appt_id": appointment_id,
                    "start_t": appt_time, "end_t": new_end,
                },
            )).one_or_none()

            if conflict is not None:
                return _err(
                    "That new time slot is not available. "
                    "Please choose another slot."
                )

            # ── update ────────────────────────────────────────────────────────
            await db.execute(
                text(
                    "UPDATE appointments "
                    "SET appointment_date = :new_date, "
                    "    start_time = :new_start, "
                    "    end_time   = :new_end "
                    "WHERE id = :appt_id"
                ),
                {
                    "new_date": appt_date,
                    "new_start": appt_time,
                    "new_end": new_end,
                    "appt_id": appointment_id,
                },
            )

    old_details = {
        "date": row["old_date"].isoformat(),
        "start_time": _fmt_time(row["old_start_time"]),
    }
    new_details = {
        "barber": row["barber_name"],
        "service": row["service_name"],
        "new_date": new_date,
        "new_start_time": new_time,
        "new_end_time": _fmt_time(new_end),
        "duration_minutes": duration,
    }

    result = _ok({
        "rescheduled": True,
        "appointment_id": appointment_id,
        **new_details,
        "old_date": old_details["date"],
        "old_start_time": old_details["start_time"],
        "message": (
            f"Rescheduled your {row['service_name']} with {row['barber_name']} "
            f"to {_fmt_date(appt_date)} at {new_time}."
        ),
    })

    if customer_email:
        fire_and_forget(
            send_reschedule_email(
                customer_email, customer_name or "there", old_details, new_details
            )
        )

    return result
