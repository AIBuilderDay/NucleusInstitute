"""Startup API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.model.schema.startup import StartupCreate, StartupListResponse, StartupResponse
from app.service.startup_service import StartupService

router = APIRouter()


@router.post("", response_model=StartupResponse, status_code=status.HTTP_201_CREATED)
async def create_startup(
    payload: StartupCreate,
    service: StartupService = Depends(StartupService),
) -> StartupResponse:
    startup = await service.create(payload)
    return StartupResponse.model_validate(startup)


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
