"""
User and VerificationCode models.

Design decisions:
- UUIDs as PKs (no sequential leakage, safe for distributed systems)
- Soft-delete via is_active flag (preserve audit trail)
- VerificationCode has attempts + is_used to prevent brute-force & replay
- Index on (email) and (user_id, is_used, expires_at) for fast lookups
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.chat import ChatSession


def utcnow() -> datetime:
    return datetime.utcnow()  # naive UTC — matches TIMESTAMP WITHOUT TIME ZONE columns


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    email: str = Field(
        max_length=255,
        unique=True,
        index=True,
        nullable=False,
    )
    name: str = Field(max_length=255, nullable=False)
    is_verified: bool = Field(default=False)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    last_active_at: Optional[datetime] = Field(default=None)

    # Relationships
    verification_codes: list["VerificationCode"] = Relationship(back_populates="user")
    chat_sessions: list["ChatSession"] = Relationship()


class VerificationCode(SQLModel, table=True):
    __tablename__ = "verification_codes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, nullable=False)
    code: str = Field(max_length=6, nullable=False)
    attempts: int = Field(default=0)
    max_attempts: int = Field(default=3)
    expires_at: datetime = Field(nullable=False, index=True)
    is_used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)

    # Relationship
    user: Optional[User] = Relationship(back_populates="verification_codes")

    @property
    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc)
        expires = self.expires_at
        # asyncpg returns tz-aware datetimes for TIMESTAMPTZ columns; normalise
        # if naive (e.g. freshly-created before first DB round-trip).
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return now > expires

    @property
    def is_exhausted(self) -> bool:
        return self.attempts >= self.max_attempts

    @property
    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired and not self.is_exhausted
