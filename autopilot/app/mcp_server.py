"""FastMCP server exposing the agent's whole toolkit.

Tools wrap the Nucleus backend over HTTP plus the local autopilot SQLite (for
contact dedup). The agent uses ONLY these tools — nothing else — so the
attack surface for hallucinated calls is bounded by what's defined here.
"""

from __future__ import annotations

import logging
from typing import Any

from fastmcp import FastMCP

from . import store
from .nucleus_client import NucleusClient

logger = logging.getLogger("autopilot.mcp")


def build_mcp_server(
    *,
    heal_startup_id: str,
    nucleus: NucleusClient,
) -> FastMCP:
    """Build a per-run MCP server bound to a specific HEAL startup id and
    Nucleus HTTP client. The agent tool-calls land on these closures."""

    mcp = FastMCP(name="heal-autopilot")

    # =========================================================================
    # Discovery
    # =========================================================================
    @mcp.tool
    async def find_candidates(
        sectors: list[str] | None = None,
        skills: list[str] | None = None,
        role_titles: list[str] | None = None,
        comp_ceiling_usd: int | None = None,
        location_state: str | None = None,
        remote_ok: bool | None = None,
        stages: list[str] | None = None,
        include_students: bool = True,
        top_k: int = 25,
    ) -> list[dict]:
        """Find candidates from the Nucleus talent network.

        - sectors: e.g. ["ai", "software"]. Sectors of interest the candidate flagged.
        - skills: e.g. ["python", "pytorch"]. ANY-of match against the candidate's skills.
        - role_titles: e.g. ["engineer", "cto"]. Defaults to engineer-shaped roles.
        - comp_ceiling_usd: drops candidates whose minimum salary expectation is above this.
        - location_state: 2-letter US state (e.g. "UT"). Remote-OK candidates pass too.
        - remote_ok: filter to remote-OK candidates only.
        - stages: e.g. ["seed", "series_a"]. Stages the candidate would consider.
        - include_students: also pull from the student/intern network.
        - top_k: cap on results (default 25).

        Returns a list of {id, name, email, headline, role_category, skills,
        sectors_of_interest, comp_min_salary_usd, location_city, score, top_reason,
        already_contacted}. Sorted by score descending.
        """
        body: dict[str, Any] = {}
        if sectors:
            body["sectors_of_interest"] = sectors
        body["role_titles_seeking"] = role_titles or ["engineer", "cto", "cofounder"]
        if skills:
            body["skills_any"] = skills
        if comp_ceiling_usd is not None:
            body["comp_max_min_usd"] = comp_ceiling_usd
        if location_state:
            body["location_state"] = location_state
        if remote_ok is not None:
            body["remote_ok"] = remote_ok
        if stages:
            body["stages"] = stages

        op_resp = await nucleus.find_operators(heal_startup_id, body, top_k=top_k)
        results = list(op_resp.get("results", []))

        if include_students and sectors:
            stu_body: dict[str, Any] = {"sectors_of_interest": sectors}
            stu_resp = await nucleus.find_students_interns(
                heal_startup_id, stu_body, top_k=min(15, top_k)
            )
            seen = {r["target"]["id"] for r in results}
            for r in stu_resp.get("results", []):
                if r["target"]["id"] not in seen:
                    results.append(r)

        contacted = await store.list_contacted_ids()
        out = []
        for r in results:
            t = r["target"]
            out.append(
                {
                    "id": t["id"],
                    "name": t.get("name"),
                    "email": t.get("email"),
                    "headline": t.get("headline"),
                    "role_category": t.get("role_category"),
                    "skills": t.get("skills", []),
                    "sectors_of_interest": t.get("sectors_of_interest", []),
                    "stage_preference": t.get("stage_preference", []),
                    "comp_min_salary_usd": t.get("comp_min_salary_usd"),
                    "location_city": t.get("location_city"),
                    "location_state": t.get("location_state"),
                    "remote_ok": t.get("remote_ok"),
                    "years_experience": t.get("years_experience"),
                    "score": r.get("score"),
                    "top_reason": r.get("top_reason"),
                    "already_contacted": t["id"] in contacted,
                }
            )
        return out

    @mcp.tool
    async def get_candidate(talent_id: str) -> dict:
        """Get the full Nucleus profile for one candidate."""
        return await nucleus.get_talent(talent_id)

    # =========================================================================
    # Outreach
    # =========================================================================
    @mcp.tool
    async def send_outreach_email(
        talent_id: str,
        subject: str,
        body: str,
        signer_name: str = "Heal Engineering",
        signer_role: str = "Engineering team",
        cta_url: str | None = None,
        cta_label: str | None = None,
    ) -> dict:
        """Send a personalized outreach email FROM HEAL Engineering TO a Nucleus candidate.

        - subject: email subject (1–300 chars).
        - body: plain-text body. Newlines preserved as line breaks.
        - signer_name / signer_role: shown in the From: row.
        - cta_url / cta_label: optional call-to-action button.

        Returns {sent: bool, to: str | None, resend_id: str | None, error: str | None}.
        Logs the contact to the local dedup table on success.
        """
        # Look up candidate first so we can record name/email even if send fails.
        try:
            candidate = await nucleus.get_talent(talent_id)
        except Exception as e:
            return {"sent": False, "to": None, "error": f"talent {talent_id} not found: {e}"}

        variables: dict[str, Any] = {
            "banner_eyebrow": "Heal Engineering · Hiring",
            "banner_title": "Quick intro from Heal Engineering",
            "from_label": signer_name,
            "from_role": signer_role,
            "body": body,
            "signoff": f"Talk soon,\n{signer_name}",
            "footer_note": "You can reply directly to this email.",
        }
        if cta_url and cta_label:
            variables["cta_url"] = cta_url
            variables["cta_label"] = cta_label

        try:
            result = await nucleus.send_email(
                startup_id=heal_startup_id,
                talent_id=talent_id,
                subject=subject,
                variables=variables,
            )
        except Exception as e:
            await store.record_contact(
                talent_id=talent_id,
                name=candidate.get("name", ""),
                email=candidate.get("email"),
                status="error",
                subject=subject,
                resend_id=None,
            )
            return {"sent": False, "to": candidate.get("email"), "error": str(e)}

        sent = bool(result.get("sent"))
        await store.record_contact(
            talent_id=talent_id,
            name=candidate.get("name", ""),
            email=candidate.get("email"),
            status="sent" if sent else "error",
            subject=subject,
            resend_id=result.get("resend_id"),
        )
        return {
            "sent": sent,
            "to": result.get("to") or candidate.get("email"),
            "resend_id": result.get("resend_id"),
            "error": result.get("error"),
        }

    # =========================================================================
    # Contact dedup
    # =========================================================================
    @mcp.tool
    async def already_contacted(talent_id: str) -> bool:
        """True if HEAL has already emailed this candidate from a previous run."""
        return await store.is_contacted(talent_id)

    @mcp.tool
    async def list_recently_contacted(limit: int = 50) -> list[str]:
        """List talent_ids HEAL has already emailed. Use this BEFORE sending."""
        ids = await store.list_contacted_ids()
        return list(ids)[:limit]

    return mcp
