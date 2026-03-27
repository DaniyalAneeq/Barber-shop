"""
Auth service — JWT creation/validation + session management.

Strategy:
- Access tokens: 7-day expiry (configurable)
- Tokens include user_id + email + verified flag
- On every authenticated request we optionally refresh token
  (returns new token in X-Refresh-Token header if > 1 day old)
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import HTTPException, status

from app.config import get_settings

settings = get_settings()

ALGORITHM = settings.jwt_algorithm
SECRET_KEY = settings.jwt_secret


def create_access_token(user_id: uuid.UUID, email: str, name: str) -> str:
    """Generate a signed JWT for the authenticated user."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.jwt_expire_days)
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": name,
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises 401 on any failure."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise JWTError("wrong token type")
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def should_refresh(payload: dict) -> bool:
    """Return True if token was issued more than 1 day ago (sliding refresh)."""
    iat = payload.get("iat")
    if iat is None:
        return False
    issued_at = datetime.fromtimestamp(iat, tz=timezone.utc)
    return (datetime.now(timezone.utc) - issued_at) > timedelta(days=1)


def get_current_user_id(payload: dict) -> uuid.UUID:
    return uuid.UUID(payload["sub"])
