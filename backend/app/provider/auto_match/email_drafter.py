"""AutoMatchEmailDrafter — Anthropic-powered drafter for the weekly digest.

Loop contract mirrors `AgenticFilterMatcher`:
- Up to MAX_LOOP_ITERATIONS Anthropic calls per pair.
- Agent navigates the auto-match-email MCP toolkit (sender profile,
  recipient profile, match details, overlap) until it has enough to
  write the email.
- Final answer: a single JSON object `{"subject": "...", "body_html": "..."}`.
- If the agent never produces usable JSON, the drafter returns a
  deterministic fallback so the digest still ships.

The drafter is stateless. One instance is shared across cron runs;
`draft(...)` is called once per (subscriber, match) pair.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from anthropic import AsyncAnthropic
from fastmcp import Client

from app.core.config import settings
from app.dao.factory import DAOFactory
from app.mcp.auto_match_email_server import build_auto_match_email_mcp_server
from app.model.schema.match import MatchResult

MODEL_ID = "claude-sonnet-4-6"
MAX_LOOP_ITERATIONS = 4
MAX_TOKENS = 1500


@dataclass
class DraftedEmail:
    subject: str
    body_html: str
    fallback_used: bool = False


class AutoMatchEmailDrafter:
    """Drafts a single auto-match email per (sender, recipient) pair."""

    def __init__(self) -> None:
        self._client: AsyncAnthropic | None = None

    def _get_client(self) -> AsyncAnthropic | None:
        """Return None when ANTHROPIC_API_KEY is missing — the caller will
        use the fallback template instead of crashing the cron run."""
        if not settings.anthropic_api_key:
            return None
        if self._client is None:
            self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        return self._client

    async def draft(
        self,
        *,
        daos: DAOFactory,
        sender_kind: str,
        sender_id: UUID,
        sender_name: str,
        recipient_kind: str,
        recipient_id: UUID,
        recipient_name: str,
        match: MatchResult,
    ) -> DraftedEmail:
        """Draft `{subject, body_html}` for one digest entry.

        Falls back to a deterministic template if the agent isn't
        available or doesn't produce parseable JSON. Never raises —
        the cron's job is to ship emails, not surface drafter errors.
        """
        client = self._get_client()
        if client is None:
            return self._fallback(sender_name, recipient_name, recipient_kind, match)

        server = build_auto_match_email_mcp_server(
            daos=daos,
            sender_kind=sender_kind,
            sender_id=sender_id,
            recipient_kind=recipient_kind,
            recipient_id=recipient_id,
            match=match,
        )

        try:
            async with Client(server) as mcp_client:
                mcp_tools = await mcp_client.list_tools()
                anthropic_tools: list[dict[str, Any]] = [
                    {
                        "name": t.name,
                        "description": t.description or "",
                        "input_schema": t.inputSchema,
                    }
                    for t in mcp_tools
                ]

                messages: list[dict[str, Any]] = [
                    {"role": "user", "content": self._user_prompt(sender_name, recipient_name)}
                ]
                drafted: dict[str, Any] | None = None

                for _ in range(MAX_LOOP_ITERATIONS):
                    response = await client.messages.create(
                        model=MODEL_ID,
                        max_tokens=MAX_TOKENS,
                        system=self._system_prompt(),
                        tools=anthropic_tools,
                        messages=messages,
                    )
                    messages.append({"role": "assistant", "content": response.content})

                    if response.stop_reason != "tool_use":
                        final_text = "".join(
                            b.text for b in response.content
                            if getattr(b, "type", None) == "text"
                        )
                        drafted = self._parse_drafted(final_text)
                        break

                    tool_results: list[dict[str, Any]] = []
                    for block in response.content:
                        if getattr(block, "type", None) != "tool_use":
                            continue
                        try:
                            mcp_result = await mcp_client.call_tool(block.name, block.input)
                            payload = (
                                mcp_result.data if mcp_result.data is not None else {}
                            )
                            content_text = json.dumps(payload, default=str)
                        except Exception as exc:  # noqa: BLE001
                            content_text = json.dumps({"error": str(exc)})
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": content_text,
                            }
                        )
                    messages.append({"role": "user", "content": tool_results})
        except Exception as exc:  # noqa: BLE001 — never let drafter errors break the cron
            settings.logger.warning(f"AutoMatchEmailDrafter error: {exc}")
            return self._fallback(sender_name, recipient_name, recipient_kind, match)

        if drafted is None or "subject" not in drafted or "body_html" not in drafted:
            return self._fallback(sender_name, recipient_name, recipient_kind, match)

        subject = str(drafted["subject"]).strip()
        body_html = str(drafted["body_html"]).strip()
        if not subject or not body_html:
            return self._fallback(sender_name, recipient_name, recipient_kind, match)
        return DraftedEmail(subject=subject, body_html=body_html, fallback_used=False)

    # -------------------------------------------------------------------------
    # Prompt construction
    # -------------------------------------------------------------------------
    def _system_prompt(self) -> str:
        return (
            "You are drafting an automated weekly match notification for the "
            "Nucleus Institute, a Utah deep-tech network connecting talent and "
            "startups.\n\n"
            "The email goes TO the subscriber (the 'sender' in the tools). It "
            "tells them about ONE candidate (the 'recipient' in the tools) we "
            "think they should consider connecting with.\n\n"
            "HARD REQUIREMENTS (every email must contain these):\n"
            "1. Make it clear at the top that this is an AUTOMATED notification "
            "from Nucleus Institute — not a personal message and not from the "
            "candidate themselves. Use a phrase like 'Automated match suggestion' "
            "or 'This is a weekly match notification.'\n"
            "2. State that the subscriber should reach out IF they want to "
            "connect — Nucleus is not making an introduction, just surfacing the "
            "match.\n"
            "3. Include the candidate's name, headline/one-liner, and 1-2 "
            "specific reasons we paired them (cite shared sectors, missions, or "
            "a strong dimension score from get_match_details / get_overlap).\n"
            "4. Keep the tone friendly and brief (under 180 words in the body).\n"
            "5. Do not invent facts. Only use what the MCP tools return.\n\n"
            "WORKFLOW:\n"
            "- Call get_sender_profile, get_recipient_profile, and get_overlap "
            "first. Call get_match_details to ground the 'why we paired you' line.\n"
            "- Aim for 3 tool calls total. You have a hard budget of "
            f"{MAX_LOOP_ITERATIONS - 1} tool turns.\n\n"
            "FINAL ANSWER FORMAT — respond with ONLY a single JSON object, no "
            "prose, no markdown fences:\n"
            "{\n"
            '  "subject": "Short subject line, under 80 chars",\n'
            '  "body_html": "<p>...</p><p>...</p>"\n'
            "}\n\n"
            "The body_html must be valid lightweight HTML using <p>, <strong>, "
            "<em>, <ul>, <li>, <a href=\"...\"> tags only. No <script>, no "
            "inline CSS, no <style> tags. Email clients render the rest."
        )

    def _user_prompt(self, sender_name: str, recipient_name: str) -> str:
        return (
            f"Draft the weekly auto-match email for subscriber {sender_name} "
            f"about candidate {recipient_name}. Use the MCP tools to learn "
            "about both, then return the JSON envelope per the system prompt."
        )

    # -------------------------------------------------------------------------
    # Parsing + fallback
    # -------------------------------------------------------------------------
    def _parse_drafted(self, text: str) -> dict[str, Any] | None:
        """Extract the `{subject, body_html}` JSON object from the agent's
        final text. Tolerates leading prose and ```json fences."""
        cleaned = text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
        if not isinstance(data, dict):
            return None
        return data

    def _fallback(
        self,
        sender_name: str,
        recipient_name: str,
        recipient_kind: str,
        match: MatchResult,
    ) -> DraftedEmail:
        """Deterministic email used when the agent is unavailable or fails.

        Still satisfies the "this is automated, reach out if interested"
        contract so subscribers always get a usable email.
        """
        kind_word = "founder" if recipient_kind == "startup" else "person"
        reasons_html = ""
        if match.reasons:
            bullets = "".join(f"<li>{_escape(r)}</li>" for r in match.reasons[:3])
            reasons_html = f"<p>Why we paired you:</p><ul>{bullets}</ul>"
        body_html = (
            f"<p><em>Automated match suggestion from Nucleus Institute.</em></p>"
            f"<p>Hi {_escape(sender_name)},</p>"
            f"<p>This is your weekly Nucleus match notification. Based on your "
            f"profile, we think you might want to connect with the "
            f"{kind_word} <strong>{_escape(recipient_name)}</strong>.</p>"
            f"{reasons_html}"
            f"<p>If they look interesting, reach out directly through Nucleus or "
            f"on LinkedIn. We're just surfacing the match — not making an "
            f"introduction.</p>"
            f"<p>— Nucleus Institute</p>"
        )
        return DraftedEmail(
            subject=f"Nucleus weekly match: {recipient_name}",
            body_html=body_html,
            fallback_used=True,
        )


def _escape(text: str) -> str:
    """Minimal HTML escaping for the deterministic fallback path."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
