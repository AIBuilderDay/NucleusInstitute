"""Auto-match weekly digest tables.

Two tables, both polymorphic on `*_kind` so the same column references
either `talent.id` or `startup.id`. No SQL FK — service layer validates
existence (mirrors `swipe_list`).

`auto_match_subscription`
    Opt-in registry, one row per subscriber. The cron loop walks active
    rows whose `last_run_at` is older than `frequency_days` (or null).
    `email_subject_override` + `email_body_html_override` are an escape
    hatch: if both are set, the digest uses them verbatim and skips the
    drafter agent. If both are null the agent drafts per-recipient.

`auto_match_sent`
    Write-once log of every (subscriber, target) pair the digest has
    included. Filtered out of future runs so a subscriber never sees
    the same match twice.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.connection import Base


class AutoMatchSubscription(Base):
    __tablename__ = "auto_match_subscription"
    __table_args__ = (
        UniqueConstraint(
            "subject_kind",
            "subject_id",
            name="uq_auto_match_subscription_subject",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)

    subject_kind: Mapped[str] = mapped_column(String(20), nullable=False)
    subject_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)

    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    frequency_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)

    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Both null → drafter agent writes the email. Both set → verbatim send.
    email_subject_override: Mapped[str | None] = mapped_column(String(300))
    email_body_html_override: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AutoMatchSent(Base):
    __tablename__ = "auto_match_sent"
    __table_args__ = (
        UniqueConstraint(
            "subject_kind",
            "subject_id",
            "target_kind",
            "target_id",
            name="uq_auto_match_sent_pair",
        ),
        Index(
            "ix_auto_match_sent_subject",
            "subject_kind",
            "subject_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)

    subject_kind: Mapped[str] = mapped_column(String(20), nullable=False)
    subject_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    target_kind: Mapped[str] = mapped_column(String(20), nullable=False)
    target_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)

    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
