"""
Alembic env.py — async migrations for Neon PostgreSQL.
DATABASE_URL is read from the .env file via pydantic-settings.
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

# Make sure app/ is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import get_settings
from app.models import *  # noqa — import all models to populate metadata
from sqlmodel import SQLModel

# Alembic config
config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# Use SQLModel metadata for autogenerate
target_metadata = SQLModel.metadata


def _clean_url(raw_url: str) -> tuple[str, dict]:
    """Strip ?sslmode from URL; return (clean_url, connect_args) for asyncpg."""
    parsed = urlparse(raw_url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = params.pop("sslmode", [None])[0]
    params.pop("channel_binding", None)  # not understood by asyncpg
    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean = urlunparse(parsed._replace(query=new_query))
    args: dict = {}
    if sslmode in ("require", "verify-full", "verify-ca"):
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        args["ssl"] = ssl_ctx
    return clean, args


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    settings = get_settings()
    clean_url, _ = _clean_url(settings.database_url)
    context.configure(
        url=clean_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode (async)."""
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


def _run_sync_migrations(sync_connection):
    context.configure(
        connection=sync_connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
