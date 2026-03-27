"""
End-to-end test suite for the barbershop multi-agent system.
Run from the backend/ directory:
    python test_e2e.py

Tests:
  1. Import integrity   — every module loads without circular-import errors
  2. DB tool functions  — live Neon DB calls (get_services, get_barbers, slots)
  3. REST endpoint data — raw tool results match expected schema
  4. Agent runner       — full triage → specialist → tool → response round-trip
     (uses real OpenAI API; requires OPENAI_API_KEY in .env)
"""
import asyncio
import sys
import os
import traceback
from datetime import date, timedelta

# ── Bootstrap (load .env, propagate OPENAI_API_KEY) ──────────────────────────
from dotenv import load_dotenv
load_dotenv()

from app.config import get_settings
settings = get_settings()
if settings.openai_api_key:
    os.environ.setdefault("OPENAI_API_KEY", settings.openai_api_key)

# ── Helpers ───────────────────────────────────────────────────────────────────

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


# ═════════════════════════════════════════════════════════════════════════════
# 1. Import integrity
# ═════════════════════════════════════════════════════════════════════════════

def test_imports() -> None:
    section("1 · Import integrity")
    modules = [
        ("app.agents.context",       "AppContext"),
        ("app.agents.tools",         "book_appointment"),
        ("app.agents.booking_agent", "booking_agent"),
        ("app.agents.manage_agent",  "manage_agent"),
        ("app.agents.triage_agent",  "triage_agent"),
        ("app.agents.runner",        "run_agent"),
        ("app.tools.appointment_tools", "get_services"),
        ("app.services.email_service",  "send_booking_confirmation"),
        ("app.routers.appointments",    "router"),
    ]
    for module, attr in modules:
        try:
            mod = __import__(module, fromlist=[attr])
            assert hasattr(mod, attr), f"missing attribute '{attr}'"
            ok(module)
        except Exception as exc:
            fail(module, str(exc))


# ═════════════════════════════════════════════════════════════════════════════
# 2. DB tool functions
# ═════════════════════════════════════════════════════════════════════════════

async def test_db_tools() -> None:
    section("2 · DB tool functions (live Neon)")

    from app.tools.appointment_tools import (
        get_services,
        get_barbers,
        get_available_slots,
    )

    # ── get_services ─────────────────────────────────────────────────────────
    try:
        result = await get_services()
        assert result["ok"], result.get("error")
        svcs = result["data"]
        assert len(svcs) >= 4, f"expected ≥4 services, got {len(svcs)}"
        assert all("price" in s and "duration_minutes" in s for s in svcs)
        ok("get_services", f"{len(svcs)} services found")
        for s in svcs:
            print(f"       • [{s['id']}] {s['name']}  ${s['price']}  {s['duration_minutes']} min")
    except Exception as exc:
        fail("get_services", traceback.format_exc(limit=3))

    # ── get_barbers ───────────────────────────────────────────────────────────
    try:
        result = await get_barbers()
        assert result["ok"], result.get("error")
        barbers = result["data"]
        assert len(barbers) >= 2, f"expected ≥2 barbers, got {len(barbers)}"
        ok("get_barbers", f"{len(barbers)} barbers found")
        for b in barbers:
            print(f"       • [{b['id']}] {b['name']}  {b['specialties']}")
    except Exception as exc:
        fail("get_barbers", traceback.format_exc(limit=3))

    # ── get_barbers(specialty) ────────────────────────────────────────────────
    try:
        result = await get_barbers("fade")
        assert result["ok"]
        ok("get_barbers(specialty='fade')", f"{len(result['data'])} match(es)")
    except Exception as exc:
        fail("get_barbers(specialty='fade')", str(exc))

    # ── get_available_slots ───────────────────────────────────────────────────
    try:
        # Use next Monday to guarantee it's a working day for all barbers
        today = date.today()
        days_until_monday = (7 - today.weekday()) % 7 or 7  # next Monday, not today
        next_monday = today + timedelta(days=days_until_monday)
        date_str = next_monday.isoformat()

        result = await get_available_slots(barber_id=1, date=date_str, service_id=1)
        assert result["ok"], result.get("error")
        data = result["data"]
        ok(
            f"get_available_slots(barber=1, date={date_str}, svc=1)",
            f"available={data.get('available')}  slots={len(data.get('slots', []))}",
        )
        if data.get("slots"):
            print(f"       First 5: {data['slots'][:5]}")
    except Exception as exc:
        fail("get_available_slots", traceback.format_exc(limit=3))


# ═════════════════════════════════════════════════════════════════════════════
# 3. Agent tool wrappers (SDK format)
# ═════════════════════════════════════════════════════════════════════════════

async def test_sdk_tools() -> None:
    section("3 · Agent SDK tool definitions")

    from app.agents.tools import (
        get_services, get_barbers, get_available_slots,
        get_hours, get_contact_info,
    )

    # These are @function_tool objects — they should be callable as tools
    for tool in [get_services, get_barbers, get_available_slots, get_hours, get_contact_info]:
        name = getattr(tool, "name", type(tool).__name__)
        try:
            assert hasattr(tool, "name"), "no .name attribute"
            assert hasattr(tool, "description"), "no .description"
            ok(f"@function_tool: {name}")
        except Exception as exc:
            fail(f"@function_tool: {name}", str(exc))

    # Check agent definitions loaded correctly
    from app.agents.booking_agent import booking_agent
    from app.agents.manage_agent  import manage_agent
    from app.agents.triage_agent  import triage_agent

    for agent in [booking_agent, manage_agent, triage_agent]:
        try:
            assert agent.name, "no name"
            assert agent.tools or agent.handoffs, "no tools or handoffs"
            tool_names  = [t.name for t in (agent.tools  or [])]
            handoff_names = [h.agent_name if hasattr(h, 'agent_name') else str(h)
                             for h in (agent.handoffs or [])]
            ok(
                f"Agent '{agent.name}'",
                f"tools={tool_names}  handoffs={handoff_names or '—'}",
            )
        except Exception as exc:
            fail(f"Agent '{agent.name}'", str(exc))


