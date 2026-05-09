"""Per-request FastMCP server for the agentic-filter matcher.

The 11 tools defined in `build_mcp_server` are the agent's view of the matching
corpus. They all operate on in-memory candidate pools (passed in by the matcher
that already loaded them via DAOFactory) — no DB or HTTP layer touches this.

WHY PER-REQUEST?
----------------
FastMCP's natural pattern is one server per process, but the matcher signature
hands us a focal entity + candidate pool per call. Per-request servers let us
close over those values cleanly. Tools are registered as inner functions; the
returned `FastMCP` object is wired up via `Client(server)` for in-process calls
(no subprocess, no stdio, microsecond round-trip).

DIRECTION-AWARE
---------------
When focal is a Talent (matching talent → startups), only `find_startups` +
`get_*` are useful — the talent-finder tools have nothing to score against.
When focal is a Startup (matching startup → talent), the seven find_<network>
tools light up. We register the full set either way so the agent has a uniform
view, but tools that don't make sense for the direction return an empty list.

SCORE AUTHORITY
---------------
Every find_* tool ranks by `RuleFilterMatcher._score_pair` — same scoring
engine `rule_filter` uses. The agent re-orders the survivors and writes new
`reasons`, but never invents a score. See PLAN.md §7.5.

FILTER PRIMITIVES are shared with the `/discover` REST endpoints — they live
in `app/provider/matching/filters.py`. Both this MCP server and the discovery
service import them so the rule semantics never drift between the two surfaces.
"""

from __future__ import annotations

from typing import Literal

from fastmcp import FastMCP

from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.model.schema.enums import (
    Availability,
    CheckSize,
    InvestorType,
    RoleCategory,
    RoleTitle,
    Sector,
    ServiceType,
    Stage,
)
from app.provider.matching import filters
from app.provider.matching.rule_filter import RuleFilterMatcher

# Re-use the singleton instance the rule_filter registry already created so we
# share the same per-pair scoring logic. RuleFilterMatcher is stateless.
_rule_filter = RuleFilterMatcher()

# Hard cap on summary records per find_* tool call (PLAN.md §7.5).
HARD_LIMIT = 30


# =============================================================================
# Helpers — projections.
# =============================================================================
def _talent_summary(t: Talent, score: float, top_reason: str | None) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "headline": t.headline,
        "role_category": t.role_category,
        "primary_network": t.primary_network,
        "sectors_of_interest": list(t.sectors_of_interest)[:3],
        "availability": t.availability,
        "location": f"{t.location_city}, {t.location_state}",
        "score": round(score, 3),
        "top_reason": top_reason,
    }


def _startup_summary(s: Startup, score: float, top_reason: str | None) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "one_liner": s.one_liner,
        "sector": s.sector,
        "stage": s.stage,
        "seeking_investment": s.seeking_investment,
        "roles_needed": list(s.roles_needed)[:5],
        "location": f"{s.location_city}, {s.location_state}",
        "score": round(score, 3),
        "top_reason": top_reason,
    }


def _score_pair(t: Talent, s: Startup) -> tuple[float, str | None]:
    """Score a (talent, startup) pair via rule_filter. Returns (score, top_reason)."""
    result = _rule_filter._score_pair(t, s)
    score = result.score if result.passed_hard_filters else 0.0
    top_reason = result.reasons[0] if result.reasons else None
    return score, top_reason


def _full_talent(t: Talent) -> dict:
    """Full-fidelity talent view for `get_talent`. Includes everything the agent
    might want when drilling into a specific candidate."""
    return {
        "id": str(t.id),
        "name": t.name,
        "email": t.email,
        "headline": t.headline,
        "linkedin_url": t.linkedin_url,
        "role_category": t.role_category,
        "primary_network": t.primary_network,
        "role_titles_seeking": list(t.role_titles_seeking),
        "availability": t.availability,
        "hours_per_week_min": t.hours_per_week_min,
        "hours_per_week_max": t.hours_per_week_max,
        "skills": list(t.skills),
        "sectors_of_interest": list(t.sectors_of_interest),
        "domain_expertise": list(t.domain_expertise),
        "stage_preference": list(t.stage_preference),
        "years_experience": t.years_experience,
        "prior_titles": list(t.prior_titles),
        "prior_companies": list(t.prior_companies),
        "prior_exits": t.prior_exits,
        "ventures_advised_count": t.ventures_advised_count,
        "education": list(t.education),
        "certifications": list(t.certifications),
        "comp_expectation_type": t.comp_expectation_type,
        "comp_min_salary_usd": t.comp_min_salary_usd,
        "comp_max_salary_usd": t.comp_max_salary_usd,
        "equity_acceptable": t.equity_acceptable,
        "location_city": t.location_city,
        "location_state": t.location_state,
        "remote_ok": t.remote_ok,
        "willing_to_relocate": t.willing_to_relocate,
        "mission_keywords": list(t.mission_keywords),
        "risk_tolerance": t.risk_tolerance,
        "bio": t.bio,
        "investor_profile": t.investor_profile,
        "service_provider_profile": t.service_provider_profile,
        "utah_networks": list(t.utah_networks),
        "university_affiliations": list(t.university_affiliations),
    }


