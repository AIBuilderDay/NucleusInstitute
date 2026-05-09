"""Match result schemas — same shape regardless of which MatchingProvider produced them.

This uniformity is the contract that makes the matcher swappable: the frontend
match card renders identically whether the matches came from rule_filter,
embedding, or agentic. See PLAN.md §2a.
"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.model.schema.startup import StartupResponse
from app.model.schema.talent import TalentResponse


class MatchResult(BaseModel):
    """One match between a talent and a startup, with explainable breakdown."""

    talent_id: UUID
    startup_id: UUID
    score: float = Field(ge=0.0, le=1.0, description="Final 0–1 score after weights")
    passed_hard_filters: bool
    dimension_scores: dict[str, float] = Field(
        default_factory=dict,
        description="Per-dimension 0–1 scores e.g. {'sector': 1.0, 'role': 0.66}",
    )
    reasons: list[str] = Field(
        default_factory=list,
        description="Human-readable 'why matched' bullets shown on the match card",
    )
    blockers: list[str] = Field(
        default_factory=list,
        description="Hard-filter failures explaining why a match was excluded",
    )
    matcher: str = Field(description="Which provider produced this result (rule_filter, embedding, ...)")
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Agent-supplied 0–1 confidence in this pick. Only set when an LLM matcher produced the result.",
    )
    agent_notes: str | None = Field(
        default=None,
        description="One-sentence overall take written by the agent. None for deterministic matchers.",
    )
    agent_raw_response: str | None = Field(
        default=None,
        description=(
            "The agent's full final-turn text (typically a <REASONING>...</REASONING> "
            "block). Carried through unparsed so the frontend can re-parse or display "
            "it verbatim if backend parsing produced incomplete structured fields."
        ),
    )


class TalentMatchResponse(BaseModel):
    """Result of POST /match/talent/{id} — top startups for a given talent."""

    talent: TalentResponse
    matcher: str
    matches: list[MatchResult]


class StartupMatchResponse(BaseModel):
    """Result of POST /match/startup/{id} — top talent for a given startup."""

    startup: StartupResponse
    matcher: str
    matches: list[MatchResult]


class MatchCompareResponse(BaseModel):
    """Result of /match/.../compare — side-by-side from every registered matcher."""

    by_matcher: dict[str, list[MatchResult]]
