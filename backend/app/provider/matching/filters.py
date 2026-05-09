"""Pure filter primitives over Talent / Startup pools.

Originally lived as inner closures inside `app/mcp/server.py`. Extracted so the
discovery API and the agentic-filter MCP server share the same filter logic —
otherwise we'd duplicate the rule semantics in two places and they'd drift.

Every filter:
- takes the candidate pool + a typed Pydantic filter model (None fields = ignored)
- returns a list[Talent] | list[Startup] of survivors (no scoring, no ranking)
- intersects (AND) across fields; list fields are ANY-of (OR within the field)

Scoring + ranking happens in the discovery service (or the MCP `_summarize_*`
helpers) — it's separate so a count-only probe is cheap.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

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


# =============================================================================
# Helpers
# =============================================================================
def _enum_values(items: list[Any] | None) -> set[str]:
    if not items:
        return set()
    return {x.value if hasattr(x, "value") else x for x in items}


def _str_lower_set(items: list[str] | None) -> set[str]:
    if not items:
        return set()
    return {s.lower() for s in items}


def _enum_value(x: Any) -> str | None:
    if x is None:
        return None
    return x.value if hasattr(x, "value") else x


# =============================================================================
# Typed filter request models
# =============================================================================
class OperatorFilters(BaseModel):
    """Filters for the Operator Network — executives, operators, fractional execs, cofounders."""

    sectors_of_interest: list[Sector] | None = None
    role_titles_seeking: list[RoleTitle] | None = None
    skills_any: list[str] | None = None
    availability: Availability | None = None
    comp_max_min_usd: int | None = Field(
        None,
        description="Cap on the candidate's minimum salary expectation — drops anyone above this.",
    )
    location_state: str | None = None
    remote_ok: bool | None = None
    stages: list[Stage] | None = None


class MentorFilters(BaseModel):
    """Filters for the Mentor Network — informal, free-of-charge mentors."""

    sectors_of_interest: list[Sector] | None = None
    mission_keywords_any: list[str] | None = None
    location_state: str | None = None
    hours_per_week_max: int | None = None


class AdvisorFilters(BaseModel):
    """Filters for the SME Advisory Network — formal advisors paid in equity."""

    domain_expertise_any: list[str] | None = None
    sectors_of_interest: list[Sector] | None = None
    equity_acceptable: bool | None = None
    ventures_advised_count_min: int | None = None


class BoardMemberFilters(BaseModel):
    """Filters for board candidates."""

    prior_titles_any: list[str] | None = None
    sectors_of_interest: list[Sector] | None = None
    stages: list[Stage] | None = None


class InvestorFilters(BaseModel):
    """Filters for the Venture Network — angels, VCs, family offices, syndicates, corporate VCs."""

    investor_type: InvestorType | None = None
    typical_check_size: CheckSize | None = None
    stages_invested_any: list[Stage] | None = None
    sectors_focused_any: list[Sector] | None = None
    utah_only: bool | None = None
    lead_check: bool | None = None


class ServiceProviderFilters(BaseModel):
    """Filters for the Service Provider Network — legal, creative, technical, etc."""

    service_type: ServiceType | None = None
    stages_served_any: list[Stage] | None = None
    sectors_served_any: list[Sector] | None = None
    startup_friendly_terms: bool | None = None


class StudentInternFilters(BaseModel):
    """Filters for academic-pipeline talent (students + interns)."""

    school: str | None = Field(None, description="Case-insensitive substring match on education[].school")
    field_of_study: str | None = Field(None, description="Case-insensitive substring match on education[].field")
    availability: Availability | None = None
    sectors_of_interest: list[Sector] | None = None


class StartupFilters(BaseModel):
    """Filters for startups — the 'find startups' lookup."""

    sector: Sector | None = None
    stages: list[Stage] | None = None
    role_categories_open_to_any: list[RoleCategory] | None = None
    seeking: str | None = Field(
        None,
        description="One of 'hiring', 'investment', 'services', 'advisors', 'board'",
    )
    services_needed_any: list[ServiceType] | None = None
    location_state: str | None = None
    mission_keywords_any: list[str] | None = None


# =============================================================================
# Filter functions
# =============================================================================
def filter_operators(pool: list[Talent], f: OperatorFilters) -> list[Talent]:
    survivors = [
        t for t in pool
        if t.role_category in (RoleCategory.EXECUTIVE.value, RoleCategory.OPERATOR.value)
    ]
    if (sectors := _enum_values(f.sectors_of_interest)):
        survivors = [t for t in survivors if set(t.sectors_of_interest) & sectors]
    if (titles := _enum_values(f.role_titles_seeking)):
        survivors = [t for t in survivors if set(t.role_titles_seeking) & titles]
    if (skills := _str_lower_set(f.skills_any)):
        survivors = [t for t in survivors if {sk.lower() for sk in t.skills} & skills]
    if (avail := _enum_value(f.availability)) is not None:
        survivors = [t for t in survivors if t.availability == avail]
    if f.comp_max_min_usd is not None:
        cap = f.comp_max_min_usd
        survivors = [
            t for t in survivors
            if t.comp_min_salary_usd is None or t.comp_min_salary_usd <= cap
        ]
    if f.location_state:
        st = f.location_state
        survivors = [t for t in survivors if t.location_state == st or t.remote_ok]
    if f.remote_ok is not None:
        survivors = [t for t in survivors if t.remote_ok == f.remote_ok]
    if (stages := _enum_values(f.stages)):
        survivors = [t for t in survivors if set(t.stage_preference) & stages]
    return survivors


def filter_mentors(pool: list[Talent], f: MentorFilters) -> list[Talent]:
    survivors = [t for t in pool if t.role_category == RoleCategory.MENTOR.value]
    if (sectors := _enum_values(f.sectors_of_interest)):
        survivors = [t for t in survivors if set(t.sectors_of_interest) & sectors]
    if (missions := _str_lower_set(f.mission_keywords_any)):
        survivors = [
            t for t in survivors
            if {m.lower() for m in t.mission_keywords} & missions
        ]
    if f.location_state:
        st = f.location_state
        survivors = [t for t in survivors if t.location_state == st or t.remote_ok]
    if f.hours_per_week_max is not None:
        cap = f.hours_per_week_max
        survivors = [
            t for t in survivors
            if t.hours_per_week_max is None or t.hours_per_week_max <= cap
        ]
    return survivors


def filter_advisors(pool: list[Talent], f: AdvisorFilters) -> list[Talent]:
    survivors = [t for t in pool if t.role_category == RoleCategory.ADVISOR.value]
    if (domains := _str_lower_set(f.domain_expertise_any)):
        survivors = [
            t for t in survivors
            if {d.lower() for d in t.domain_expertise} & domains
        ]
    if (sectors := _enum_values(f.sectors_of_interest)):
        survivors = [t for t in survivors if set(t.sectors_of_interest) & sectors]
    if f.equity_acceptable is not None:
        survivors = [t for t in survivors if t.equity_acceptable == f.equity_acceptable]
    if f.ventures_advised_count_min is not None:
        n = f.ventures_advised_count_min
        survivors = [
            t for t in survivors if (t.ventures_advised_count or 0) >= n
        ]
    return survivors


def filter_board_members(pool: list[Talent], f: BoardMemberFilters) -> list[Talent]:
    survivors = [t for t in pool if t.role_category == RoleCategory.BOARD_MEMBER.value]
    if (titles := _str_lower_set(f.prior_titles_any)):
        survivors = [
            t for t in survivors if {p.lower() for p in t.prior_titles} & titles
        ]
    if (sectors := _enum_values(f.sectors_of_interest)):
        survivors = [t for t in survivors if set(t.sectors_of_interest) & sectors]
    if (stages := _enum_values(f.stages)):
        survivors = [t for t in survivors if set(t.stage_preference) & stages]
    return survivors


def filter_investors(pool: list[Talent], f: InvestorFilters) -> list[Talent]:
    survivors = [t for t in pool if t.role_category == RoleCategory.INVESTOR.value]

    def ip(t: Talent) -> dict:
        return t.investor_profile or {}

    if (itype := _enum_value(f.investor_type)) is not None:
        survivors = [t for t in survivors if ip(t).get("investor_type") == itype]
    if (cs := _enum_value(f.typical_check_size)) is not None:
        survivors = [t for t in survivors if ip(t).get("typical_check_size") == cs]
    if (stages := _enum_values(f.stages_invested_any)):
        survivors = [
            t for t in survivors if set(ip(t).get("stages_invested", [])) & stages
        ]
    if (sectors := _enum_values(f.sectors_focused_any)):
        survivors = [
            t for t in survivors if set(ip(t).get("sectors_focused", [])) & sectors
        ]
    if f.utah_only is not None:
        survivors = [t for t in survivors if ip(t).get("utah_only") == f.utah_only]
    if f.lead_check is not None:
        survivors = [t for t in survivors if ip(t).get("lead_check") == f.lead_check]
    return survivors


def filter_service_providers(pool: list[Talent], f: ServiceProviderFilters) -> list[Talent]:
    survivors = [
        t for t in pool if t.role_category == RoleCategory.SERVICE_PROVIDER.value
    ]

    def sp(t: Talent) -> dict:
        return t.service_provider_profile or {}

    if (st := _enum_value(f.service_type)) is not None:
        survivors = [t for t in survivors if sp(t).get("service_type") == st]
    if (stages := _enum_values(f.stages_served_any)):
        survivors = [
            t for t in survivors if set(sp(t).get("stages_served", [])) & stages
        ]
    if (sectors := _enum_values(f.sectors_served_any)):
        survivors = [
            t for t in survivors if set(sp(t).get("sectors_served", [])) & sectors
        ]
    if f.startup_friendly_terms is not None:
        survivors = [
            t for t in survivors
            if sp(t).get("startup_friendly_terms") == f.startup_friendly_terms
        ]
    return survivors


def filter_students_interns(pool: list[Talent], f: StudentInternFilters) -> list[Talent]:
    survivors = [
        t for t in pool
        if t.role_category in (RoleCategory.STUDENT.value, RoleCategory.INTERN.value)
    ]
    if f.school:
        school_l = f.school.lower()
        survivors = [
            t for t in survivors
            if any(school_l in (e.get("school", "") or "").lower() for e in (t.education or []))
        ]
    if f.field_of_study:
        field_l = f.field_of_study.lower()
        survivors = [
            t for t in survivors
            if any(field_l in (e.get("field", "") or "").lower() for e in (t.education or []))
        ]
    if (sectors := _enum_values(f.sectors_of_interest)):
        survivors = [t for t in survivors if set(t.sectors_of_interest) & sectors]
    if (avail := _enum_value(f.availability)) is not None:
        survivors = [t for t in survivors if t.availability == avail]
    return survivors


def filter_startups(pool: list[Startup], f: StartupFilters) -> list[Startup]:
    survivors = list(pool)
    if (sector := _enum_value(f.sector)) is not None:
        survivors = [
            s for s in survivors
            if s.sector == sector or sector in s.sectors_secondary
        ]
    if (stages := _enum_values(f.stages)):
        survivors = [s for s in survivors if s.stage in stages]
    if (rcats := _enum_values(f.role_categories_open_to_any)):
        survivors = [s for s in survivors if set(s.role_categories_open_to) & rcats]
    if f.seeking:
        seeking_l = f.seeking.lower()
        if seeking_l == "investment":
            survivors = [s for s in survivors if s.seeking_investment]
        elif seeking_l == "services":
            survivors = [s for s in survivors if s.services_needed]
        elif seeking_l == "advisors":
            survivors = [s for s in survivors if (s.advisor_slots_open or 0) > 0]
        elif seeking_l == "board":
            survivors = [s for s in survivors if (s.board_seats_open or 0) > 0]
        elif seeking_l == "hiring":
            survivors = [s for s in survivors if s.roles_needed]
    if (services := _enum_values(f.services_needed_any)):
        survivors = [s for s in survivors if set(s.services_needed) & services]
    if f.location_state:
        st = f.location_state
        survivors = [s for s in survivors if s.location_state == st or s.remote_ok]
    if (missions := _str_lower_set(f.mission_keywords_any)):
        survivors = [
            s for s in survivors
            if {m.lower() for m in s.mission_keywords} & missions
        ]
    return survivors


# =============================================================================
# Routing — used by both the MCP `count` tool and the discovery API.
# =============================================================================
TARGET_TALENT_NETWORKS = (
    "operators",
    "mentors",
    "advisors",
    "board_members",
    "investors",
    "service_providers",
    "students_interns",
)
TARGET_STARTUPS = "startups"
ALL_TARGETS = (*TARGET_TALENT_NETWORKS, TARGET_STARTUPS)
