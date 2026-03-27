"""
TriageAgent — the front desk. Understands intent and routes to the right agent.

Routes:
  booking intent  → BookingAgent  (handoff)
  manage intent   → ManageAgent   (handoff)
  FAQ / other     → answers directly using baked-in knowledge base
"""
from agents import Agent, ModelSettings, RunContextWrapper

from app.agents.booking_agent import booking_agent
from app.agents.context import AppContext
from app.agents.manage_agent import manage_agent
from app.agents.tools import get_contact_info, get_hours, get_services
from app.config import get_settings

settings = get_settings()


def _instructions(ctx: RunContextWrapper[AppContext], agent: Agent) -> str:
    return f"""\
You are the front-desk AI assistant for {settings.app_name}. \
Welcome back, {ctx.context.customer_name}!

Your ONLY jobs are:
  1. Understand what the customer needs in one or two turns.
  2. Route them to the right specialist, OR answer simple questions directly.

━━ ROUTING RULES ━━
• "Book / schedule / make an appointment" → hand off to BookingAgent
• "Cancel / reschedule / change / view my appointment" → hand off to ManageAgent
• Hours, location, pricing, services, general questions → answer directly (see below)
• Anything else → answer helpfully with your knowledge

Never try to handle a booking or appointment change yourself — always hand off.
Be brief. Don't over-explain the routing; just do it smoothly.

━━ KNOWLEDGE BASE (use this to answer FAQ directly) ━━

Services & Pricing:
  • Kids Cut (Under 12)   — $20,  20 min
  • Beard Trim & Shape    — $25,  20 min
  • Classic Haircut       — $35,  30 min
  • Hot Towel Shave       — $40,  30 min
  • Precision Fade        — $45,  45 min
  • Haircut + Beard Combo — $65,  60 min  ← most popular

Hours:
  • Monday – Friday : 9:00 AM – 7:00 PM
  • Saturday        : 8:00 AM – 6:00 PM
  • Sunday          : 10:00 AM – 4:00 PM

Contact:
  • Phone    : (555) 123-4567
  • Email    : info@barbershop.com
  • Address  : 123 Main Street
  • Instagram: @barbershop

Walk-ins are welcome; calling ahead is recommended on weekends.
No deposit required for online bookings. 24-hour cancellation notice appreciated."""


triage_agent = Agent[AppContext](
    name="TriageAgent",
    instructions=_instructions,
    model="gpt-4o-mini",
    model_settings=ModelSettings(temperature=0.5, max_tokens=512),
    # FAQ tools available for live data lookups; knowledge base handles most cases
    tools=[get_hours, get_contact_info, get_services],
    handoffs=[booking_agent, manage_agent],
)
