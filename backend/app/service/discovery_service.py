"""DiscoveryService — directory-style "find me X" lookups.

Sits alongside `MatchingService` but solves a different problem:

  MatchingService  →  ranked, explainable talent ↔ startup matches.
                      Returns full `MatchResult` (dimension scores + reasons).
                      Use for "show me the best startup for Marcus" with a
                      breakdown card. Supports rule_filter and agentic_filter
                      via `?matcher=`.

  DiscoveryService →  filtered + scored directory of any one network type.
                      Used by the browse / search UI for "find me investors",
                      "find me mentors", "find me peer operators". Returns a
                      flat list of target profiles + relevance score + a
                      single top reason.

                      Vanilla only — uses rule_filter for scoring. Agentic
                      flows live on `/match/*?matcher=agentic_filter`.

Direction-aware scoring:
  - talent → startup  / startup → talent : score(talent, startup) via
    rule_filter; ranked by score desc.
  - talent → talent   / startup → startup: no (talent, startup) pair to
    score against. The network filter has already narrowed the results;
    we sort alphabetically with score=0.0.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException

from app.dao.factory import DAOFactory
from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.provider.matching import filters
from app.provider.matching.rule_filter import RuleFilterMatcher

# Stateless singleton — same scorer the rule_filter matcher uses, so a
# candidate's score in `/discover` is consistent with their score in `/match`.
_rule_filter = RuleFilterMatcher()


# =============================================================================
# Scoring helpers
# =============================================================================
def _score_pair(t: Talent, s: Startup) -> tuple[float, str | None]:
    """Score a (talent, startup) pair via rule_filter.

    Score collapses to 0.0 if the pair fails rule_filter's hard filters —
    hard-blocked pairs still appear in discovery results (the network filter
    already narrowed them in), but they sink to the bottom of the ranking.
    """
    result = _rule_filter._score_pair(t, s)
    score = result.score if result.passed_hard_filters else 0.0
    top_reason = result.reasons[0] if result.reasons else None
    return score, top_reason


def _rank_talents_against_startup(
    survivors: list[Talent], focal: Startup, top_k: int
) -> list[tuple[Talent, float, str | None]]:
    scored = [(t, *_score_pair(t, focal)) for t in survivors]
    scored.sort(key=lambda row: row[1], reverse=True)
    return scored[:top_k]


def _rank_startups_against_talent(
    survivors: list[Startup], focal: Talent, top_k: int
) -> list[tuple[Startup, float, str | None]]:
    scored = [(s, *_score_pair(focal, s)) for s in survivors]
    scored.sort(key=lambda row: row[1], reverse=True)
    return scored[:top_k]


def _rank_peer_talents(
    survivors: list[Talent], top_k: int
) -> list[tuple[Talent, float, str | None]]:
    """Talent → talent: no rule_filter pair to score against. Sort by name."""
    survivors = sorted(survivors, key=lambda t: t.name)
    return [(t, 0.0, None) for t in survivors[:top_k]]


def _rank_peer_startups(
    survivors: list[Startup], top_k: int
) -> list[tuple[Startup, float, str | None]]:
    survivors = sorted(survivors, key=lambda s: s.name)
    return [(s, 0.0, None) for s in survivors[:top_k]]


# =============================================================================
# Service
# =============================================================================
class DiscoveryService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self.talent_dao = dao_factory.get_talent_dao()
        self.startup_dao = dao_factory.get_startup_dao()

    async def _load_talent(self, talent_id: UUID) -> Talent:
        t = await self.talent_dao.get(talent_id)
        if t is None:
            raise HTTPException(status_code=404, detail=f"Talent {talent_id} not found")
        return t

    async def _load_startup(self, startup_id: UUID) -> Startup:
        s = await self.startup_dao.get(startup_id)
        if s is None:
            raise HTTPException(status_code=404, detail=f"Startup {startup_id} not found")
        return s

    # =========================================================================
    # Talent-network lookups (target ∈ {operators, mentors, advisors,
    # board_members, investors, service_providers, students_interns})
    # =========================================================================
    async def find_talent_network(
        self,
        *,
        focal_type: str,
        focal_id: UUID,
        target_type: str,
        f: Any,  # one of the filter Pydantic models
        top_k: int,
    ) -> tuple[Talent | Startup, list[tuple[Talent, float, str | None]]]:
        """Find members of a single talent network from any focal entity.

        Returns (focal, ranked_results).
        """
        focal: Talent | Startup
        if focal_type == "talent":
            focal = await self._load_talent(focal_id)
        else:
            focal = await self._load_startup(focal_id)
        pool = await self.talent_dao.list_all()

        survivors = self._apply_talent_network_filter(pool, target_type, f)
        # Drop the focal entity from peer results.
        if isinstance(focal, Talent):
            survivors = [t for t in survivors if t.id != focal.id]
            ranked = _rank_peer_talents(survivors, top_k)
        else:
            ranked = _rank_talents_against_startup(survivors, focal, top_k)
        return focal, ranked

    @staticmethod
    def _apply_talent_network_filter(
        pool: list[Talent], target_type: str, f: Any
    ) -> list[Talent]:
        if target_type == "operators":
            return filters.filter_operators(pool, f)
        if target_type == "mentors":
            return filters.filter_mentors(pool, f)
        if target_type == "advisors":
            return filters.filter_advisors(pool, f)
        if target_type == "board_members":
            return filters.filter_board_members(pool, f)
        if target_type == "investors":
            return filters.filter_investors(pool, f)
        if target_type == "service_providers":
            return filters.filter_service_providers(pool, f)
        if target_type == "students_interns":
            return filters.filter_students_interns(pool, f)
        raise HTTPException(
            status_code=400,
            detail=f"Unknown talent target_type '{target_type}'",
        )

    # =========================================================================
    # Startup lookups (target == 'startups'; from talent or startup focal)
    # =========================================================================
    async def find_startups(
        self,
        *,
        focal_type: str,
        focal_id: UUID,
        f: filters.StartupFilters,
        top_k: int,
    ) -> tuple[Talent | Startup, list[tuple[Startup, float, str | None]]]:
        focal: Talent | Startup
        if focal_type == "talent":
            focal = await self._load_talent(focal_id)
        else:
            focal = await self._load_startup(focal_id)
        pool = await self.startup_dao.list_all()
        survivors = filters.filter_startups(pool, f)

        if isinstance(focal, Startup):
            survivors = [s for s in survivors if s.id != focal.id]
            ranked = _rank_peer_startups(survivors, top_k)
        else:
            ranked = _rank_startups_against_talent(survivors, focal, top_k)
        return focal, ranked
