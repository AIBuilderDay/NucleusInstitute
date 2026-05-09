"""Swipe API routes for the Tinder-style matching UI.

Three legal swiper/target combos (startup -> startup is rejected):

- POST/DELETE /swipe/talent/{swiper_id}/talent/{target_id}
- POST/DELETE /swipe/talent/{swiper_id}/startup/{target_id}
- POST/DELETE /swipe/startup/{swiper_id}/talent/{target_id}

POST body: {"liked": bool}     (true = matched, false = passed)
DELETE: removes the target from both lists for that swiper

GET /swipe/talent/{swiper_id}/talents
GET /swipe/talent/{swiper_id}/startups
GET /swipe/startup/{swiper_id}/talents
    -> { "matched": [...], "passed": [...] }
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.model.schema.swipe import (
    StartupSwipeListsResponse,
    SwipeAckResponse,
    SwipeRequest,
    TalentSwipeListsResponse,
)
from app.service.swipe_service import SwipeService

router = APIRouter()


# ---------- talent swiper -------------------------------------------------------

@router.post(
    "/talent/{swiper_id}/talent/{target_id}",
    response_model=SwipeAckResponse,
)
async def talent_swipe_talent(
    swiper_id: UUID,
    target_id: UUID,
    payload: SwipeRequest,
    service: SwipeService = Depends(SwipeService),
) -> SwipeAckResponse:
    try:
        return await service.record_swipe(
            swiper_id=swiper_id,
            swiper_kind="talent",
            target_id=target_id,
            target_kind="talent",
            liked=payload.liked,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete(
    "/talent/{swiper_id}/talent/{target_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def talent_unswipe_talent(
    swiper_id: UUID,
    target_id: UUID,
    service: SwipeService = Depends(SwipeService),
) -> None:
    await service.clear_swipe(
        swiper_id=swiper_id,
        swiper_kind="talent",
        target_id=target_id,
        target_kind="talent",
    )


@router.post(
    "/talent/{swiper_id}/startup/{target_id}",
    response_model=SwipeAckResponse,
)
async def talent_swipe_startup(
    swiper_id: UUID,
    target_id: UUID,
    payload: SwipeRequest,
    service: SwipeService = Depends(SwipeService),
) -> SwipeAckResponse:
    try:
        return await service.record_swipe(
            swiper_id=swiper_id,
            swiper_kind="talent",
            target_id=target_id,
            target_kind="startup",
            liked=payload.liked,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete(
    "/talent/{swiper_id}/startup/{target_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def talent_unswipe_startup(
    swiper_id: UUID,
    target_id: UUID,
    service: SwipeService = Depends(SwipeService),
) -> None:
    await service.clear_swipe(
        swiper_id=swiper_id,
        swiper_kind="talent",
        target_id=target_id,
        target_kind="startup",
    )


@router.get(
    "/talent/{swiper_id}/talents",
    response_model=TalentSwipeListsResponse,
)
async def list_talent_swiper_talent_lists(
    swiper_id: UUID,
    service: SwipeService = Depends(SwipeService),
) -> TalentSwipeListsResponse:
    return await service.get_talent_lists(swiper_id, "talent")


@router.get(
    "/talent/{swiper_id}/startups",
    response_model=StartupSwipeListsResponse,
)
async def list_talent_swiper_startup_lists(
    swiper_id: UUID,
    service: SwipeService = Depends(SwipeService),
) -> StartupSwipeListsResponse:
    return await service.get_startup_lists(swiper_id, "talent")


# ---------- startup swiper ------------------------------------------------------

@router.post(
    "/startup/{swiper_id}/talent/{target_id}",
    response_model=SwipeAckResponse,
)
async def startup_swipe_talent(
    swiper_id: UUID,
    target_id: UUID,
    payload: SwipeRequest,
    service: SwipeService = Depends(SwipeService),
) -> SwipeAckResponse:
    try:
        return await service.record_swipe(
            swiper_id=swiper_id,
            swiper_kind="startup",
            target_id=target_id,
            target_kind="talent",
            liked=payload.liked,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete(
    "/startup/{swiper_id}/talent/{target_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def startup_unswipe_talent(
    swiper_id: UUID,
    target_id: UUID,
    service: SwipeService = Depends(SwipeService),
) -> None:
    await service.clear_swipe(
        swiper_id=swiper_id,
        swiper_kind="startup",
        target_id=target_id,
        target_kind="talent",
    )


@router.get(
    "/startup/{swiper_id}/talents",
    response_model=TalentSwipeListsResponse,
)
async def list_startup_swiper_talent_lists(
    swiper_id: UUID,
    service: SwipeService = Depends(SwipeService),
) -> TalentSwipeListsResponse:
    return await service.get_talent_lists(swiper_id, "startup")
