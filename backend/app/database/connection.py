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


def _normalize_database_url(url_str: str) -> str:
    """Accept either a SQLAlchemy URL or a bare SQLite filesystem path.

    - Strips surrounding whitespace and `"…"`/`'…'` quotes (deploy platforms
      sometimes leave them behind).
    - If the result has no `://` scheme, treats it as a SQLite path and wraps
      it as `sqlite+aiosqlite:///{path}` (3 slashes + path; an absolute path's
      leading `/` makes that 4 slashes total, which is correct).
    """
    cleaned = url_str.strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in ("'", '"'):
        cleaned = cleaned[1:-1]
    if "://" not in cleaned:
        cleaned = f"sqlite+aiosqlite:///{cleaned}"
    return cleaned


def _ensure_sqlite_parent_dir(url_str: str) -> None:
    url = make_url(url_str)
    if url.get_backend_name() != "sqlite":
        return
    db_path = url.database
    if not db_path or db_path == ":memory:":
        return
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)


def _create_engine() -> AsyncEngine:
    raw = settings.database_url
    normalized = _normalize_database_url(raw)
    if normalized != raw:
        logger.info(f"Normalized DATABASE_URL: {raw!r} -> {normalized!r}")
    else:
        logger.info(f"Initializing async DB connection: {normalized!r}")
    _ensure_sqlite_parent_dir(normalized)
    return create_async_engine(normalized, echo=False)


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
