"""
Chat router — message sending, streaming, history, file uploads.

Endpoints:
  POST /api/chat/message  — standard request/response
  POST /api/chat/stream   — Server-Sent Events streaming
  GET  /api/chat/history  — paginated message history
  POST /api/chat/session  — create a new session
  POST /api/chat/upload   — upload a file (image/pdf) and get a reference
"""
import base64
import logging
import mimetypes
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional, AsyncGenerator

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException,
    Request, UploadFile, status
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc

from app.database import get_session
from app.models.chat import ChatSession, Message
from app.models.user import User
from app.services.openai_service import chat_completion, stream_chat_completion
from app.services.rate_limiter import check_ip_rate, check_user_rate
from app.utils.deps import get_current_user
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])
settings = get_settings()


# ── Schemas ───────────────────────────────────────────────────────────────────

class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000, strip_whitespace=True)
    session_id: Optional[str] = None
    file_ref: Optional[str] = None  # reference from /upload endpoint


class MessageResponse(BaseModel):
    id: str
    session_id: str
    content: str
    tokens_used: Optional[int] = None
    created_at: datetime


class HistoryMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    tokens_used: Optional[int] = None


class HistoryResponse(BaseModel):
    session_id: str
    messages: list[HistoryMessage]
    has_more: bool
    total: int


class SessionResponse(BaseModel):
    id: str
    title: Optional[str]
    message_count: int
    created_at: datetime
    last_message_at: Optional[datetime]