# ═════════════════════════════════════════════════════════════════════════════
# 4. Full agent runner — real OpenAI API calls
# ═════════════════════════════════════════════════════════════════════════════

async def test_agent_runner() -> None:
    section("4 · Multi-agent runner (live OpenAI API)")

    if not settings.openai_api_key:
        print(f"  {INFO} OPENAI_API_KEY not set — skipping runner tests")
        return

    from app.agents.runner import run_agent

    # Use a dummy customer_id (UUID format) — no real DB lookup in the runner
    CUST_ID    = "00000000-0000-0000-0000-000000000001"
    CUST_EMAIL = "test@example.com"
    CUST_NAME  = "Test Customer"

    cases = [
        (
            "FAQ routing — hours question",
            "What are your opening hours?",
            ["hour", "am", "pm", "monday", "saturday", "sunday"],
            None,  # no specific agent expected (triage answers directly)
        ),
        (
            "FAQ routing — services/pricing",
            "How much does a haircut cost?",
            ["$", "haircut", "fade", "35", "45"],
            None,
        ),
        (
            "Triage → BookingAgent handoff",
            "I want to book a haircut appointment",
            ["service", "barber", "date", "time", "available", "choose", "option"],
            "BookingAgent",
        ),
        (
            "Triage → ManageAgent handoff",
            "I want to cancel my appointment",
            ["appointment", "cancel", "upcoming"],
            "ManageAgent",
        ),
    ]

    for test_name, message, expected_keywords, expected_agent in cases:
        try:
            result = await run_agent(
                user_message=message,
                customer_id=CUST_ID,
                customer_email=CUST_EMAIL,
                customer_name=CUST_NAME,
            )
            content = result["content"].lower()
            resp_id = result.get("last_response_id", "—")
            agent   = result.get("agent", "—")
            tools   = result.get("tool_calls", [])

            # Check at least one expected keyword appears in the response
            matched = [kw for kw in expected_keywords if kw in content]
            assert matched, (
                f"None of {expected_keywords} found in response:\n{result['content'][:300]}"
            )

            # Check agent routing (if expected)
            if expected_agent:
                assert agent == expected_agent, (
                    f"Expected agent '{expected_agent}', got '{agent}'"
                )

            ok(
                test_name,
                f"agent={agent}  tools={tools}  keywords={matched[:3]}  resp_id={str(resp_id)[:16]}…",
            )
            print(f"       Response: {result['content'][:120].strip()}…")

        except AssertionError as exc:
            fail(test_name, str(exc))
        except Exception as exc:
            fail(test_name, traceback.format_exc(limit=4))


# ═════════════════════════════════════════════════════════════════════════════
# 5. Booking flow simulation — multi-turn
# ═════════════════════════════════════════════════════════════════════════════

async def test_booking_flow() -> None:
    section("5 · Booking flow simulation (multi-turn)")

    if not settings.openai_api_key:
        print(f"  {INFO} OPENAI_API_KEY not set — skipping")
        return

    from app.agents.runner import run_agent

    CUST_ID    = "00000000-0000-0000-0000-000000000002"
    CUST_EMAIL = "flow-test@example.com"
    CUST_NAME  = "Flow Tester"

    previous_response_id = None
    conversation = [
        ("book a haircut",        ["service", "choose", "option", "available"]),
        ("Classic Haircut please", ["barber", "date", "when", "prefer"]),
    ]

    for turn, (msg, keywords) in enumerate(conversation, 1):
        try:
            result = await run_agent(
                user_message=msg,
                customer_id=CUST_ID,
                customer_email=CUST_EMAIL,
                customer_name=CUST_NAME,
                previous_response_id=previous_response_id,
            )
            previous_response_id = result.get("last_response_id")
            content = result["content"].lower()
            matched = [kw for kw in keywords if kw in content]
            agent   = result.get("agent", "—")
            tools   = result.get("tool_calls", [])

            ok(
                f"Turn {turn}: '{msg}'",
                f"agent={agent}  tools={tools}  resp_id={str(previous_response_id or '')[:16]}",
            )
            print(f"       Response: {result['content'][:150].strip()}…")

            if not matched:
                print(f"       ⚠  None of {keywords} in response (non-fatal)")

        except Exception as exc:
            fail(f"Turn {turn}: '{msg}'", traceback.format_exc(limit=4))


# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════

async def main() -> None:
    print("\n" + "═"*60)
    print("  BarberShop Multi-Agent — End-to-End Test Suite")
    print("═"*60)

    test_imports()
    await test_db_tools()
    await test_sdk_tools()
    await test_agent_runner()
    await test_booking_flow()

    # ── Summary ───────────────────────────────────────────────────────────────
    total   = len(results)
    passed  = sum(1 for _, ok, _ in results if ok)
    failed  = total - passed

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
