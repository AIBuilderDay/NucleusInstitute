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
import re
from typing import Any
from uuid import UUID

from anthropic import AsyncAnthropic
from fastapi import Depends, HTTPException
from fastmcp import Client

from app.core.config import settings
from app.dao.factory import DAOFactory
from app.model.database.talent import Talent
from app.model.schema.auth import (
    GoogleUserInfo,
    InferInterestsResponse,
    LinkedInUserInfo,
)

MODEL_ID = "claude-sonnet-4-6"
MAX_LOOP_ITERATIONS = 6  # 1 initial + up to 5 follow-ups; leaves room for retries
MAX_TOKENS = 4096

# Interest-inference call. Smaller budget — single-shot, JSON output.
INFER_MAX_TOKENS = 2048
INFER_WEB_SEARCH_USES = 4

# Sector vocabulary the inference agent must pick from. Mirrors the frontend
# InterestModal's SECTOR_OPTIONS so the popup chip layout matches.
INFER_SECTOR_VOCAB = [
    "B2B Software",
    "FinTech",
    "Life Sciences",
    "AI / ML",
    "Security",
    "Hardware",
    "Consumer",
    "Energy",
    "EdTech",
    "AgTech",
    "Defense & Aerospace",
    "Manufacturing",
]


from dataclasses import dataclass


@dataclass
class OnboardAgentRun:
    """Everything the route needs to build an OnboardAgentResponse.

    Returned from `OnboardService.create_talent_from_oidc`. The route flattens
    this into the JSON response. `agent_raw_response` is always populated when
    the agent reached a final-text turn, even if envelope parsing failed — so
    the frontend can display the verbatim <REASONING> block as fallback."""

    talent: Talent
    agent_notes: str | None
    confidence: float | None
    reasoning_bullets: list[str]
    agent_raw_response: str | None


