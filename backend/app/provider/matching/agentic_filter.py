"""AgenticFilterMatcher — Phase 2 active matcher.

Wraps Anthropic Sonnet 4.6 in a tool-calling loop with the 11 MCP tools defined
in `app.mcp.server`. The agent's job is to navigate the filter space until it
has a strong top-k; rule_filter scores remain authoritative (PLAN.md §7).

LOOP CONTRACT
-------------
- Up to MAX_LOOP_ITERATIONS Anthropic API calls per match.
- Agent emits final answer as a JSON array in its last text turn:
    [{"id": "<uuid>", "reasons": ["..."]}, ...]
- The matcher parses the JSON, looks up each id in the candidate pool, runs
  rule_filter to obtain score + dimension_scores + blockers, swaps in the
  agent's reasons, and returns list[MatchResult].
- If the agent gives no usable picks (parse failure, no convergence), fall
  back to rule_filter's top_k with a synthetic leading reason flagging the
  fallback — never silently substitute (PLAN.md §7.5).

ERROR MODES
-----------
- Missing ANTHROPIC_API_KEY: raises HTTPException(503). The compare endpoint
  will surface this as a per-matcher error (handled in MatchingService once
  we adopt return_exceptions=True there).
"""

from __future__ import annotations

import json
import re
from typing import Any

from anthropic import AsyncAnthropic
from fastapi import HTTPException
from fastmcp import Client

from app.core.config import settings
from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.model.schema.match import MatchResult
from app.provider.matching.base import MatchingProvider, register_matcher
from app.provider.matching.rule_filter import RuleFilterMatcher

MODEL_ID = "claude-sonnet-4-6"
MAX_LOOP_ITERATIONS = 4  # 1 initial + up to 3 follow-ups
MAX_TOKENS = 2048


