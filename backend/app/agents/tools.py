"""
OpenAI Agents SDK tool definitions for the barbershop booking system.

Design rules:
- Tools that need the authenticated customer's identity accept
  `ctx: RunContextWrapper[AppContext]` as their FIRST parameter.
  The SDK injects this automatically; the LLM never sees or provides it.
- Tools that are purely informational (FAQ, slot lookup) take no ctx param.
- Every tool returns a plain string — the LLM reads this as the tool result.
- Docstrings are parsed by the SDK to generate the tool description sent to
  the model, so they explain WHAT the tool does and WHEN to use it.
"""
import logging
from typing import Optional

from agents import RunContextWrapper, function_tool

from app.agents.context import AppContext
from app.tools.appointment_tools import (
    book_appointment as _book_appointment,
    cancel_appointment as _cancel_appointment,
    get_available_slots as _get_available_slots,
    get_barbers as _get_barbers,
    get_my_appointments as _get_my_appointments,
    get_services as _get_services,
    reschedule_appointment as _reschedule_appointment,
)

log = logging.getLogger(__name__)


# ── FAQ tools (no auth context needed) ───────────────────────────────────────

@function_tool
def get_hours() -> str:
    """
    Get the barbershop's current operating hours for every day of the week.
    Call this when a customer asks about opening times, closing times, or
    whether the shop is open on a specific day.
    """
    return (
        "Operating hours:\n"
        "• Monday – Friday : 9:00 AM – 7:00 PM\n"
        "• Saturday        : 8:00 AM – 6:00 PM\n"
        "• Sunday          : 10:00 AM – 4:00 PM"
    )


@function_tool
def get_contact_info() -> str:
    """
    Get the barbershop's contact details — phone number, email, and address.
    Call this when a customer asks how to reach us or where we are located.
    """
    return (
        "Contact:\n"
        "• Phone    : (555) 123-4567\n"
        "• Email    : info@barbershop.com\n"
        "• Address  : 123 Main Street\n"
        "• Instagram: @barbershop"
    )


# ── Booking tools (no auth context needed) ────────────────────────────────────

@function_tool
async def get_services() -> str:
    """
    Retrieve all active barbershop services with their IDs, names, prices,
    and durations from the live database.

    Call this first when a customer asks what services are available OR before
    starting the booking flow so the customer can choose a service.
    The returned IDs are required by get_available_slots and book_appointment.
    """
    result = await _get_services()
    if not result["ok"]:
        return f"Error fetching services: {result['error']}"

    lines = ["Available services:\n"]
    for s in result["data"]:
        desc = f"\n  {s['description']}" if s.get("description") else ""
        lines.append(
            f"• [ID {s['id']}] {s['name']} — ${s['price']:.2f}, "
            f"{s['duration_minutes']} min{desc}"
        )
    return "\n".join(lines)


@function_tool
async def get_barbers(specialty: Optional[str] = None) -> str:
    """
    Retrieve active barbers from the database, optionally filtered by specialty.

    Call this when:
    - The customer asks who is available or wants to choose a barber
    - The customer mentions a preference like 'fade', 'beard', or 'kids'
      (pass the keyword as specialty to filter results)

    The returned barber IDs are required by get_available_slots and book_appointment.

    Parameters:
        specialty: Optional skill keyword to filter by (e.g. 'fade', 'beard',
                   'kids_cuts', 'hot_towel_shave'). Leave empty to list all barbers.
    """
    result = await _get_barbers(specialty)
    if not result["ok"]:
        return f"Error fetching barbers: {result['error']}"

    barbers = result["data"]
    if not barbers:
        msg = f"No barbers found with specialty '{specialty}'." if specialty else "No barbers currently available."
        return msg + " Try another keyword or list all barbers."

    lines = ["Available barbers:\n"]
    for b in barbers:
        specs = ", ".join(b["specialties"]) if b["specialties"] else "general"
        lines.append(f"• [ID {b['id']}] {b['name']} — specialties: {specs}")
    return "\n".join(lines)


@function_tool
async def get_available_slots(barber_id: int, date: str, service_id: int) -> str:
    """
    Check open appointment slots for a barber, date, and service combination.

    Call this BEFORE booking to show the customer which times are available.
    The barber's working hours and the service duration are both accounted for
    automatically — slots that would run over closing time or clash with an
    existing appointment are excluded.

    Parameters:
        barber_id:  Barber's numeric ID (from get_barbers)
        date:       The date to check, in YYYY-MM-DD format (e.g. '2026-04-05').
                    Must be today or a future date.
        service_id: Service's numeric ID (from get_services)
    """
    result = await _get_available_slots(barber_id, date, service_id)
    if not result["ok"]:
        return f"Error: {result['error']}"

    data = result["data"]
    if not data["available"]:
        return (
            f"{data['message']}\n"
            "Suggestion: try a different day or a different barber."
        )

    slots = data["slots"]
    svc   = data["service"]
    if not slots:
        return (
            f"No open slots on {date} for {svc['name']} ({svc['duration_minutes']} min).\n"
            "Suggestion: try the next day or a different barber."
        )

    return (
        f"Open slots on {date} — {svc['name']} ({svc['duration_minutes']} min)\n"
        f"Working hours: {data['working_hours']}\n\n"
        f"Available times: {', '.join(slots)}"
    )


# ── Auth-context tools (customer_id injected from RunContextWrapper) ──────────

