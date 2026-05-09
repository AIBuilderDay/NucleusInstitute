"""RuleFilterMatcher — the Phase 1 vanilla matcher.

Two-stage scoring (PLAN.md §4):

  Stage A (hard filters):  eliminate impossible matches outright.
                           Which filters apply depends on talent.role_category —
                           e.g. mentors don't care about salary, students don't
                           need exec-level role overlap.

  Stage B (soft scoring):  for survivors, compute a weighted sum of 0–1
                           dimension scores. Weights are role-category-specific.
                           Each dimension also emits a human-readable reason
                           when it scores ≥ 0.5 — these become the "Why matched"
                           bullets on the frontend match card.

Design notes for future contributors:

* Only structured fields are read. Free-text (bio, description) is intentionally
  ignored here — that's the embedding matcher's job.
* The matcher is stateless. All state is on the inputs.
* Adding a new dimension = add a `_score_<dim>` function + entry in WEIGHTS.
* Adding a new role-category override = add an entry in `ROLE_WEIGHTS`.
* Adding a new hard filter = add a function returning (passed: bool, blocker: str | None)
  and add it to `_run_hard_filters`.
"""

from __future__ import annotations

from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.model.schema.enums import (
    Availability,
    CompType,
    RiskTolerance,
    RoleCategory,
    Stage,
)
from app.model.schema.match import MatchResult
from app.provider.matching.base import MatchingProvider, register_matcher

# -----------------------------------------------------------------------------
# Weights — must sum to 1.0 within each role-category profile.
# -----------------------------------------------------------------------------
DEFAULT_WEIGHTS: dict[str, float] = {
    "role": 0.25,
    "sector": 0.20,
    "stage": 0.10,
    "skills": 0.20,
    "mission": 0.10,
    "location": 0.10,
    "risk": 0.05,
}

ROLE_WEIGHTS: dict[str, dict[str, float]] = {
    RoleCategory.EXECUTIVE.value: DEFAULT_WEIGHTS,
    RoleCategory.OPERATOR.value: DEFAULT_WEIGHTS,
    RoleCategory.MENTOR.value: {
        "sector": 0.50,
        "mission": 0.50,
    },
    RoleCategory.ADVISOR.value: {
        "role": 0.30,
        "sector": 0.30,
        "mission": 0.20,
        "stage": 0.20,
    },
    RoleCategory.BOARD_MEMBER.value: {
        "stage": 0.30,
        "sector": 0.30,
        "role": 0.20,
        "mission": 0.20,
    },
    RoleCategory.STUDENT.value: {
        "sector": 0.30,
        "skills": 0.20,
        "mission": 0.20,
        "location": 0.20,
        "role": 0.10,
    },
    RoleCategory.INTERN.value: {
        "sector": 0.30,
        "skills": 0.20,
        "mission": 0.20,
        "location": 0.20,
        "role": 0.10,
    },
    RoleCategory.UNIVERSITY.value: {
        "sector": 0.30,
        "mission": 0.30,
        "stage": 0.20,
        "location": 0.20,
    },
    # investor / service_provider scoring is delegated to TODO matchers; for
    # now we fall back to default weights if they ever route through here.
    RoleCategory.INVESTOR.value: DEFAULT_WEIGHTS,
    RoleCategory.SERVICE_PROVIDER.value: DEFAULT_WEIGHTS,
}

# Stage → expected risk tolerance bucket. Earlier stage = higher risk.
STAGE_RISK: dict[str, str] = {
    Stage.IDEA.value: RiskTolerance.HIGH.value,
    Stage.PRE_SEED.value: RiskTolerance.HIGH.value,
    Stage.SEED.value: RiskTolerance.MEDIUM.value,
    Stage.SERIES_A.value: RiskTolerance.MEDIUM.value,
    Stage.GROWTH.value: RiskTolerance.LOW.value,
}


