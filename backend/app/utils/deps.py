"""
FastAPI dependency helpers — JWT extraction, current-user injection.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.user import User
from app.services.auth_service import decode_token, get_current_user_id

_bearer = HTTPBearer(auto_error=False)


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

    # Update last active
    user.last_active_at = datetime.utcnow()

    # Sliding refresh: attach refreshed token to response state for middleware
    from app.services.auth_service import should_refresh, create_access_token
    if should_refresh(payload):
        request.state.refresh_token = create_access_token(
            user.id, user.email, user.name
        )

    return user
