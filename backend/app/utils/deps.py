"""
FastAPI dependency helpers — JWT extraction, current-user injection.
"""
from datetime import datetime, timezone, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.user import User
from app.services.auth_service import decode_token, get_current_user_id

_bearer = HTTPBearer(auto_error=False)

# Only write last_active_at if it hasn't been updated in this many minutes.
# Prevents an UPDATE users on every single authenticated request.
_LAST_ACTIVE_WRITE_INTERVAL = timedelta(minutes=5)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)] = None,
    db: AsyncSession = Depends(get_session),
) -> User:
    """
    Extract Bearer token, validate it, return the User object.
    Raises HTTP 401 if token is missing or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    user_id = get_current_user_id(payload)

    stmt = select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or not verified.",
        )

    # Throttled last_active_at: only dirty the ORM object (triggering an UPDATE)
    # if the stored value is stale. This avoids an UPDATE users on every request.
    #
    # The column is TIMESTAMP WITHOUT TIME ZONE (naive UTC), but asyncpg may
    # return a tz-aware datetime if the DB column was created as TIMESTAMPTZ.
    # Normalise the stored value to tz-aware for a safe comparison, then write
    # a naive UTC datetime so asyncpg's TIMESTAMP codec is satisfied.
    now = datetime.now(timezone.utc)
    last = user.last_active_at
    if last is not None and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if (
        last is None
        or now - last > _LAST_ACTIVE_WRITE_INTERVAL
    ):
        user.last_active_at = now.replace(tzinfo=None)  # naive UTC for column

    # Sliding refresh: attach refreshed token to response state for middleware
    from app.services.auth_service import should_refresh, create_access_token
    if should_refresh(payload):
        request.state.refresh_token = create_access_token(
            user.id, user.email, user.name
        )

    return user
