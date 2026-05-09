"""PageRank over the follow graph.

Two scored graphs:

1. `people_only`    — nodes = all Talent rows, edges = TalentFollow
2. `full_ecosystem` — nodes = all Talent rows + all Startup rows,
                      edges = TalentFollow + StartupFollow

Algorithm follows the standard formulation taught in the BYU ACME PageRank
lab (volume 1):

    p_{k+1} = d * (M + a/N * 1) * p_k + (1-d)/N * 1

where M is the column-stochastic transition matrix (M[i,j] = 1/out_deg(j)
if j → i, else 0), `a` is the dangling-node mass (sum of p[j] over nodes
with out_degree=0), and 1 is the all-ones vector. Damping d = 0.85.

Vector is renormalized each iteration to defend against floating-point
drift (the dangling redistribution should keep ||p||_1 = 1, but cheap
insurance is cheap).

Cache: two in-process score vectors keyed on `(talent_count,
startup_count, talent_edge_count, startup_edge_count)`. Any mutation to
talents, startups, or follow edges changes that key and forces a
recompute on the next call. Compute is bounded by node count and edge
sparsity — at hackathon scale (~500 nodes, a few thousand edges) it
runs in well under a second.
"""

from __future__ import annotations

import asyncio
from typing import Literal
from uuid import UUID

import numpy as np
from fastapi import Depends

from app.dao.factory import DAOFactory

GraphKind = Literal["people_only", "full_ecosystem"]

DAMPING = 0.85
MAX_ITERATIONS = 100
TOLERANCE = 1e-7


class _CacheEntry:
    __slots__ = ("signature", "scores", "node_index")

    def __init__(
        self,
        signature: tuple[int, ...],
        scores: dict[UUID, float],
        node_index: dict[UUID, int],
    ) -> None:
        self.signature = signature
        self.scores = scores
        self.node_index = node_index


class PageRankService:
    """Compute and cache PageRank for the two follow graphs.

    Cache lives at module scope and is shared across requests (process-wide).
    A simple asyncio.Lock guards recomputation so concurrent first-callers
    don't both build the matrix.
    """

    _cache: dict[GraphKind, _CacheEntry] = {}
    _lock: asyncio.Lock = asyncio.Lock()

    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self.talent_dao = dao_factory.get_talent_dao()
        self.startup_dao = dao_factory.get_startup_dao()
        self.talent_follow_dao = dao_factory.get_talent_follow_dao()
        self.startup_follow_dao = dao_factory.get_startup_follow_dao()

    async def _signature(self) -> tuple[int, int, int, int]:
        return (
            await self.talent_dao.count(),
            await self.startup_dao.count(),
            await self.talent_follow_dao.total_count(),
            await self.startup_follow_dao.total_count(),
        )

    async def get_scores(self, graph: GraphKind) -> dict[UUID, float]:
        sig = await self._signature()
        cached = PageRankService._cache.get(graph)
        if cached is not None and cached.signature == sig:
            return cached.scores

        async with PageRankService._lock:
            cached = PageRankService._cache.get(graph)
            if cached is not None and cached.signature == sig:
                return cached.scores
            entry = await self._compute(graph, sig)
            PageRankService._cache[graph] = entry
            return entry.scores

    async def _compute(self, graph: GraphKind, sig: tuple[int, ...]) -> _CacheEntry:
        talent_ids = [t.id for t in await self.talent_dao.list_all()]
        if graph == "full_ecosystem":
            startup_ids = [s.id for s in await self.startup_dao.list_all()]
            node_ids: list[UUID] = talent_ids + startup_ids
        else:
            startup_ids = []
            node_ids = list(talent_ids)

        n = len(node_ids)
        if n == 0:
            return _CacheEntry(sig, {}, {})

        index: dict[UUID, int] = {nid: i for i, nid in enumerate(node_ids)}

        # Build edge list. talent → talent is in both graphs; talent → startup
        # only in full_ecosystem. Edges to nodes outside `index` (shouldn't
        # happen, but defensive) are dropped.
        edges: list[tuple[int, int]] = []
        for follower, followee in await self.talent_follow_dao.all_edges():
            if follower in index and followee in index:
                edges.append((index[follower], index[followee]))
        if graph == "full_ecosystem":
            for follower, startup in await self.startup_follow_dao.all_edges():
                if follower in index and startup in index:
                    edges.append((index[follower], index[startup]))

        scores = _power_iterate(n, edges)
        score_map: dict[UUID, float] = {nid: float(scores[i]) for nid, i in index.items()}
        return _CacheEntry(sig, score_map, index)

    @classmethod
    def invalidate(cls, graph: GraphKind | None = None) -> None:
        """Drop cached scores. Called by FollowService after any mutation."""
        if graph is None:
            cls._cache.clear()
        else:
            cls._cache.pop(graph, None)


def _power_iterate(n: int, edges: list[tuple[int, int]]) -> np.ndarray:
    """Standard PageRank via power iteration with dangling-node redistribution."""
    out_degree = np.zeros(n, dtype=np.float64)
    for src, _ in edges:
        out_degree[src] += 1.0

    # Sparse adjacency stored as parallel arrays. For each edge j → i we add
    # 1/out_deg(j) to M[i, j]. We don't need a dense matrix — just iterate
    # edges each step and accumulate into `next_p`.
    inv_out = np.zeros(n, dtype=np.float64)
    nonzero = out_degree > 0
    inv_out[nonzero] = 1.0 / out_degree[nonzero]

    p = np.full(n, 1.0 / n, dtype=np.float64)
    teleport = (1.0 - DAMPING) / n

    for _ in range(MAX_ITERATIONS):
        dangling_mass = float(np.sum(p[~nonzero])) if (~nonzero).any() else 0.0
        # Each non-dangling node distributes p[j] * inv_out[j] to its successors.
        contrib = p * inv_out
        next_p = np.full(n, teleport + DAMPING * dangling_mass / n, dtype=np.float64)
        for src, dst in edges:
            next_p[dst] += DAMPING * contrib[src]

        delta = float(np.sum(np.abs(next_p - p)))
        # Renormalize defensively — should already sum to 1.
        s = float(np.sum(next_p))
        if s > 0:
            next_p /= s
        p = next_p
        if delta < TOLERANCE:
            break

    return p