def _full_startup(s: Startup) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "website": s.website,
        "one_liner": s.one_liner,
        "description": s.description,
        "sector": s.sector,
        "sectors_secondary": list(s.sectors_secondary),
        "origin": s.origin,
        "founded_year": s.founded_year,
        "stage": s.stage,
        "trl_level": s.trl_level,
        "funding_status": s.funding_status,
        "total_raised_usd": s.total_raised_usd,
        "team_size": s.team_size,
        "roles_needed": list(s.roles_needed),
        "role_categories_open_to": list(s.role_categories_open_to),
        "availability_open_to": list(s.availability_open_to),
        "urgency": s.urgency,
        "board_seats_open": s.board_seats_open,
        "advisor_slots_open": s.advisor_slots_open,
        "comp_offered_type": s.comp_offered_type,
        "comp_min_salary_usd": s.comp_min_salary_usd,
        "comp_max_salary_usd": s.comp_max_salary_usd,
        "comp_max_equity_pct": s.comp_max_equity_pct,
        "seeking_investment": s.seeking_investment,
        "target_raise_usd": s.target_raise_usd,
        "target_check_sizes": list(s.target_check_sizes),
        "seeking_lead": s.seeking_lead,
        "services_needed": list(s.services_needed),
        "required_skills": list(s.required_skills),
        "nice_to_have_skills": list(s.nice_to_have_skills),
        "location_city": s.location_city,
        "location_state": s.location_state,
        "remote_ok": s.remote_ok,
        "mission_keywords": list(s.mission_keywords),
        "university_lab_origin": s.university_lab_origin,
        "accelerator_affiliations": list(s.accelerator_affiliations),
    }


