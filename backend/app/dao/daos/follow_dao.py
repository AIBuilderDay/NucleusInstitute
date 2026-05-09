"""DAOs for the two follow-edge tables.

Idempotent add/remove (re-following or re-unfollowing returns the existing
state, never raises). The PageRank service reads `all_edges` from these
DAOs to build the two graphs.
"""

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.model.database.follow import StartupFollow, TalentFollow


class TalentFollowDAO:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, follower_id: UUID, followee_id: UUID) -> bool:
        """Insert a (follower, followee) edge if it does not already exist.

        Returns True if a new edge was created, False if it already existed.
        Raises ValueError on self-follow (also enforced by DB CHECK constraint).
        """
        if follower_id == followee_id:
            raise ValueError("Cannot follow self")
        stmt = (
            sqlite_insert(TalentFollow)
            .values(follower_id=follower_id, followee_id=followee_id)
            .on_conflict_do_nothing(index_elements=["follower_id", "followee_id"])
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0

    async def remove(self, follower_id: UUID, followee_id: UUID) -> bool:
        stmt = delete(TalentFollow).where(
            TalentFollow.follower_id == follower_id,
            TalentFollow.followee_id == followee_id,
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0

    async def exists(self, follower_id: UUID, followee_id: UUID) -> bool:
        stmt = select(TalentFollow).where(
            TalentFollow.follower_id == follower_id,
            TalentFollow.followee_id == followee_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def following_ids(self, follower_id: UUID) -> list[UUID]:
        stmt = select(TalentFollow.followee_id).where(
            TalentFollow.follower_id == follower_id
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all()]

    async def follower_ids(self, followee_id: UUID) -> list[UUID]:
        stmt = select(TalentFollow.follower_id).where(
            TalentFollow.followee_id == followee_id
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all()]

    async def follower_count(self, followee_id: UUID) -> int:
        stmt = select(func.count()).select_from(TalentFollow).where(
            TalentFollow.followee_id == followee_id
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def total_count(self) -> int:
        stmt = select(func.count()).select_from(TalentFollow)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def all_edges(self) -> list[tuple[UUID, UUID]]:
        stmt = select(TalentFollow.follower_id, TalentFollow.followee_id)
        result = await self.session.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    async def bulk_insert(self, edges: list[tuple[UUID, UUID]]) -> int:
        """Used by the seeder. Skips duplicates and self-follows."""
        clean = [(a, b) for (a, b) in edges if a != b]
        if not clean:
            return 0
        stmt = (
            sqlite_insert(TalentFollow)
            .values([{"follower_id": a, "followee_id": b} for (a, b) in clean])
            .on_conflict_do_nothing(index_elements=["follower_id", "followee_id"])
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount or 0


class StartupFollowDAO:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, follower_id: UUID, startup_id: UUID) -> bool:
        stmt = (
            sqlite_insert(StartupFollow)
            .values(follower_id=follower_id, startup_id=startup_id)
            .on_conflict_do_nothing(index_elements=["follower_id", "startup_id"])
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0

    async def remove(self, follower_id: UUID, startup_id: UUID) -> bool:
        stmt = delete(StartupFollow).where(
            StartupFollow.follower_id == follower_id,
            StartupFollow.startup_id == startup_id,
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0

    async def exists(self, follower_id: UUID, startup_id: UUID) -> bool:
        stmt = select(StartupFollow).where(
            StartupFollow.follower_id == follower_id,
            StartupFollow.startup_id == startup_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def following_startup_ids(self, follower_id: UUID) -> list[UUID]:
        stmt = select(StartupFollow.startup_id).where(
            StartupFollow.follower_id == follower_id
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all()]

    async def follower_ids(self, startup_id: UUID) -> list[UUID]:
        stmt = select(StartupFollow.follower_id).where(
            StartupFollow.startup_id == startup_id
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all()]

    async def follower_count(self, startup_id: UUID) -> int:
        stmt = select(func.count()).select_from(StartupFollow).where(
            StartupFollow.startup_id == startup_id
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def total_count(self) -> int:
        stmt = select(func.count()).select_from(StartupFollow)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def all_edges(self) -> list[tuple[UUID, UUID]]:
        stmt = select(StartupFollow.follower_id, StartupFollow.startup_id)
        result = await self.session.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    async def bulk_insert(self, edges: list[tuple[UUID, UUID]]) -> int:
        if not edges:
            return 0
        stmt = (
            sqlite_insert(StartupFollow)
            .values([{"follower_id": a, "startup_id": b} for (a, b) in edges])
            .on_conflict_do_nothing(index_elements=["follower_id", "startup_id"])
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount or 0
