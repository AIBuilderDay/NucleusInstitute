"""Discovery schemas — response shapes for `/api/v1/discover/*`.

These power the "find me X" flows for both perspectives:
  - From a focal *talent*: find startups, peer operators, mentors, advisors,
    board members, investors, service providers, students/interns.
  - From a focal *startup*: find peer startups OR any of the seven talent
    networks (operators, mentors, advisors, board members, investors, service
    providers, students/interns).

The matching/explainable contract (`MatchResult`) is intentionally NOT reused
here. `MatchResult` couples a single talent to a single startup; the discovery
flow can return talent ↔ talent or startup ↔ startup pairs too. We keep the
shape minimal — just the projected target + a score + a top reason — so the
frontend can render a directory-style list. Drilling into a single match for
the full explainable breakdown is what `/match/*` is for.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.model.schema.startup import StartupResponse
from app.model.schema.talent import TalentResponse


TargetType = Literal[
    "operators",
    "mentors",
    "advisors",
    "board_members",
    "investors",
    "service_providers",
    "students_interns",
    "startups",
]
FocalType = Literal["talent", "startup"]


class TalentDiscoveryResult(BaseModel):
    """One discovered talent — used when target ∈ talent networks."""

    target: TalentResponse
    score: float = Field(ge=0.0, le=1.0)
    top_reason: str | None = None


class StartupDiscoveryResult(BaseModel):
    """One discovered startup — used when target == 'startups'."""

    target: StartupResponse
    score: float = Field(ge=0.0, le=1.0)
    top_reason: str | None = None


class TalentDiscoveryResponse(BaseModel):
    focal_type: FocalType
    focal_id: UUID
    target_type: TargetType
    matcher: str = "rule_filter"
    results: list[TalentDiscoveryResult]
    total: int


class StartupDiscoveryResponse(BaseModel):
    focal_type: FocalType
    focal_id: UUID
    target_type: TargetType
    matcher: str = "rule_filter"
    results: list[StartupDiscoveryResult]
    total: int
