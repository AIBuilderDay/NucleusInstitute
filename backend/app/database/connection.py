"""Async SQLAlchemy engine + session factory + declarative base.

- One async engine per process (aiosqlite driver — SQLite, file-backed).
- One session per request via the `get_session` FastAPI dependency.
- `Base` is the parent of all ORM models.
- `init_db()` runs `create_all()` on startup so we don't need Alembic during the hackathon.
- For SQLite, the parent directory of the DB file is created if missing so a
  fresh checkout can boot without a manual mkdir.
"""

from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = settings.logger


def _ensure_sqlite_parent_dir(url_str: str) -> None:
    url = make_url(url_str)
    if url.get_backend_name() != "sqlite":
        return
    db_path = url.database
    if not db_path or db_path == ":memory:":
        return
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)


def _create_engine() -> AsyncEngine:
    _ensure_sqlite_parent_dir(settings.database_url)
    logger.info(f"Initializing async DB connection: {settings.database_url}")
    # SQLite ignores Postgres-style pool args; connect_args sets isolation_level
    # to None (autocommit) so SQLAlchemy controls transactions explicitly.
    return create_async_engine(settings.database_url, echo=False)


engine: AsyncEngine = _create_engine()

session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Parent class for all SQLAlchemy ORM models."""

    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a session and closes it on request end."""
    async with session_factory() as session:
        yield session


async def init_db() -> None:
    """Create all tables registered on `Base.metadata`. Hackathon-only path; replace with Alembic later."""
    # Import models so Base.metadata knows about them before create_all.
    from app.model import database as _models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema ensured (create_all)")
