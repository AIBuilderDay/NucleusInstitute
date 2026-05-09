"""OnboardService — drives the Claude agent that fills out a Talent profile.

Sync, server-side, single-shot:
  POST /onboard/agent  ->  OnboardService.create_talent_from_linkedin()
                       ->  spawns per-request FastMCP server with the
                           `create_talent_profile` tool
                       ->  Claude (Sonnet 4.6) loops with that tool until it
                           emits a successful create
                       ->  returns the saved Talent

Mirrors the tool-use loop in app.provider.matching.agentic_filter.
"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from anthropic import AsyncAnthropic
from fastapi import Depends, HTTPException
from fastmcp import Client

from app.core.config import settings
from app.dao.factory import DAOFactory
from app.model.database.talent import Talent
from app.model.schema.auth import GoogleUserInfo, LinkedInUserInfo

MODEL_ID = "claude-sonnet-4-6"
MAX_LOOP_ITERATIONS = 6  # 1 initial + up to 5 follow-ups; leaves room for retries
MAX_TOKENS = 4096


class OnboardService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self._client: AsyncAnthropic | None = None

    def _get_client(self) -> AsyncAnthropic:
        if not settings.anthropic_api_key:
            raise HTTPException(
                status_code=503,
                detail="Onboarding agent unavailable: ANTHROPIC_API_KEY not set",
            )
        if self._client is None:
            self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        return self._client

    async def create_talent_from_oidc(
        self,
        userinfo: LinkedInUserInfo | GoogleUserInfo,
        resume_text: str | None,
        provider: str,
    ) -> tuple[Talent, str | None]:
        """Run the agent loop, return (saved Talent, optional agent_notes).

        `provider` is "linkedin" or "google" — passed through to the prompt so
        the agent knows which OIDC source the userinfo came from. Both providers
        return the same OIDC claim set (sub/name/email/picture/locale) so the
        agent's extraction logic is identical past the provider label.

        Raises HTTPException on:
          - missing ANTHROPIC_API_KEY (503)
          - agent never calls create_talent_profile or all calls fail (502)
          - email already exists (409, with the existing talent_id surfaced)
        """
        # Local import keeps the matching-side import cycle isolated.
        from app.mcp.onboard_server import build_onboard_mcp_server

        client = self._get_client()
        server = build_onboard_mcp_server(self.dao_factory)
        talent_dao = self.dao_factory.get_talent_dao()

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
                {
                    "role": "user",
                    "content": self._user_prompt(userinfo, resume_text, provider),
                }
            ]

            saved_talent_id: UUID | None = None
            conflict_talent_id: UUID | None = None
            agent_notes: str | None = None

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
                    agent_notes = "".join(
                        b.text
                        for b in response.content
                        if getattr(b, "type", None) == "text"
                    ).strip() or None
                    break

                tool_results: list[dict[str, Any]] = []
                for block in response.content:
                    if getattr(block, "type", None) != "tool_use":
                        continue
                    try:
                        mcp_result = await mcp_client.call_tool(block.name, block.input)
                        payload = mcp_result.data if mcp_result.data is not None else {}
                    except Exception as exc:  # noqa: BLE001
                        payload = {"status": "tool_error", "error": str(exc)}

                    if isinstance(payload, dict):
                        if payload.get("status") == "created" and payload.get("talent_id"):
                            saved_talent_id = UUID(payload["talent_id"])
                        elif payload.get("status") == "conflict" and payload.get("talent_id"):
                            conflict_talent_id = UUID(payload["talent_id"])

                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(payload, default=str),
                        }
                    )
                messages.append({"role": "user", "content": tool_results})

                if saved_talent_id is not None:
                    # We have a persisted profile; one more turn lets the agent
                    # acknowledge in text but isn't required.
                    break

        if saved_talent_id is None:
            if conflict_talent_id is not None:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "A Talent with that email already exists",
                        "talent_id": str(conflict_talent_id),
                    },
                )
            raise HTTPException(
                status_code=502,
                detail="Onboarding agent did not produce a profile within the iteration budget",
            )

        talent = await talent_dao.get(saved_talent_id)
        if talent is None:  # pragma: no cover — DAO just wrote it.
            raise HTTPException(
                status_code=500,
                detail=f"Created talent {saved_talent_id} not found on read-back",
            )
        return talent, agent_notes

    # -------------------------------------------------------------------------
    # Prompt construction
    # -------------------------------------------------------------------------
    def _system_prompt(self) -> str:
        return (
            "You are an onboarding agent for the Nucleus Institute, a Utah deep-tech "
            "matchmaking network. Your job is to extract a structured Talent profile "
            "from the user's OIDC sign-in data (LinkedIn or Google) and (if provided) "
            "a pasted resume / experience text, then persist it by calling the "
            "`create_talent_profile` tool exactly once.\n\n"
            "STRICT VOCABULARY — use these enum string values exactly:\n\n"
            "  role_category: executive | operator | student | intern | board_member | "
            "advisor | mentor | investor | service_provider\n"
            "  primary_network: operator | mentor | sme_advisor | venture | service_provider\n"
            "    (operator network = working operators/execs/cofounders;\n"
            "     mentor network = informal pro-bono mentors;\n"
            "     sme_advisor network = formal equity-paid SME advisors;\n"
            "     venture network = investors;\n"
            "     service_provider network = legal/creative/etc firms)\n"
            "  role_titles_seeking (list): cofounder, ceo, coo, cto, cfo, fractional_exec, "
            "engineer, sales, marketing, biz_dev, regulatory, product, design, other\n"
            "  availability: full_time | part_time | fractional | advisory | internship\n"
            "  comp_expectation_type: salary | equity | salary_plus_equity | free\n"
            "    (use `free` for pro-bono mentors)\n"
            "  sectors_of_interest (list): life_sciences, ai, defense_aerospace, cyber, "
            "energy, advanced_manufacturing, fintech, software\n"
            "  stage_preference (list): idea, pre_seed, seed, series_a, growth\n"
            "  risk_tolerance: low | medium | high (default medium)\n\n"
            "REQUIRED FIELDS — `create_talent_profile` will reject the payload if any "
            "are missing:\n"
            "  name, email, role_category, availability, comp_expectation_type, "
            "primary_network, location_city\n\n"
            "EXTRACTION RULES:\n"
            "  - name, email come from the LinkedIn userinfo verbatim.\n"
            "  - linkedin_url: synthesize from `https://www.linkedin.com/in/<vanity>` "
            "if obvious from the resume; otherwise omit.\n"
            "  - photo_url: copy from LinkedIn `picture` field if present.\n"
            "  - headline: short tagline ('Fractional CTO advising Utah fintechs', "
            "'Backend engineer, ex-Stripe').\n"
            "  - role_category: infer from current role + what they're seeking. "
            "If a senior IC explicitly looking for fractional/advisory work, lean "
            "advisor or operator; if a current C-suite, lean executive; if explicitly "
            "mentoring without expectation of pay, mentor; if writing checks, investor; "
            "if running a service firm, service_provider.\n"
            "  - primary_network MUST be consistent with role_category (executive/operator "
            "→ operator network; advisor → sme_advisor; mentor → mentor; investor → "
            "venture; service_provider → service_provider).\n"
            "  - sectors_of_interest: infer from past employers + stated focus areas. "
            "Pick 1-3 of the eight enum values; do NOT invent new sector names.\n"
            "  - skills: free-text strings (Python, Solidity, GTM strategy, etc.). 5-15 "
            "items, lowercase preferred but not required.\n"
            "  - prior_companies, prior_titles: pull straight from resume.\n"
            "  - years_experience: integer; estimate from earliest dated role.\n"
            "  - location_city, location_state: default 'Salt Lake City' / 'UT' if the "
            "resume doesn't specify but mentions Utah-area work; otherwise use what's "
            "in the resume. Set remote_ok=true unless contradicted.\n"
            "  - bio: 2-4 sentence summary in third person.\n"
            "  - mission_keywords: short phrases the user cares about (e.g. ['climate', "
            "'rural healthcare']).\n"
            "  - education: list of {school, degree, field, graduation_year?}.\n"
            "  - investor_profile / service_provider_profile: only populate when "
            "role_category is investor or service_provider, respectively. Otherwise "
            "leave null.\n"
            "  - When information is missing, prefer omitting the field over guessing. "
            "Defaults will fill in.\n\n"
            "FLOW:\n"
            "  1. Read the user message (LinkedIn userinfo + optional resume text).\n"
            "  2. Build a single, complete TalentCreate-shaped payload.\n"
            "  3. Call `create_talent_profile` ONCE with that payload.\n"
            "  4. If the tool returns status=validation_error, fix the specific fields "
            "the error mentions and call ONCE more. Don't loop indefinitely.\n"
            "  5. If status=conflict, stop — the user already has a profile.\n"
            "  6. After status=created, respond with one short sentence acknowledging "
            "the save (no JSON, no markdown, no follow-up tool calls).\n"
        )

    def _user_prompt(
        self,
        userinfo: LinkedInUserInfo | GoogleUserInfo,
        resume_text: str | None,
        provider: str,
    ) -> str:
        info_json = userinfo.model_dump_json(indent=2, exclude_none=True)
        provider_label = provider.upper()
        resume_block = (
            f"\n\nRESUME / EXPERIENCE TEXT (user-pasted):\n{resume_text.strip()}"
            if resume_text and resume_text.strip()
            else f"\n\n(No resume text was provided. Build the profile from the "
            f"{provider_label} fields alone.)"
        )
        return (
            "Create a Talent profile for the user described below.\n\n"
            f"{provider_label} USERINFO (OIDC):\n{info_json}"
            f"{resume_block}"
        )
