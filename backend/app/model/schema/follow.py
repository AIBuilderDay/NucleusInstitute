"""Schemas for the follow graph + PageRank-derived network scores.

Two graphs are scored independently:

- `people_only`     — talent → talent edges only. Score reflects how
                       central a person is in the human network.
- `full_ecosystem`  — talent → talent + talent → startup edges. Startups
                       become first-class graph nodes; their score is
                       a measure of "ecosystem attention" rather than
                       "personal centrality".

Brackets are computed *within cohort* (per RoleCategory for talent, all
startups together) so a mentor is compared to other mentors and a student
to other students — otherwise hub categories would dominate every bracket.
"""

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FollowSummary(BaseModel):
    """Compact representation of a node in the follow graph."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    headline: str = ""
    role_category: str | None = None
    primary_network: str | None = None
    photo_url: str | None = None
    sector: str | None = None
    stage: str | None = None
    one_liner: str | None = None


class TalentFollowingResponse(BaseModel):
    """What a given talent is following — split by entity type."""

    talent: list[FollowSummary] = Field(default_factory=list)
    startups: list[FollowSummary] = Field(default_factory=list)
    total: int = 0


class FollowersResponse(BaseModel):
    """Talent followers of a node (talent or startup). Only Talent can follow."""

    items: list[FollowSummary] = Field(default_factory=list)
    total: int = 0


class NetworkBracket(str, Enum):
    LIMITED = "limited_network"
    GROWING = "growing_network"
    STRONG = "strong_network"
    HIGHLY_CONNECTED = "highly_connected"


_BRACKET_LABELS: dict[NetworkBracket, str] = {
    NetworkBracket.LIMITED: "Limited network",
    NetworkBracket.GROWING: "Growing network",
    NetworkBracket.STRONG: "Strong network",
    NetworkBracket.HIGHLY_CONNECTED: "Highly connected",
}


def percentile_to_bracket(percentile: float) -> NetworkBracket:
    """Map a percentile in [0, 100] to a discrete bracket.

    Percentile is "fraction of the cohort this entity is at-or-above," so
    higher = better. Cutpoints at 25 / 50 / 75 split into four equal
    quarters.
    """
    if percentile < 25:
        return NetworkBracket.LIMITED
    if percentile < 50:
        return NetworkBracket.GROWING
    if percentile < 75:
        return NetworkBracket.STRONG
    return NetworkBracket.HIGHLY_CONNECTED


def bracket_label(bracket: NetworkBracket) -> str:
    return _BRACKET_LABELS[bracket]


class GraphScore(BaseModel):
    """One PageRank score, contextualized within a cohort."""

    score: float
    rank: int           # 1-indexed rank within cohort (lower = better-connected)
    cohort: str         # role_category for talent, "startup" for startups
    cohort_size: int
    percentile: float   # 0..100, fraction of cohort at-or-below this score
    bracket: NetworkBracket
    bracket_label: str


class NetworkScoreResponse(BaseModel):
    """A node's score across both graphs.

    `people_only` is null for startups (they aren't nodes in that graph).
    """

    entity_id: UUID
    entity_type: str  # "talent" or "startup"
    followers_count: int
    following_count: int
    people_only: GraphScore | None = None
    full_ecosystem: GraphScore
