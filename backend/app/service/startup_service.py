"""StartupService — business logic for Startup profiles."""

from uuid import UUID

from fastapi import Depends

from app.dao.factory import DAOFactory
from app.model.database.startup import Startup
from app.model.database.startup_profile_extension import StartupProfileExtension
from app.model.schema.profile_extension import StartupProfileExtensionUpsert
from app.model.schema.startup import StartupCreate, StartupFullCreate


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

    async def create_with_profile(
        self, payload: StartupFullCreate
    ) -> tuple[Startup, StartupProfileExtension | None]:
        """Insert lean Startup + (optional) extension in one transaction."""
        lean_data = payload.model_dump(mode="json", exclude={"profile_extension"})
        startup = await self.startup_dao.add(**lean_data)

        profile: StartupProfileExtension | None = None
        if payload.profile_extension is not None:
            ext_data = payload.profile_extension.model_dump(mode="json")
            profile = await self.profile_dao.add(startup_id=startup.id, **ext_data)

        await self.dao_factory.commit()
        await self.dao_factory.session.refresh(startup)
        if profile is not None:
            await self.dao_factory.session.refresh(profile)
        return startup, profile
