"""
OpenAI Agents SDK service — barbershop AI assistant "Blade".

Architecture:
  - Agent defined once (singleton) with instructions + function tools
  - Runner.run()         → non-streaming response
  - Runner.run_streamed() → SSE streaming response
  - previous_response_id → server-side conversation chaining via Responses API
    (no need to replay full message history on every turn)

Conversation chaining:
  Each session stores last_response_id in the DB.
  Pass it back as previous_response_id on the next turn so OpenAI's server
  continues the same conversation context automatically.
  auto_previous_response_id=True handles the first turn gracefully.

Tools:
  get_services, get_hours, get_contact_info, get_booking_info
  — Give the agent reliable structured data to reference instead of
    baking it all into the system prompt.
"""
import logging
from typing import AsyncGenerator, Optional

from agents import Agent, ModelSettings, Runner, function_tool
from agents.exceptions import MaxTurnsExceeded, ModelBehaviorError
from openai import APIConnectionError, APIStatusError, RateLimitError
from openai.types.responses import ResponseTextDeltaEvent

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Function Tools ────────────────────────────────────────────────────────────

@function_tool
def get_services() -> str:
    """Get all available barbershop services with prices and estimated duration."""
    return (
        "Available services:\n"
        "• Classic Haircut        — $35,  ~45 min\n"
        "• Precision Fade         — $45,  ~50 min\n"
        "• Beard Trim & Shape     — $25,  ~30 min\n"
        "• Hot Towel Shave        — $40,  ~40 min\n"
        "• Hair + Beard Combo     — $65,  ~75 min  ⭐ Most Popular\n"
        "• Kids Cut (under 12)    — $20,  ~30 min"
    )


@function_tool
def get_hours() -> str:
    """Get the barbershop's current operating hours."""
    return (
        "Business hours:\n"
        "• Monday – Friday : 9:00 AM – 7:00 PM\n"
        "• Saturday        : 8:00 AM – 6:00 PM\n"
        "• Sunday          : 10:00 AM – 4:00 PM"
    )


@function_tool
def get_contact_info() -> str:
    """Get the barbershop's phone number, email, and address."""
    return (
        "Contact information:\n"
        "• Phone   : (555) 123-4567\n"
        "• Email   : info@barbershop.com\n"
        "• Address : 123 Main Street\n"
        "• Instagram: @barbershop"
    )


@function_tool
def get_booking_info() -> str:
    """Get information about booking or scheduling an appointment."""
    return (
        "How to book:\n"
        "• Call us at (555) 123-4567\n"
        "• Walk-ins are always welcome (subject to availability)\n"
        "• Best walk-in times: weekday mornings before 11 AM\n"
        "• Weekends are busy — calling ahead is recommended"
    )


# ── Agent singleton ───────────────────────────────────────────────────────────

_agent: Optional[Agent] = None


def get_agent() -> Agent:
    """Return the barbershop Agent, creating it once per process."""
    global _agent
    if _agent is None:
        _agent = Agent(
            name=settings.bot_name,
            instructions=settings.bot_system_prompt,
            model=settings.openai_model,
            model_settings=ModelSettings(
                temperature=0.7,
                max_tokens=settings.openai_max_tokens,
                parallel_tool_calls=True,
            ),
            tools=[get_services, get_hours, get_contact_info, get_booking_info],
        )
        logger.info("Barbershop agent '%s' initialised (model=%s)", settings.bot_name, settings.openai_model)
    return _agent


# ── Input builder (text + optional image) ────────────────────────────────────

def _build_input(user_message: str, file_data: Optional[dict]) -> str | list:
    """
    Build the Runner input.
    Plain string for text-only messages; multimodal list when a file is attached.
    """
    if not file_data:
        return user_message

    # Vision: image + text as Responses API content list
    return [
        {
            "role": "user",
            "content": [
                {
                    "type": "input_image",
                    "image_url": f"data:{file_data['mime_type']};base64,{file_data['data']}",
                },
                {"type": "input_text", "text": user_message or "What's in this image?"},
            ],
        }
    ]


# ── Non-streaming run ─────────────────────────────────────────────────────────

async def run_agent(
    user_message: str,
    previous_response_id: Optional[str] = None,
    file_data: Optional[dict] = None,
) -> dict:
    """
    Non-streaming agent run.

    Returns:
        {"content": str, "last_response_id": str | None}
    """
    agent = get_agent()
    agent_input = _build_input(user_message, file_data)

    try:
        result = await Runner.run(
            agent,
            input=agent_input,
            previous_response_id=previous_response_id,
            # Handles the first turn (previous_response_id=None) cleanly
            auto_previous_response_id=True,
        )
        return {
            "content": result.final_output or "",
            "last_response_id": result.last_response_id,
        }

    except MaxTurnsExceeded:
        logger.warning("Agent exceeded max turns for: %.60s", user_message)
        return {
            "content": "I needed more steps than expected. Could you rephrase your question?",
            "last_response_id": None,
        }
    except ModelBehaviorError as exc:
        logger.warning("Model behaviour error: %s", exc)
        return {
            "content": "I ran into an issue processing that. Please try again.",
            "last_response_id": None,
        }
    except RateLimitError:
        logger.error("OpenAI rate limit hit")
        raise
    except APIConnectionError as exc:
        logger.error("OpenAI connection error: %s", exc)
        raise
    except APIStatusError as exc:
        if exc.status_code >= 500:
            logger.error("OpenAI server error %s: %s", exc.status_code, exc)
            raise
        # 4xx (bad request, invalid previous_response_id, etc.) — start fresh
        logger.warning("OpenAI API %s error, retrying without previous_response_id: %s", exc.status_code, exc)
        result = await Runner.run(agent, input=agent_input, auto_previous_response_id=True)
        return {
            "content": result.final_output or "",
            "last_response_id": result.last_response_id,
        }


# ── Streaming run ─────────────────────────────────────────────────────────────

async def stream_agent_response(
    user_message: str,
    previous_response_id: Optional[str] = None,
    file_data: Optional[dict] = None,
) -> AsyncGenerator[tuple[str, Optional[str]], None]:
    """
    Streaming agent run — yields SSE text deltas then the final response ID.

    Yields:
        (text_chunk, None)        — one per text delta from the model
        ("",  last_response_id)   — final item; response_id may be None on error
    """
    agent = get_agent()
    agent_input = _build_input(user_message, file_data)

    try:
        result = Runner.run_streamed(
            agent,
            input=agent_input,
            previous_response_id=previous_response_id,
            auto_previous_response_id=True,
        )

        async for event in result.stream_events():
            if (
                event.type == "raw_response_event"
                and isinstance(event.data, ResponseTextDeltaEvent)
                and event.data.delta
            ):
                yield event.data.delta, None

        # Stream fully consumed — response_id is now available
        response_id = getattr(result, "last_response_id", None)
        yield "", response_id

    except APIStatusError as exc:
        # Stale previous_response_id — retry without it
        if exc.status_code < 500 and previous_response_id:
            logger.warning("Stale previous_response_id, retrying fresh: %s", exc)
            async for chunk in stream_agent_response(user_message, None, file_data):
                yield chunk
        else:
            logger.error("OpenAI API error during stream: %s", exc)
            yield "\n\n[Sorry, I ran into an issue. Please try again.]", None
            yield "", None

    except Exception as exc:
        logger.error("Unexpected stream error: %s", exc, exc_info=True)
        yield "\n\n[Sorry, I ran into an issue. Please try again.]", None
        yield "", None