class UploadResponse(BaseModel):
    file_ref: str
    mime_type: str
    filename: str


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_or_create_session(
    user: User,
    session_id: Optional[str],
    db: AsyncSession,
    first_message: str = "",
) -> ChatSession:
    """Get existing session or create a new one."""
    if session_id:
        try:
            sid = uuid.UUID(session_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session_id format.")

        stmt = select(ChatSession).where(
            ChatSession.id == sid,
            ChatSession.user_id == user.id,
            ChatSession.is_active == True,  # noqa: E712
        )
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        return session

    # Auto-generate title from first message (first 60 chars)
    title = (first_message[:57] + "...") if len(first_message) > 60 else first_message
    session = ChatSession(user_id=user.id, title=title)
    db.add(session)
    await db.flush()
    return session


async def _load_history(
    session_id: uuid.UUID,
    db: AsyncSession,
    limit: int = 40,
) -> list[dict]:
    """Load recent messages for context building."""
    stmt = (
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(desc(Message.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    msgs = result.scalars().all()
    # Reverse to chronological order
    return [
        {"role": m.role, "content": m.content, "extra": m.extra}
        for m in reversed(msgs)
    ]


# In-memory file store (keyed by ref UUID). For production use S3/GCS.
_file_store: dict[str, dict] = {}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/message", response_model=MessageResponse)
async def send_message(
    body: MessageRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Send a message and receive an AI response (non-streaming)."""
    await check_ip_rate(request)
    await check_user_rate(str(current_user.id))

    session = await _get_or_create_session(
        current_user, body.session_id, db, body.message
    )
    history = await _load_history(session.id, db)

    # Resolve file attachment
    file_data: Optional[dict] = None
    if body.file_ref:
        file_data = _file_store.get(body.file_ref)

    # Save user message
    user_msg = Message(
        session_id=session.id,
        user_id=current_user.id,
        role="user",
        content=body.message,
        extra={"file_ref": body.file_ref} if body.file_ref else None,
    )
    db.add(user_msg)
    await db.flush()

    # OpenAI call
    try:
        result = await chat_completion(
            history=history,
            user_message=body.message,
            file_data=file_data,
        )
    except Exception as exc:
        logger.error("OpenAI error for user %s: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable. Please try again.",
        )

    # Save assistant message
    ai_msg = Message(
        session_id=session.id,
        user_id=current_user.id,
        role="assistant",
        content=result["content"],
        tokens_used=result["tokens_used"],
    )
    db.add(ai_msg)

    # Update session metadata
    now = datetime.utcnow()
    session.message_count += 2
    session.last_message_at = now
    session.updated_at = now

    await db.commit()

    return MessageResponse(
        id=str(ai_msg.id),
        session_id=str(session.id),
        content=result["content"],
        tokens_used=result["tokens_used"],
        created_at=ai_msg.created_at,
    )


@router.post("/stream")
async def stream_message(
    body: MessageRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Stream AI response via Server-Sent Events."""
    await check_ip_rate(request)
    await check_user_rate(str(current_user.id))

    session = await _get_or_create_session(
        current_user, body.session_id, db, body.message
    )
    history = await _load_history(session.id, db)
    session_id = str(session.id)

    file_data: Optional[dict] = None
    if body.file_ref:
        file_data = _file_store.get(body.file_ref)

    # Save user message immediately
    user_msg = Message(
        session_id=session.id,
        user_id=current_user.id,
        role="user",
        content=body.message,
        extra={"file_ref": body.file_ref} if body.file_ref else None,
    )
    db.add(user_msg)
    await db.flush()
    await db.commit()

    async def event_stream() -> AsyncGenerator[str, None]:
        """Yield SSE-formatted events."""
        full_content = []

        # Send session_id first so client can store it
        yield f"event: session\ndata: {session_id}\n\n"

        try:
            async for chunk in stream_chat_completion(
                history=history,
                user_message=body.message,
                file_data=file_data,
            ):
                full_content.append(chunk)
                # Escape newlines in SSE data field
                safe = chunk.replace("\n", "\\n")
                yield f"data: {safe}\n\n"

        except Exception as exc:
            logger.error("Stream error: %s", exc)
            yield "event: error\ndata: AI service error\n\n"
            return

        # Persist assistant message after stream completes
        async with db.begin():
            ai_content = "".join(full_content)
            ai_msg = Message(
                session_id=uuid.UUID(session_id),
                user_id=current_user.id,
                role="assistant",
                content=ai_content,
            )
            db.add(ai_msg)

            now = datetime.utcnow()
            upd_stmt = select(ChatSession).where(ChatSession.id == uuid.UUID(session_id))
            upd_result = await db.execute(upd_stmt)
            sess = upd_result.scalar_one_or_none()
            if sess:
                sess.message_count += 2
                sess.last_message_at = now
                sess.updated_at = now

        yield f"event: done\ndata: {str(ai_msg.id)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    request: Request,
    session_id: Optional[str] = None,
    before_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> HistoryResponse:
    """
    Retrieve chat history for a session.
    Supports cursor-based pagination via before_id.
    """
    await check_ip_rate(request)

    if limit > 100:
        limit = 100

    if session_id is None:
        # Return the most recent active session
        sess_stmt = (
            select(ChatSession)
            .where(
                ChatSession.user_id == current_user.id,
                ChatSession.is_active == True,  # noqa: E712
            )
            .order_by(desc(ChatSession.last_message_at))
            .limit(1)
        )
        sess_result = await db.execute(sess_stmt)
        session = sess_result.scalar_one_or_none()
        if session is None:
            return HistoryResponse(session_id="", messages=[], has_more=False, total=0)
        session_id = str(session.id)

    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id.")

    # Verify ownership
    sess_stmt = select(ChatSession).where(
        ChatSession.id == sid,
        ChatSession.user_id == current_user.id,
    )
    sess_result = await db.execute(sess_stmt)
    session = sess_result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Build query with optional cursor
    query = select(Message).where(Message.session_id == sid)

    if before_id:
        try:
            cursor_id = uuid.UUID(before_id)
            # Get the timestamp of the cursor message for keyset pagination
            cursor_stmt = select(Message.created_at).where(Message.id == cursor_id)
            cursor_result = await db.execute(cursor_stmt)
            cursor_ts = cursor_result.scalar_one_or_none()
            if cursor_ts:
                query = query.where(Message.created_at < cursor_ts)
        except ValueError:
            pass

    query = query.order_by(desc(Message.created_at)).limit(limit + 1)
    result = await db.execute(query)
    msgs = list(reversed(result.scalars().all()))

    has_more = len(msgs) > limit
    if has_more:
        msgs = msgs[1:]  # remove the extra item

    return HistoryResponse(
        session_id=session_id,
        messages=[
            HistoryMessage(
                id=str(m.id),
                role=m.role,
                content=m.content,
                created_at=m.created_at,
                tokens_used=m.tokens_used,
            )
            for m in msgs
        ],
        has_more=has_more,
        total=session.message_count,
    )


@router.post("/session", response_model=SessionResponse, status_code=201)
async def create_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SessionResponse:
    """Create a new chat session explicitly."""
    session = ChatSession(user_id=current_user.id, title="New conversation")
    db.add(session)
    await db.commit()
    return SessionResponse(
        id=str(session.id),
        title=session.title,
        message_count=0,
        created_at=session.created_at,
        last_message_at=None,
    )


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[SessionResponse]:
    """List all active chat sessions for the current user."""
    stmt = (
        select(ChatSession)
        .where(
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True,  # noqa: E712
        )
        .order_by(desc(ChatSession.last_message_at))
        .limit(20)
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return [
        SessionResponse(
            id=str(s.id),
            title=s.title,
            message_count=s.message_count,
            created_at=s.created_at,
            last_message_at=s.last_message_at,
        )
        for s in sessions
    ]


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> UploadResponse:
    """
    Upload a file (image or PDF) for use in the next chat message.
    Files are stored in-memory and referenced by a UUID.
    For production, replace with S3/GCS storage.
    """
    await check_ip_rate(request)

    # Validate size
    content = await file.read()
    if len(content) > settings.upload_max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.upload_max_size_mb}MB.",
        )

    # Validate mime type
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if mime not in settings.allowed_upload_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {mime}.",
        )

    # Store in memory with a ref UUID
    ref = str(uuid.uuid4())
    _file_store[ref] = {
        "data": base64.b64encode(content).decode(),
        "mime_type": mime,
        "filename": file.filename or "upload",
    }

    # Clean up old file store entries (keep last 100)
    if len(_file_store) > 100:
        oldest = list(_file_store.keys())[0]
        del _file_store[oldest]

    return UploadResponse(
        file_ref=ref,
        mime_type=mime,
        filename=file.filename or "upload",
    )
