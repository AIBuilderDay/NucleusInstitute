"""Async SQLAlchemy engine + session factory + declarative base.

Mirrors the HEAL FastAPI template (`backend/app/database/connection.py`):
- One async engine per process (psycopg driver).
- One session per request via the `get_session` FastAPI dependency.
- `Base` is the parent of all ORM models.
- `init_db()` runs `create_all()` on startup so we don't need Alembic during the hackathon.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = settings.logger


def _create_engine() -> AsyncEngine:
    logger.info("Initializing async PostgreSQL database connection")
    return create_async_engine(
        settings.database_url,
        pool_size=15,
        max_overflow=15,
        pool_timeout=30,
        pool_recycle=3600,
        pool_pre_ping=True,
        pool_use_lifo=True,
        echo=False,
    )


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
