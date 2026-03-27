"""
Edge case test suite for the barbershop appointment tools.

Run from the backend/ directory:
    python test_edge_cases.py

Tests:
  1. Race condition    — SELECT FOR UPDATE + conflict detection path
  2. Past date         — book / reschedule rejects yesterday
  3. Closed day        — barber not available on requested day
  4. No slots          — all slots taken, empty list returned
  5. Mid-flow change   — BookingAgent / ManageAgent carry FAQ tools
  6. Cancel nothing    — cancel with no appointments returns graceful error
  7. Reschedule same   — rescheduling to the exact same date/time is rejected
  8. Already cancelled — cancelling a cancelled appointment returns graceful error

All tests except #5 use mocked DB sessions — no live database required.
"""
import asyncio
import sys
import os
import traceback
from datetime import date, time, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

from dotenv import load_dotenv
load_dotenv()

# ── Output helpers ────────────────────────────────────────────────────────────

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
INFO = "\033[94m→\033[0m"
results: list[tuple[str, bool, str]] = []


def ok(name: str, detail: str = "") -> None:
    print(f"  {PASS} {name}" + (f"  [{detail}]" if detail else ""))
    results.append((name, True, detail))


def fail(name: str, detail: str = "") -> None:
    print(f"  {FAIL} {name}  ERROR: {detail}")
    results.append((name, False, detail))


def section(title: str) -> None:
    print(f"\n{'─'*60}")
    print(f"  {INFO} {title}")
    print(f"{'─'*60}")


# ── DB mock infrastructure ────────────────────────────────────────────────────

class _MappingResult:
    """Wraps a value to support both .mappings()... and direct .one_or_none()."""

    def __init__(self, data):
        self._data = data

    # Called via .mappings() chain
    def mappings(self):
        return self

    def all(self) -> list:
        if isinstance(self._data, list):
            return self._data
        return [self._data] if self._data is not None else []

    def one_or_none(self):
        if isinstance(self._data, list):
            return self._data[0] if self._data else None
        return self._data

    def one(self):
        return self._data


def _make_session(execute_sequence: list):
    """
    Build a mock async DB session whose execute() calls return values from
    execute_sequence in order.  Each element is returned as a _MappingResult.
    """
    call_idx = [0]

    async def _execute(query, params=None):
        idx = call_idx[0]
        call_idx[0] += 1
        data = execute_sequence[idx] if idx < len(execute_sequence) else None
        return _MappingResult(data)

    db = AsyncMock()
    db.execute = _execute

    # db.begin() → trivial async context manager (commit/rollback are no-ops)
    txn_cm = AsyncMock()
    txn_cm.__aenter__ = AsyncMock(return_value=txn_cm)
    txn_cm.__aexit__ = AsyncMock(return_value=False)
    db.begin = MagicMock(return_value=txn_cm)

    return db


def _patch_db(execute_sequence: list):
    """
    Return a context manager that replaces AsyncSessionLocal for one test.
    Usage:
        with _patch_db([...]):
            result = await some_tool_fn(...)
    """
    db = _make_session(execute_sequence)

    session_cm = AsyncMock()
    session_cm.__aenter__ = AsyncMock(return_value=db)
    session_cm.__aexit__ = AsyncMock(return_value=False)

    mock_factory = MagicMock(return_value=session_cm)
    return patch("app.tools.appointment_tools.AsyncSessionLocal", mock_factory)


# ── Shared test data ──────────────────────────────────────────────────────────

CUST_ID    = str(uuid.uuid4())
BARBER_ID  = 1
SERVICE_ID = 3
TOMORROW   = (date.today() + timedelta(days=1)).isoformat()
YESTERDAY  = (date.today() - timedelta(days=1)).isoformat()

# A working schedule Mon-Sat
_SCHED = {"start_time": time(9, 0), "end_time": time(17, 0), "is_available": True}
_CLOSED = {"start_time": time(9, 0), "end_time": time(17, 0), "is_available": False}
_SVC   = {"id": SERVICE_ID, "name": "Classic Haircut", "duration_minutes": 30, "price": "35.00"}
_BARBER = {"id": BARBER_ID, "name": "Alex"}
_APPT_ROW = {
    "id": 42,
    "customer_id": uuid.UUID(CUST_ID),
    "barber_id": BARBER_ID,
    "service_id": SERVICE_ID,
    "status": "confirmed",
    "old_date": date.today() + timedelta(days=1),
    "old_start_time": time(10, 0),
    "barber_name": "Alex",
    "service_name": "Classic Haircut",
    "duration_minutes": 30,
    "appointment_date": date.today() + timedelta(days=1),
    "start_time": time(10, 0),
}
_INSERT_ROW = {"id": 99, "created_at": datetime.now()}


