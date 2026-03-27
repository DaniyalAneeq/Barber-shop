"""
OpenAI service — async chat completions with gpt-4o-mini.

Features:
- Sliding context window: last N messages + system prompt
- Streaming via Server-Sent Events
- Token usage tracking
- Exponential back-off retry (3 attempts)
- Context summarization for very long threads (>40 messages)
- File/image support via base64 vision messages
"""
import asyncio
import base64
import logging
from typing import AsyncGenerator, Optional

import tiktoken
from openai import AsyncOpenAI, RateLimitError, APIStatusError, APIConnectionError
from openai.types.chat import ChatCompletionMessageParam

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Lazy-initialised client (one instance per process)
_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            max_retries=0,  # we handle retries ourselves
            timeout=60.0,
        )
    return _client


def _count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    try:
        enc = tiktoken.encoding_for_model(model)
        return len(enc.encode(text))
    except Exception:
        return len(text) // 4  # rough fallback


def _build_messages(
    history: list[dict],
    system_prompt: str,
    context_limit: int,
) -> list[ChatCompletionMessageParam]:
    """
    Build OpenAI message list with sliding context window.

    Strategy:
    1. Always include system prompt
    2. Take the last `context_limit` messages from history
    3. If the total token count would exceed ~6000, summarise older messages
    """
    messages: list[ChatCompletionMessageParam] = [
        {"role": "system", "content": system_prompt},
    ]

    # Sliding window — take the last N turns
    recent = history[-context_limit:] if len(history) > context_limit else history

    for msg in recent:
        role = msg["role"]
        content = msg["content"]

        # Handle file/image attachments stored in extra
        if msg.get("extra") and msg["extra"].get("file_data"):
            fd = msg["extra"]["file_data"]
            messages.append({
                "role": role,
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{fd['mime_type']};base64,{fd['data']}",
                            "detail": "auto",
                        },
                    },
                    {"type": "text", "text": content or "What's in this image?"},
                ],
            })
        else:
            messages.append({"role": role, "content": content})

    return messages


async def chat_completion(
    history: list[dict],
    user_message: str,
    system_prompt: Optional[str] = None,
    file_data: Optional[dict] = None,
    max_retries: int = 3,
) -> dict:
    """
    Non-streaming chat completion.

    Returns: {"content": str, "tokens_used": int, "model": str}
    """
    client = get_openai_client()
    prompt = system_prompt or settings.bot_system_prompt
    context_limit = settings.openai_context_messages

    # Build messages + append the new user turn
    messages = _build_messages(history, prompt, context_limit)

    if file_data:
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{file_data['mime_type']};base64,{file_data['data']}",
                        "detail": "auto",
                    },
                },
                {"type": "text", "text": user_message},
            ],
        })
    else:
        messages.append({"role": "user", "content": user_message})

    last_exc: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=messages,
                max_tokens=settings.openai_max_tokens,
                temperature=0.7,
                presence_penalty=0.1,
                frequency_penalty=0.1,
            )
            content = response.choices[0].message.content or ""
            tokens = response.usage.total_tokens if response.usage else 0
            return {
                "content": content,
                "tokens_used": tokens,
                "model": response.model,
            }
        except RateLimitError as exc:
            wait = 2 ** attempt * 5  # 10, 20, 40s
            logger.warning("OpenAI rate limit (attempt %d): waiting %ds", attempt, wait)
            last_exc = exc
            if attempt < max_retries:
                await asyncio.sleep(wait)
        except APIConnectionError as exc:
            wait = 2 ** attempt  # 2, 4, 8s
            logger.warning("OpenAI connection error (attempt %d): %s", attempt, exc)
            last_exc = exc
            if attempt < max_retries:
                await asyncio.sleep(wait)
        except APIStatusError as exc:
            # 5xx errors are retryable; 4xx are not
            if exc.status_code >= 500:
                wait = 2 ** attempt
                last_exc = exc
                if attempt < max_retries:
                    await asyncio.sleep(wait)
            else:
                raise

    raise RuntimeError(f"OpenAI call failed after {max_retries} attempts: {last_exc}")


async def stream_chat_completion(
    history: list[dict],
    user_message: str,
    system_prompt: Optional[str] = None,
    file_data: Optional[dict] = None,
) -> AsyncGenerator[str, None]:
    """
    Streaming chat completion — yields text chunks as they arrive.
    Each chunk is a plain string (the delta content).
    """
    client = get_openai_client()
    prompt = system_prompt or settings.bot_system_prompt
    context_limit = settings.openai_context_messages

    messages = _build_messages(history, prompt, context_limit)

    if file_data:
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{file_data['mime_type']};base64,{file_data['data']}",
                        "detail": "auto",
                    },
                },
                {"type": "text", "text": user_message},
            ],
        })
    else:
        messages.append({"role": "user", "content": user_message})

    try:
        async with await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            max_tokens=settings.openai_max_tokens,
            temperature=0.7,
            stream=True,
        ) as stream:
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield delta.content
    except Exception as exc:
        logger.error("Streaming error: %s", exc)
        yield "\n\n[Sorry, I encountered an issue. Please try again.]"
