"""StartupProfileExtension ORM model.

Holds expanded profile content (long description, pitch deck, imagery, links,
highlights) used by the "more details" view. Separate table so the matching
framework keeps reading the lean `startup` row unchanged.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.connection import Base


class StartupProfileExtension(Base):
    __tablename__ = "startup_profile_extension"

    startup_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("startup.id", ondelete="CASCADE"),
        primary_key=True,
    )

    description_extended: Mapped[str] = mapped_column(Text, default="")
    pitch_deck_url: Mapped[str | None] = mapped_column(String(1000))
    image_url: Mapped[str | None] = mapped_column(String(1000))
    cover_image_url: Mapped[str | None] = mapped_column(String(1000))

    links: Mapped[dict] = mapped_column(JSON, default=dict)
    highlights: Mapped[list[str]] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
