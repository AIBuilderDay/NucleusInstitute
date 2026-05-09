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
                    final_text = "".join(
                        b.text for b in response.content if getattr(b, "type", None) == "text"
                    )
                    picks = self._parse_picks(final_text)
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

        return self._compose(focal, candidates, picks, top_k, direction)

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
                "  - Student / intern → find_students_interns"
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
            "Final answer format: when you are done, respond with ONLY a JSON "
            "array (no prose, no markdown fences). Each item is an object with "
            "`id` and `reasons`. Example:\n\n"
            '[\n'
            '  {"id": "uuid-here", "reasons": ["Strong sector overlap: AI", "Stage match: seed"]},\n'
            '  {"id": "uuid-here", "reasons": ["..."]}\n'
            ']\n\n'
            f"The list must be in descending order of fit (best first), at most "
            f"{top_k} items. Each `reasons` array contains 1-3 short, specific "
            "bullets explaining why this candidate is a strong match. Do NOT "
            "include the focal entity in your output."
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
    def _parse_picks(self, text: str) -> list[dict]:
        """Extract a JSON array from the agent's final text. Tolerates leading
        prose and ```json fences."""
        cleaned = text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        match = re.search(r"\[[\s\S]*\]", cleaned)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return []
        if not isinstance(data, list):
            return []
        return [d for d in data if isinstance(d, dict) and "id" in d]

    def _compose(
        self,
        focal: Talent | Startup,
        candidates: list,
        picks: list[dict],
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
                results.append(r)

        return results
