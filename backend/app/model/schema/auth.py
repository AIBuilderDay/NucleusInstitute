"""Pydantic schemas for the OAuth + onboarding flow (LinkedIn + Google)."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

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


class GoogleUserInfo(BaseModel):
    """OIDC userinfo blob returned from https://openidconnect.googleapis.com/v1/userinfo.

    Field set is the OIDC standard claims; same wire shape as `LinkedInUserInfo`
    but kept as its own type so the onboarding agent can know which provider
    the data came from. `locale` is normally a string from Google but typed as
    Any to match the LinkedIn schema and tolerate any future shape changes.
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


class GoogleHandoffResponse(GoogleUserInfo):
    """Returned by GET /auth/google/handoff. Same shape as userinfo."""

    pass


class OnboardAgentRequest(BaseModel):
    """Body for POST /onboard/agent.

    Exactly one of `linkedin_userinfo` or `google_userinfo` must be present —
    whichever provider the user signed in with. The frontend pulls the dict
    from the matching `/auth/<provider>/handoff` endpoint and forwards it here.
    `resume_text` is the optional paste-box / extracted-PDF contents the agent
    uses to fill out experience, education, skills, etc.
    """

    linkedin_userinfo: LinkedInUserInfo | None = None
    google_userinfo: GoogleUserInfo | None = None
    resume_text: str | None = Field(default=None, max_length=50_000)

    @model_validator(mode="after")
    def _exactly_one_userinfo(self) -> "OnboardAgentRequest":
        provided = [self.linkedin_userinfo is not None, self.google_userinfo is not None]
        if sum(provided) != 1:
            raise ValueError(
                "Exactly one of `linkedin_userinfo` or `google_userinfo` must be provided"
            )
        return self


class OnboardAgentResponse(BaseModel):
    talent_id: UUID
    talent: TalentResponse
    agent_notes: str | None = None
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Agent-supplied 0–1 confidence in the inferred profile.",
    )
    reasoning_bullets: list[str] = Field(
        default_factory=list,
        description="Agent-written bullets explaining how it filled out the profile.",
    )
    agent_raw_response: str | None = Field(
        default=None,
        description=(
            "The agent's full final-turn text (typically a <REASONING>...</REASONING> "
            "block). Carried through unparsed so the frontend can re-parse or display "
            "it verbatim if backend parsing produced incomplete structured fields."
        ),
    )


# -----------------------------------------------------------------------------
# Interest inference (Ecosystem page) — read-only Claude call after sign-in.
# Takes the LinkedIn userinfo, runs Claude with web_search to surface the user's
# public footprint, returns inferred categories the frontend pre-fills into the
# "Is this you?" confirmation popup. NO Talent row is written here.
# -----------------------------------------------------------------------------


class InferInterestsRequest(BaseModel):
    """Body for POST /onboard/infer-interests."""

    linkedin_userinfo: LinkedInUserInfo


class InferInterestsResponse(BaseModel):
    """Categories Claude inferred from the user's public footprint.

    Field names mirror the frontend's `InferredInterests` type (camelCase) so
    the JSON wire shape is identical and no client-side rename is needed.
    """

    model_config = ConfigDict(populate_by_name=True)

    city: str = ""
    sectors: list[str] = Field(default_factory=list)
    stages: list[str] = Field(default_factory=list)
    lookingFor: list[str] = Field(default_factory=lambda: ["both"])
    evidence: list[str] = Field(default_factory=list)
    confidence: Literal["low", "medium", "high"] = "low"
