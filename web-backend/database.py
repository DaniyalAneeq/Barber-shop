"""
Async DB engine for the web-backend.
Mirrors the chatbot backend's SSL handling so both work with Neon's ?sslmode=require URL.
"""
import ssl
from typing import AsyncGenerator
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from config import get_settings

settings = get_settings()


def _build_engine_args(raw_url: str) -> tuple[str, dict]:
    """Strip ?sslmode from URL and build asyncpg SSL context."""
    parsed = urlparse(raw_url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    sslmode = params.pop("sslmode", [None])[0]
    params.pop("channel_binding", None)

    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=new_query))

    connect_args: dict = {
        "server_settings": {"application_name": "barbershop-web"},
        "command_timeout": 30,
    }

    if sslmode in ("require", "verify-ca", "verify-full"):
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_ctx

    return clean_url, connect_args


_db_url, _connect_args = _build_engine_args(settings.database_url)

engine = create_async_engine(
    _db_url,
    echo=settings.debug,
    pool_size=3,
    max_overflow=5,
    pool_recycle=300,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


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


async def close_db() -> None:
    await engine.dispose()
