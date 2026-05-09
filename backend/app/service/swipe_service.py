"""SwipeService — record/clear swipes and hydrate per-swiper lists.

Three legal swiper/target combos:

- talent  -> talent
- talent  -> startup
- startup -> talent

Startups never swipe other startups; the service raises ValueError if asked.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import Depends

from app.dao.daos.swipe_list_dao import SwiperKind, TargetKind
from app.dao.factory import DAOFactory
from app.model.database.swipe_list import SwipeList
from app.model.schema.startup import StartupResponse
from app.model.schema.swipe import (
    StartupSwipeListsResponse,
    SwipeAckResponse,
    TalentSwipeListsResponse,
)
from app.model.schema.talent import TalentResponse


class SwipeService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self.talent_dao = dao_factory.get_talent_dao()
        self.startup_dao = dao_factory.get_startup_dao()
        self.swipe_dao = dao_factory.get_swipe_list_dao()

    # ----- mutations ---------------------------------------------------------

    async def record_swipe(
        self,
        swiper_id: UUID,
        swiper_kind: SwiperKind,
        target_id: UUID,
        target_kind: TargetKind,
        liked: bool,
    ) -> SwipeAckResponse:
        self._reject_illegal_pair(swiper_kind, target_kind)
        if swiper_kind == "talent" and target_kind == "talent" and swiper_id == target_id:
            raise ValueError("Cannot swipe on yourself")
        await self._validate_exists(swiper_id, swiper_kind)
        await self._validate_exists(target_id, target_kind)

        row = await self.swipe_dao.record_swipe(
            swiper_id=swiper_id,
            swiper_kind=swiper_kind,
            target_id=target_id,
            target_kind=target_kind,
            liked=liked,
        )
        liked_col, passed_col = self._cols(target_kind)
        return SwipeAckResponse(
            swiper_id=str(swiper_id),
            swiper_kind=swiper_kind,
            target_id=str(target_id),
            target_kind=target_kind,
            liked=liked,
            matched_count=len(getattr(row, liked_col) or []),
            passed_count=len(getattr(row, passed_col) or []),
        )

    async def clear_swipe(
        self,
        swiper_id: UUID,
        swiper_kind: SwiperKind,
        target_id: UUID,
        target_kind: TargetKind,
    ) -> bool:
        self._reject_illegal_pair(swiper_kind, target_kind)
        return await self.swipe_dao.clear_swipe(
            swiper_id=swiper_id,
            swiper_kind=swiper_kind,
            target_id=target_id,
            target_kind=target_kind,
        )

    # ----- reads -------------------------------------------------------------

    async def get_talent_lists(
        self, swiper_id: UUID, swiper_kind: SwiperKind
    ) -> TalentSwipeListsResponse:
        row = await self.swipe_dao.get(swiper_id, swiper_kind)
        matched_ids = _ids(row, "liked_talent_ids")
        passed_ids = _ids(row, "passed_talent_ids")
        matched = await self._hydrate_talents(matched_ids)
        passed = await self._hydrate_talents(passed_ids)
        return TalentSwipeListsResponse(matched=matched, passed=passed)

    async def get_startup_lists(
        self, swiper_id: UUID, swiper_kind: SwiperKind
    ) -> StartupSwipeListsResponse:
        if swiper_kind == "startup":
            # Startups don't swipe on startups — always empty.
            return StartupSwipeListsResponse(matched=[], passed=[])
        row = await self.swipe_dao.get(swiper_id, swiper_kind)
        matched_ids = _ids(row, "liked_startup_ids")
        passed_ids = _ids(row, "passed_startup_ids")
        matched = await self._hydrate_startups(matched_ids)
        passed = await self._hydrate_startups(passed_ids)
        return StartupSwipeListsResponse(matched=matched, passed=passed)

    # ----- internals ---------------------------------------------------------

    @staticmethod
    def _reject_illegal_pair(swiper_kind: SwiperKind, target_kind: TargetKind) -> None:
        if swiper_kind == "startup" and target_kind == "startup":
            raise ValueError("Startups cannot swipe on other startups")

    @staticmethod
    def _cols(target_kind: TargetKind) -> tuple[str, str]:
        if target_kind == "talent":
            return "liked_talent_ids", "passed_talent_ids"
        return "liked_startup_ids", "passed_startup_ids"

    async def _validate_exists(self, entity_id: UUID, kind: SwiperKind | TargetKind) -> None:
        if kind == "talent":
            if await self.talent_dao.get(entity_id) is None:
                raise LookupError(f"Talent {entity_id} not found")
        else:
            if await self.startup_dao.get(entity_id) is None:
                raise LookupError(f"Startup {entity_id} not found")

    async def _hydrate_talents(self, ids: list[UUID]) -> list[TalentResponse]:
        out: list[TalentResponse] = []
        for tid in ids:
            t = await self.talent_dao.get(tid)
            if t is not None:
                out.append(TalentResponse.model_validate(t))
        return out

    async def _hydrate_startups(self, ids: list[UUID]) -> list[StartupResponse]:
        out: list[StartupResponse] = []
        for sid in ids:
            s = await self.startup_dao.get(sid)
            if s is not None:
                out.append(StartupResponse.model_validate(s))
        return out


def _ids(row: SwipeList | None, attr: str) -> list[UUID]:
    if row is None:
        return []
    raw = getattr(row, attr) or []
    return [UUID(x) if isinstance(x, str) else x for x in raw]