@register_matcher
class AgenticFilterMatcher(MatchingProvider):
    """Agent navigates filter space; rule_filter remains the score authority."""

    name = "agentic_filter"

    def __init__(self) -> None:
        # Lazy-init the Anthropic client so the registry hydrates fine without
        # an API key (e.g. for tests). Real instantiation happens in _get_client.
        self._client: AsyncAnthropic | None = None
        self._rule_filter = RuleFilterMatcher()

    def _get_client(self) -> AsyncAnthropic:
        if not settings.anthropic_api_key:
            raise HTTPException(
                status_code=503,
                detail="agentic_filter unavailable: ANTHROPIC_API_KEY not set",
            )
        if self._client is None:
            self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        return self._client

    # -------------------------------------------------------------------------
    # MatchingProvider interface
    # -------------------------------------------------------------------------
    async def match_talent_to_startups(
        self,
        talent: Talent,
        startups: list[Startup],
        top_k: int = 5,
    ) -> list[MatchResult]:
        return await self._run(
            focal=talent,
            candidates=startups,
            top_k=top_k,
            direction="talent_to_startups",
        )

    async def match_startup_to_talent(
        self,
        startup: Startup,
        talents: list[Talent],
        top_k: int = 5,
    ) -> list[MatchResult]:
        return await self._run(
            focal=startup,
            candidates=talents,
            top_k=top_k,
            direction="startup_to_talent",
        )

    # -------------------------------------------------------------------------
    # Core loop
    # -------------------------------------------------------------------------
    async def _run(
        self,
        *,
        focal: Talent | Startup,
        candidates: list,
        top_k: int,
        direction: str,
    ) -> list[MatchResult]:
        # Local import breaks the import cycle:
        # provider.matching.__init__ → agentic_filter → mcp.server → provider.matching.rule_filter
        # The submodule needs the package __init__ to run first; doing this at
        # module-import time would deadlock the registry hydration.
        from app.mcp.server import build_mcp_server

        client = self._get_client()

        if direction == "talent_to_startups":
            server = build_mcp_server(
                focal=focal, talents_pool=[focal], startups_pool=candidates
            )
        else:
            server = build_mcp_server(
                focal=focal, talents_pool=candidates, startups_pool=[focal]
            )

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
                {"role": "user", "content": self._user_prompt(focal, top_k)}
            ]

            picks: list[dict] = []
            agent_notes: str | None = None
            agent_raw: str | None = None
            for _ in range(MAX_LOOP_ITERATIONS):
                response = await client.messages.create(
                    model=MODEL_ID,
                    max_tokens=MAX_TOKENS,
                    system=self._system_prompt(direction, top_k),
                    tools=anthropic_tools,
                    messages=messages,
                )
                messages.append({"role": "assistant", "content": response.content})

                if response.stop_reason != "tool_use":
                    agent_raw = "".join(
                        b.text for b in response.content if getattr(b, "type", None) == "text"
                    )
                    picks, agent_notes = self._parse_envelope(agent_raw)
                    break

                # Execute every tool_use block in this turn, batch results into
                # a single user message (Anthropic's expected pattern).
                tool_results: list[dict[str, Any]] = []
                for block in response.content:
                    if getattr(block, "type", None) != "tool_use":
                        continue
                    try:
                        mcp_result = await mcp_client.call_tool(block.name, block.input)
                        payload = (
                            mcp_result.data if mcp_result.data is not None else []
                        )
                        content_text = json.dumps(payload, default=str)
                    except Exception as exc:
                        content_text = json.dumps({"error": str(exc)})
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": content_text,
                        }
                    )
                messages.append({"role": "user", "content": tool_results})

        return self._compose(
            focal, candidates, picks, agent_notes, agent_raw, top_k, direction
        )

    # -------------------------------------------------------------------------
    # Prompt construction
    # -------------------------------------------------------------------------
    def _system_prompt(self, direction: str, top_k: int) -> str:
        if direction == "talent_to_startups":
            entity_word = "startups"
            tool_hint = (
                "Use find_startups as your primary tool. Choose the `seeking` "
                "filter based on the focal talent's role_category: investor → "
                "seeking='investment'; service_provider → seeking='services'; "
                "advisor → seeking='advisors'; board_member → seeking='board'; "
                "anyone else → seeking='hiring'."
            )
        else:
            entity_word = "talent"
            tool_hint = (
                "Pick the right find_* tool based on what the focal startup needs:\n"
                "  - Hiring an exec/operator → find_operators\n"
                "  - Free-of-charge mentor → find_mentors\n"
                "  - Equity-paid SME advisor → find_advisors\n"
                "  - Board candidate → find_board_members\n"
                "  - Investor (if seeking_investment) → find_investors\n"
                "  - Service provider (if services_needed) → find_service_providers\n"
                "  - Student / intern → find_students_interns\n"
                "  - Faculty / professor (lab tie-in, academic sponsor) → find_university"
            )

        return (
            "You are a Utah deep-tech matchmaker for the Nucleus Institute.\n\n"
            f"Goal: find the {top_k} best {entity_word} for the given focal entity.\n\n"
            "You have access to MCP tools that filter the candidate pool. Each "
            "find_* tool returns up to 30 candidate summaries already ranked by "
            "a structured scoring engine (rule_filter). Your job is to navigate "
            "the filter space, not to invent scores.\n\n"
            f"{tool_hint}\n\n"
            "Strategy:\n"
            f"1. Start with a focused filter. If fewer than {top_k} results have "
            "score >= 0.6, broaden ONE filter dimension and retry.\n"
            f"2. Aim for 2-3 tool calls; you have a hard budget of {MAX_LOOP_ITERATIONS - 1} "
            "tool turns.\n"
            "3. Use get_talent / get_startup only when a summary is ambiguous and "
            "the full profile would change your ranking.\n"
            "4. Use `count` as a cheap probe before committing to a wide search.\n\n"
            "Final answer format: emit a single <REASONING>...</REASONING> block "
            "as your entire response. Inside the tag put a JSON object (no "
            "markdown fences) with `picks` and `agent_notes`. Each pick has "
            "`id`, `confidence_pct`, and `reasons`. Example:\n\n"
            "<REASONING>\n"
            '{\n'
            '  "picks": [\n'
            '    {"id": "uuid-here", "confidence_pct": 82, "reasons": ["Strong sector overlap: AI", "Stage match: seed"]},\n'
            '    {"id": "uuid-here", "confidence_pct": 54, "reasons": ["..."]}\n'
            '  ],\n'
            '  "agent_notes": "Two strong fits in fintech; rest are stretch picks."\n'
            "}\n"
            "</REASONING>\n\n"
            f"The picks list must be in descending order of fit (best first), at "
            f"most {top_k} items. Do NOT include the focal entity in your output. "
            "Do not write anything outside the REASONING tag.\n\n"
            "JUSTIFICATION GUIDELINES:\n"
            "  - Write each `reasons` bullet yourself in your own words. Cite a "
            "specific field from the candidate's profile or the rule_filter "
            "score that drove your decision (e.g. 'Sector overlap: AI + cyber, "
            "rule_filter sector dim = 1.0'). Vague reasons are useless.\n"
            "  - 1-3 bullets per pick. Short, specific, no hedging.\n"
            "  - `confidence_pct` is an integer 0-100 that reflects YOUR read on "
            "this pick — not the rule_filter score. Calibrate roughly:\n"
            "      75-100  multiple strong overlaps + no soft mismatches\n"
            "      45-74   one strong overlap, some weak signal, viable\n"
            "      0-44    speculative; flag this honestly\n"
            "  - `agent_notes` summarizes the run (e.g. 'Two strong fits, three "
            "stretch picks; would broaden sector if asked again')."
        )

    def _user_prompt(self, focal: Talent | Startup, top_k: int) -> str:
        if isinstance(focal, Talent):
            return self._describe_talent(focal, top_k)
        return self._describe_startup(focal, top_k)

    def _describe_talent(self, t: Talent, top_k: int) -> str:
        ip = t.investor_profile or {}
        sp = t.service_provider_profile or {}
        return (
            f"Focal entity is a TALENT looking for the top {top_k} startups.\n\n"
            "Profile:\n"
            f"- Name: {t.name}\n"
            f"- Headline: {t.headline}\n"
            f"- Role category: {t.role_category} (Nucleus Network: {t.primary_network})\n"
            f"- Role titles seeking: {list(t.role_titles_seeking)}\n"
            f"- Sectors of interest: {list(t.sectors_of_interest)}\n"
            f"- Stage preference: {list(t.stage_preference)}\n"
            f"- Skills: {list(t.skills)}\n"
            f"- Availability: {t.availability}\n"
            f"- Compensation: {t.comp_expectation_type}, min ${t.comp_min_salary_usd}/yr\n"
            f"- Mission keywords: {list(t.mission_keywords)}\n"
            f"- Location: {t.location_city}, {t.location_state} (remote_ok={t.remote_ok})\n"
            f"- Investor profile: {ip if ip else 'n/a'}\n"
            f"- Service provider profile: {sp if sp else 'n/a'}\n"
        )

    def _describe_startup(self, s: Startup, top_k: int) -> str:
        return (
            f"Focal entity is a STARTUP looking for the top {top_k} talent matches.\n\n"
            "Profile:\n"
            f"- Name: {s.name}\n"
            f"- One-liner: {s.one_liner}\n"
            f"- Sector: {s.sector} (secondary: {list(s.sectors_secondary)})\n"
            f"- Stage: {s.stage}\n"
            f"- Roles needed: {list(s.roles_needed)}\n"
            f"- Role categories open to: {list(s.role_categories_open_to)}\n"
            f"- Availability open to: {list(s.availability_open_to)}\n"
            f"- Required skills: {list(s.required_skills)}\n"
            f"- Nice-to-have skills: {list(s.nice_to_have_skills)}\n"
            f"- Compensation offered: {s.comp_offered_type}, max ${s.comp_max_salary_usd}/yr\n"
            f"- Mission keywords: {list(s.mission_keywords)}\n"
            f"- Location: {s.location_city}, {s.location_state} (remote_ok={s.remote_ok})\n"
            f"- Seeking investment: {s.seeking_investment} "
            f"(target: ${s.target_raise_usd}, check sizes: {list(s.target_check_sizes)})\n"
            f"- Services needed: {list(s.services_needed)}\n"
            f"- Board seats open: {s.board_seats_open}, "
            f"advisor slots open: {s.advisor_slots_open}\n"
        )

    # -------------------------------------------------------------------------
    # Final-answer parsing + MatchResult composition
    # -------------------------------------------------------------------------
    def _parse_envelope(self, text: str) -> tuple[list[dict], str | None]:
        """Pull the JSON envelope out of the agent's final text.

        The prompt asks the agent to wrap its answer in <REASONING>...</REASONING>;
        we match that block first, then fall back to a bare JSON object or array
        for tolerance against models that drop the tag. Returns (picks, agent_notes)
        — both empty/None if parsing fails. The raw text is captured separately at
        the call site so even total parse failure still surfaces something."""
        tag_match = re.search(
            r"<REASONING>([\s\S]*?)</REASONING>", text, flags=re.IGNORECASE
        )
        body = tag_match.group(1) if tag_match else text
        body = body.strip()
        body = re.sub(r"^```(?:json)?\s*", "", body)
        body = re.sub(r"\s*```$", "", body)

        obj_match = re.search(r"\{[\s\S]*\}", body)
        if obj_match:
            try:
                data = json.loads(obj_match.group(0))
            except json.JSONDecodeError:
                data = None
            if isinstance(data, dict):
                raw_picks = data.get("picks")
                picks_list: list = raw_picks if isinstance(raw_picks, list) else []
                picks = [p for p in picks_list if isinstance(p, dict) and "id" in p]
                notes_raw = data.get("agent_notes")
                notes = (
                    notes_raw.strip()
                    if isinstance(notes_raw, str) and notes_raw.strip()
                    else None
                )
                return picks, notes

        # Backwards compat: a bare JSON array of picks (older prompt shape).
        arr_match = re.search(r"\[[\s\S]*\]", body)
        if arr_match:
            try:
                data = json.loads(arr_match.group(0))
            except json.JSONDecodeError:
                return [], None
            if isinstance(data, list):
                return [d for d in data if isinstance(d, dict) and "id" in d], None
        return [], None

    def _compose(
        self,
        focal: Talent | Startup,
        candidates: list,
        picks: list[dict],
        agent_notes: str | None,
        agent_raw: str | None,
        top_k: int,
        direction: str,
    ) -> list[MatchResult]:
        """Convert agent picks → MatchResult list. Score from rule_filter, reasons
        from agent. Falls back to rule_filter top_k with a flagged reason if the
        agent returned nothing usable (PLAN.md §7.5)."""
        candidates_by_id = {str(c.id): c for c in candidates}

        results: list[MatchResult] = []
        for pick in picks[:top_k]:
            cid = str(pick.get("id"))
            candidate = candidates_by_id.get(cid)
            if candidate is None:
                continue

            if direction == "talent_to_startups":
                rf = self._rule_filter._score_pair(focal, candidate)  # type: ignore[arg-type]
            else:
                rf = self._rule_filter._score_pair(candidate, focal)  # type: ignore[arg-type]

            agent_reasons = pick.get("reasons", [])
            if not isinstance(agent_reasons, list):
                agent_reasons = []
            cleaned_reasons = [str(r) for r in agent_reasons if r]

            confidence = _coerce_confidence(pick.get("confidence_pct"))

            results.append(
                MatchResult(
                    talent_id=rf.talent_id,
                    startup_id=rf.startup_id,
                    score=rf.score,
                    passed_hard_filters=rf.passed_hard_filters,
                    dimension_scores=rf.dimension_scores,
                    reasons=cleaned_reasons or rf.reasons,
                    blockers=rf.blockers,
                    matcher=self.name,
                    confidence=confidence,
                    agent_notes=agent_notes,
                    agent_raw_response=agent_raw,
                )
            )

        if not results:
            # Fallback path: agent gave us nothing usable. Surface rule_filter
            # results with an explicit flag so /compare and the match card make
            # the fallback visible.
            if direction == "talent_to_startups":
                fallback = [self._rule_filter._score_pair(focal, c) for c in candidates]  # type: ignore[arg-type]
            else:
                fallback = [self._rule_filter._score_pair(c, focal) for c in candidates]  # type: ignore[arg-type]
            fallback.sort(key=lambda r: (r.passed_hard_filters, r.score), reverse=True)
            for r in fallback[:top_k]:
                r.matcher = self.name
                r.reasons = [
                    "Fallback: agent returned no usable picks; score from rule_filter",
                    *r.reasons,
                ]
                r.agent_raw_response = agent_raw
                r.agent_notes = agent_notes
                results.append(r)

        return results


def _coerce_confidence(raw: object) -> float | None:
    """Convert the agent's `confidence_pct` (0-100 integer) into a 0-1 float.

    The schema stores 0-1; we ask the agent for a percentage because that's
    easier to reason about in calibration guidance. Returns None for junk values
    so the field stays NULL rather than misleadingly defaulting to 0."""
    if raw is None:
        return None
    try:
        value = float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, value / 100.0))
