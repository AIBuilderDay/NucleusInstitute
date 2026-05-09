"""Pydantic schemas for the LinkedIn OAuth + onboarding flow."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.model.schema.talent import TalentResponse


class LinkedInUserInfo(BaseModel):
    """OIDC userinfo blob returned from https://api.linkedin.com/v2/userinfo.

    `locale` arrives as either a dict (`{"country": "US", "language": "en"}`)
    or a string in some LinkedIn responses, so we accept Any.
    """

    model_config = ConfigDict(extra="ignore")

    sub: str
    name: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    picture: str | None = None
    email: EmailStr | None = None
    email_verified: bool = False
    locale: Any = None


class LinkedInHandoffResponse(LinkedInUserInfo):
    """Returned by GET /auth/linkedin/handoff. Same shape as userinfo."""

    pass


class OnboardAgentRequest(BaseModel):
    """Body for POST /onboard/agent.

    `linkedin_userinfo` should be the dict the frontend pulled from
    /auth/linkedin/handoff. `resume_text` is the optional paste-box contents
    the agent uses to fill out experience, education, skills, etc.
    """

    linkedin_userinfo: LinkedInUserInfo
    resume_text: str | None = Field(default=None, max_length=50_000)


class OnboardAgentResponse(BaseModel):
    talent_id: UUID
    talent: TalentResponse
    agent_notes: str | None = None
