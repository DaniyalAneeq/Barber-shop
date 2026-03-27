"""
Async database engine + session factory using SQLModel + asyncpg.
Connection pooling tuned for Neon serverless (max 10, recycle 300s).

SSL note:
  asyncpg does NOT accept ?sslmode= as a query parameter.
  ssl=True  → strict cert verification (fails on Neon/WSL2)
  ssl="require" → encrypts the connection, skips cert verification
  We always use ssl="require" when sslmode was present in the URL.
"""
import ssl
from typing import AsyncGenerator
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlmodel import SQLModel

from app.config import get_settings

settings = get_settings()


def _build_engine_url_and_args(raw_url: str) -> tuple[str, dict]:
    """
    Strip ?sslmode from URL and build the correct asyncpg SSL context.
    asyncpg accepts an ssl.SSLContext; CERT_NONE matches sslmode=require
    (encrypt but don't verify the certificate chain).
    """
    parsed = urlparse(raw_url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    sslmode = params.pop("sslmode", [None])[0]
    params.pop("channel_binding", None)  # asyncpg doesn't understand this either

    # Rebuild query string without stripped params
    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=new_query))

    connect_args: dict = {
        "server_settings": {"application_name": "barbershop-chatbot"},
        "command_timeout": 30,
    }

    if sslmode in ("require", "verify-ca", "verify-full"):
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_ctx

    return clean_url, connect_args


_db_url, _connect_args = _build_engine_url_and_args(settings.database_url)

engine = create_async_engine(
    _db_url,
    echo=settings.debug,
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,    # recycle connections every 5 min
    pool_pre_ping=True,  # health-check before handing out from pool
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def init_db() -> None:
    """Create all tables on startup (only for dev; use Alembic in prod)."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def close_db() -> None:
    await engine.dispose()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
