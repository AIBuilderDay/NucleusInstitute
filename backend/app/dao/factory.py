"""DAOFactory — one per request, lazy-instantiates DAOs sharing a single session.

Mirrors `fastapi-1password-template/backend/app/dao/factory.py`. Inject this into
Services (not into routes) and pull DAOs off it. Routes never touch DAOs directly.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.daos.follow_dao import StartupFollowDAO, TalentFollowDAO
from app.dao.daos.startup_dao import StartupDAO
from app.dao.daos.startup_profile_extension_dao import StartupProfileExtensionDAO
from app.dao.daos.talent_dao import TalentDAO
from app.dao.daos.talent_profile_extension_dao import TalentProfileExtensionDAO
from app.database.connection import get_session


class DAOFactory:
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session
        self._daos: dict[str, object] = {}

    def get_talent_dao(self) -> TalentDAO:
        if "talent" not in self._daos:
            self._daos["talent"] = TalentDAO(self.session)
        return self._daos["talent"]  # type: ignore[return-value]

    def get_startup_dao(self) -> StartupDAO:
        if "startup" not in self._daos:
            self._daos["startup"] = StartupDAO(self.session)
        return self._daos["startup"]  # type: ignore[return-value]

    def get_talent_profile_extension_dao(self) -> TalentProfileExtensionDAO:
        if "talent_profile_extension" not in self._daos:
            self._daos["talent_profile_extension"] = TalentProfileExtensionDAO(self.session)
        return self._daos["talent_profile_extension"]  # type: ignore[return-value]

    def get_startup_profile_extension_dao(self) -> StartupProfileExtensionDAO:
        if "startup_profile_extension" not in self._daos:
            self._daos["startup_profile_extension"] = StartupProfileExtensionDAO(self.session)
        return self._daos["startup_profile_extension"]  # type: ignore[return-value]

    def get_talent_follow_dao(self) -> TalentFollowDAO:
        if "talent_follow" not in self._daos:
            self._daos["talent_follow"] = TalentFollowDAO(self.session)
        return self._daos["talent_follow"]  # type: ignore[return-value]

    def get_startup_follow_dao(self) -> StartupFollowDAO:
        if "startup_follow" not in self._daos:
            self._daos["startup_follow"] = StartupFollowDAO(self.session)
        return self._daos["startup_follow"]  # type: ignore[return-value]

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
