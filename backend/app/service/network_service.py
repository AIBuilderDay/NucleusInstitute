"""NetworkService — follow-graph mutations + PageRank-derived network scores.

Owns the follow/unfollow operations, looks up follow lists, and produces
the user-facing `NetworkScoreResponse` (bracket + percentile within cohort).
On any mutation, invalidates the PageRank cache for both graphs so the
next score request recomputes against the fresh edge set.

Cohorting:
- Talent are bracketed within their `role_category` (mentors compared
  to mentors, students to students, etc.).
- Startups are a single cohort under "startup".
"""

from __future__ import annotations

from uuid import UUID

from fastapi import Depends

from app.dao.factory import DAOFactory
from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.model.schema.follow import (
    FollowSummary,
    FollowersResponse,
    GraphScore,
    NetworkScoreResponse,
    TalentFollowingResponse,
    bracket_label,
    percentile_to_bracket,
)
from app.service.pagerank_service import GraphKind, PageRankService


def _talent_summary(t: Talent) -> FollowSummary:
    return FollowSummary(
        id=t.id,
        name=t.name,
        headline=t.headline or "",
        role_category=t.role_category,
        primary_network=t.primary_network,
        photo_url=t.photo_url,
    )


def _startup_summary(s: Startup) -> FollowSummary:
    return FollowSummary(
        id=s.id,
        name=s.name,
        headline=s.one_liner or "",
        sector=s.sector,
        stage=s.stage,
        one_liner=s.one_liner,
    )


