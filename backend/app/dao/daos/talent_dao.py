"""TalentDAO — database operations for the Talent model."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.base import BaseDAO
from app.model.database.talent import Talent


class TalentDAO(BaseDAO[Talent]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, Talent)

    async def get_by_email(self, email: str) -> Talent | None:
        stmt = select(Talent).where(Talent.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