# ═════════════════════════════════════════════════════════════════════════════
# 1. Race condition — SELECT FOR UPDATE + conflict detection
# ═════════════════════════════════════════════════════════════════════════════

async def test_race_condition() -> None:
    section("1 · Race condition — SELECT FOR UPDATE + conflict detection")

    from app.tools.appointment_tools import book_appointment

    # 1a. Verify SELECT FOR UPDATE is present in the source
    import inspect
    src = inspect.getsource(book_appointment)
    if "FOR UPDATE" in src:
        ok("SELECT FOR UPDATE present in book_appointment source")
    else:
        fail("SELECT FOR UPDATE missing from book_appointment source")

    # 1b. Simulate first booking succeeding (no conflict in SELECT FOR UPDATE)
    seq_success = [_SVC, _BARBER, _SCHED, None, _INSERT_ROW]
    with _patch_db(seq_success):
        result = await book_appointment(
            customer_id=CUST_ID,
            barber_id=BARBER_ID,
            service_id=SERVICE_ID,
            date=TOMORROW,
            time="10:00",
        )
    if result["ok"]:
        ok("First booking succeeds (no conflict)", f"appt_id={result['data']['appointment_id']}")
    else:
        fail("First booking unexpectedly failed", result.get("error", ""))

    # 1c. Simulate second concurrent booking hitting the conflict row
    seq_conflict = [_SVC, _BARBER, _SCHED, {"id": 42}]  # SELECT FOR UPDATE finds a row
    with _patch_db(seq_conflict):
        result = await book_appointment(
            customer_id=CUST_ID,
            barber_id=BARBER_ID,
            service_id=SERVICE_ID,
            date=TOMORROW,
            time="10:00",
        )
    if not result["ok"] and "no longer available" in result["error"]:
        ok("Second concurrent booking rejected correctly", result["error"])
    else:
        fail("Concurrent booking should have been rejected", str(result))


# ═════════════════════════════════════════════════════════════════════════════
# 2. Past date — book and reschedule both reject yesterday
# ═════════════════════════════════════════════════════════════════════════════

async def test_past_date() -> None:
    section("2 · Past date rejection")

    from app.tools.appointment_tools import book_appointment, reschedule_appointment

    # 2a. book_appointment with yesterday
    result = await book_appointment(
        customer_id=CUST_ID,
        barber_id=BARBER_ID,
        service_id=SERVICE_ID,
        date=YESTERDAY,
        time="10:00",
    )
    if not result["ok"] and "past" in result["error"].lower():
        ok("book_appointment rejects past date", result["error"])
    else:
        fail("book_appointment should reject past date", str(result))

    # 2b. reschedule_appointment with yesterday
    result = await reschedule_appointment(
        appointment_id=42,
        customer_id=CUST_ID,
        new_date=YESTERDAY,
        new_time="10:00",
    )
    if not result["ok"] and "past" in result["error"].lower():
        ok("reschedule_appointment rejects past date", result["error"])
    else:
        fail("reschedule_appointment should reject past date", str(result))

    # 2c. get_available_slots with yesterday
    from app.tools.appointment_tools import get_available_slots
    result = await get_available_slots(barber_id=BARBER_ID, date=YESTERDAY, service_id=SERVICE_ID)
    if not result["ok"] and "past" in result["error"].lower():
        ok("get_available_slots rejects past date", result["error"])
    else:
        fail("get_available_slots should reject past date", str(result))

    # 2d. Invalid date format
    result = await book_appointment(
        customer_id=CUST_ID,
        barber_id=BARBER_ID,
        service_id=SERVICE_ID,
        date="not-a-date",
        time="10:00",
    )
    if not result["ok"] and "invalid date" in result["error"].lower():
        ok("book_appointment rejects invalid date format", result["error"])
    else:
        fail("book_appointment should reject invalid date format", str(result))

    # 2e. Invalid time format
    result = await book_appointment(
        customer_id=CUST_ID,
        barber_id=BARBER_ID,
        service_id=SERVICE_ID,
        date=TOMORROW,
        time="99:99",
    )
    if not result["ok"] and "invalid time" in result["error"].lower():
        ok("book_appointment rejects invalid time format", result["error"])
    else:
        fail("book_appointment should reject invalid time format", str(result))

    # 2f. Invalid customer UUID
    result = await book_appointment(
        customer_id="not-a-uuid",
        barber_id=BARBER_ID,
        service_id=SERVICE_ID,
        date=TOMORROW,
        time="10:00",
    )
    if not result["ok"] and "invalid customer" in result["error"].lower():
        ok("book_appointment rejects invalid customer UUID", result["error"])
    else:
        fail("book_appointment should reject invalid customer UUID", str(result))


