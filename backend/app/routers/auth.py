"""
Auth router — registration, email verification, token refresh.

Flow:
  1. POST /register   → create unverified user, send 6-digit code
  2. POST /verify     → validate code, mark user verified, return JWT
  3. POST /resend     → send new code (rate-limited, 60s cooldown)
  4. GET  /me         → return current user profile (requires JWT)
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.user import User, VerificationCode
from app.services.auth_service import (
    create_access_token,
    decode_token,
    should_refresh,
    get_current_user_id,
)
from app.services.email_service import generate_verification_code, send_verification_email
from app.services.rate_limiter import check_ip_rate, check_resend_rate
from app.utils.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100, strip_whitespace=True)


class RegisterResponse(BaseModel):
    message: str
    email: str
    cooldown_seconds: int = 60


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class VerifyResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str
    email: str


class ResendRequest(BaseModel):
    email: EmailStr


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    is_verified: bool
    created_at: datetime


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> RegisterResponse:
    """
    Register or re-register an email address.

    Security: We always respond with the same message regardless of whether
    the email already exists (prevents email enumeration attacks).
    """
    await check_ip_rate(request)

    # Upsert user — create if new, update name if exists
    stmt = select(User).where(User.email == body.email.lower())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        user = User(email=body.email.lower(), name=body.name)
        db.add(user)
        await db.flush()  # get the UUID
    else:
        user.name = body.name
        user.updated_at = datetime.utcnow()

    # Invalidate any existing active codes
    code_stmt = select(VerificationCode).where(
        VerificationCode.user_id == user.id,
        VerificationCode.is_used == False,  # noqa: E712
    )
    code_result = await db.execute(code_stmt)
    for old_code in code_result.scalars().all():
        old_code.is_used = True

    # Create new verification code
    raw_code = generate_verification_code()
    vcode = VerificationCode(
        user_id=user.id,
        code=raw_code,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(vcode)
    await db.commit()

    # Send email (non-blocking — we don't await failure to avoid timing attacks)
    try:
        await send_verification_email(
            to_email=user.email,
            name=user.name,
            code=raw_code,
        )
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", user.email, exc)
        # Still return success — code is in DB, user can resend
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send verification email. Please try again shortly.",
        )

    return RegisterResponse(
        message="Verification code sent to your email.",
        email=user.email,
    )


@router.post("/verify", response_model=VerifyResponse)
async def verify(
    body: VerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> VerifyResponse:
    """Verify 6-digit code and return JWT access token."""
    await check_ip_rate(request)

    # Fetch user
    user_stmt = select(User).where(User.email == body.email.lower())
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    # Always raise generic error (no enumeration)
    _invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired verification code.",
    )

    if user is None:
        raise _invalid

    # Find the latest unused, unexpired code for this user
    code_stmt = (
        select(VerificationCode)
        .where(
            VerificationCode.user_id == user.id,
            VerificationCode.is_used == False,  # noqa: E712
            VerificationCode.expires_at > datetime.utcnow(),
        )
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    code_result = await db.execute(code_stmt)
    vcode = code_result.scalar_one_or_none()

    if vcode is None:
        raise _invalid

    if vcode.is_exhausted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect attempts. Please request a new code.",
        )

    # Check code (constant-time comparison via secrets module)
    import hmac
    if not hmac.compare_digest(vcode.code, body.code):
        vcode.attempts += 1
        await db.commit()
        remaining = vcode.max_attempts - vcode.attempts
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many incorrect attempts. Please request a new code.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect code. {remaining} attempt(s) remaining.",
        )

    # ✓ Code is correct — mark as used
    vcode.is_used = True
    user.is_verified = True
    user.last_active_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    await db.commit()

    token = create_access_token(user.id, user.email, user.name)
    logger.info("User %s verified and authenticated", user.email)

    return VerifyResponse(
        access_token=token,
        user_id=str(user.id),
        name=user.name,
        email=user.email,
    )


@router.post("/resend", response_model=RegisterResponse)
async def resend(
    body: ResendRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> RegisterResponse:
    """Resend verification code. Rate-limited to 1 per 60 seconds."""
    await check_ip_rate(request)
    await check_resend_rate(body.email.lower())

    user_stmt = select(User).where(User.email == body.email.lower())
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    # Always return the same response
    _ok = RegisterResponse(
        message="If that email is registered, a new code has been sent.",
        email=body.email.lower(),
    )

    if user is None:
        return _ok

    # Invalidate old codes
    old_stmt = select(VerificationCode).where(
        VerificationCode.user_id == user.id,
        VerificationCode.is_used == False,  # noqa: E712
    )
    old_result = await db.execute(old_stmt)
    for old_code in old_result.scalars().all():
        old_code.is_used = True

    raw_code = generate_verification_code()
    vcode = VerificationCode(
        user_id=user.id,
        code=raw_code,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(vcode)
    await db.commit()

    try:
        await send_verification_email(user.email, user.name, raw_code)
    except Exception as exc:
        logger.error("Resend email failed for %s: %s", user.email, exc)

    return _ok


@router.get("/me", response_model=UserProfile)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserProfile:
    """Return authenticated user's profile."""
    return UserProfile(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
    )
