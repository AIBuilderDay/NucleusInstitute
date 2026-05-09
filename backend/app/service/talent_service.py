"""TalentService — business logic for Talent profiles.

Routes inject this; this owns the DAO calls. Per the template's 4-layer pattern,
routes never touch DAOs directly.
"""

from uuid import UUID

from fastapi import Depends

from app.dao.factory import DAOFactory
from app.model.database.talent import Talent
from app.model.database.talent_profile_extension import TalentProfileExtension
from app.model.schema.profile_extension import TalentProfileExtensionUpsert
from app.model.schema.talent import TalentCreate, TalentFullCreate


class TalentService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self.talent_dao = dao_factory.get_talent_dao()
        self.profile_dao = dao_factory.get_talent_profile_extension_dao()

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

    async def get_profile_extension(
        self, talent_id: UUID
    ) -> TalentProfileExtension | None:
        return await self.profile_dao.get_by_talent_id(talent_id)

    async def upsert_profile_extension(
        self, talent_id: UUID, payload: TalentProfileExtensionUpsert
    ) -> TalentProfileExtension:
        data = payload.model_dump(mode="json")
        return await self.profile_dao.upsert(talent_id, **data)

    async def create_with_profile(
        self, payload: TalentFullCreate
    ) -> tuple[Talent, TalentProfileExtension | None]:
        """Insert lean Talent + (optional) extension in one transaction.

        Both writes share the request session so a failure on either rolls
        back the whole thing — no orphan rows.
        """
        lean_data = payload.model_dump(mode="json", exclude={"profile_extension"})
        talent = await self.talent_dao.add(**lean_data)

        profile: TalentProfileExtension | None = None
        if payload.profile_extension is not None:
            ext_data = payload.profile_extension.model_dump(mode="json")
            profile = await self.profile_dao.add(talent_id=talent.id, **ext_data)

        await self.dao_factory.commit()
        await self.dao_factory.session.refresh(talent)
        if profile is not None:
            await self.dao_factory.session.refresh(profile)
        return talent, profile
