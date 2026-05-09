"""MatchingService — the orchestrator for talent ↔ startup matching.

Responsibilities:
- Resolve which `MatchingProvider` to use (request override > app default).
- Fetch the focal profile (talent or startup) and the candidate pool via DAOs.
- Hand off to the provider, return ranked results.

This service is intentionally thin — all matching intelligence lives in the
providers under `app/provider/matching/`. Adding a new matcher does not
require touching this file.
"""

import asyncio
from uuid import UUID

from fastapi import Depends, HTTPException

from app.core.config import settings
from app.dao.factory import DAOFactory
from app.model.database.startup import Startup
from app.model.database.talent import Talent
from app.model.schema.match import MatchResult
from app.provider.matching.base import get_matcher, list_matchers


class MatchingService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self.talent_dao = dao_factory.get_talent_dao()
        self.startup_dao = dao_factory.get_startup_dao()

    def _resolve_matcher_name(self, override: str | None) -> str:
        return override or settings.default_matcher

    async def _load_talent(self, talent_id: UUID) -> Talent:
        talent = await self.talent_dao.get(talent_id)
        if talent is None:
            raise HTTPException(status_code=404, detail=f"Talent {talent_id} not found")
        return talent

    async def _load_startup(self, startup_id: UUID) -> Startup:
        startup = await self.startup_dao.get(startup_id)
        if startup is None:
            raise HTTPException(status_code=404, detail=f"Startup {startup_id} not found")
        return startup

    # -------------------------------------------------------------------------
    # Single-matcher endpoints
    # -------------------------------------------------------------------------
    async def match_talent_to_startups(
        self,
        talent_id: UUID,
        top_k: int = 5,
        matcher_name: str | None = None,
    ) -> tuple[Talent, str, list[MatchResult]]:
        talent = await self._load_talent(talent_id)
        startups = await self.startup_dao.list_all()
        name = self._resolve_matcher_name(matcher_name)
        try:
            matcher = get_matcher(name)
        except KeyError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        matches = await matcher.match_talent_to_startups(talent, startups, top_k=top_k)
        return talent, name, matches

    async def match_startup_to_talent(
        self,
        startup_id: UUID,
        top_k: int = 5,
        matcher_name: str | None = None,
        roles: list[str] | None = None,
    ) -> tuple[Startup, str, list[MatchResult]]:
        startup = await self._load_startup(startup_id)
        talents = await self.talent_dao.list_all()
        if roles:
            wanted = {r for r in roles if r}
            if wanted:
                talents = [t for t in talents if t.role_category in wanted]
        name = self._resolve_matcher_name(matcher_name)
        try:
            matcher = get_matcher(name)
        except KeyError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        matches = await matcher.match_startup_to_talent(startup, talents, top_k=top_k)
        return startup, name, matches

    # -------------------------------------------------------------------------
    # Compare-all endpoint — runs every registered matcher in parallel on the
    # same input so the demo can show "rule says X, embedding says Y, agent says Z."
    # -------------------------------------------------------------------------
    async def compare_talent_matchers(
        self,
        talent_id: UUID,
        top_k: int = 5,
    ) -> dict[str, list[MatchResult]]:
        talent = await self._load_talent(talent_id)
        startups = await self.startup_dao.list_all()
        names = list_matchers()
        results = await asyncio.gather(
            *[get_matcher(n).match_talent_to_startups(talent, startups, top_k=top_k) for n in names]
        )
        return dict(zip(names, results, strict=True))

    async def compare_startup_matchers(
        self,
        startup_id: UUID,
        top_k: int = 5,
    ) -> dict[str, list[MatchResult]]:
        startup = await self._load_startup(startup_id)
        talents = await self.talent_dao.list_all()
        names = list_matchers()
        results = await asyncio.gather(
            *[get_matcher(n).match_startup_to_talent(startup, talents, top_k=top_k) for n in names]
        )
        return dict(zip(names, results, strict=True))
