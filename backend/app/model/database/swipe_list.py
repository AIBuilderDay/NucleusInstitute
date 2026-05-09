"""Swipe list table for the Tinder-style matching UI.

One row per swiper (a talent or a startup), storing four JSON arrays of
target IDs:

- `liked_talent_ids`     : right-swipes on talents
- `passed_talent_ids`    : left-swipes on talents
- `liked_startup_ids`    : right-swipes on startups (talent swipers only —
                           startups never swipe other startups)
- `passed_startup_ids`   : left-swipes on startups (talent swipers only)

The presence of an ID in *any* of the four lists means "already seen" —
that's how the candidate fetch filters out people the swiper has already
made a decision on. The split between `liked_*` and `passed_*` powers
the two per-user lists (matched / passed) requested by the spec.

The "context" of a swipe (looking for an investor? a mentor?) is *not*
stored here. The target's own `role_category` carries that info — the
front end groups the matched list by `role_category` at display time.

Composite PK on (`swiper_id`, `swiper_kind`) so the same UUID can't
collide across the talent and startup namespaces. No SQL FK because
`swiper_id` is polymorphic; the service layer validates existence
before insert.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.connection import Base


class SwipeList(Base):
    __tablename__ = "swipe_list"

    swiper_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    swiper_kind: Mapped[str] = mapped_column(String(20), primary_key=True)

    liked_talent_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    passed_talent_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    liked_startup_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    passed_startup_ids: Mapped[list[str]] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
