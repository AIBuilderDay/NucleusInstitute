"""TalentService — business logic for Talent profiles.

Routes inject this; this owns the DAO calls. Per the template's 4-layer pattern,
routes never touch DAOs directly.
"""

from uuid import UUID

from fastapi import Depends

from app.dao.factory import DAOFactory
from app.model.database.talent import Talent
from app.model.schema.talent import TalentCreate


class TalentService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self.talent_dao = dao_factory.get_talent_dao()

    async def get(self, talent_id: UUID) -> Talent | None:
        return await self.talent_dao.get(talent_id)

    async def get_by_email(self, email: str) -> Talent | None:
        return await self.talent_dao.get_by_email(email)

    async def list_all(self, limit: int | None = None) -> list[Talent]:
        return await self.talent_dao.list_all(limit=limit)

    async def create(self, payload: TalentCreate) -> Talent:
        # Pydantic → dict; serialize sub-models so JSONB columns get plain dicts.
        data = payload.model_dump(mode="json")
        return await self.talent_dao.create(**data)