# ═════════════════════════════════════════════════════════════════════════════
# 3. Closed day — barber not available on requested weekday
# ═════════════════════════════════════════════════════════════════════════════

async def test_closed_day() -> None:
    section("3 · Closed day — barber unavailable on requested day")

    from app.tools.appointment_tools import get_available_slots

    # Mock: barber schedule has is_available=False
    with _patch_db([_CLOSED]):
        result = await get_available_slots(
            barber_id=BARBER_ID,
            date=TOMORROW,
            service_id=SERVICE_ID,
        )

    if result["ok"] and not result["data"]["available"] and "does not work" in result["data"]["message"]:
        ok("Closed day returns available=False with explanation", result["data"]["message"])
    else:
        fail("Closed day not handled correctly", str(result))

    # Also verify book_appointment rejects a closed day
    seq = [_SVC, _BARBER, _CLOSED]
    with _patch_db(seq):
        result = await __import__(
            "app.tools.appointment_tools", fromlist=["book_appointment"]
        ).book_appointment(
            customer_id=CUST_ID,
            barber_id=BARBER_ID,
            service_id=SERVICE_ID,
            date=TOMORROW,
            time="10:00",
        )
    if not result["ok"] and "does not work" in result["error"]:
        ok("book_appointment rejects closed day", result["error"])
    else:
        fail("book_appointment should reject closed day", str(result))


# ═════════════════════════════════════════════════════════════════════════════
# 4. No slots — all time blocks are taken
# ═════════════════════════════════════════════════════════════════════════════

async def test_no_slots() -> None:
    section("4 · No slots — all slots booked for the day")

    from app.tools.appointment_tools import get_available_slots

    # One "mega" booking that covers the entire working day blocks every slot
    fully_booked = [{"start_time": time(9, 0), "end_time": time(17, 0)}]

    with _patch_db([_SCHED, _SVC, fully_booked]):
        result = await get_available_slots(
            barber_id=BARBER_ID,
            date=TOMORROW,
            service_id=SERVICE_ID,
        )

    if result["ok"] and result["data"]["available"] and result["data"]["slots"] == []:
        ok("No slots: returns empty list", result["data"]["message"])
    else:
        fail("No slots: unexpected result", str(result))


# ═════════════════════════════════════════════════════════════════════════════
# 5. Mid-flow change — agents carry FAQ tools
# ═════════════════════════════════════════════════════════════════════════════

async def test_midflow_context_switch() -> None:
    section("5 · Mid-flow change — agents carry FAQ tools for context switches")

    from app.agents.booking_agent import booking_agent
    from app.agents.manage_agent import manage_agent

    for agent in [booking_agent, manage_agent]:
        tool_names = [t.name for t in (agent.tools or [])]
        if "get_hours" in tool_names and "get_contact_info" in tool_names:
            ok(
                f"{agent.name} has get_hours + get_contact_info",
                f"all tools: {tool_names}",
            )
        else:
            fail(
                f"{agent.name} missing FAQ tools",
                f"tools found: {tool_names}",
            )


# ═════════════════════════════════════════════════════════════════════════════
# 6. Cancel non-existent — no appointments, graceful error
# ═════════════════════════════════════════════════════════════════════════════

async def test_cancel_nonexistent() -> None:
    section("6 · Cancel non-existent appointment")

    from app.tools.appointment_tools import cancel_appointment, get_my_appointments

    # 6a. get_my_appointments returns empty list
    with _patch_db([[]]):
        result = await get_my_appointments(customer_id=CUST_ID)

    if result["ok"] and result["data"]["count"] == 0:
        ok("get_my_appointments returns empty list gracefully", result["data"]["message"])
    else:
        fail("get_my_appointments should return empty gracefully", str(result))

    # 6b. cancel_appointment with a non-existent ID
    with _patch_db([None]):  # query returns nothing
        result = await cancel_appointment(
            appointment_id=99999,
            customer_id=CUST_ID,
        )

    if not result["ok"] and "not found" in result["error"]:
        ok("cancel_appointment: non-existent appointment rejected", result["error"])
    else:
        fail("cancel_appointment should reject non-existent ID", str(result))


