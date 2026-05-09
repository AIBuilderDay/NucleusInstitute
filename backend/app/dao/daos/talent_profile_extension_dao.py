"""TalentProfileExtensionDAO — database operations for the talent profile extension."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.base import BaseDAO
from app.model.database.talent_profile_extension import TalentProfileExtension


class TalentProfileExtensionDAO(BaseDAO[TalentProfileExtension]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, TalentProfileExtension)

    async def get_by_talent_id(self, talent_id: UUID) -> TalentProfileExtension | None:
        stmt = select(TalentProfileExtension).where(
            TalentProfileExtension.talent_id == talent_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(self, talent_id: UUID, **kwargs: Any) -> TalentProfileExtension:
        existing = await self.get_by_talent_id(talent_id)
        if existing is None:
            instance = TalentProfileExtension(talent_id=talent_id, **kwargs)
            self.session.add(instance)
            await self.session.commit()
            await self.session.refresh(instance)
            return instance
        for key, value in kwargs.items():
            setattr(existing, key, value)
        await self.session.commit()
        await self.session.refresh(existing)
        return existing
