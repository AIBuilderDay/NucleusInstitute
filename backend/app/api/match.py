"""Match API routes — single-matcher and compare-all."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.model.schema.match import (
    MatchCompareResponse,
    StartupMatchResponse,
    TalentMatchResponse,
)
from app.model.schema.startup import StartupResponse
from app.model.schema.talent import TalentResponse
from app.service.matching_service import MatchingService

router = APIRouter()


@router.post("/talent/{talent_id}", response_model=TalentMatchResponse)
async def match_talent_to_startups(
    talent_id: UUID,
    top_k: int = Query(5, ge=1, le=50),
    matcher: str | None = Query(None, description="Override default matcher (e.g. rule_filter)"),
    service: MatchingService = Depends(MatchingService),
) -> TalentMatchResponse:
    talent, name, matches = await service.match_talent_to_startups(
        talent_id, top_k=top_k, matcher_name=matcher
    )
    return TalentMatchResponse(
        talent=TalentResponse.model_validate(talent),
        matcher=name,
        matches=matches,
    )


@router.post("/startup/{startup_id}", response_model=StartupMatchResponse)
async def match_startup_to_talent(
    startup_id: UUID,
    top_k: int = Query(5, ge=1, le=50),
    matcher: str | None = Query(None, description="Override default matcher"),
    service: MatchingService = Depends(MatchingService),
) -> StartupMatchResponse:
    startup, name, matches = await service.match_startup_to_talent(
        startup_id, top_k=top_k, matcher_name=matcher
    )
    return StartupMatchResponse(
        startup=StartupResponse.model_validate(startup),
        matcher=name,
        matches=matches,
    )


@router.post("/talent/{talent_id}/compare", response_model=MatchCompareResponse)
async def compare_matchers_for_talent(
    talent_id: UUID,
    top_k: int = Query(5, ge=1, le=50),
    service: MatchingService = Depends(MatchingService),
) -> MatchCompareResponse:
    by_matcher = await service.compare_talent_matchers(talent_id, top_k=top_k)
    return MatchCompareResponse(by_matcher=by_matcher)


@router.post("/startup/{startup_id}/compare", response_model=MatchCompareResponse)
async def compare_matchers_for_startup(
    startup_id: UUID,
    top_k: int = Query(5, ge=1, le=50),
    service: MatchingService = Depends(MatchingService),
) -> MatchCompareResponse:
    by_matcher = await service.compare_startup_matchers(startup_id, top_k=top_k)
    return MatchCompareResponse(by_matcher=by_matcher)
