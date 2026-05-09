"""Follow edge tables.

Two directed-edge tables, both with `talent` as the follower:

- `talent_follow`     : talent  -> talent
- `startup_follow`    : talent  -> startup

The follower is always a Talent (a Talent row may carry any of the 9
RoleCategory values, so this covers executives, operators, mentors,
investors, service_providers, etc. — the graph is *not* "person → person",
it spans all 9 role categories of Talent uniformly).

Composite primary keys + ON DELETE CASCADE keep the graph consistent if a
profile is deleted. A SQL CHECK constraint blocks self-follow on the
talent→talent table.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.connection import Base


class TalentFollow(Base):
    __tablename__ = "talent_follow"
    __table_args__ = (
        CheckConstraint("follower_id <> followee_id", name="ck_talent_follow_no_self"),
        Index("ix_talent_follow_followee", "followee_id"),
    )

    follower_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("talent.id", ondelete="CASCADE"),
        primary_key=True,
    )
    followee_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("talent.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class StartupFollow(Base):
    __tablename__ = "startup_follow"
    __table_args__ = (
        Index("ix_startup_follow_startup", "startup_id"),
    )

    follower_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("talent.id", ondelete="CASCADE"),
        primary_key=True,
    )
    startup_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("startup.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