# ═════════════════════════════════════════════════════════════════════════════
# 7. Reschedule to same date/time — gracefully rejected
# ═════════════════════════════════════════════════════════════════════════════

async def test_reschedule_same_time() -> None:
    section("7 · Reschedule to same date/time — no changes needed")

    from app.tools.appointment_tools import reschedule_appointment

    tomorrow = date.today() + timedelta(days=1)

    # The DB row has old_date=tomorrow, old_start_time=10:00
    same_appt = dict(_APPT_ROW)  # copy

    with _patch_db([same_appt]):
        result = await reschedule_appointment(
            appointment_id=42,
            customer_id=CUST_ID,
            new_date=tomorrow.isoformat(),
            new_time="10:00",   # same as old_start_time
        )

    if not result["ok"] and "no changes were made" in result["error"].lower():
        ok("Reschedule to same time rejected gracefully", result["error"])
    else:
        fail("Reschedule to same time should be rejected", str(result))

    # Sanity: different time on same day should NOT be blocked by this check
    # (it would proceed to DB conflict check — we don't need to test further here)
    # Just verify the error is absent for a different time
    with _patch_db([same_appt, _CLOSED]):  # _CLOSED triggers "not available" after same-time check passes
        result2 = await reschedule_appointment(
            appointment_id=42,
            customer_id=CUST_ID,
            new_date=tomorrow.isoformat(),
            new_time="11:00",   # different time
        )
    # Should NOT be the same-time error (it will be a different error)
    if not (not result2["ok"] and "no changes were made" in result2.get("error", "").lower()):
        ok("Different time is not caught by same-time check")
    else:
        fail("Different time should not trigger same-time error", str(result2))


# ═════════════════════════════════════════════════════════════════════════════
# 8. Already cancelled — double-cancel rejected gracefully
# ═════════════════════════════════════════════════════════════════════════════

async def test_already_cancelled() -> None:
    section("8 · Already cancelled — double-cancel rejected gracefully")

    from app.tools.appointment_tools import cancel_appointment

    # Build an appointment row with status='cancelled'
    cancelled_row = {
        "id": 42,
        "customer_id": uuid.UUID(CUST_ID),
        "status": "cancelled",
        "appointment_date": date.today() + timedelta(days=1),
        "start_time": time(10, 0),
        "barber_name": "Alex",
        "service_name": "Classic Haircut",
    }

    with _patch_db([cancelled_row]):
        result = await cancel_appointment(
            appointment_id=42,
            customer_id=CUST_ID,
        )

    if not result["ok"] and "already cancelled" in result["error"].lower():
        ok("Double-cancel rejected gracefully", result["error"])
    else:
        fail("Double-cancel should be rejected", str(result))

    # Also test cancelling a completed appointment
    completed_row = dict(cancelled_row)
    completed_row["status"] = "completed"

    with _patch_db([completed_row]):
        result = await cancel_appointment(
            appointment_id=42,
            customer_id=CUST_ID,
        )

    if not result["ok"] and "completed" in result["error"].lower():
        ok("Cancelling completed appointment rejected gracefully", result["error"])
    else:
        fail("Cancelling completed appointment should be rejected", str(result))


# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════

async def main() -> None:
    print("\n" + "═"*60)
    print("  BarberShop — Edge Case Test Suite")
    print("═"*60)

    await test_race_condition()
    await test_past_date()
    await test_closed_day()
    await test_no_slots()
    await test_midflow_context_switch()
    await test_cancel_nonexistent()
    await test_reschedule_same_time()
    await test_already_cancelled()

    # ── Summary ───────────────────────────────────────────────────────────────
    total  = len(results)
    passed = sum(1 for _, ok_, _ in results if ok_)
    failed = total - passed

    print(f"\n{'═'*60}")
    print(f"  Results: {passed}/{total} passed", end="")
    if failed:
        print(f"  ({failed} failed)")
        for name, ok_, detail in results:
            if not ok_:
                print(f"    {FAIL} {name}: {detail[:120]}")
    else:
        print("  — all green ✓")
    print("═"*60 + "\n")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
