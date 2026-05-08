"""Talent API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.model.schema.talent import TalentCreate, TalentListResponse, TalentResponse
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
