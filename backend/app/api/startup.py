"""Startup API routes."""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.model.schema.follow import FollowersResponse, NetworkScoreResponse
from app.model.schema.profile_extension import (
    StartupProfileExtensionResponse,
    StartupProfileExtensionUpsert,
)
from app.model.schema.startup import (
    StartupFullCreate,
    StartupFullResponse,
    StartupListResponse,
    StartupResponse,
)
from app.provider.matching.embedding import prewarm_startup_embedding
from app.service.network_service import NetworkService
from app.service.startup_service import StartupService

router = APIRouter()


@router.post("", response_model=StartupFullResponse, status_code=status.HTTP_201_CREATED)
async def create_startup(
    payload: StartupFullCreate,
    background: BackgroundTasks,
    service: StartupService = Depends(StartupService),
) -> StartupFullResponse:
    """Create a Startup: lean profile + (optional) extended profile + embedding.

    Same one-shot shape as `POST /talent` — see that docstring for rationale.
    """
    startup, profile = await service.create_with_profile(payload)
    background.add_task(prewarm_startup_embedding, startup.id)
    return StartupFullResponse(
        **StartupResponse.model_validate(startup).model_dump(),
        profile_extension=(
            StartupProfileExtensionResponse.model_validate(profile)
            if profile is not None
            else None
        ),
    )


@router.get("", response_model=StartupListResponse)
async def list_startups(
    limit: int | None = None,
    service: StartupService = Depends(StartupService),
) -> StartupListResponse:
    items = await service.list_all(limit=limit)
    return StartupListResponse(
        items=[StartupResponse.model_validate(s) for s in items],
        total=len(items),
    )


@router.get("/{startup_id}", response_model=StartupResponse)
async def get_startup(
    startup_id: UUID,
    service: StartupService = Depends(StartupService),
) -> StartupResponse:
    startup = await service.get(startup_id)
    if startup is None:
        raise HTTPException(status_code=404, detail=f"Startup {startup_id} not found")
    return StartupResponse.model_validate(startup)


@router.get("/{startup_id}/profile", response_model=StartupProfileExtensionResponse)
async def get_startup_profile_extension(
    startup_id: UUID,
    service: StartupService = Depends(StartupService),
) -> StartupProfileExtensionResponse:
    startup = await service.get(startup_id)
    if startup is None:
        raise HTTPException(status_code=404, detail=f"Startup {startup_id} not found")
    profile = await service.get_profile_extension(startup_id)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=f"No extended profile for startup {startup_id}",
        )
    return StartupProfileExtensionResponse.model_validate(profile)


@router.put("/{startup_id}/profile", response_model=StartupProfileExtensionResponse)
async def upsert_startup_profile_extension(
    startup_id: UUID,
    payload: StartupProfileExtensionUpsert,
    service: StartupService = Depends(StartupService),
) -> StartupProfileExtensionResponse:
    startup = await service.get(startup_id)
    if startup is None:
        raise HTTPException(status_code=404, detail=f"Startup {startup_id} not found")
    profile = await service.upsert_profile_extension(startup_id, payload)
    return StartupProfileExtensionResponse.model_validate(profile)


# Startups can't follow anything, but they accumulate followers (talent who hit
# "save" / "watch" on the startup) and they get a network score in the
# full_ecosystem PageRank graph.


@router.get("/{startup_id}/followers", response_model=FollowersResponse)
async def list_startup_followers(
    startup_id: UUID,
    startup_service: StartupService = Depends(StartupService),
    network: NetworkService = Depends(NetworkService),
) -> FollowersResponse:
    if await startup_service.get(startup_id) is None:
        raise HTTPException(status_code=404, detail=f"Startup {startup_id} not found")
    return await network.get_startup_followers(startup_id)


@router.get("/{startup_id}/network-score", response_model=NetworkScoreResponse)
async def get_startup_network_score(
    startup_id: UUID,
    network: NetworkService = Depends(NetworkService),
) -> NetworkScoreResponse:
    score = await network.get_startup_score(startup_id)
    if score is None:
        raise HTTPException(status_code=404, detail=f"Startup {startup_id} not found")
    return score
