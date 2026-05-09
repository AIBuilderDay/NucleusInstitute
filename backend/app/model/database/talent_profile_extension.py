"""TalentProfileExtension ORM model.

Holds expanded profile content (long bio, resume, imagery, links, projects,
highlights) that the frontend "more details" view loads on demand. Lives in
its own table so the matching framework keeps reading the lean `talent` row
unchanged.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.connection import Base


class TalentProfileExtension(Base):
    __tablename__ = "talent_profile_extension"

    talent_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("talent.id", ondelete="CASCADE"),
        primary_key=True,
    )

    bio_extended: Mapped[str] = mapped_column(Text, default="")
    resume_url: Mapped[str | None] = mapped_column(String(1000))
    image_url: Mapped[str | None] = mapped_column(String(1000))
    cover_image_url: Mapped[str | None] = mapped_column(String(1000))
    degree: Mapped[str | None] = mapped_column(String(200))
    university: Mapped[str | None] = mapped_column(String(300))

    links: Mapped[dict] = mapped_column(JSON, default=dict)
    projects: Mapped[list[dict]] = mapped_column(JSON, default=list)
    highlights: Mapped[list[str]] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
