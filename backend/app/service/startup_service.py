"""StartupService — business logic for Startup profiles."""

from uuid import UUID

from fastapi import Depends

from app.dao.factory import DAOFactory
from app.model.database.startup import Startup
from app.model.database.startup_profile_extension import StartupProfileExtension
from app.model.schema.profile_extension import StartupProfileExtensionUpsert
from app.model.schema.startup import StartupCreate


class StartupService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self.startup_dao = dao_factory.get_startup_dao()
        self.profile_dao = dao_factory.get_startup_profile_extension_dao()

    async def get(self, startup_id: UUID) -> Startup | None:
        return await self.startup_dao.get(startup_id)

    async def list_all(self, limit: int | None = None) -> list[Startup]:
        return await self.startup_dao.list_all(limit=limit)

    async def create(self, payload: StartupCreate) -> Startup:
        data = payload.model_dump(mode="json")
        return await self.startup_dao.create(**data)

    async def get_profile_extension(
        self, startup_id: UUID
    ) -> StartupProfileExtension | None:
        return await self.profile_dao.get_by_startup_id(startup_id)

    async def upsert_profile_extension(
        self, startup_id: UUID, payload: StartupProfileExtensionUpsert
    ) -> StartupProfileExtension:
        data = payload.model_dump(mode="json")
        return await self.profile_dao.upsert(startup_id, **data)
