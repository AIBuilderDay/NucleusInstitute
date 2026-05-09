"""Onboard API routes — drive the Claude agent that builds a Talent profile."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.model.schema.auth import OnboardAgentRequest, OnboardAgentResponse
from app.model.schema.talent import TalentResponse
from app.service.onboard_service import OnboardService

router = APIRouter()


@router.post("/agent", response_model=OnboardAgentResponse)
async def onboard_agent(
    payload: OnboardAgentRequest,
    service: OnboardService = Depends(OnboardService),
) -> OnboardAgentResponse:
    """Single-shot: feed LinkedIn userinfo + optional resume to Claude, return saved Talent."""
    talent, agent_notes = await service.create_talent_from_linkedin(
        linkedin_userinfo=payload.linkedin_userinfo,
        resume_text=payload.resume_text,
    )
    return OnboardAgentResponse(
        talent_id=talent.id,
        talent=TalentResponse.model_validate(talent),
        agent_notes=agent_notes,
    )