# =============================================================================
# Hard filters — return (passed, blocker_message_or_none).
# =============================================================================
def _filter_availability(t: Talent, s: Startup) -> tuple[bool, str | None]:
    if not s.availability_open_to:
        return True, None  # startup hasn't specified — don't block
    if t.availability in s.availability_open_to:
        return True, None
    return False, f"Availability mismatch: talent wants {t.availability}, startup needs {s.availability_open_to}"


def _filter_role_category(t: Talent, s: Startup) -> tuple[bool, str | None]:
    if not s.role_categories_open_to:
        return True, None
    if t.role_category in s.role_categories_open_to:
        return True, None
    return False, f"Startup not open to role category {t.role_category}"


def _filter_compensation(t: Talent, s: Startup) -> tuple[bool, str | None]:
    if t.role_category in (RoleCategory.MENTOR.value, RoleCategory.UNIVERSITY.value):
        return True, None

    talent_wants_salary = t.comp_expectation_type in (
        CompType.SALARY.value,
        CompType.SALARY_PLUS_EQUITY.value,
    )
    startup_offers_salary = s.comp_offered_type in (
        CompType.SALARY.value,
        CompType.SALARY_PLUS_EQUITY.value,
    )

    if talent_wants_salary and not startup_offers_salary:
        return False, "Talent wants salary, startup offers equity-only"

    if (
        talent_wants_salary
        and t.comp_min_salary_usd is not None
        and s.comp_max_salary_usd is not None
        and s.comp_max_salary_usd < t.comp_min_salary_usd
    ):
        return False, (
            f"Salary gap: talent min ${t.comp_min_salary_usd:,} > "
            f"startup max ${s.comp_max_salary_usd:,}"
        )
    return True, None


def _filter_location(t: Talent, s: Startup) -> tuple[bool, str | None]:
    if t.remote_ok or s.remote_ok:
        return True, None
    if t.location_state == s.location_state:
        return True, None
    return False, (
        f"Location mismatch: talent in {t.location_state}, startup in "
        f"{s.location_state}, neither remote-friendly"
    )


def _run_hard_filters(t: Talent, s: Startup) -> list[str]:
    """Return list of blocker messages. Empty list = passed all filters."""
    blockers: list[str] = []
    for fn in (_filter_availability, _filter_role_category, _filter_compensation, _filter_location):
        passed, msg = fn(t, s)
        if not passed and msg is not None:
            blockers.append(msg)
    return blockers


# =============================================================================
# Soft scoring — each returns (score in [0,1], reason if score >= 0.5 else None).
# =============================================================================
def _score_role(t: Talent, s: Startup) -> tuple[float, str | None]:
    if not s.roles_needed or not t.role_titles_seeking:
        return 0.0, None
    overlap = set(t.role_titles_seeking) & set(s.roles_needed)
    score = len(overlap) / max(len(s.roles_needed), 1)
    score = min(score, 1.0)
    if score >= 0.5:
        return score, f"Role match: {', '.join(sorted(overlap))}"
    if overlap:
        return score, None
    return 0.0, None


def _score_sector(t: Talent, s: Startup) -> tuple[float, str | None]:
    if not t.sectors_of_interest:
        return 0.0, None
    startup_sectors = {s.sector, *s.sectors_secondary}
    overlap = set(t.sectors_of_interest) & startup_sectors
    if not overlap:
        return 0.0, None
    score = 1.0 if s.sector in overlap else 0.6
    return score, f"Sector overlap: {', '.join(sorted(overlap))}"


def _score_stage(t: Talent, s: Startup) -> tuple[float, str | None]:
    if not t.stage_preference:
        return 0.0, None
    if s.stage in t.stage_preference:
        return 1.0, f"Stage match: {s.stage}"
    return 0.0, None


def _score_skills(t: Talent, s: Startup) -> tuple[float, str | None]:
    talent_skills = {sk.lower() for sk in t.skills}
    required = {sk.lower() for sk in s.required_skills}
    nice = {sk.lower() for sk in s.nice_to_have_skills}

    if not required and not nice:
        return 0.0, None

    required_hits = talent_skills & required
    nice_hits = talent_skills & nice

    required_score = len(required_hits) / len(required) if required else 0.0
    nice_score = (len(nice_hits) / len(nice) * 0.5) if nice else 0.0

    # Combined: required dominates, nice-to-have adds at most 50% bump.
    score = min(required_score + (nice_score if not required else nice_score * 0.5), 1.0)

    hits = sorted(required_hits | nice_hits)
    if score >= 0.5 and hits:
        return score, f"Skill overlap: {', '.join(hits)}"
    return score, None


