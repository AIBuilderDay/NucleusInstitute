"""Per-request FastMCP server for the connect-strategy agent.

Exposes a small read-only toolkit the agent uses to draft "how should I reach
out to this person" advice. All tools close over the request's DAOFactory and
the viewer/target IDs that came in on the route — the agent never sees IDs as
arguments, only `get_*()` style accessors. Same per-request pattern as
`build_mcp_server` (matching) and `build_onboard_mcp_server` (onboarding).

Tool surface (7 tools):

    get_viewer_profile()      Full lean fields + extension for the viewer.
    get_target_profile()      Same, for the target.
    get_network_context()     PageRank bracket + percentile for both ends.
    get_connection_status()   Already-following + reverse-following booleans.
    get_overlap()             Structured overlap (sectors / skills /
                              missions / affiliations / prior_companies).
    get_warm_intros()         Bridge people in the follow graph who could
                              provide a warm intro.
    get_match_score()         Run rule_filter on the viewer↔target pair to
                              ground the fit narrative in the same scoring
                              engine the rest of the app uses.

Every tool returns a JSON-serializable dict (or list of dicts). No tool
mutates state.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastmcp import FastMCP

from app.dao.factory import DAOFactory
from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.provider.matching.rule_filter import RuleFilterMatcher

EntityType = str  # "talent" | "startup"

# Cap returned list lengths so big-fanout fields don't blow the agent's
# context window when both viewer and target are well-connected.
_INTRO_LIMIT = 12


def _talent_full(t: Talent, ext: Any | None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(t.id),
        "type": "talent",
        "name": t.name,
        "headline": t.headline,
        "role_category": t.role_category,
        "primary_network": t.primary_network,
        "role_titles_seeking": list(t.role_titles_seeking),
        "availability": t.availability,
        "skills": list(t.skills),
        "sectors_of_interest": list(t.sectors_of_interest),
        "stage_preference": list(t.stage_preference),
        "years_experience": t.years_experience,
        "prior_titles": list(t.prior_titles),
        "prior_companies": list(t.prior_companies),
        "prior_exits": t.prior_exits,
        "education": list(t.education),
        "location_city": t.location_city,
        "location_state": t.location_state,
        "remote_ok": t.remote_ok,
        "mission_keywords": list(t.mission_keywords),
        "bio": t.bio,
        "university_affiliations": list(t.university_affiliations),
        "trust_badges": list(t.trust_badges),
        "investor_profile": t.investor_profile,
        "service_provider_profile": t.service_provider_profile,
    }
    if ext is not None:
        out["bio_extended"] = ext.bio_extended
        out["highlights"] = list(ext.highlights or [])
        out["projects"] = list(ext.projects or [])
        out["links"] = dict(ext.links or {})
    return out


def _startup_full(s: Startup, ext: Any | None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(s.id),
        "type": "startup",
        "name": s.name,
        "one_liner": s.one_liner,
        "description": s.description,
        "sector": s.sector,
        "sectors_secondary": list(s.sectors_secondary),
        "stage": s.stage,
        "funding_status": s.funding_status,
        "team_size": s.team_size,
        "founded_year": s.founded_year,
        "roles_needed": list(s.roles_needed),
        "role_categories_open_to": list(s.role_categories_open_to),
        "required_skills": list(s.required_skills),
        "nice_to_have_skills": list(s.nice_to_have_skills),
        "mission_keywords": list(s.mission_keywords),
        "location_city": s.location_city,
        "location_state": s.location_state,
        "remote_ok": s.remote_ok,
        "seeking_investment": s.seeking_investment,
        "target_raise_usd": s.target_raise_usd,
        "accelerator_affiliations": list(s.accelerator_affiliations),
        "university_lab_origin": s.university_lab_origin,
    }
    if ext is not None:
        out["description_extended"] = ext.description_extended
        out["highlights"] = list(ext.highlights or [])
        out["links"] = dict(ext.links or {})
    return out


def _entity_skills(entity: Talent | Startup) -> set[str]:
    """The 'what they bring' skill axis differs by entity type."""
    if isinstance(entity, Talent):
        return {s.lower() for s in (entity.skills or [])}
    return {s.lower() for s in (entity.required_skills or [])}


def _entity_sectors(entity: Talent | Startup) -> set[str]:
    if isinstance(entity, Talent):
        return set(entity.sectors_of_interest or [])
    primary = {entity.sector} if entity.sector else set()
    return primary | set(entity.sectors_secondary or [])


def _entity_missions(entity: Talent | Startup) -> set[str]:
    return {m.lower() for m in (entity.mission_keywords or [])}


def _entity_city(entity: Talent | Startup) -> str:
    return (entity.location_city or "").strip().lower()


def _entity_state(entity: Talent | Startup) -> str:
    return (entity.location_state or "").strip().lower()


def build_connect_mcp_server(
    *,
    daos: DAOFactory,
    viewer_type: EntityType,
    viewer_id: UUID,
    target_type: EntityType,
    target_id: UUID,
) -> FastMCP:
    """Build a per-request MCP server bound to the viewer/target pair."""
    mcp = FastMCP("nucleus-connect")

    talent_dao = daos.get_talent_dao()
    startup_dao = daos.get_startup_dao()
    talent_ext_dao = daos.get_talent_profile_extension_dao()
    startup_ext_dao = daos.get_startup_profile_extension_dao()
    talent_follow_dao = daos.get_talent_follow_dao()
    startup_follow_dao = daos.get_startup_follow_dao()

    rule_filter = RuleFilterMatcher()

    async def _load_entity(
        kind: EntityType, eid: UUID
    ) -> tuple[Talent | Startup | None, Any]:
        if kind == "talent":
            t = await talent_dao.get(eid)
            if t is None:
                return None, None
            ext = await talent_ext_dao.get_by_talent_id(eid)
            return t, ext
        s = await startup_dao.get(eid)
        if s is None:
            return None, None
        ext = await startup_ext_dao.get_by_startup_id(eid)
        return s, ext

    # ------------------------------------------------------------------
    # Profile tools
    # ------------------------------------------------------------------
    @mcp.tool
    async def get_viewer_profile() -> dict[str, Any]:
        """Return the viewer's full profile (lean fields + extension if any).

        The viewer is the logged-in user clicking the "How should I connect?"
        button. Returns the same shape as `get_target_profile`, with a `type`
        field of `"talent"` or `"startup"` so the agent can branch on it.
        """
        entity, ext = await _load_entity(viewer_type, viewer_id)
        if entity is None:
            return {"error": "viewer not found"}
        if isinstance(entity, Talent):
            return _talent_full(entity, ext)
        return _startup_full(entity, ext)

    @mcp.tool
    async def get_target_profile() -> dict[str, Any]:
        """Return the target's full profile (lean fields + extension if any).

        The target is the person/company on the profile page that triggered
        the connect-strategy request.
        """
        entity, ext = await _load_entity(target_type, target_id)
        if entity is None:
            return {"error": "target not found"}
        if isinstance(entity, Talent):
            return _talent_full(entity, ext)
        return _startup_full(entity, ext)

    # ------------------------------------------------------------------
    # Network / follow tools
    # ------------------------------------------------------------------
    @mcp.tool
    async def get_connection_status() -> dict[str, Any]:
        """Booleans + counts describing the existing follow relationship.

        Fields:
          viewer_follows_target  Does the viewer already follow the target?
                                 Always false when viewer is a startup
                                 (startups don't follow anything).
          target_follows_viewer  Reverse direction. Only meaningful when
                                 both are talents.
          mutual_followers_count Count of talents that follow BOTH endpoints
                                 (a "double-follower" — strong proxy for
                                 community overlap).
        """
        viewer_follows_target = False
        target_follows_viewer = False
        if viewer_type == "talent" and target_type == "talent":
            viewer_follows_target = await talent_follow_dao.exists(viewer_id, target_id)
            target_follows_viewer = await talent_follow_dao.exists(target_id, viewer_id)
        elif viewer_type == "talent" and target_type == "startup":
            viewer_follows_target = await startup_follow_dao.exists(viewer_id, target_id)

        # Mutual followers = talent IDs that follow both viewer and target
        viewer_followers: set[UUID] = set()
        target_followers: set[UUID] = set()
        if viewer_type == "talent":
            viewer_followers = set(await talent_follow_dao.follower_ids(viewer_id))
        else:  # startup
            viewer_followers = set(await startup_follow_dao.follower_ids(viewer_id))
        if target_type == "talent":
            target_followers = set(await talent_follow_dao.follower_ids(target_id))
        else:
            target_followers = set(await startup_follow_dao.follower_ids(target_id))

        mutual = viewer_followers & target_followers
        mutual.discard(viewer_id)
        mutual.discard(target_id)
        return {
            "viewer_follows_target": viewer_follows_target,
            "target_follows_viewer": target_follows_viewer,
            "mutual_followers_count": len(mutual),
        }

    @mcp.tool
    async def get_warm_intros() -> list[dict[str, Any]]:
        """Up to 12 "bridge" people who could provide a warm intro.

        A bridge is a talent the viewer follows who, in turn, follows the
        target. If the target is a startup, "follows" means via StartupFollow.
        Returned in arbitrary deterministic order; agent should pick the
        most relevant given the conversation context.
        """
        # Viewer must be talent for "viewer follows X" to exist.
        if viewer_type != "talent":
            return []
        viewer_following = set(await talent_follow_dao.following_ids(viewer_id))
        if not viewer_following:
            return []

        if target_type == "talent":
            target_inbound = set(await talent_follow_dao.follower_ids(target_id))
        else:
            target_inbound = set(await startup_follow_dao.follower_ids(target_id))

        bridges = list((viewer_following & target_inbound) - {viewer_id, target_id})
        out: list[dict[str, Any]] = []
        for bid in bridges[:_INTRO_LIMIT]:
            t = await talent_dao.get(bid)
            if t is None:
                continue
            out.append(
                {
                    "id": str(t.id),
                    "name": t.name,
                    "headline": t.headline,
                    "role_category": t.role_category,
                }
            )
        return out

    @mcp.tool
    async def get_network_context() -> dict[str, Any]:
        """PageRank brackets for viewer + target, computed inside their cohorts.

        Use this to ground statements like "Marcus is in the top quartile of
        Utah mentors" — the bracket label and percentile both come from the
        same `network_service` the standalone /network-score endpoint uses.
        """
        # Local import to avoid eager pull of the matching/numpy stack at
        # MCP-server build time — connect requests don't always need a
        # PageRank refresh.
        from app.service.network_service import NetworkService

        net = NetworkService(daos)
        out: dict[str, Any] = {}
        if viewer_type == "talent":
            v = await net.get_talent_score(viewer_id)
        else:
            v = await net.get_startup_score(viewer_id)
        if target_type == "talent":
            t = await net.get_talent_score(target_id)
        else:
            t = await net.get_startup_score(target_id)

        def _project(score: Any) -> dict[str, Any]:
            if score is None:
                return {}
            graph = score.full_ecosystem  # GraphScore for both kinds
            return {
                "bracket": graph.bracket.value,
                "bracket_label": graph.bracket_label,
                "percentile": graph.percentile,
                "cohort": graph.cohort,
                "cohort_size": graph.cohort_size,
                "rank": graph.rank,
                "followers_count": score.followers_count,
                "following_count": score.following_count,
            }

        out["viewer"] = _project(v)
        out["target"] = _project(t)
        return out

    # ------------------------------------------------------------------
    # Overlap + scoring tools
    # ------------------------------------------------------------------
    @mcp.tool
    async def get_overlap() -> dict[str, Any]:
        """Structured overlap between viewer and target.

        Returns intersection sets for the dimensions that exist on both
        sides — sectors always, skills/missions/affiliations/prior_companies
        when both are talent. `same_city` / `same_state` are simple booleans
        so the agent doesn't have to re-check city strings.
        """
        v_entity, _ = await _load_entity(viewer_type, viewer_id)
        t_entity, _ = await _load_entity(target_type, target_id)
        if v_entity is None or t_entity is None:
            return {"error": "viewer or target not found"}

        shared_sectors = sorted(_entity_sectors(v_entity) & _entity_sectors(t_entity))
        shared_skills = sorted(_entity_skills(v_entity) & _entity_skills(t_entity))
        shared_missions = sorted(_entity_missions(v_entity) & _entity_missions(t_entity))

        same_city = (
            _entity_city(v_entity) == _entity_city(t_entity)
            and _entity_city(v_entity) != ""
        )
        same_state = (
            _entity_state(v_entity) == _entity_state(t_entity)
            and _entity_state(v_entity) != ""
        )

        result: dict[str, Any] = {
            "shared_sectors": shared_sectors,
            "shared_skills": shared_skills,
            "shared_missions": shared_missions,
            "same_city": same_city,
            "same_state": same_state,
        }

        # Talent-only dimensions
        if isinstance(v_entity, Talent) and isinstance(t_entity, Talent):
            v_unis = {u for u in (v_entity.university_affiliations or [])}
            t_unis = {u for u in (t_entity.university_affiliations or [])}
            v_pc = {c.lower() for c in (v_entity.prior_companies or [])}
            t_pc = {c.lower() for c in (t_entity.prior_companies or [])}
            result["shared_university_affiliations"] = sorted(v_unis & t_unis)
            result["shared_prior_companies"] = sorted(v_pc & t_pc)

        return result

    @mcp.tool
    async def get_match_score() -> dict[str, Any]:
        """Rule-filter score for the viewer↔target pair, when applicable.

        Returns score, dimension breakdown, hard-filter status, and the
        top reason. Only computable when one side is a talent and the
        other is a startup; for talent↔talent or startup↔startup the
        endpoint reports `not_applicable`.
        """
        v_entity, _ = await _load_entity(viewer_type, viewer_id)
        t_entity, _ = await _load_entity(target_type, target_id)
        if v_entity is None or t_entity is None:
            return {"status": "missing", "score": None}

        if isinstance(v_entity, Talent) and isinstance(t_entity, Startup):
            res = rule_filter._score_pair(v_entity, t_entity)  # noqa: SLF001
        elif isinstance(v_entity, Startup) and isinstance(t_entity, Talent):
            res = rule_filter._score_pair(t_entity, v_entity)  # noqa: SLF001
        else:
            return {"status": "not_applicable", "score": None}

        return {
            "status": "ok",
            "score": res.score,
            "passed_hard_filters": res.passed_hard_filters,
            "dimension_scores": dict(res.dimension_scores),
            "blockers": list(res.blockers),
            "top_reason": res.reasons[0] if res.reasons else None,
        }

    return mcp
