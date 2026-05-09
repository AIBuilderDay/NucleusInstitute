"""Pydantic schemas for the auto-match weekly digest endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

SubjectKind = Literal["talent", "startup"]
TargetKind = Literal["talent", "startup"]


class SubscribeRequest(BaseModel):
    """Body for POST /auto-match/subscribe.

    `email_subject_override` and `email_body_html_override` must be both null
    or both set. If set, the digest uses them verbatim and skips the drafter
    agent. If null, the agent drafts per-recipient.
    """

    subject_kind: SubjectKind
    subject_id: UUID
    frequency_days: int = Field(default=7, ge=1, le=90)
    email_subject_override: str | None = Field(default=None, max_length=300)
    email_body_html_override: str | None = None

    @model_validator(mode="after")
    def _both_overrides_or_neither(self) -> SubscribeRequest:
        a = self.email_subject_override
        b = self.email_body_html_override
        if (a is None) != (b is None):
            raise ValueError(
                "email_subject_override and email_body_html_override must both "
                "be set or both be null"
            )
        return self


class SubscriptionResponse(BaseModel):
    id: UUID
    subject_kind: SubjectKind
    subject_id: UUID
    active: bool
    frequency_days: int
    last_run_at: datetime | None
    has_email_override: bool
    created_at: datetime
    updated_at: datetime


class SubscriptionListResponse(BaseModel):
    subscriptions: list[SubscriptionResponse]


class RunReport(BaseModel):
    """Result of running the digest for a single subscriber."""

    subscription_id: UUID
    subject_kind: SubjectKind
    subject_id: UUID
    matches_considered: int
    emails_sent: int
    skipped: int
    used_override: bool
    notes: list[str] = Field(default_factory=list)


class RunNowResponse(BaseModel):
    """Result of POST /auto-match/run-now (one subscriber or all due)."""

    reports: list[RunReport]
