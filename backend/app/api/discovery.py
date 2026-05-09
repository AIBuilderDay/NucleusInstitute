"""Discovery API — directory-style "find me X" lookups across all 8 networks.

URL pattern:
    POST /api/v1/discover/from/{talent|startup}/{focal_id}/{target}

Where `target` ∈ {operators, mentors, advisors, board_members, investors,
service_providers, students_interns, startups}.

Two perspectives × eight targets = 16 lookup endpoints. Each takes its own
filter body (typed Pydantic model in `app/provider/matching/filters.py`) and
returns a `TalentDiscoveryResponse` or `StartupDiscoveryResponse` (see
`app/model/schema/discovery.py`).

Vanilla only — uses rule_filter for scoring. The agentic path lives on
`/match/*?matcher=agentic_filter` (see `api/match.py`). Discovery is the
"directory" view; `/match/*` is the "explainable single-pair" view.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.model.schema.discovery import (
    StartupDiscoveryResponse,
    StartupDiscoveryResult,
    TalentDiscoveryResponse,
    TalentDiscoveryResult,
)
from app.model.schema.startup import StartupResponse
from app.model.schema.talent import TalentResponse
from app.provider.matching import filters
from app.service.discovery_service import DiscoveryService

router = APIRouter()


# =============================================================================
# Response builders
# =============================================================================
def _build_talent_response(
    focal: Talent | Startup,
    target_type: str,
    ranked: list[tuple[Talent, float, str | None]],
) -> TalentDiscoveryResponse:
    return TalentDiscoveryResponse(
        focal_type="talent" if isinstance(focal, Talent) else "startup",
        focal_id=focal.id,
        target_type=target_type,  # type: ignore[arg-type]
        results=[
            TalentDiscoveryResult(
                target=TalentResponse.model_validate(t),
                score=score,
                top_reason=reason,
            )
            for (t, score, reason) in ranked
        ],
        total=len(ranked),
    )


def _build_startup_response(
    focal: Talent | Startup,
    ranked: list[tuple[Startup, float, str | None]],
) -> StartupDiscoveryResponse:
    return StartupDiscoveryResponse(
        focal_type="talent" if isinstance(focal, Talent) else "startup",
        focal_id=focal.id,
        target_type="startups",
        results=[
            StartupDiscoveryResult(
                target=StartupResponse.model_validate(s),
                score=score,
                top_reason=reason,
            )
            for (s, score, reason) in ranked
        ],
        total=len(ranked),
    )


# =============================================================================
# From-talent endpoints (8)
# =============================================================================
@router.post(
    "/from/talent/{talent_id}/operators", response_model=TalentDiscoveryResponse
)
async def discover_operators_from_talent(
    talent_id: UUID,
    f: filters.OperatorFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="talent",
        focal_id=talent_id,
        target_type="operators",
        f=f or filters.OperatorFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "operators", ranked)


@router.post(
    "/from/talent/{talent_id}/mentors", response_model=TalentDiscoveryResponse
)
async def discover_mentors_from_talent(
    talent_id: UUID,
    f: filters.MentorFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="talent",
        focal_id=talent_id,
        target_type="mentors",
        f=f or filters.MentorFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "mentors", ranked)


@router.post(
    "/from/talent/{talent_id}/advisors", response_model=TalentDiscoveryResponse
)
async def discover_advisors_from_talent(
    talent_id: UUID,
    f: filters.AdvisorFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="talent",
        focal_id=talent_id,
        target_type="advisors",
        f=f or filters.AdvisorFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "advisors", ranked)


@router.post(
    "/from/talent/{talent_id}/board_members",
    response_model=TalentDiscoveryResponse,
)
async def discover_board_members_from_talent(
    talent_id: UUID,
    f: filters.BoardMemberFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="talent",
        focal_id=talent_id,
        target_type="board_members",
        f=f or filters.BoardMemberFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "board_members", ranked)


@router.post(
    "/from/talent/{talent_id}/investors", response_model=TalentDiscoveryResponse
)
async def discover_investors_from_talent(
    talent_id: UUID,
    f: filters.InvestorFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="talent",
        focal_id=talent_id,
        target_type="investors",
        f=f or filters.InvestorFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "investors", ranked)


@router.post(
    "/from/talent/{talent_id}/service_providers",
    response_model=TalentDiscoveryResponse,
)
async def discover_service_providers_from_talent(
    talent_id: UUID,
    f: filters.ServiceProviderFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="talent",
        focal_id=talent_id,
        target_type="service_providers",
        f=f or filters.ServiceProviderFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "service_providers", ranked)


@router.post(
    "/from/talent/{talent_id}/students_interns",
    response_model=TalentDiscoveryResponse,
)
async def discover_students_interns_from_talent(
    talent_id: UUID,
    f: filters.StudentInternFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="talent",
        focal_id=talent_id,
        target_type="students_interns",
        f=f or filters.StudentInternFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "students_interns", ranked)


@router.post(
    "/from/talent/{talent_id}/startups", response_model=StartupDiscoveryResponse
)
async def discover_startups_from_talent(
    talent_id: UUID,
    f: filters.StartupFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> StartupDiscoveryResponse:
    focal, ranked = await service.find_startups(
        focal_type="talent",
        focal_id=talent_id,
        f=f or filters.StartupFilters(),
        top_k=top_k,
    )
    return _build_startup_response(focal, ranked)


# =============================================================================
# From-startup endpoints (8)
# =============================================================================
@router.post(
    "/from/startup/{startup_id}/operators",
    response_model=TalentDiscoveryResponse,
)
async def discover_operators_from_startup(
    startup_id: UUID,
    f: filters.OperatorFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="startup",
        focal_id=startup_id,
        target_type="operators",
        f=f or filters.OperatorFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "operators", ranked)


@router.post(
    "/from/startup/{startup_id}/mentors", response_model=TalentDiscoveryResponse
)
async def discover_mentors_from_startup(
    startup_id: UUID,
    f: filters.MentorFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="startup",
        focal_id=startup_id,
        target_type="mentors",
        f=f or filters.MentorFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "mentors", ranked)


@router.post(
    "/from/startup/{startup_id}/advisors",
    response_model=TalentDiscoveryResponse,
)
async def discover_advisors_from_startup(
    startup_id: UUID,
    f: filters.AdvisorFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="startup",
        focal_id=startup_id,
        target_type="advisors",
        f=f or filters.AdvisorFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "advisors", ranked)


@router.post(
    "/from/startup/{startup_id}/board_members",
    response_model=TalentDiscoveryResponse,
)
async def discover_board_members_from_startup(
    startup_id: UUID,
    f: filters.BoardMemberFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="startup",
        focal_id=startup_id,
        target_type="board_members",
        f=f or filters.BoardMemberFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "board_members", ranked)


@router.post(
    "/from/startup/{startup_id}/investors",
    response_model=TalentDiscoveryResponse,
)
async def discover_investors_from_startup(
    startup_id: UUID,
    f: filters.InvestorFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="startup",
        focal_id=startup_id,
        target_type="investors",
        f=f or filters.InvestorFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "investors", ranked)


@router.post(
    "/from/startup/{startup_id}/service_providers",
    response_model=TalentDiscoveryResponse,
)
async def discover_service_providers_from_startup(
    startup_id: UUID,
    f: filters.ServiceProviderFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="startup",
        focal_id=startup_id,
        target_type="service_providers",
        f=f or filters.ServiceProviderFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "service_providers", ranked)


@router.post(
    "/from/startup/{startup_id}/students_interns",
    response_model=TalentDiscoveryResponse,
)
async def discover_students_interns_from_startup(
    startup_id: UUID,
    f: filters.StudentInternFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> TalentDiscoveryResponse:
    focal, ranked = await service.find_talent_network(
        focal_type="startup",
        focal_id=startup_id,
        target_type="students_interns",
        f=f or filters.StudentInternFilters(),
        top_k=top_k,
    )
    return _build_talent_response(focal, "students_interns", ranked)


@router.post(
    "/from/startup/{startup_id}/startups",
    response_model=StartupDiscoveryResponse,
)
async def discover_startups_from_startup(
    startup_id: UUID,
    f: filters.StartupFilters | None = None,
    top_k: int = Query(20, ge=1, le=100),
    service: DiscoveryService = Depends(DiscoveryService),
) -> StartupDiscoveryResponse:
    focal, ranked = await service.find_startups(
        focal_type="startup",
        focal_id=startup_id,
        f=f or filters.StartupFilters(),
        top_k=top_k,
    )
    return _build_startup_response(focal, ranked)
