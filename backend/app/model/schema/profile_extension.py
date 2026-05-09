"""Pydantic schemas for the extended profile views.

These power the frontend "more details" panel — long bio/description, resume
or pitch deck link, gallery imagery, social links, project showcase, and
highlight bullets. The matching framework intentionally does not read these.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectEntry(BaseModel):
    title: str
    description: str = ""
    url: str | None = None


class TalentProfileExtensionBase(BaseModel):
    bio_extended: str = ""
    resume_url: str | None = None
    image_url: str | None = None
    cover_image_url: str | None = None
    degree: str | None = None
    university: str | None = None
    links: dict[str, str] = Field(default_factory=dict)
    projects: list[ProjectEntry] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)


class TalentProfileExtensionUpsert(TalentProfileExtensionBase):
    pass


class TalentProfileExtensionResponse(TalentProfileExtensionBase):
    model_config = ConfigDict(from_attributes=True)

    talent_id: UUID
    created_at: datetime
    updated_at: datetime


class StartupProfileExtensionBase(BaseModel):
    description_extended: str = ""
    pitch_deck_url: str | None = None
    image_url: str | None = None
    cover_image_url: str | None = None
    links: dict[str, str] = Field(default_factory=dict)
    highlights: list[str] = Field(default_factory=list)


class StartupProfileExtensionUpsert(StartupProfileExtensionBase):
    pass


class StartupProfileExtensionResponse(StartupProfileExtensionBase):
    model_config = ConfigDict(from_attributes=True)

    startup_id: UUID
    created_at: datetime
    updated_at: datetime
