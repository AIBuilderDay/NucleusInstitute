"""Local SQLite for autopilot config + run log + contacted-talent dedup.

Deliberately separate from the Nucleus DB. The autopilot service can be
re-deployed and wiped without touching the matching backend's data.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .config import settings


class Base(DeclarativeBase):
    pass


class AgentConfig(Base):
    """Singleton row holding the user's saved instructions + schedule."""

    __tablename__ = "agent_config"
    __table_args__ = (UniqueConstraint("singleton_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    singleton_key: Mapped[str] = mapped_column(String(8), default="ONLY", unique=True)

    candidate_criteria: Mapped[str] = mapped_column(Text, default="")
    email_instructions: Mapped[str] = mapped_column(Text, default="")
    structured_filters: Mapped[dict] = mapped_column(JSON, default=dict)

    schedule_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    cadence_hours: Mapped[int] = mapped_column(Integer, default=24)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class RunLog(Base):
    __tablename__ = "run_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    trigger: Mapped[str] = mapped_column(String(16), default="manual")
    status: Mapped[str] = mapped_column(String(16), default="running")
    candidates_considered: Mapped[int] = mapped_column(Integer, default=0)
    emails_sent: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[list] = mapped_column(JSON, default=list)


class ContactedTalent(Base):
    """Per-talent contact log — keyed by Nucleus talent_id so re-runs skip
    anyone we've already emailed."""

    __tablename__ = "contacted_talent"
    __table_args__ = (UniqueConstraint("talent_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    talent_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="sent")
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    resend_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    contacted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ---------- async engine + session helpers ----------------------------------
engine = create_async_engine(
    settings.autopilot_db_url,
    echo=False,
    future=True,
)
session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    Path(__file__).resolve().parents[1].joinpath("data").mkdir(exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