# =============================================================================
# Server factory
# =============================================================================
def build_mcp_server(
    *,
    focal: Talent | Startup,
    talents_pool: list[Talent],
    startups_pool: list[Startup],
) -> FastMCP:
    """Build a per-request MCP server bound to this focal entity + candidate pool.

    Returns a `FastMCP` instance with all 11 tools registered. The caller wraps
    it with `Client(server)` for in-process tool calls.
    """
    mcp = FastMCP("nucleus-agentic-filter")
    talents_by_id = {str(t.id): t for t in talents_pool}
    startups_by_id = {str(s.id): s for s in startups_pool}
    focal_is_talent = isinstance(focal, Talent)
    focal_talent: Talent | None = focal if focal_is_talent else None
    focal_startup: Startup | None = None if focal_is_talent else focal  # type: ignore[assignment]

    # =========================================================================
    # Filter wrappers — bind the shared primitives in `filters.py` to the
    # per-request candidate pools. Each takes the raw kwargs the agent passed
    # to its corresponding find_* tool, builds the typed Pydantic filter, and
    # delegates. This is the only place the closure-over-pool happens.
    # =========================================================================
    def _filter_operators(kw: dict) -> list[Talent]:
        return filters.filter_operators(
            talents_pool, filters.OperatorFilters.model_validate(kw)
        )

    def _filter_mentors(kw: dict) -> list[Talent]:
        return filters.filter_mentors(
            talents_pool, filters.MentorFilters.model_validate(kw)
        )

    def _filter_advisors(kw: dict) -> list[Talent]:
        return filters.filter_advisors(
            talents_pool, filters.AdvisorFilters.model_validate(kw)
        )

    def _filter_board_members(kw: dict) -> list[Talent]:
        return filters.filter_board_members(
            talents_pool, filters.BoardMemberFilters.model_validate(kw)
        )

    def _filter_investors(kw: dict) -> list[Talent]:
        return filters.filter_investors(
            talents_pool, filters.InvestorFilters.model_validate(kw)
        )

    def _filter_service_providers(kw: dict) -> list[Talent]:
        return filters.filter_service_providers(
            talents_pool, filters.ServiceProviderFilters.model_validate(kw)
        )

    def _filter_students_interns(kw: dict) -> list[Talent]:
        return filters.filter_students_interns(
            talents_pool, filters.StudentInternFilters.model_validate(kw)
        )

    def _filter_startups(kw: dict) -> list[Startup]:
        return filters.filter_startups(
            startups_pool, filters.StartupFilters.model_validate(kw)
        )

    # Routing table for the unified `count` tool.
    _filter_handlers = {
        "operators": _filter_operators,
        "mentors": _filter_mentors,
        "advisors": _filter_advisors,
        "board_members": _filter_board_members,
        "investors": _filter_investors,
        "service_providers": _filter_service_providers,
        "students_interns": _filter_students_interns,
        "startups": _filter_startups,
    }

    # =========================================================================
    # Score-and-summarize helpers — apply rule_filter scoring to survivors,
    # sort, and project to summary dicts. Cap at min(limit, HARD_LIMIT).
    # =========================================================================
    def _summarize_talents(survivors: list[Talent], limit: int) -> list[dict]:
        if focal_startup is not None:
            scored = [(t, *_score_pair(t, focal_startup)) for t in survivors]
        else:
            # Focal is a talent — no startup to score against. Return alphabetical;
            # this branch is rare (e.g. mentor → mentee) and is here for safety.
            scored = [(t, 0.0, None) for t in sorted(survivors, key=lambda t: t.name)]
        scored.sort(key=lambda row: row[1], reverse=True)
        return [_talent_summary(t, sc, tr) for t, sc, tr in scored[: min(limit, HARD_LIMIT)]]

    def _summarize_startups(survivors: list[Startup], limit: int) -> list[dict]:
        if focal_talent is not None:
            scored = [(s, *_score_pair(focal_talent, s)) for s in survivors]
        else:
            scored = [(s, 0.0, None) for s in sorted(survivors, key=lambda s: s.name)]
        scored.sort(key=lambda row: row[1], reverse=True)
        return [_startup_summary(s, sc, tr) for s, sc, tr in scored[: min(limit, HARD_LIMIT)]]

    # =========================================================================
    # 11 MCP tools.
    # =========================================================================
    @mcp.tool
    def find_operators(
        sectors_of_interest: list[Sector] | None = None,
        role_titles_seeking: list[RoleTitle] | None = None,
        skills_any: list[str] | None = None,
        availability: Availability | None = None,
        comp_max_min_usd: int | None = None,
        location_state: str | None = None,
        remote_ok: bool | None = None,
        stages: list[Stage] | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Find executives, operators, fractional execs, and cofounders (Operator Network).

        Use when the focal startup needs operational leadership (CEO, COO, CTO,
        fractional CFO, VP Sales, etc.) or when finding peers for a founder.
        Filters intersect (AND); list filters are ANY-of. Returns up to `limit`
        candidates (max 30) sorted by rule_filter score against the focal entity.
        """
        return _summarize_talents(_filter_operators(locals()), limit)

    @mcp.tool
    def find_mentors(
        sectors_of_interest: list[Sector] | None = None,
        mission_keywords_any: list[str] | None = None,
        location_state: str | None = None,
        hours_per_week_max: int | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Find informal, free-of-charge mentors (Mentor Network).

        Mentors offer time without compensation, typically a few hours/month.
        Use when the focal startup wants a relaxed, time-flexible advisor with
        no equity or salary commitment. Filters intersect (AND); list filters
        are ANY-of.
        """
        return _summarize_talents(_filter_mentors(locals()), limit)

    @mcp.tool
    def find_advisors(
        domain_expertise_any: list[str] | None = None,
        sectors_of_interest: list[Sector] | None = None,
        equity_acceptable: bool | None = None,
        ventures_advised_count_min: int | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Find formal SME advisors paid in equity (SME Advisory Network).

        Advisors are deeper, longer-engagement than mentors and typically
        compensated with founder equity or advisory shares. Use when the focal
        startup needs domain expertise (regulatory, deep-tech, market strategy)
        with a formal commitment.
        """
        return _summarize_talents(_filter_advisors(locals()), limit)

    @mcp.tool
    def find_board_members(
        prior_titles_any: list[str] | None = None,
        sectors_of_interest: list[Sector] | None = None,
        stages: list[Stage] | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Find board candidates.

        Board members typically have prior C-suite experience (CEO, CFO, COO,
        General Counsel) and bring governance + investor relations chops. Use
        when the focal startup is filling board seats (often post-Series-A).
        """
        return _summarize_talents(_filter_board_members(locals()), limit)

    @mcp.tool
    def find_investors(
        investor_type: InvestorType | None = None,
        typical_check_size: CheckSize | None = None,
        stages_invested_any: list[Stage] | None = None,
        sectors_focused_any: list[Sector] | None = None,
        utah_only: bool | None = None,
        lead_check: bool | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Find angel investors, VCs, family offices, syndicates, corporate VCs (Venture Network).

        Use when the focal startup is fundraising. Filters mirror the
        InvestorProfile sub-record on talent. `utah_only` finds investors who
        explicitly focus on Utah deep tech; `lead_check` finds investors who
        will lead rounds rather than follow.
        """
        return _summarize_talents(_filter_investors(locals()), limit)

    @mcp.tool
    def find_service_providers(
        service_type: ServiceType | None = None,
        stages_served_any: list[Stage] | None = None,
        sectors_served_any: list[Sector] | None = None,
        startup_friendly_terms: bool | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Find legal, creative, operational, technical, financial, marketing, recruiting service firms (Service Provider Network).

        Use when the focal startup needs paid services. `startup_friendly_terms`
        filters to providers offering deferred billing, discounted rates, or
        equity-for-services arrangements.
        """
        return _summarize_talents(_filter_service_providers(locals()), limit)

    @mcp.tool
    def find_students_interns(
        school: str | None = None,
        field_of_study: str | None = None,
        availability: Availability | None = None,
        sectors_of_interest: list[Sector] | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Find students and interns (academic pipeline).

        Use when the focal startup wants early-career talent from U of U, BYU,
        USU, or other universities. `school` and `field_of_study` are
        case-insensitive substring matches against the talent's education
        history.
        """
        return _summarize_talents(_filter_students_interns(locals()), limit)

    @mcp.tool
    def find_startups(
        sector: Sector | None = None,
        stages: list[Stage] | None = None,
        role_categories_open_to_any: list[RoleCategory] | None = None,
        seeking: Literal["hiring", "investment", "services", "advisors", "board"] | None = None,
        services_needed_any: list[ServiceType] | None = None,
        location_state: str | None = None,
        mission_keywords_any: list[str] | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Find startups filtered by sector, stage, and what they're open to.

        Use when the focal entity is talent (operator, investor, advisor,
        mentor, etc.) looking for a startup. `seeking` narrows to startups
        currently open to that kind of engagement: `hiring` (has roles_needed),
        `investment` (seeking_investment=True), `services` (has services_needed),
        `advisors` (advisor_slots_open > 0), `board` (board_seats_open > 0).
        """
        return _summarize_startups(_filter_startups(locals()), limit)

    @mcp.tool
    def get_talent(talent_id: str) -> dict | None:
        """Return the full profile of a talent by ID.

        Use after a find_* tool surfaces a promising candidate and you need the
        bio, full skill list, education, comp expectations, etc. Returns None
        if the ID isn't in the candidate pool.
        """
        t = talents_by_id.get(talent_id)
        return _full_talent(t) if t else None

    @mcp.tool
    def get_startup(startup_id: str) -> dict | None:
        """Return the full profile of a startup by ID.

        Use after `find_startups` surfaces a promising candidate and you need
        the description, full skills required, fundraise details, accelerator
        affiliations, etc. Returns None if the ID isn't in the candidate pool.
        """
        s = startups_by_id.get(startup_id)
        return _full_startup(s) if s else None

    @mcp.tool
    def count(
        category: Literal[
            "operators",
            "mentors",
            "advisors",
            "board_members",
            "investors",
            "service_providers",
            "students_interns",
            "startups",
        ],
        filters: dict | None = None,
    ) -> int:
        """Cheap probe — return how many candidates match `filters` for `category`.

        Equivalent to calling find_<category> and reading the length, but skips
        the per-pair scoring and summary projection so it's much cheaper in
        tokens. Use this to test whether a filter is too narrow before
        committing to a full search. `filters` is an optional dict whose keys
        match the corresponding find_* tool's parameters; unknown keys are
        ignored.
        """
        handler = _filter_handlers[category]
        return len(handler(filters or {}))

    return mcp
