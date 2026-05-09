"""Email API routes — outreach send button on the frontend lands here."""

from fastapi import APIRouter, Depends, status

from app.model.schema.email import SendEmailRequest, SendEmailResponse
from app.service.email_service import EmailService

router = APIRouter()


@router.post("/send", response_model=SendEmailResponse, status_code=status.HTTP_200_OK)
async def send_email(
    payload: SendEmailRequest,
    service: EmailService = Depends(EmailService),
) -> SendEmailResponse:
    """Render the outreach Jinja template with `variables` and send via Resend.

    Resolves `(sender_type, sender_id)` and `(recipient_type, recipient_id)` —
    each can be a talent or a startup. The recipient's `email` column is the
    TO address; reply-to defaults to the sender's email so replies route back
    to the human, not the platform.
    """
    return await service.send(payload)