class NetworkService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self.talent_dao = dao_factory.get_talent_dao()
        self.startup_dao = dao_factory.get_startup_dao()
        self.talent_follow_dao = dao_factory.get_talent_follow_dao()
        self.startup_follow_dao = dao_factory.get_startup_follow_dao()
        self.pagerank = PageRankService(dao_factory)

    # ----- mutations ---------------------------------------------------------

    async def follow_talent(self, follower_id: UUID, followee_id: UUID) -> bool:
        if follower_id == followee_id:
            raise ValueError("Cannot follow yourself")
        if await self.talent_dao.get(follower_id) is None:
            raise LookupError(f"Follower talent {follower_id} not found")
        if await self.talent_dao.get(followee_id) is None:
            raise LookupError(f"Followee talent {followee_id} not found")
        created = await self.talent_follow_dao.add(follower_id, followee_id)
        if created:
            PageRankService.invalidate()
        return created

    async def unfollow_talent(self, follower_id: UUID, followee_id: UUID) -> bool:
        removed = await self.talent_follow_dao.remove(follower_id, followee_id)
        if removed:
            PageRankService.invalidate()
        return removed

    async def follow_startup(self, follower_id: UUID, startup_id: UUID) -> bool:
        if await self.talent_dao.get(follower_id) is None:
            raise LookupError(f"Follower talent {follower_id} not found")
        if await self.startup_dao.get(startup_id) is None:
            raise LookupError(f"Startup {startup_id} not found")
        created = await self.startup_follow_dao.add(follower_id, startup_id)
        if created:
            PageRankService.invalidate("full_ecosystem")
        return created

    async def unfollow_startup(self, follower_id: UUID, startup_id: UUID) -> bool:
        removed = await self.startup_follow_dao.remove(follower_id, startup_id)
        if removed:
            PageRankService.invalidate("full_ecosystem")
        return removed

    # ----- reads -------------------------------------------------------------

    async def get_following(self, talent_id: UUID) -> TalentFollowingResponse:
        followee_talent_ids = await self.talent_follow_dao.following_ids(talent_id)
        followee_startup_ids = await self.startup_follow_dao.following_startup_ids(talent_id)

        talents: list[FollowSummary] = []
        for tid in followee_talent_ids:
            t = await self.talent_dao.get(tid)
            if t is not None:
                talents.append(_talent_summary(t))

        startups: list[FollowSummary] = []
        for sid in followee_startup_ids:
            s = await self.startup_dao.get(sid)
            if s is not None:
                startups.append(_startup_summary(s))

        return TalentFollowingResponse(
            talent=talents,
            startups=startups,
            total=len(talents) + len(startups),
        )

    async def get_talent_followers(self, talent_id: UUID) -> FollowersResponse:
        ids = await self.talent_follow_dao.follower_ids(talent_id)
        items: list[FollowSummary] = []
        for fid in ids:
            t = await self.talent_dao.get(fid)
            if t is not None:
                items.append(_talent_summary(t))
        return FollowersResponse(items=items, total=len(items))

    async def get_startup_followers(self, startup_id: UUID) -> FollowersResponse:
        ids = await self.startup_follow_dao.follower_ids(startup_id)
        items: list[FollowSummary] = []
        for fid in ids:
            t = await self.talent_dao.get(fid)
            if t is not None:
                items.append(_talent_summary(t))
        return FollowersResponse(items=items, total=len(items))

    # ----- scores ------------------------------------------------------------

    async def get_talent_score(self, talent_id: UUID) -> NetworkScoreResponse | None:
        talent = await self.talent_dao.get(talent_id)
        if talent is None:
            return None
        followers_count = await self.talent_follow_dao.follower_count(talent_id)
        following_count = len(await self.talent_follow_dao.following_ids(talent_id))
        following_count += len(
            await self.startup_follow_dao.following_startup_ids(talent_id)
        )

        people_only = await self._talent_graph_score(talent, "people_only")
        full = await self._talent_graph_score(talent, "full_ecosystem")
        return NetworkScoreResponse(
            entity_id=talent_id,
            entity_type="talent",
            followers_count=followers_count,
            following_count=following_count,
            people_only=people_only,
            full_ecosystem=full,
        )

    async def get_startup_score(self, startup_id: UUID) -> NetworkScoreResponse | None:
        startup = await self.startup_dao.get(startup_id)
        if startup is None:
            return None
        followers_count = await self.startup_follow_dao.follower_count(startup_id)
        full = await self._startup_graph_score(startup_id)
        return NetworkScoreResponse(
            entity_id=startup_id,
            entity_type="startup",
            followers_count=followers_count,
            following_count=0,  # startups don't follow anything
            people_only=None,
            full_ecosystem=full,
        )

    # ----- internals ---------------------------------------------------------

    async def _talent_graph_score(
        self, talent: Talent, graph: GraphKind
    ) -> GraphScore:
        scores = await self.pagerank.get_scores(graph)
        cohort_label = talent.role_category
        cohort_ids = [
            t.id for t in await self.talent_dao.list_all()
            if t.role_category == cohort_label
        ]
        cohort_scores = [scores.get(cid, 0.0) for cid in cohort_ids]
        return _graphscore(
            score=scores.get(talent.id, 0.0),
            cohort_label=cohort_label,
            cohort_scores=cohort_scores,
        )

    async def _startup_graph_score(self, startup_id: UUID) -> GraphScore:
        scores = await self.pagerank.get_scores("full_ecosystem")
        startups = await self.startup_dao.list_all()
        cohort_scores = [scores.get(s.id, 0.0) for s in startups]
        return _graphscore(
            score=scores.get(startup_id, 0.0),
            cohort_label="startup",
            cohort_scores=cohort_scores,
        )


def _graphscore(*, score: float, cohort_label: str, cohort_scores: list[float]) -> GraphScore:
    cohort_size = len(cohort_scores)
    if cohort_size == 0:
        return GraphScore(
            score=score,
            rank=1,
            cohort=cohort_label,
            cohort_size=0,
            percentile=0.0,
            bracket=percentile_to_bracket(0.0),
            bracket_label=bracket_label(percentile_to_bracket(0.0)),
        )

    sorted_desc = sorted(cohort_scores, reverse=True)
    # rank = 1-indexed position when sorted descending; ties resolve to the
    # highest matching index so a tied entity gets the better rank.
    rank = next(
        (i + 1 for i, s in enumerate(sorted_desc) if s <= score),
        cohort_size,
    )
    # Percentile: fraction of cohort strictly below this score. A node with
    # the top score in its cohort gets ~100; the bottom gets ~0. Ties land
    # at the lower edge of the tied group.
    below = sum(1 for s in cohort_scores if s < score)
    percentile = 100.0 * below / cohort_size
    bracket = percentile_to_bracket(percentile)
    return GraphScore(
        score=score,
        rank=rank,
        cohort=cohort_label,
        cohort_size=cohort_size,
        percentile=percentile,
        bracket=bracket,
        bracket_label=bracket_label(bracket),
    )
