"""StartupProfileExtensionDAO — database operations for the startup profile extension."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.base import BaseDAO
from app.model.database.startup_profile_extension import StartupProfileExtension


class StartupProfileExtensionDAO(BaseDAO[StartupProfileExtension]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, StartupProfileExtension)

    async def get_by_startup_id(self, startup_id: UUID) -> StartupProfileExtension | None:
        stmt = select(StartupProfileExtension).where(
            StartupProfileExtension.startup_id == startup_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(self, startup_id: UUID, **kwargs: Any) -> StartupProfileExtension:
        existing = await self.get_by_startup_id(startup_id)
        if existing is None:
            instance = StartupProfileExtension(startup_id=startup_id, **kwargs)
            self.session.add(instance)
            await self.session.commit()
            await self.session.refresh(instance)
            return instance
        for key, value in kwargs.items():
            setattr(existing, key, value)
        await self.session.commit()
        await self.session.refresh(existing)
        return existing
