"""ProfileEmbeddingDAO — read/upsert/batch-fetch sentence-transformer vectors.

Used by EmbeddingMatcher to avoid re-encoding profiles on every cold start.
The DAO returns a (signature, vector_bytes) pair so the matcher can decide
whether the cached row is still valid for the freshly-constructed text.
"""

from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.base import BaseDAO
from app.model.database.profile_embedding import ProfileEmbedding

EntityType = Literal["talent", "startup"]


class ProfileEmbeddingDAO(BaseDAO[ProfileEmbedding]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, ProfileEmbedding)

    async def get_many(
        self, entity_type: EntityType, entity_ids: list[UUID], model_name: str
    ) -> dict[UUID, ProfileEmbedding]:
        """Batch fetch — one query for the whole candidate pool."""
        if not entity_ids:
            return {}
        stmt = select(ProfileEmbedding).where(
            ProfileEmbedding.entity_type == entity_type,
            ProfileEmbedding.model_name == model_name,
            ProfileEmbedding.entity_id.in_(entity_ids),
        )
        result = await self.session.execute(stmt)
        return {row.entity_id: row for row in result.scalars().all()}

    async def upsert(
        self,
        entity_type: EntityType,
        entity_id: UUID,
        model_name: str,
        source_signature: str,
        vector: bytes,
        dim: int,
    ) -> ProfileEmbedding:
        """Insert or update the row for (entity_type, entity_id, model_name)."""
        stmt = select(ProfileEmbedding).where(
            ProfileEmbedding.entity_type == entity_type,
            ProfileEmbedding.entity_id == entity_id,
            ProfileEmbedding.model_name == model_name,
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing is None:
            instance = ProfileEmbedding(
                entity_type=entity_type,
                entity_id=entity_id,
                model_name=model_name,
                source_signature=source_signature,
                vector=vector,
                dim=dim,
            )
            self.session.add(instance)
            await self.session.commit()
            await self.session.refresh(instance)
            return instance
        existing.source_signature = source_signature
        existing.vector = vector
        existing.dim = dim
        await self.session.commit()
        await self.session.refresh(existing)
        return existing
