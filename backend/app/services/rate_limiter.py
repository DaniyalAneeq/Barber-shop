"""
In-memory rate limiter using a sliding-window algorithm.

Supports per-user and per-IP limiting without Redis dependency.
For production at scale, swap the storage backend with Redis.

Limits:
- Per-user:    10 requests / minute
- Per-IP:      50 requests / minute
- Verification resend: 1 / cooldown_seconds per email
"""
import asyncio
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import HTTPException, Request, status

from app.config import get_settings

settings = get_settings()


def _parse_limit(spec: str) -> tuple[int, int]:
    """Parse '10/minute' → (10, 60). Supports minute/hour/second."""
    parts = spec.split("/")
    count = int(parts[0])
    unit = parts[1].lower().strip() if len(parts) > 1 else "minute"
    period = {"second": 1, "minute": 60, "hour": 3600}.get(unit, 60)
    return count, period


class SlidingWindowRateLimiter:
    """
    Thread-safe sliding-window rate limiter backed by in-memory deques.
    Automatically evicts expired entries.
    """

    def __init__(self) -> None:
        self._windows: dict[str, deque] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str, limit: int, period_seconds: int) -> None:
        """
        Raise HTTP 429 if `key` has exceeded `limit` requests in the last `period_seconds`.
        """
        now = time.monotonic()
        cutoff = now - period_seconds

        async with self._lock:
            window = self._windows[key]

            # Evict timestamps outside the window
            while window and window[0] <= cutoff:
                window.popleft()

            if len(window) >= limit:
                retry_after = int(period_seconds - (now - window[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Retry after {retry_after}s.",
                    headers={"Retry-After": str(retry_after)},
                )

            window.append(now)

    async def reset(self, key: str) -> None:
        async with self._lock:
            self._windows.pop(key, None)


# Singleton instances
user_limiter = SlidingWindowRateLimiter()
ip_limiter = SlidingWindowRateLimiter()
resend_limiter = SlidingWindowRateLimiter()

_user_limit, _user_period = _parse_limit(settings.rate_limit_per_user)
_ip_limit, _ip_period = _parse_limit(settings.rate_limit_per_ip)


def get_client_ip(request: Request) -> str:
    """Extract real IP, respecting X-Forwarded-For for reverse proxies."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def check_user_rate(user_id: str) -> None:
    await user_limiter.check(f"user:{user_id}", _user_limit, _user_period)


async def check_ip_rate(request: Request) -> None:
    ip = get_client_ip(request)
    await ip_limiter.check(f"ip:{ip}", _ip_limit, _ip_period)


async def check_resend_rate(email: str) -> None:
    """1 resend per cooldown window per email address."""
    await resend_limiter.check(
        f"resend:{email}",
        limit=1,
        period_seconds=settings.verification_cooldown_seconds,
    )
