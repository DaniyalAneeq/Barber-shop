"""
ChatSession and Message models.

Design decisions:
- Sessions are soft-deleted (is_active=False) to preserve history
- Messages store role (user/assistant/system) for OpenAI context building
- tokens_used tracked per message for cost monitoring
- extra JSONB for extensibility (file refs, reactions, edit history)
- Composite indexes on (session_id, created_at) for efficient pagination
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Any, TYPE_CHECKING

from sqlalchemy import Column, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User


def utcnow() -> datetime:
    return datetime.utcnow()  # naive UTC — matches TIMESTAMP WITHOUT TIME ZONE columns


class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, nullable=False)
    title: Optional[str] = Field(default=None, max_length=255)
    is_active: bool = Field(default=True)
    message_count: int = Field(default=0)
    # OpenAI Responses API response ID from the last turn in this session.
    # Passed as previous_response_id on the next turn for server-side context chaining.
    last_response_id: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    last_message_at: Optional[datetime] = Field(default=None)

    # Relationships
    messages: list["Message"] = Relationship(back_populates="session")


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="chat_sessions.id", index=True, nullable=False)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, nullable=False)
    role: str = Field(max_length=20, nullable=False)  # user | assistant | system
    content: str = Field(nullable=False)
    tokens_used: Optional[int] = Field(default=None)
    # Stores file references, metadata, etc.
    extra: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    created_at: datetime = Field(default_factory=utcnow)

    # Relationship back to session
    session: Optional[ChatSession] = Relationship(back_populates="messages")
