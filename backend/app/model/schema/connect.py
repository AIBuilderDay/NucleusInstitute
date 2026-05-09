"""Schemas for the connect-strategy agent.

Powers the frontend's "How should I connect with this person?" button. Body
identifies the viewer (the logged-in user) + the target (whose profile is
being viewed); the response is a mix of deterministic facts (already-following,
mutual followers, PageRank brackets) and agent-written prose (fit bullets,
approach bullets, questions to ask, self-reported confidence).
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

EntityType = Literal["talent", "startup"]
ConfidenceLabel = Literal["low", "medium", "high"]


class ConnectStrategyRequest(BaseModel):
    viewer_type: EntityType
    viewer_id: UUID
    target_type: EntityType
    target_id: UUID


class MutualConnection(BaseModel):
    """A node in the follow graph that bridges viewer and target — useful for
    warm intros. The exact bridging semantics depend on viewer/target types
    (see ConnectService._mutual_connections)."""

    id: UUID
    name: str
    headline: str = ""
    role_category: str | None = None


class GraphBracket(BaseModel):
    """Slimmed-down PageRank bracket info — what the agent and frontend need."""

    bracket: str | None = None
    bracket_label: str | None = None
    percentile: float | None = None
    cohort: str | None = None
    cohort_size: int | None = None


class NetworkContext(BaseModel):
    viewer: GraphBracket = Field(default_factory=GraphBracket)
    target: GraphBracket = Field(default_factory=GraphBracket)
    mutual_connections: list[MutualConnection] = Field(default_factory=list)


class ConnectStrategyResponse(BaseModel):
    viewer_type: EntityType
    viewer_id: UUID
    target_type: EntityType
    target_id: UUID

    # --- structural facts (server-computed; never agent-supplied) -----------
    already_connected: bool
    target_follows_viewer: bool  # only meaningful for talent → talent
    mutual_connections_count: int
    network_context: NetworkContext

    # --- agent-written prose ------------------------------------------------
    confidence: float
    confidence_label: ConfidenceLabel
    fit_bullets: list[str] = Field(default_factory=list)
    approach_bullets: list[str] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)
    agent_notes: str | None = None
    agent_raw_response: str | None = Field(
        default=None,
        description=(
            "The agent's full final-turn text (typically a <REASONING>...</REASONING> "
            "block). Carried through unparsed so the frontend can fall back to verbatim "
            "display if backend parsing missed any structured fields."
        ),
    )
