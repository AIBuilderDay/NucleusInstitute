"""StartupDAO — database operations for the Startup model."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.base import BaseDAO
from app.model.database.startup import Startup


class StartupDAO(BaseDAO[Startup]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, Startup)

    async def get_by_name(self, name: str) -> Startup | None:
        stmt = select(Startup).where(Startup.name == name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
