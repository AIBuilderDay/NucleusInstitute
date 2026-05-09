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
    """Single-shot: feed OIDC userinfo + optional resume to Claude, return saved Talent.

    `OnboardAgentRequest` enforces that exactly one of `linkedin_userinfo` or
    `google_userinfo` is set; we forward whichever is present along with the
    provider label so the agent prompt can reference the right source.
    """
    if payload.linkedin_userinfo is not None:
        userinfo = payload.linkedin_userinfo
        provider = "linkedin"
    else:
        assert payload.google_userinfo is not None  # guaranteed by validator
        userinfo = payload.google_userinfo
        provider = "google"

    run = await service.create_talent_from_oidc(
        userinfo=userinfo,
        resume_text=payload.resume_text,
        provider=provider,
    )
    return OnboardAgentResponse(
        talent_id=run.talent.id,
        talent=TalentResponse.model_validate(run.talent),
        agent_notes=run.agent_notes,
        confidence=run.confidence,
        reasoning_bullets=run.reasoning_bullets,
        agent_raw_response=run.agent_raw_response,
    )
