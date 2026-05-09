"""Pydantic schemas for the outreach email endpoint."""

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

ParticipantType = Literal["talent", "startup"]


class SendEmailRequest(BaseModel):
    """Frontend submits this when a user clicks "send email" on a profile.

    Sender / recipient are looked up server-side via (type, id). The recipient's
    `email` column is the actual TO address; if it's null the request 400s.
    Everything in `variables` is forwarded to the Jinja template untouched, so
    the frontend controls subject line, body, banner copy, optional CTA, etc.
    """

    sender_type: ParticipantType
    sender_id: UUID
    recipient_type: ParticipantType
    recipient_id: UUID

    subject: str = Field(min_length=1, max_length=300)
    variables: dict[str, Any] = Field(default_factory=dict)

    # Optional override — e.g. a no-reply address. Defaults to the sender's
    # email so replies go straight back to the human who sent it.
    reply_to: EmailStr | None = None


class SendEmailResponse(BaseModel):
    sent: bool
    resend_id: str | None = None
    to: EmailStr
