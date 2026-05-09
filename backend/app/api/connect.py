"""Connect API — agentic outreach-strategy advice.

Single endpoint, single shot. Frontend POSTs viewer + target, gets back
follow-graph facts, PageRank context, and Claude-written bullets covering
fit, approach, and questions to ask.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.model.schema.connect import (
    ConnectStrategyRequest,
    ConnectStrategyResponse,
)
from app.service.connect_service import ConnectService

router = APIRouter()


@router.post("/strategy", response_model=ConnectStrategyResponse)
async def connect_strategy(
    payload: ConnectStrategyRequest,
    service: ConnectService = Depends(ConnectService),
) -> ConnectStrategyResponse:
    """Return an agent-drafted outreach plan for connecting viewer → target.

    Body:
        viewer_type / viewer_id  the logged-in user (talent or startup)
        target_type / target_id  the profile they're looking at

    Response merges:
      - structurally-computed facts (already_connected, target_follows_viewer,
        mutual_connections + count, PageRank brackets)
      - agent-written prose (fit bullets, approach bullets, questions, notes)
      - agent-self-reported confidence (clamped to [0, 1] + bucketed label)

    Costs 1–6 Anthropic calls per request. Returns 503 if ANTHROPIC_API_KEY
    is unset, 404 if either entity doesn't exist, 502 if the agent never
    produces a final JSON envelope.
    """
    return await service.build_strategy(payload)
