"""
Multi-agent runner — drop-in replacement for app/services/openai_service.py.

Public API (same signature shape the chat router already calls):
  run_agent(...)             → {"content": str, "last_response_id": str | None}
  stream_agent_response(...) → AsyncGenerator[(chunk, resp_id | None)]

New required params vs Phase 1:
  customer_id, customer_email, customer_name
  — passed from the authenticated User object in the chat router.

Conversation chaining:
  previous_response_id is forwarded to Runner so OpenAI's Responses API
  continues the same server-side thread across turns (and across handoffs).
  On a 4xx (stale ID), we retry fresh automatically.
"""
import logging
from typing import AsyncGenerator, Optional

from agents import Runner
from agents.exceptions import MaxTurnsExceeded, ModelBehaviorError
from openai import APIConnectionError, APIStatusError, RateLimitError
from openai.types.responses import ResponseTextDeltaEvent

from app.agents.context import AppContext
from app.agents.triage_agent import triage_agent

log = logging.getLogger(__name__)

# Allow enough turns for: triage → handoff → tool calls × N → reply.
# A full booking flow: triage(1) + handoff(1) + get_services(1) + get_barbers(1)
# + get_available_slots(1) + confirm(1) + book_appointment(1) = 7 minimum.
# 20 gives comfortable headroom for multi-step flows without allowing runaway loops.
_MAX_TURNS = 20


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_context(customer_id: str, customer_email: str, customer_name: str) -> AppContext:
    return AppContext(
        customer_id=customer_id,
        customer_email=customer_email,
        customer_name=customer_name,
    )


def _extract_metadata(result) -> dict:
    """
    Safely pull agent name, tool calls, and handoffs out of a RunResult or
    RunResultStreaming after the stream is consumed.
    Uses getattr throughout so it degrades gracefully across SDK versions.
    """
    meta: dict = {}

    # Which agent produced the final text
    current_agent = getattr(result, "current_agent", None)
    if current_agent is not None:
        meta["agent"] = getattr(current_agent, "name", "unknown")

    tool_calls: list[str] = []
    handoffs:   list[str] = []

    for item in getattr(result, "new_items", []):
        item_type = type(item).__name__

        # Tool calls — FunctionToolCall stored in raw_item.name
        raw = getattr(item, "raw_item", None)
        if raw is not None:
            fn_name = getattr(raw, "name", None)
            if fn_name and isinstance(fn_name, str):
                tool_calls.append(fn_name)

        # Handoff tracking
        if "Handoff" in item_type:
            src = getattr(getattr(item, "source_agent", None), "name", None)
            tgt = getattr(getattr(item, "target_agent", None), "name", None)
            if src and tgt:
                handoffs.append(f"{src} → {tgt}")

    if tool_calls:
        meta["tool_calls"] = tool_calls
    if handoffs:
        meta["handoffs"] = handoffs

    # Infer agent name from handoff tool calls if current_agent wasn't resolved
    if "agent" not in meta:
        transfer_calls = [t for t in tool_calls if t.startswith("transfer_to_")]
        if transfer_calls:
            agent_slug = transfer_calls[-1].replace("transfer_to_", "")
            for known_agent in ["BookingAgent", "ManageAgent", "TriageAgent"]:
                if known_agent.lower() == agent_slug:
                    meta["agent"] = known_agent
                    break
        else:
            meta["agent"] = "TriageAgent"

    return meta


def _build_input(user_message: str, file_data: Optional[dict]) -> str | list:
    """Plain string for text messages; multimodal list when a file is attached."""
    if not file_data:
        return user_message
    return [
        {
            "role": "user",
            "content": [
                {
                    "type": "input_image",
                    "image_url": (
                        f"data:{file_data['mime_type']};base64,{file_data['data']}"
                    ),
                },
                {"type": "input_text", "text": user_message or "What's in this image?"},
            ],
        }
    ]


# ── Non-streaming run ─────────────────────────────────────────────────────────

