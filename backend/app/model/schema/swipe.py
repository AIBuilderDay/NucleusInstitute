"""Schemas for the Tinder-style swipe lists.

The list endpoints hydrate raw IDs into full Talent/Startup responses so the
front-end can render the match card directly. Group-by-type happens
client-side using `target.role_category` for talents and `target.sector` /
`target.stage` for startups.
"""

from pydantic import BaseModel

from app.model.schema.startup import StartupResponse
from app.model.schema.talent import TalentResponse


class SwipeRequest(BaseModel):
    """Body of POST swipe endpoints. True = matched, False = passed."""

    liked: bool


class TalentSwipeListsResponse(BaseModel):
    """Per-swiper view of who they've matched / passed among talents."""

    matched: list[TalentResponse]
    passed: list[TalentResponse]


class StartupSwipeListsResponse(BaseModel):
    """Per-swiper view of who they've matched / passed among startups."""

    matched: list[StartupResponse]
    passed: list[StartupResponse]


class SwipeAckResponse(BaseModel):
    """Returned by POST swipe — current liked/passed list lengths after the
    mutation, so the front end can update its counters without a refetch."""

    swiper_id: str
    swiper_kind: str
    target_id: str
    target_kind: str
    liked: bool
    matched_count: int
    passed_count: int
