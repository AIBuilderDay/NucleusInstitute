"""Anthropic Sonnet 4.6 agent loop driven by the FastMCP tools.

Borrows the manual-tool-loop pattern from the existing agentic_filter
matcher in the Nucleus backend. Differences here:
  - No structured-result composition; the agent's job IS to send emails, so
    "side effects through tool calls" is the primary output.
  - Iteration cap is higher (we expect search → triage → multiple sends).
  - The system prompt builds from the user's saved free-text criteria and
    email instructions, NOT from a structured schema.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from anthropic import AsyncAnthropic
from fastmcp import Client

from .config import settings
from .mcp_server import build_mcp_server
from .nucleus_client import NucleusClient

logger = logging.getLogger("autopilot.agent")

MODEL_ID = "claude-sonnet-4-6"
MAX_LOOP_ITERATIONS = 12
MAX_TOKENS = 4096
MAX_EMAILS_PER_RUN = 5  # safety rail — agent can't spam the entire database


@dataclass
class RunResult:
    candidates_considered: int = 0
    emails_sent: int = 0
    skipped: int = 0
    notes: list[str] = field(default_factory=list)
    error: str | None = None
    final_text: str | None = None


async def run_agent(
    *,
    heal_startup_id: str,
    candidate_criteria: str,
    email_instructions: str,
    structured_filters: dict[str, Any],
    nucleus: NucleusClient,
) -> RunResult:
    """One-shot agent run: search → draft → send. Returns RunResult."""
    if not settings.anthropic_api_key:
        return RunResult(
            error="ANTHROPIC_API_KEY is not configured on the autopilot service",
            notes=["Set ANTHROPIC_API_KEY in autopilot/.env then restart the service"],
        )

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    mcp_server = build_mcp_server(heal_startup_id=heal_startup_id, nucleus=nucleus)

    result = RunResult()

    async with Client(mcp_server) as mcp_client:
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
            {
                "role": "user",
                "content": _user_prompt(
                    candidate_criteria=candidate_criteria,
                    email_instructions=email_instructions,
                    structured_filters=structured_filters,
                ),
            }
        ]

        for iteration in range(MAX_LOOP_ITERATIONS):
            response = await client.messages.create(
                model=MODEL_ID,
                max_tokens=MAX_TOKENS,
                system=_system_prompt(),
                tools=anthropic_tools,
                messages=messages,
            )
            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason != "tool_use":
                result.final_text = "".join(
                    b.text for b in response.content if getattr(b, "type", None) == "text"
                )
                result.notes.append(
                    f"Agent finished on iteration {iteration + 1}: {response.stop_reason}"
                )
                break

            tool_results: list[dict[str, Any]] = []
            for block in response.content:
                if getattr(block, "type", None) != "tool_use":
                    continue

                # Hard cap on outbound emails — the agent CAN call send_outreach_email
                # all it wants but we refuse beyond MAX_EMAILS_PER_RUN per run.
                if (
                    block.name == "send_outreach_email"
                    and result.emails_sent >= MAX_EMAILS_PER_RUN
                ):
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(
                                {
                                    "sent": False,
                                    "error": (
                                        f"refused: {MAX_EMAILS_PER_RUN}-email-per-run cap reached"
                                    ),
                                }
                            ),
                        }
                    )
                    continue

                try:
                    mcp_result = await mcp_client.call_tool(block.name, block.input)
                    payload = mcp_result.data if mcp_result.data is not None else []
                    content_text = json.dumps(payload, default=str)

                    # Side-effect bookkeeping for the run report.
                    if block.name == "find_candidates":
                        if isinstance(payload, list):
                            result.candidates_considered = max(
                                result.candidates_considered, len(payload)
                            )
                    elif block.name == "send_outreach_email":
                        if isinstance(payload, dict) and payload.get("sent"):
                            result.emails_sent += 1
                            result.notes.append(
                                f"Sent: {block.input.get('talent_id')} → {payload.get('to')}"
                            )
                        else:
                            result.skipped += 1
                            err = (
                                payload.get("error")
                                if isinstance(payload, dict)
                                else "unknown"
                            )
                            result.notes.append(
                                f"Send failed for {block.input.get('talent_id')}: {err}"
                            )
                except Exception as exc:
                    content_text = json.dumps({"error": str(exc)})
                    result.notes.append(f"Tool {block.name} crashed: {exc}")

                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": content_text,
                    }
                )

            messages.append({"role": "user", "content": tool_results})
        else:
            # Loop exited via max-iterations rather than stop_reason="end_turn".
            result.notes.append(
                f"Loop budget exhausted at {MAX_LOOP_ITERATIONS} iterations"
            )

    return result


# =============================================================================
# Prompt construction
# =============================================================================
def _system_prompt() -> str:
    return f"""You are HEAL Engineering's AI hiring autopilot.