def _score_mission(t: Talent, s: Startup) -> tuple[float, str | None]:
    a = {m.lower() for m in t.mission_keywords}
    b = {m.lower() for m in s.mission_keywords}
    if not a or not b:
        return 0.0, None
    overlap = a & b
    if not overlap:
        return 0.0, None
    score = len(overlap) / max(min(len(a), len(b)), 1)
    score = min(score, 1.0)
    if score >= 0.5:
        return score, f"Shared mission focus: {', '.join(sorted(overlap))}"
    return score, None


def _score_location(t: Talent, s: Startup) -> tuple[float, str | None]:
    if t.location_city and t.location_city == s.location_city:
        return 1.0, f"Same city: {t.location_city}"
    if t.location_state == s.location_state:
        return 0.7, f"Same state: {t.location_state}"
    if t.remote_ok or s.remote_ok:
        return 0.5, "Remote-compatible"
    return 0.0, None


def _score_risk(t: Talent, s: Startup) -> tuple[float, str | None]:
    expected = STAGE_RISK.get(s.stage)
    if expected is None:
        return 0.5, None
    if t.risk_tolerance == expected:
        return 1.0, None
    # Adjacent buckets get partial credit.
    order = [RiskTolerance.LOW.value, RiskTolerance.MEDIUM.value, RiskTolerance.HIGH.value]
    distance = abs(order.index(t.risk_tolerance) - order.index(expected))
    return max(0.0, 1.0 - 0.5 * distance), None


SCORERS = {
    "role": _score_role,
    "sector": _score_sector,
    "stage": _score_stage,
    "skills": _score_skills,
    "mission": _score_mission,
    "location": _score_location,
    "risk": _score_risk,
}


# =============================================================================
# Main matcher.
# =============================================================================
@register_matcher
class RuleFilterMatcher(MatchingProvider):
    """Vanilla weighted-filter matcher. No LLMs, no embeddings, fully deterministic."""

    name = "rule_filter"

    def _score_pair(self, t: Talent, s: Startup) -> MatchResult:
        blockers = _run_hard_filters(t, s)
        passed = not blockers

        weights = ROLE_WEIGHTS.get(t.role_category, DEFAULT_WEIGHTS)

        dimension_scores: dict[str, float] = {}
        reasons: list[str] = []
        weighted_total = 0.0
        for dim, weight in weights.items():
            scorer = SCORERS[dim]
            dim_score, reason = scorer(t, s)
            dimension_scores[dim] = round(dim_score, 3)
            weighted_total += dim_score * weight
            if reason:
                reasons.append(reason)

        # Hard-filter failures collapse the surfaced score to 0 but we still keep
        # the dimension breakdown so the UI can show "what could fix this?".
        final = round(weighted_total if passed else 0.0, 3)

        return MatchResult(
            talent_id=t.id,
            startup_id=s.id,
            score=final,
            passed_hard_filters=passed,
            dimension_scores=dimension_scores,
            reasons=reasons,
            blockers=blockers,
            matcher=self.name,
        )

    async def match_talent_to_startups(
        self,
        talent: Talent,
        startups: list[Startup],
        top_k: int = 5,
    ) -> list[MatchResult]:
        results = [self._score_pair(talent, s) for s in startups]
        results.sort(key=lambda r: (r.passed_hard_filters, r.score), reverse=True)
        return results[:top_k]

    async def match_startup_to_talent(
        self,
        startup: Startup,
        talents: list[Talent],
        top_k: int = 5,
    ) -> list[MatchResult]:
        results = [self._score_pair(t, startup) for t in talents]
        results.sort(key=lambda r: (r.passed_hard_filters, r.score), reverse=True)
        return results[:top_k]
