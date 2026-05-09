"""Per-request FastMCP server for the auto-match email drafter agent.

The drafter agent's job is to write a single short email per (subscriber,
match) pair. It needs four read-only tools:

    get_sender_profile()      Subscriber's profile — same person across the
                              whole digest. The "from" voice.
    get_recipient_profile()   The candidate the drafter is currently writing
                              about. Re-build the server per recipient so
                              this tool always returns the right person.
    get_match_details()       Score + reasons + dimension scores from the
                              matcher that produced this pair. Grounds the
                              email's "why we paired you" line.
    get_overlap()             Quick intersection between sender + recipient
                              (sectors, missions, skills, location). Lets
                              the agent point at concrete commonalities.

Same per-request, in-process pattern as `connect_server.py` and
`onboard_server.py`. The drafter's `Client(server)` round-trip is
microseconds; no subprocess, no stdio.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastmcp import FastMCP

from app.dao.factory import DAOFactory
from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.model.schema.match import MatchResult

EntityKind = str  # "talent" | "startup"


def _talent_view(t: Talent) -> dict[str, Any]:
    """Slim talent projection — what the drafter needs to write a personable
    paragraph. Excludes free-text bio (drafter doesn't need to copy-paste)."""
    return {
        "id": str(t.id),
        "kind": "talent",
        "name": t.name,
        "email": t.email,
        "headline": t.headline,
        "role_category": t.role_category,
        "primary_network": t.primary_network,
        "sectors_of_interest": list(t.sectors_of_interest),
        "skills": list(t.skills)[:12],
        "mission_keywords": list(t.mission_keywords),
        "years_experience": t.years_experience,
        "location": f"{t.location_city}, {t.location_state}",
        "remote_ok": t.remote_ok,
    }


def _startup_view(s: Startup) -> dict[str, Any]:
    return {
        "id": str(s.id),
        "kind": "startup",
        "name": s.name,
        "one_liner": s.one_liner,
        "sector": s.sector,
        "sectors_secondary": list(s.sectors_secondary),
        "stage": s.stage,
        "mission_keywords": list(s.mission_keywords),
        "roles_needed": list(s.roles_needed),
        "seeking_investment": s.seeking_investment,
        "location": f"{s.location_city}, {s.location_state}",
        "remote_ok": s.remote_ok,
    }


def _project(entity: Talent | Startup) -> dict[str, Any]:
    if isinstance(entity, Talent):
        return _talent_view(entity)
    return _startup_view(entity)


def _entity_sectors(entity: Talent | Startup) -> set[str]:
    if isinstance(entity, Talent):
        return {s.lower() for s in (entity.sectors_of_interest or [])}
    primary = {entity.sector.lower()} if entity.sector else set()
    return primary | {s.lower() for s in (entity.sectors_secondary or [])}


def _entity_missions(entity: Talent | Startup) -> set[str]:
    return {m.lower() for m in (entity.mission_keywords or [])}


def _entity_city(entity: Talent | Startup) -> str:
    return (entity.location_city or "").strip().lower()


def _entity_state(entity: Talent | Startup) -> str:
    return (entity.location_state or "").strip().lower()


def build_auto_match_email_mcp_server(
    *,
    daos: DAOFactory,
    sender_kind: EntityKind,
    sender_id: UUID,
    recipient_kind: EntityKind,
    recipient_id: UUID,
    match: MatchResult,
) -> FastMCP:
    """Build a per-request MCP server for the email-drafter agent.

    Bound to one (sender, recipient, match) triple. Re-build per pair so
    `get_recipient_profile` and `get_match_details` always reflect the
    candidate currently being drafted.
    """
    mcp = FastMCP("nucleus-auto-match-email")

    talent_dao = daos.get_talent_dao()
    startup_dao = daos.get_startup_dao()

    async def _load(kind: EntityKind, eid: UUID) -> Talent | Startup | None:
        if kind == "talent":
            return await talent_dao.get(eid)
        return await startup_dao.get(eid)

    @mcp.tool
    async def get_sender_profile() -> dict[str, Any]:
        """The subscriber's profile — they're the "from" of this email.

        Use this to set the voice (an investor's email reads differently
        than a fractional COO's) and to pick which of the sender's traits
        to mention in the opener.
        """
        entity = await _load(sender_kind, sender_id)
        if entity is None:
            return {"error": "sender not found"}
        return _project(entity)

    @mcp.tool
    async def get_recipient_profile() -> dict[str, Any]:
        """The matched candidate this email is about. Don't address the
        recipient by name in the salutation — the email goes TO the
        sender, who then decides whether to reach out. Use the recipient
        details to explain who we suggested and why.
        """
        entity = await _load(recipient_kind, recipient_id)
        if entity is None:
            return {"error": "recipient not found"}
        return _project(entity)

    @mcp.tool
    async def get_match_details() -> dict[str, Any]:
        """Score, dimension breakdown, and the matcher's `reasons` bullets
        for this pair. These reasons came from rule_filter (or whichever
        matcher ran). Cite them when explaining why we paired the two.
        """
        return {
            "score": match.score,
            "matcher": match.matcher,
            "passed_hard_filters": match.passed_hard_filters,
            "dimension_scores": dict(match.dimension_scores),
            "reasons": list(match.reasons),
        }

    @mcp.tool
    async def get_overlap() -> dict[str, Any]:
        """Concrete intersections between sender + recipient:
        shared sectors, shared mission keywords, same city, same state.
        Use these instead of generic phrases — pointing at a specific
        shared sector reads warmer than "you have a lot in common."
        """
        sender = await _load(sender_kind, sender_id)
        recipient = await _load(recipient_kind, recipient_id)
        if sender is None or recipient is None:
            return {"error": "sender or recipient not found"}
        return {
            "shared_sectors": sorted(
                _entity_sectors(sender) & _entity_sectors(recipient)
            ),
            "shared_missions": sorted(
                _entity_missions(sender) & _entity_missions(recipient)
            ),
            "same_city": (
                _entity_city(sender) == _entity_city(recipient)
                and _entity_city(sender) != ""
            ),
            "same_state": (
                _entity_state(sender) == _entity_state(recipient)
                and _entity_state(sender) != ""
            ),
        }

    return mcp
