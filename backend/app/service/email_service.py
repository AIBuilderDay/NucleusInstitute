"""EmailService — render the outreach Jinja template + send via Resend.

The frontend's "send email" button posts to /api/v1/email/send. This service
resolves sender + recipient (talent or startup) by id, validates the recipient
has an email on file, renders the server-side Jinja template using whatever
`variables` the frontend supplied, and dispatches through the Resend HTTP API.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

import resend
from fastapi import Depends, HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings
from app.dao.factory import DAOFactory
from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.model.schema.email import ParticipantType, SendEmailRequest, SendEmailResponse

# Templates live alongside the app package so they ship with the codebase
# instead of needing a separate static-files mount.
_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates" / "email"

_jinja_env = Environment(
    loader=FileSystemLoader(_TEMPLATE_DIR),
    autoescape=select_autoescape(["html", "j2"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

_OUTREACH_TEMPLATE = "outreach.html.j2"


class EmailService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory

    async def _resolve(
        self, kind: ParticipantType, entity_id: UUID
    ) -> Talent | Startup:
        if kind == "talent":
            row = await self.dao_factory.get_talent_dao().get(entity_id)
        else:
            row = await self.dao_factory.get_startup_dao().get(entity_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{kind} {entity_id} not found",
            )
        return row

    async def send(self, payload: SendEmailRequest) -> SendEmailResponse:
        if not settings.resend_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="RESEND_API_KEY is not configured on the server.",
            )

        sender = await self._resolve(payload.sender_type, payload.sender_id)
        recipient = await self._resolve(payload.recipient_type, payload.recipient_id)

        recipient_email = getattr(recipient, "email", None)
        if not recipient_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{payload.recipient_type} {payload.recipient_id} has no email on file.",
            )

        html = _jinja_env.get_template(_OUTREACH_TEMPLATE).render(
            subject=payload.subject,
            **payload.variables,
        )

        reply_to = payload.reply_to or getattr(sender, "email", None) or settings.email_reply_to_default

        resend.api_key = settings.resend_api_key
        params: dict[str, Any] = {
            "from": settings.email_from_address,
            "to": [recipient_email],
            "subject": payload.subject,
            "html": html,
        }
        if reply_to:
            params["reply_to"] = reply_to

        try:
            result = resend.Emails.send(params)
        except Exception as exc:  # noqa: BLE001 — surface as 502 to the client
            settings.logger.warning(f"Resend send failed: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Email provider rejected the send: {exc}",
            ) from exc

        return SendEmailResponse(
            sent=True,
            resend_id=(result or {}).get("id") if isinstance(result, dict) else None,
            to=recipient_email,
        )
