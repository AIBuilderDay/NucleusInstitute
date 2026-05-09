"""Auto-match API routes — weekly digest subscription registry + manual triggers.

Routes:
- POST   /auto-match/subscribe                                    subscribe / re-subscribe / update overrides
- DELETE /auto-match/subscribe/{subject_kind}/{subject_id}        soft-disable
- GET    /auto-match/subscriptions                                list all
- GET    /auto-match/subscriptions/{subject_kind}/{subject_id}    fetch one
- POST   /auto-match/run-now                                      run for every active+due subscription
- POST   /auto-match/run-now/{subject_kind}/{subject_id}          force-run for one subscription

The cron tick (APScheduler in main.py's lifespan) calls the same
`run_due()` path the `/run-now` endpoint hits.
"""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.model.schema.auto_match import (
    RunNowResponse,
    SubscribeRequest,
    SubscriptionListResponse,
    SubscriptionResponse,
)
from app.service.auto_match_service import AutoMatchService

router = APIRouter()

SubjectKindPath = Literal["talent", "startup"]


@router.post("/subscribe", response_model=SubscriptionResponse)
async def subscribe(
    payload: SubscribeRequest,
    service: AutoMatchService = Depends(AutoMatchService),
) -> SubscriptionResponse:
    """Subscribe a talent or startup to the weekly auto-match digest.

    Re-posting for an existing subject reactivates it and updates
    `frequency_days` + email overrides. Returns the persisted subscription.
    """
    return await service.subscribe(payload)


@router.delete(
    "/subscribe/{subject_kind}/{subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unsubscribe(
    subject_kind: SubjectKindPath,
    subject_id: UUID,
    service: AutoMatchService = Depends(AutoMatchService),
) -> None:
    """Soft-disable a subscription. The row stays so re-subscribing
    preserves history (and the sent-pair log keeps blocking duplicates)."""
    changed = await service.unsubscribe(subject_kind, subject_id)
    if not changed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active subscription for {subject_kind}:{subject_id}",
        )


@router.get("/subscriptions", response_model=SubscriptionListResponse)
async def list_subscriptions(
    service: AutoMatchService = Depends(AutoMatchService),
) -> SubscriptionListResponse:
    rows = await service.list_subscriptions()
    return SubscriptionListResponse(subscriptions=rows)


@router.get(
    "/subscriptions/{subject_kind}/{subject_id}",
    response_model=SubscriptionResponse,
)
async def get_subscription(
    subject_kind: SubjectKindPath,
    subject_id: UUID,
    service: AutoMatchService = Depends(AutoMatchService),
) -> SubscriptionResponse:
    row = await service.get_one(subject_kind, subject_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No subscription for {subject_kind}:{subject_id}",
        )
    return row


@router.post("/run-now", response_model=RunNowResponse)
async def run_now_all(
    service: AutoMatchService = Depends(AutoMatchService),
) -> RunNowResponse:
    """Run the digest for every active+due subscription. Cron uses the
    same code path. Useful for demos and manual ops."""
    reports = await service.run_due()
    return RunNowResponse(reports=reports)


@router.post(
    "/run-now/{subject_kind}/{subject_id}",
    response_model=RunNowResponse,
)
async def run_now_one(
    subject_kind: SubjectKindPath,
    subject_id: UUID,
    service: AutoMatchService = Depends(AutoMatchService),
) -> RunNowResponse:
    """Force-run the digest for one subscription regardless of `last_run_at`."""
    report = await service.run_for_subject(subject_kind, subject_id)
    return RunNowResponse(reports=[report])