def _parse_onboard_envelope(
    text: str | None,
) -> tuple[float | None, list[str], str | None]:
    """Pull (confidence, reasoning_bullets, agent_notes) out of the agent's
    final-turn text. The prompt asks for a <REASONING>...</REASONING> wrapper
    around a JSON object with `confidence_pct`, `reasoning_bullets`, and
    `agent_notes`. Returns (None, [], None) on any parse failure — the caller
    still surfaces the raw text via OnboardAgentRun.agent_raw_response."""
    if not text:
        return None, [], None

    tag_match = re.search(
        r"<REASONING>([\s\S]*?)</REASONING>", text, flags=re.IGNORECASE
    )
    body = tag_match.group(1) if tag_match else text
    body = body.strip()
    body = re.sub(r"^```(?:json)?\s*", "", body)
    body = re.sub(r"\s*```$", "", body)

    obj_match = re.search(r"\{[\s\S]*\}", body)
    if not obj_match:
        # No JSON found — surface the whole text as agent_notes so the user
        # still sees the agent's words, even if structured fields are missing.
        return None, [], text.strip() or None
    try:
        data = json.loads(obj_match.group(0))
    except json.JSONDecodeError:
        return None, [], text.strip() or None
    if not isinstance(data, dict):
        return None, [], text.strip() or None

    raw_pct = data.get("confidence_pct")
    confidence: float | None = None
    if raw_pct is not None:
        try:
            confidence = max(0.0, min(1.0, float(raw_pct) / 100.0))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            confidence = None

    raw_bullets = data.get("reasoning_bullets")
    bullets_list = raw_bullets if isinstance(raw_bullets, list) else []
    reasoning_bullets = [
        str(b).strip() for b in bullets_list if isinstance(b, str) and b.strip()
    ]

    notes_raw = data.get("agent_notes")
    agent_notes = (
        notes_raw.strip()
        if isinstance(notes_raw, str) and notes_raw.strip()
        else None
    )

    return confidence, reasoning_bullets, agent_notes


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
    ) -> "OnboardAgentRun":
        """Run the agent loop, return a run summary the route can flatten into the response.

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
            agent_raw: str | None = None

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
                    agent_raw = "".join(
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
        confidence, reasoning_bullets, agent_notes = _parse_onboard_envelope(agent_raw)
        return OnboardAgentRun(
            talent=talent,
            agent_notes=agent_notes,
            confidence=confidence,
            reasoning_bullets=reasoning_bullets,
            agent_raw_response=agent_raw,
        )

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
            "advisor | mentor | investor | service_provider | university\n"
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
            "if running a service firm, service_provider; if a current professor / "
            "faculty / lecturer at a university (especially U of U, BYU, USU) plugging "
            "their lab or students into startups, lean university.\n"
            "  - primary_network MUST be consistent with role_category (executive/operator "
            "→ operator network; advisor → sme_advisor; mentor → mentor; investor → "
            "venture; service_provider → service_provider; university → mentor unless "
            "the resume signals a formal equity-paid engagement, in which case sme_advisor).\n"
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
            "  6. After status=created, emit a single <REASONING>...</REASONING> block "
            "as your final response (nothing outside it):\n\n"
            "       <REASONING>\n"
            "       {\n"
            "         \"confidence_pct\": 0-100,         // your read on how solid the inferred profile is\n"
            "         \"reasoning_bullets\": [\"...\", \"...\"], // 3-5 short bullets explaining the choices that mattered (which fields you inferred vs took verbatim, which were guesses)\n"
            "         \"agent_notes\": \"one short sentence acknowledging the save\"\n"
            "       }\n"
            "       </REASONING>\n\n"
            "JUSTIFICATION GUIDELINES:\n"
            "  - Write each bullet yourself in your own words. Cite the SPECIFIC field "
            "and source: e.g. 'role_category=advisor — resume mentions \"fractional CTO\" "
            "with no current full-time role.' Vague bullets are useless.\n"
            "  - `confidence_pct` is an integer 0-100. Calibrate roughly:\n"
            "      75-100  rich resume + clear role signal; very few guesses\n"
            "      45-74   moderate signal; a few fields inferred from indirect cues\n"
            "      0-44    sparse OIDC-only data; many defaults applied\n"
            "  - Do not call any tools after emitting the REASONING block.\n"
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

    # -------------------------------------------------------------------------
    # Interest inference (Ecosystem page) — read-only, no DB write.
    # -------------------------------------------------------------------------

    async def infer_interests(
        self,
        *,
        userinfo: LinkedInUserInfo,
    ) -> InferInterestsResponse:
        """Run a one-shot Claude call with web_search to infer the user's
        interests from public traces. Returns a structured InferInterestsResponse.

        Falls back to a low-confidence empty response if web_search isn't
        available on the SDK / model combo, the agent returns malformed JSON,
        or any other recoverable error happens.
        """
        client = self._get_client()  # raises 503 if no ANTHROPIC_API_KEY

        info_json = userinfo.model_dump_json(indent=2, exclude_none=True)

        system = self._infer_system_prompt()
        user_msg = self._infer_user_prompt(info_json)

        try:
            response = await client.messages.create(
                model=MODEL_ID,
                max_tokens=INFER_MAX_TOKENS,
                tools=[
                    {
                        "type": "web_search_20250305",
                        "name": "web_search",
                        "max_uses": INFER_WEB_SEARCH_USES,
                    }
                ],
                system=system,
                messages=[{"role": "user", "content": user_msg}],
            )
        except Exception as exc:
            # If web_search isn't supported on this model/version, retry without it.
            settings.logger.warning(
                f"infer_interests: web_search call failed ({exc}); retrying without tools",
                exc_info=True,
            )
            response = await client.messages.create(
                model=MODEL_ID,
                max_tokens=INFER_MAX_TOKENS,
                system=system,
                messages=[{"role": "user", "content": user_msg}],
            )

        # Concatenate all final-turn text blocks; the JSON envelope is in there.
        final_text = "".join(
            getattr(b, "text", "")
            for b in response.content
            if getattr(b, "type", None) == "text"
        )

        parsed = _extract_json_object(final_text)
        if parsed is None:
            settings.logger.warning(
                f"infer_interests: could not parse JSON from agent output: {final_text[:500]!r}"
            )
            return InferInterestsResponse(
                evidence=["Could not parse agent output."],
                confidence="low",
            )

        try:
            return InferInterestsResponse.model_validate(parsed)
        except Exception:
            settings.logger.warning(
                f"infer_interests: Pydantic rejected agent JSON: {parsed!r}",
                exc_info=True,
            )
            return InferInterestsResponse(
                evidence=["Agent output failed validation."],
                confidence="low",
            )

    def _infer_system_prompt(self) -> str:
        return (
            "You are a research assistant for the Innovate Utah Ecosystem app — a "
            "directory of Utah-based startups and state founder resources.\n\n"
            "A user just signed in with LinkedIn. You have their basic OIDC profile "
            "info (name, email, picture). Your job: infer their professional "
            "interests so the app can pre-filter relevant startups and resources.\n\n"
            "USE THE web_search TOOL to look up the user's public footprint:\n"
            "  - Search '<full name> <email-domain>' for their company/role\n"
            "  - Search '<full name> Utah' or '<full name> Salt Lake' for location\n"
            "  - Search for personal sites, GitHub, news mentions, conference talks\n"
            "  - Stop after at most 4 searches — quality over quantity\n\n"
            "Then return ONE valid JSON object with EXACTLY these fields and no "
            "extra prose around it:\n\n"
            "{\n"
            '  "city": "Salt Lake City",        // best Utah city guess, or "" if unknown\n'
            '  "sectors": ["B2B Software"],     // 0-2 from vocabulary below\n'
            '  "stages": ["seed"],              // 0-2 of: pre_seed, seed, series_a, series_b, series_c_plus, growth, public\n'
            '  "lookingFor": ["both"],          // 1+ of: resources, startups, both\n'
            '  "evidence": [                    // 1-4 short concrete sentences\n'
            '    "LinkedIn (cached) shows X works at Y in Salt Lake City.",\n'
            '    "Personal site at z.com mentions fintech focus."\n'
            "  ],\n"
            '  "confidence": "medium"           // low | medium | high\n'
            "}\n\n"
            "SECTOR VOCABULARY (use these EXACT strings):\n"
            f"  {', '.join(INFER_SECTOR_VOCAB)}\n\n"
            "RULES:\n"
            "- Be honest. If web_search returns nothing useful, set confidence='low' "
            "and put 'Could not find public profile information' in evidence.\n"
            "- Do not invent specific employers, projects, or companies. Only cite "
            "what an actual search result said.\n"
            "- Keep evidence sentences short and concrete — they will be shown "
            "verbatim to the user as a 'what we found' list.\n"
            "- Output ONLY the JSON object — no preamble, no commentary, no markdown "
            "fences. Just the raw JSON."
        )

    def _infer_user_prompt(self, info_json: str) -> str:
        return (
            "Infer interests for this user.\n\n"
            f"LINKEDIN OIDC USERINFO:\n{info_json}\n\n"
            "Use web_search to look them up, then output the JSON envelope."
        )


def _extract_json_object(text: str) -> dict[str, Any] | None:
    """Find the first {...} block in `text` and json.loads it. Tolerant to
    leading/trailing prose, code fences, etc."""
    if not text:
        return None
    # Strip common ```json fences
    fenced = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fenced:
        try:
            result = json.loads(fenced.group(1))
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass
    # Greedy first-{ to last-} fallback
    first = text.find("{")
    last = text.rfind("}")
    if first == -1 or last == -1 or last <= first:
        return None
    candidate = text[first : last + 1]
    try:
        result = json.loads(candidate)
        return result if isinstance(result, dict) else None
    except json.JSONDecodeError:
        return None
