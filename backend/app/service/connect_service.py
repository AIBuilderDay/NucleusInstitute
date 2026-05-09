"""ConnectService — drives the Claude agent that drafts outreach advice.

Sync, server-side, single-shot:
  POST /connect/strategy  ->  ConnectService.build_strategy()
                          ->  spawns per-request FastMCP server with 7 tools
                              (profile, network, follow, overlap, match-score)
                          ->  Claude (Sonnet 4.6) loops until it emits a final
                              JSON envelope of bullets + confidence
                          ->  service merges the agent's prose with
                              structurally-computed facts (follow status,
                              mutual followers, PageRank brackets) so the
                              response can never lie about hard facts.

Mirrors the tool-use loop in `app.service.onboard_service`; the prompt and
final-JSON parser are tighter because the answer space is constrained.
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
from app.model.schema.connect import (
    ConfidenceLabel,
    ConnectStrategyRequest,
    ConnectStrategyResponse,
    GraphBracket,
    MutualConnection,
    NetworkContext,
)
from app.service.network_service import NetworkService

MODEL_ID = "claude-sonnet-4-6"
MAX_LOOP_ITERATIONS = 6  # 1 initial + up to 5 follow-ups
MAX_TOKENS = 2048
MUTUAL_SAMPLE_CAP = 8  # how many mutual connections we name in the response


class ConnectService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self._client: AsyncAnthropic | None = None

    def _get_client(self) -> AsyncAnthropic:
        if not settings.anthropic_api_key:
            raise HTTPException(
                status_code=503,
                detail="Connect agent unavailable: ANTHROPIC_API_KEY not set",
            )
        if self._client is None:
            self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        return self._client

    async def build_strategy(
        self, payload: ConnectStrategyRequest
    ) -> ConnectStrategyResponse:
        """Run the agent and merge its prose with structurally-computed facts."""
        # Local import keeps import cycle isolated — connect_server pulls in
        # rule_filter via _score_pair which transitively pulls the matching
        # registry.
        from app.mcp.connect_server import build_connect_mcp_server

        # 1. Verify both endpoints exist before booting the agent.
        await self._assert_exists(payload.viewer_type, payload.viewer_id, "viewer")
        await self._assert_exists(payload.target_type, payload.target_id, "target")

        client = self._get_client()
        server = build_connect_mcp_server(
            daos=self.dao_factory,
            viewer_type=payload.viewer_type,
            viewer_id=payload.viewer_id,
            target_type=payload.target_type,
            target_id=payload.target_id,
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
                {"role": "user", "content": self._user_prompt(payload)}
            ]

            agent_envelope: dict[str, Any] | None = None
            agent_raw: str | None = None
            for _ in range(MAX_LOOP_ITERATIONS):
                response = await client.messages.create(
                    model=MODEL_ID,
                    max_tokens=MAX_TOKENS,
                    system=self._system_prompt(payload),
                    tools=anthropic_tools,
                    messages=messages,
                )
                messages.append({"role": "assistant", "content": response.content})

                if response.stop_reason != "tool_use":
                    agent_raw = "".join(
                        b.text
                        for b in response.content
                        if getattr(b, "type", None) == "text"
                    )
                    agent_envelope = self._parse_envelope(agent_raw)
                    break

                tool_results: list[dict[str, Any]] = []
                for block in response.content:
                    if getattr(block, "type", None) != "tool_use":
                        continue
                    try:
                        mcp_result = await mcp_client.call_tool(block.name, block.input)
                        payload_data = (
                            mcp_result.data if mcp_result.data is not None else {}
                        )
                        content_text = json.dumps(payload_data, default=str)
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

        # 2. Structural facts — never trust the agent for these.
        facts = await self._compute_structural_facts(payload)

        # 3. If parsing failed, still return 200 with the raw text so the frontend
        # can display the agent's <REASONING> block verbatim.
        if agent_envelope is None:
            return ConnectStrategyResponse(
                viewer_type=payload.viewer_type,
                viewer_id=payload.viewer_id,
                target_type=payload.target_type,
                target_id=payload.target_id,
                already_connected=facts["already_connected"],
                target_follows_viewer=facts["target_follows_viewer"],
                mutual_connections_count=facts["mutual_connections_count"],
                network_context=facts["network_context"],
                confidence=0.5,
                confidence_label="medium",
                fit_bullets=[],
                approach_bullets=[],
                questions_to_ask=[],
                agent_notes=None,
                agent_raw_response=agent_raw,
            )

        # 4. Merge agent envelope + facts → response.
        confidence, label = _normalize_confidence(
            agent_envelope.get("confidence"),
            agent_envelope.get("confidence_label"),
        )
        return ConnectStrategyResponse(
            viewer_type=payload.viewer_type,
            viewer_id=payload.viewer_id,
            target_type=payload.target_type,
            target_id=payload.target_id,
            already_connected=facts["already_connected"],
            target_follows_viewer=facts["target_follows_viewer"],
            mutual_connections_count=facts["mutual_connections_count"],
            network_context=facts["network_context"],
            confidence=confidence,
            confidence_label=label,
            fit_bullets=_clean_bullets(agent_envelope.get("fit_bullets")),
            approach_bullets=_clean_bullets(agent_envelope.get("approach_bullets")),
            questions_to_ask=_clean_bullets(agent_envelope.get("questions_to_ask")),
            agent_notes=_clean_text(agent_envelope.get("agent_notes")),
            agent_raw_response=agent_raw,
        )

    # -------------------------------------------------------------------------
    # Existence checks + structural facts
    # -------------------------------------------------------------------------
    async def _assert_exists(
        self, kind: str, eid: UUID, label: str
    ) -> None:
        if kind == "talent":
            row = await self.dao_factory.get_talent_dao().get(eid)
        else:
            row = await self.dao_factory.get_startup_dao().get(eid)
        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"{label.capitalize()} ({kind}) {eid} not found",
            )

    async def _compute_structural_facts(
        self, payload: ConnectStrategyRequest
    ) -> dict[str, Any]:
        talent_follow_dao = self.dao_factory.get_talent_follow_dao()
        startup_follow_dao = self.dao_factory.get_startup_follow_dao()
        talent_dao = self.dao_factory.get_talent_dao()

        # --- already-connected booleans -------------------------------------
        already_connected = False
        target_follows_viewer = False
        if payload.viewer_type == "talent" and payload.target_type == "talent":
            already_connected = await talent_follow_dao.exists(
                payload.viewer_id, payload.target_id
            )
            target_follows_viewer = await talent_follow_dao.exists(
                payload.target_id, payload.viewer_id
            )
        elif payload.viewer_type == "talent" and payload.target_type == "startup":
            already_connected = await startup_follow_dao.exists(
                payload.viewer_id, payload.target_id
            )

        # --- mutual followers (talents who follow both endpoints) -----------
        if payload.viewer_type == "talent":
            v_followers = set(
                await talent_follow_dao.follower_ids(payload.viewer_id)
            )
        else:
            v_followers = set(
                await startup_follow_dao.follower_ids(payload.viewer_id)
            )
        if payload.target_type == "talent":
            t_followers = set(
                await talent_follow_dao.follower_ids(payload.target_id)
            )
        else:
            t_followers = set(
                await startup_follow_dao.follower_ids(payload.target_id)
            )
        mutual_ids = (v_followers & t_followers) - {
            payload.viewer_id,
            payload.target_id,
        }

        mutual_objs: list[MutualConnection] = []
        for mid in list(mutual_ids)[:MUTUAL_SAMPLE_CAP]:
            t = await talent_dao.get(mid)
            if t is None:
                continue
            mutual_objs.append(
                MutualConnection(
                    id=t.id,
                    name=t.name,
                    headline=t.headline or "",
                    role_category=t.role_category,
                )
            )

        # --- PageRank context ----------------------------------------------
        net = NetworkService(self.dao_factory)
        viewer_score = await (
            net.get_talent_score(payload.viewer_id)
            if payload.viewer_type == "talent"
            else net.get_startup_score(payload.viewer_id)
        )
        target_score = await (
            net.get_talent_score(payload.target_id)
            if payload.target_type == "talent"
            else net.get_startup_score(payload.target_id)
        )
        viewer_bracket = _project_bracket(viewer_score)
        target_bracket = _project_bracket(target_score)

        return {
            "already_connected": already_connected,
            "target_follows_viewer": target_follows_viewer,
            "mutual_connections_count": len(mutual_ids),
            "network_context": NetworkContext(
                viewer=viewer_bracket,
                target=target_bracket,
                mutual_connections=mutual_objs,
            ),
        }

    # -------------------------------------------------------------------------
    # Prompts + parsing
    # -------------------------------------------------------------------------
    def _system_prompt(self, payload: ConnectStrategyRequest) -> str:
        return (
            "You are a connection-strategy advisor for the Nucleus Institute, "
            "a Utah deep-tech matchmaking network. A logged-in user (the "
            "VIEWER) is on the profile page of someone else (the TARGET) and "
            "tapped 'How should I connect?'. Your job is to write the answer.\n\n"
            "TOOL USE:\n"
            "  1. ALWAYS start with `get_viewer_profile` and `get_target_profile`.\n"
            "  2. Then call any subset of these as needed:\n"
            "       get_overlap         shared sectors / skills / missions / "
            "alma maters / prior employers; same-city flag\n"
            "       get_connection_status   already-following + reverse + mutual count\n"
            "       get_warm_intros     up to 12 bridge people who could intro\n"
            "       get_network_context PageRank bracket + percentile for both ends\n"
            "       get_match_score     rule_filter pair score (when one is a talent and one a startup)\n"
            "  3. Aim for 3-5 tool calls total. Don't fan out more than necessary.\n\n"
            "FINAL ANSWER FORMAT — emit a single <REASONING>...</REASONING> block "
            "as your entire response. Inside the tag put a JSON object (no markdown "
            "fences) matching this shape:\n\n"
            "  <REASONING>\n"
            "  {\n"
            "    \"confidence\": 0.0-1.0,            // your read on whether this is a strong outreach to make\n"
            "    \"confidence_label\": \"low\" | \"medium\" | \"high\",\n"
            "    \"fit_bullets\": [\"...\", \"...\"],   // 2-4 short bullets on WHY they fit (skills, sectors, missions, network)\n"
            "    \"approach_bullets\": [\"...\", \"...\"], // 3-5 short bullets on HOW the viewer should reach out (channel, hook, do/don't)\n"
            "    \"questions_to_ask\": [\"...\", \"...\"], // 3-5 specific open-ended questions tied to target's actual background\n"
            "    \"agent_notes\": \"one short sentence overall take\"\n"
            "  }\n"
            "  </REASONING>\n\n"
            "Write each bullet yourself in your own words — don't echo the prompt. "
            "Do not write anything outside the REASONING tag.\n\n"
            "BULLET-WRITING RULES:\n"
            "  - Reference SPECIFIC fields from the tool output. Vague advice is useless.\n"
            "    BAD: 'Mention shared interests'\n"
            "    GOOD: 'Lead with your time at Galileo — Sarah was VP Eng there 2018-2021'\n"
            "  - If `get_warm_intros` returns bridges, name 1-2 by name in approach_bullets.\n"
            "  - If `get_overlap.shared_university_affiliations` is non-empty, mention the school.\n"
            "  - If `target_follows_viewer` is true, the viewer should mention 'I noticed you started following me — would love to compare notes'. Adjust tone.\n"
            "  - If `already_connected` is true, the viewer is already following: shift the advice toward the FIRST message rather than discovery.\n"
            "  - If PageRank `target.bracket` is `highly_connected`, advise warm intro over cold outreach.\n"
            "  - Questions should target the target's prior_companies / prior_titles / "
            "headline / projects — pull a specific noun to anchor each one.\n\n"
            "CONFIDENCE CALIBRATION:\n"
            "  high (0.7+):    strong overlap (shared sector + skills/missions) AND "
            "either mutual followers OR rule_filter pair score >= 0.6\n"
            "  medium (0.4-0.7): moderate overlap, viable cold outreach with the right hook\n"
            "  low (<0.4):     weak overlap; flag this honestly so the user calibrates\n"
        )

    def _user_prompt(self, payload: ConnectStrategyRequest) -> str:
        return (
            f"VIEWER is a {payload.viewer_type} (id: {payload.viewer_id}).\n"
            f"TARGET is a {payload.target_type} (id: {payload.target_id}).\n\n"
            "Use the tools to inspect both, compute overlap, check the follow "
            "graph, and draft outreach advice. Return only the final JSON envelope."
        )

    @staticmethod
    def _parse_envelope(text: str) -> dict[str, Any] | None:
        """Pull the JSON object out of the agent's final text.

        The prompt asks for a <REASONING>...</REASONING> wrapper; we match that
        first, then fall back to the first JSON object in the raw text for
        tolerance against models that drop the tag. Returns None on parse
        failure — the caller still surfaces the raw text via agent_raw_response."""
        tag_match = re.search(
            r"<REASONING>([\s\S]*?)</REASONING>", text, flags=re.IGNORECASE
        )
        body = tag_match.group(1) if tag_match else text
        body = body.strip()
        body = re.sub(r"^```(?:json)?\s*", "", body)
        body = re.sub(r"\s*```$", "", body)
        match = re.search(r"\{[\s\S]*\}", body)
        if not match:
            return None
        try:
            obj = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
        return obj if isinstance(obj, dict) else None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _project_bracket(score: Any) -> GraphBracket:
    if score is None:
        return GraphBracket()
    graph = score.full_ecosystem
    return GraphBracket(
        bracket=graph.bracket.value,
        bracket_label=graph.bracket_label,
        percentile=graph.percentile,
        cohort=graph.cohort,
        cohort_size=graph.cohort_size,
    )


def _normalize_confidence(
    raw: Any, label_raw: Any
) -> tuple[float, ConfidenceLabel]:
    """Coerce agent-supplied confidence into [0, 1] + matching label."""
    try:
        c = float(raw) if raw is not None else 0.5
    except (TypeError, ValueError):
        c = 0.5
    c = max(0.0, min(1.0, c))

    # Trust the agent's label if it falls in the legal set; otherwise derive
    # from the numeric value.
    if isinstance(label_raw, str) and label_raw.lower() in {"low", "medium", "high"}:
        label: ConfidenceLabel = label_raw.lower()  # type: ignore[assignment]
    elif c >= 0.7:
        label = "high"
    elif c >= 0.4:
        label = "medium"
    else:
        label = "low"
    return c, label


def _clean_bullets(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, str):
            stripped = item.strip()
            if stripped:
                out.append(stripped)
    return out


def _clean_text(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    stripped = raw.strip()
    return stripped or None