@function_tool
async def book_appointment(
    ctx: RunContextWrapper[AppContext],
    barber_id: int,
    service_id: int,
    date: str,
    time: str,
) -> str:
    """
    Book a confirmed appointment for the authenticated customer.

    IMPORTANT — only call this after ALL of the following are true:
    1. The customer has chosen a service  (use get_services to list options)
    2. The customer has chosen a barber   (use get_barbers)
    3. The customer has chosen a date
    4. The customer has chosen a time     (verified via get_available_slots)
    5. You have shown a full summary and the customer has explicitly confirmed

    customer_id, customer_email, and customer_name are injected automatically
    from the session context — never ask the user for them.

    Parameters:
        barber_id:  Barber's numeric ID
        service_id: Service's numeric ID
        date:       Appointment date in YYYY-MM-DD format
        time:       Start time in HH:MM 24-hour format (e.g. '09:30')
    """
    result = await _book_appointment(
        customer_id=ctx.context.customer_id,
        barber_id=barber_id,
        service_id=service_id,
        date=date,
        time=time,
        customer_email=ctx.context.customer_email,
        customer_name=ctx.context.customer_name,
    )
    if not result["ok"]:
        return f"Booking failed: {result['error']}"

    d = result["data"]
    email_note = "\nA confirmation email has been sent." if ctx.context.customer_email else ""
    return (
        f"✓ Appointment booked!\n"
        f"  ID      : {d['appointment_id']}\n"
        f"  Service : {d['service']}\n"
        f"  Barber  : {d['barber']}\n"
        f"  Date    : {d['date']}\n"
        f"  Time    : {d['start_time']} – {d['end_time']} ({d['duration_minutes']} min)\n"
        f"  Price   : ${d['price']:.2f}\n"
        f"  Status  : {d['status']}"
        f"{email_note}"
    )


@function_tool
async def get_my_appointments(ctx: RunContextWrapper[AppContext]) -> str:
    """
    Retrieve all upcoming confirmed appointments for the authenticated customer.

    Call this first whenever the customer wants to view, cancel, or reschedule
    an existing appointment. The returned appointment IDs are needed by
    cancel_appointment and reschedule_appointment.
    """
    result = await _get_my_appointments(customer_id=ctx.context.customer_id)
    if not result["ok"]:
        return f"Error: {result['error']}"

    data = result["data"]
    if not data["appointments"]:
        return data.get("message", "You have no upcoming appointments.")

    lines = [f"Upcoming appointments ({data['count']}):\n"]
    for a in data["appointments"]:
        lines.append(
            f"• [ID {a['id']}] {a['service']} with {a['barber']}\n"
            f"  Date   : {a['date']} at {a['start_time']} – {a['end_time']}\n"
            f"  Price  : ${a['price']:.2f}"
        )
    return "\n".join(lines)


@function_tool
async def cancel_appointment(
    ctx: RunContextWrapper[AppContext],
    appointment_id: int,
) -> str:
    """
    Cancel an existing appointment for the authenticated customer.

    IMPORTANT:
    1. Always call get_my_appointments first to find the correct appointment ID
    2. Show the appointment details to the customer
    3. Ask "Are you sure you want to cancel [service] with [barber] on [date]?"
    4. Only call this function AFTER the customer explicitly confirms

    Parameters:
        appointment_id: The numeric appointment ID (from get_my_appointments)
    """
    result = await _cancel_appointment(
        appointment_id=appointment_id,
        customer_id=ctx.context.customer_id,
        customer_email=ctx.context.customer_email,
        customer_name=ctx.context.customer_name,
    )
    if not result["ok"]:
        return f"Cancellation failed: {result['error']}"

    d = result["data"]
    email_note = "\nA cancellation email has been sent." if ctx.context.customer_email else ""
    return (
        f"✓ Appointment cancelled.\n"
        f"  {d.get('service', '')} with {d.get('barber', '')} "
        f"on {d.get('date', '')} at {d.get('start_time', '')} — cancelled."
        f"{email_note}"
    )


@function_tool
async def reschedule_appointment(
    ctx: RunContextWrapper[AppContext],
    appointment_id: int,
    new_date: str,
    new_time: str,
) -> str:
    """
    Reschedule an existing appointment to a new date and time.

    IMPORTANT — follow this sequence:
    1. Call get_my_appointments to get the appointment ID and current details
    2. Ask the customer for their preferred new date and time
    3. Call get_available_slots to confirm the new slot is open
    4. Show old → new summary and ask the customer to confirm
    5. Only then call this function

    Parameters:
        appointment_id: The numeric appointment ID (from get_my_appointments)
        new_date:       New date in YYYY-MM-DD format
        new_time:       New start time in HH:MM 24-hour format (e.g. '14:00')
    """
    result = await _reschedule_appointment(
        appointment_id=appointment_id,
        customer_id=ctx.context.customer_id,
        new_date=new_date,
        new_time=new_time,
        customer_email=ctx.context.customer_email,
        customer_name=ctx.context.customer_name,
    )
    if not result["ok"]:
        return f"Reschedule failed: {result['error']}"

    d = result["data"]
    email_note = "\nA reschedule confirmation email has been sent." if ctx.context.customer_email else ""
    return (
        f"✓ Appointment rescheduled.\n"
        f"  Service : {d.get('service', '')}\n"
        f"  Barber  : {d.get('barber', '')}\n"
        f"  Was     : {d.get('old_date', '')} at {d.get('old_start_time', '')}\n"
        f"  Now     : {d['new_date']} at {d['new_start_time']} – {d['new_end_time']}"
        f"{email_note}"
    )
