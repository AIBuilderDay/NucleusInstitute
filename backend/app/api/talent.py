"""Talent API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.model.schema.follow import (
    FollowersResponse,
    NetworkScoreResponse,
    TalentFollowingResponse,
)
from app.model.schema.profile_extension import (
    TalentProfileExtensionResponse,
    TalentProfileExtensionUpsert,
)
from app.model.schema.talent import TalentCreate, TalentListResponse, TalentResponse
from app.service.network_service import NetworkService
from app.service.talent_service import TalentService

router = APIRouter()


@router.post("", response_model=TalentResponse, status_code=status.HTTP_201_CREATED)
async def create_talent(
    payload: TalentCreate,
    service: TalentService = Depends(TalentService),
) -> TalentResponse:
    existing = await service.get_by_email(payload.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Talent with email {payload.email} already exists",
        )
    talent = await service.create(payload)
    return TalentResponse.model_validate(talent)


@router.get("", response_model=TalentListResponse)
async def list_talent(
    limit: int | None = None,
    service: TalentService = Depends(TalentService),
) -> TalentListResponse:
    items = await service.list_all(limit=limit)
    return TalentListResponse(
        items=[TalentResponse.model_validate(t) for t in items],
        total=len(items),
    )


@router.get("/{talent_id}", response_model=TalentResponse)
async def get_talent(
    talent_id: UUID,
    service: TalentService = Depends(TalentService),
) -> TalentResponse:
    talent = await service.get(talent_id)
    if talent is None:
        raise HTTPException(status_code=404, detail=f"Talent {talent_id} not found")
    return TalentResponse.model_validate(talent)


@router.get("/{talent_id}/profile", response_model=TalentProfileExtensionResponse)
async def get_talent_profile_extension(
    talent_id: UUID,
    service: TalentService = Depends(TalentService),
) -> TalentProfileExtensionResponse:
    talent = await service.get(talent_id)
    if talent is None:
        raise HTTPException(status_code=404, detail=f"Talent {talent_id} not found")
    profile = await service.get_profile_extension(talent_id)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=f"No extended profile for talent {talent_id}",
        )
    return TalentProfileExtensionResponse.model_validate(profile)


@router.put("/{talent_id}/profile", response_model=TalentProfileExtensionResponse)
async def upsert_talent_profile_extension(
    talent_id: UUID,
    payload: TalentProfileExtensionUpsert,
    service: TalentService = Depends(TalentService),
) -> TalentProfileExtensionResponse:
    talent = await service.get(talent_id)
    if talent is None:
        raise HTTPException(status_code=404, detail=f"Talent {talent_id} not found")
    profile = await service.upsert_profile_extension(talent_id, payload)
    return TalentProfileExtensionResponse.model_validate(profile)


# ---------- Follow graph + network score ----------------------------------------
#
# A talent is the only entity that can *initiate* a follow. Whom they follow can
# be either another talent (any of the 9 RoleCategory values — exec, operator,
# student, intern, board_member, advisor, mentor, investor, service_provider) or
# a startup. The two are split into separate tables/endpoints so the FK is
# explicit and the PageRank service can reason about them as distinct edge sets.


@router.post("/{talent_id}/follow/talent/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def follow_talent(
    talent_id: UUID,
    target_id: UUID,
    service: NetworkService = Depends(NetworkService),
) -> None:
    try:
        await service.follow_talent(talent_id, target_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/{talent_id}/follow/talent/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_talent(
    talent_id: UUID,
    target_id: UUID,
    service: NetworkService = Depends(NetworkService),
) -> None:
    await service.unfollow_talent(talent_id, target_id)


@router.post("/{talent_id}/follow/startup/{startup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def follow_startup(
    talent_id: UUID,
    startup_id: UUID,
    service: NetworkService = Depends(NetworkService),
) -> None:
    try:
        await service.follow_startup(talent_id, startup_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete(
    "/{talent_id}/follow/startup/{startup_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def unfollow_startup(
    talent_id: UUID,
    startup_id: UUID,
    service: NetworkService = Depends(NetworkService),
) -> None:
    await service.unfollow_startup(talent_id, startup_id)


@router.get("/{talent_id}/following", response_model=TalentFollowingResponse)
async def list_talent_following(
    talent_id: UUID,
    talent_service: TalentService = Depends(TalentService),
    service: NetworkService = Depends(NetworkService),
) -> TalentFollowingResponse:
    if await talent_service.get(talent_id) is None:
        raise HTTPException(status_code=404, detail=f"Talent {talent_id} not found")
    return await service.get_following(talent_id)


@router.get("/{talent_id}/followers", response_model=FollowersResponse)
async def list_talent_followers(
    talent_id: UUID,
    talent_service: TalentService = Depends(TalentService),
    service: NetworkService = Depends(NetworkService),
) -> FollowersResponse:
    if await talent_service.get(talent_id) is None:
        raise HTTPException(status_code=404, detail=f"Talent {talent_id} not found")
    return await service.get_talent_followers(talent_id)


@router.get("/{talent_id}/network-score", response_model=NetworkScoreResponse)
async def get_talent_network_score(
    talent_id: UUID,
    service: NetworkService = Depends(NetworkService),
) -> NetworkScoreResponse:
    score = await service.get_talent_score(talent_id)
    if score is None:
        raise HTTPException(status_code=404, detail=f"Talent {talent_id} not found")
    return score
