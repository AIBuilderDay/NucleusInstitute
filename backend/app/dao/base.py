"""Generic base DAO with standard CRUD.

Mirrors the HEAL FastAPI template's `app/dao/base.py`. Concrete DAOs subclass
`BaseDAO[ModelType]` and add domain-specific queries.
"""

from abc import ABC
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase


class BaseDAO[ModelType: DeclarativeBase](ABC):
    """Generic CRUD base for SQLAlchemy models keyed by UUID id.

    DAOs ONLY do database work. Business logic belongs in Services.
    """

    def __init__(self, session: AsyncSession, model: type[ModelType]):
        self.session = session
        self.model = model

    async def get(self, id: UUID) -> ModelType | None:
        stmt = select(self.model).where(self.model.id == id)  # type: ignore[attr-defined]
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, limit: int | None = None) -> list[ModelType]:
        stmt = select(self.model)
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self) -> int:
        stmt = select(func.count()).select_from(self.model)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def create(self, **kwargs: Any) -> ModelType:
        """Create + commit immediately. Returns the persisted instance."""
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def add(self, **kwargs: Any) -> ModelType:
        """Create + flush only. Caller controls commit (used for atomic multi-DAO writes)."""
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def update(self, id: UUID, **kwargs: Any) -> ModelType | None:
        instance = await self.get(id)
        if instance is None:
            return None
        for key, value in kwargs.items():
            setattr(instance, key, value)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def delete(self, id: UUID) -> bool:
        instance = await self.get(id)
        if instance is None:
            return False
        await self.session.delete(instance)
        await self.session.commit()
        return True
