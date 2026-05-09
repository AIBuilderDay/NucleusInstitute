"""DAO for the swipe_list table.

Composite PK is (swiper_id, swiper_kind). All mutations are read-modify-write
on the JSON arrays — fine for hackathon scale; if concurrent updates ever
matter, replace with row-level locking or a normalized join table.
"""

from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.database.swipe_list import SwipeList

SwiperKind = Literal["talent", "startup"]
TargetKind = Literal["talent", "startup"]


def _columns_for(kind: TargetKind) -> tuple[str, str]:
    """Return (liked_col_name, passed_col_name) for the given target kind."""
    if kind == "talent":
        return "liked_talent_ids", "passed_talent_ids"
    return "liked_startup_ids", "passed_startup_ids"


class SwipeListDAO:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(
        self, swiper_id: UUID, swiper_kind: SwiperKind
    ) -> SwipeList | None:
        stmt = select(SwipeList).where(
            SwipeList.swiper_id == swiper_id,
            SwipeList.swiper_kind == swiper_kind,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_or_create(
        self, swiper_id: UUID, swiper_kind: SwiperKind
    ) -> SwipeList:
        row = await self.get(swiper_id, swiper_kind)
        if row is not None:
            return row
        row = SwipeList(
            swiper_id=swiper_id,
            swiper_kind=swiper_kind,
            liked_talent_ids=[],
            passed_talent_ids=[],
            liked_startup_ids=[],
            passed_startup_ids=[],
        )
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def record_swipe(
        self,
        swiper_id: UUID,
        swiper_kind: SwiperKind,
        target_id: UUID,
        target_kind: TargetKind,
        liked: bool,
    ) -> SwipeList:
        """Upsert: add `target_id` to the liked-or-passed list, remove from the
        opposite if present. Returns the updated row."""
        row = await self.get_or_create(swiper_id, swiper_kind)
        liked_col, passed_col = _columns_for(target_kind)
        target_str = str(target_id)

        chosen_col, other_col = (liked_col, passed_col) if liked else (passed_col, liked_col)

        chosen = list(getattr(row, chosen_col) or [])
        other = list(getattr(row, other_col) or [])

        if target_str in other:
            other = [x for x in other if x != target_str]
        if target_str not in chosen:
            chosen.append(target_str)

        setattr(row, chosen_col, chosen)
        setattr(row, other_col, other)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def clear_swipe(
        self,
        swiper_id: UUID,
        swiper_kind: SwiperKind,
        target_id: UUID,
        target_kind: TargetKind,
    ) -> bool:
        """Remove `target_id` from both liked and passed lists for the given
        target kind. Returns True if anything was removed."""
        row = await self.get(swiper_id, swiper_kind)
        if row is None:
            return False
        liked_col, passed_col = _columns_for(target_kind)
        target_str = str(target_id)

        liked = list(getattr(row, liked_col) or [])
        passed = list(getattr(row, passed_col) or [])
        new_liked = [x for x in liked if x != target_str]
        new_passed = [x for x in passed if x != target_str]
        changed = (len(new_liked) != len(liked)) or (len(new_passed) != len(passed))
        if not changed:
            return False
        setattr(row, liked_col, new_liked)
        setattr(row, passed_col, new_passed)
        await self.session.commit()
        return True