ROLE
HEAL Engineering is an AI/dev-tools seed startup in Salt Lake City that needs
to hire engineers. You source candidates from the Nucleus Institute talent
network, decide who's worth contacting, and email them — fully autonomous.

TOOLS
You have MCP tools for everything:
- find_candidates(filters) — searches Nucleus by sector/skills/comp/location/etc.
- get_candidate(talent_id) — pulls a full profile when you need more detail
- list_recently_contacted() — talent_ids HEAL has already emailed; SKIP these
- already_contacted(talent_id) — single-talent dedup check
- send_outreach_email(talent_id, subject, body, ...) — actually sends via Resend

You may NOT contact candidates outside of these tools. There is no other way
to reach the world.

WORKFLOW (per run)
1. Call list_recently_contacted FIRST so you know who to skip.
2. Call find_candidates ONCE with sensible filters derived from the user's
   criteria below. The score field is rule_filter's structured-fit score —
   trust it as a starting point.
3. Skim the result list. For each candidate you'd like to contact:
   a. SKIP if already_contacted (their id appears in the list from step 1).
   b. SKIP if their email is null.
   c. SKIP if the score is below 0.40 — that means hard-filter mismatches.
   d. Otherwise, draft a personalized subject + body following the user's
      email instructions, and call send_outreach_email.
4. Hard cap: at most {MAX_EMAILS_PER_RUN} emails per run. The tool will refuse
   beyond that — don't try to evade it. Quality over quantity.
5. End with a short text summary: how many you found, how many you contacted,
   how many you skipped and why.

EMAIL DRAFTING RULES
- Use the candidate's first name in the greeting.
- Reference one or two SPECIFIC things from their profile (a skill, a sector
  interest, a project) — not generic fluff.
- Respect the user's email-instructions section verbatim. If they ask for a
  specific tone, length, or call-to-action, follow it.
- Keep bodies under 180 words. Cold outreach over that gets ignored.
- Never invent facts about HEAL that aren't grounded in the brief.

SAFETY
- If the user's criteria are vague, use sensible defaults (sectors=["ai",
  "software"], top_k=20) but say so in your final summary.
- If a tool returns an error, log it in your summary and move on — don't loop.
"""


def _user_prompt(
    *,
    candidate_criteria: str,
    email_instructions: str,
    structured_filters: dict[str, Any],
) -> str:
    criteria = candidate_criteria.strip() or "(no free-text criteria saved — use defaults)"
    instructions = email_instructions.strip() or "(no email instructions saved — use defaults: warm, specific, ≤180 words, ask for a 20-min intro call)"
    filters_block = (
        json.dumps(structured_filters, indent=2)
        if structured_filters
        else "(no structured filters set — sidebar empty)"
    )

    return f"""Run the HEAL hiring autopilot now.

USER'S CANDIDATE CRITERIA (free text)
{criteria}

STRUCTURED FILTERS (from the sidebar)
{filters_block}

USER'S EMAIL INSTRUCTIONS (free text — follow verbatim)
{instructions}

Begin. Use the tools. End with a short summary.
"""