async def run_agent(
    user_message: str,
    customer_id: str,
    customer_email: str,
    customer_name: str,
    previous_response_id: Optional[str] = None,
    file_data: Optional[dict] = None,
) -> dict:
    """
    Run the multi-agent system for one turn and return the final response.

    Returns:
        {"content": str, "last_response_id": str | None}
    """
    context     = _make_context(customer_id, customer_email, customer_name)
    agent_input = _build_input(user_message, file_data)

    try:
        result = await Runner.run(
            triage_agent,
            input=agent_input,
            context=context,
            previous_response_id=previous_response_id,
            auto_previous_response_id=True,
            max_turns=_MAX_TURNS,
        )
        meta = _extract_metadata(result)
        log.debug("Agent run complete: agent=%s tools=%s", meta.get("agent"), meta.get("tool_calls"))
        return {
            "content": result.final_output or "",
            "last_response_id": result.last_response_id,
            **meta,
        }

    except MaxTurnsExceeded:
        log.warning("Multi-agent exceeded %d turns for: %.80s", _MAX_TURNS, user_message)
        return {
            "content": (
                "I needed more steps than expected to handle that. "
                "Could you rephrase or break your request into smaller steps?"
            ),
            "last_response_id": None,
        }
    except ModelBehaviorError as exc:
        log.warning("Model behaviour error: %s", exc)
        return {
            "content": "I ran into an issue processing that — please try again.",
            "last_response_id": None,
        }
    except RateLimitError:
        log.error("OpenAI rate limit hit")
        raise
    except APIConnectionError as exc:
        log.error("OpenAI connection error: %s", exc)
        raise
    except APIStatusError as exc:
        if exc.status_code >= 500:
            log.error("OpenAI server error %s: %s", exc.status_code, exc)
            raise
        # 4xx — most likely a stale previous_response_id; retry without it
        log.warning(
            "OpenAI API %s (likely stale response_id) — retrying fresh: %s",
            exc.status_code, exc,
        )
        result = await Runner.run(
            triage_agent,
            input=agent_input,
            context=context,
            auto_previous_response_id=True,
            max_turns=_MAX_TURNS,
        )
        meta = _extract_metadata(result)
        return {
            "content": result.final_output or "",
            "last_response_id": result.last_response_id,
            **meta,
        }


# ── Streaming run ─────────────────────────────────────────────────────────────

async def stream_agent_response(
    user_message: str,
    customer_id: str,
    customer_email: str,
    customer_name: str,
    previous_response_id: Optional[str] = None,
    file_data: Optional[dict] = None,
) -> AsyncGenerator[tuple[str, Optional[str], Optional[dict]], None]:
    """
    Stream the multi-agent response as SSE-ready text deltas.

    Yields 3-tuples:
        (text_chunk, None,         None)  — one per text delta while streaming
        ("",         last_resp_id, meta)  — final sentinel; carries response_id
                                            and metadata dict (agent, tool_calls, …)
    """
    context     = _make_context(customer_id, customer_email, customer_name)
    agent_input = _build_input(user_message, file_data)

    try:
        streamed = Runner.run_streamed(
            triage_agent,
            input=agent_input,
            context=context,
            previous_response_id=previous_response_id,
            auto_previous_response_id=True,
            max_turns=_MAX_TURNS,
        )

        async for event in streamed.stream_events():
            if (
                event.type == "raw_response_event"
                and isinstance(event.data, ResponseTextDeltaEvent)
                and event.data.delta
            ):
                yield event.data.delta, None, None

        # Stream fully consumed — extract response_id and metadata
        meta = _extract_metadata(streamed)
        log.debug("Stream complete: agent=%s tools=%s", meta.get("agent"), meta.get("tool_calls"))
        yield "", getattr(streamed, "last_response_id", None), meta

    except APIStatusError as exc:
        if exc.status_code < 500 and previous_response_id:
            # Stale ID — retry fresh (recursive, without previous_response_id)
            log.warning("Stale previous_response_id in stream, retrying: %s", exc)
            async for item in stream_agent_response(
                user_message, customer_id, customer_email, customer_name,
                None, file_data,
            ):
                yield item
        else:
            log.error("OpenAI API error during stream: %s", exc)
            yield "\n\n[Sorry, I ran into an issue. Please try again.]", None, None
            yield "", None, None

    except Exception as exc:
        log.error("Unexpected stream error: %s", exc, exc_info=True)
        yield "\n\n[Sorry, I ran into an issue. Please try again.]", None, None
        yield "", None, None
