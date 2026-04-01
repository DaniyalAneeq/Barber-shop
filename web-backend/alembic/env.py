"""
Alembic env.py — async migrations for the web-backend.
Only manages the contact_bookings table; all other tables are ignored.
DATABASE_URL is read from .env via pydantic-settings.
"""
import asyncio
import os
import ssl
import sys
from logging.config import fileConfig
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import pool

# Make sure web-backend/ is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import get_settings
from models.contact_booking import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _clean_url(raw_url: str) -> tuple[str, dict]:
    """Strip ?sslmode and return (clean_url, asyncpg connect_args)."""
    parsed = urlparse(raw_url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = params.pop("sslmode", [None])[0]
    params.pop("channel_binding", None)
    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean = urlunparse(parsed._replace(query=new_query))
    args: dict = {}
    if sslmode in ("require", "verify-full", "verify-ca"):
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        args["ssl"] = ssl_ctx
    return clean, args


def include_object(object, name, type_, reflected, compare_to):
    """
    Only manage tables defined in our Base.metadata.
    This prevents alembic --autogenerate from touching the chatbot's tables.
    """
    if type_ == "table":
        return name in Base.metadata.tables
    return True


def run_migrations_offline() -> None:
    settings = get_settings()
    clean_url, _ = _clean_url(settings.database_url)
    context.configure(
        url=clean_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=include_object,
        # Use a dedicated version table so the chatbot's alembic history is untouched
        version_table="alembic_version_web",
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    settings = get_settings()
    clean_url, connect_args = _clean_url(settings.database_url)
    connectable = create_async_engine(
        clean_url,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_run_sync_migrations)
    await connectable.dispose()


def _run_sync_migrations(sync_connection) -> None:
    context.configure(
        connection=sync_connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_object=include_object,
        # Use a dedicated version table so the chatbot's alembic history is untouched
        version_table="alembic_version_web",
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
