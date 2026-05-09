"""DAOs for the auto-match weekly digest tables.

Two DAOs share this file because their access patterns are tightly
coupled: the cron loop wants `due subscriptions` and `already-sent pairs
for one subscriber` in the same transaction.
"""

from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.base import BaseDAO
from app.model.database.auto_match import AutoMatchSent, AutoMatchSubscription

SubjectKind = Literal["talent", "startup"]
TargetKind = Literal["talent", "startup"]


class AutoMatchSubscriptionDAO(BaseDAO[AutoMatchSubscription]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, AutoMatchSubscription)

    async def get_by_subject(
        self, subject_kind: SubjectKind, subject_id: UUID
    ) -> AutoMatchSubscription | None:
        stmt = select(AutoMatchSubscription).where(
            AutoMatchSubscription.subject_kind == subject_kind,
            AutoMatchSubscription.subject_id == subject_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_active(self) -> list[AutoMatchSubscription]:
        stmt = select(AutoMatchSubscription).where(AutoMatchSubscription.active.is_(True))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_due(self, now: datetime | None = None) -> list[AutoMatchSubscription]:
        """Active subscriptions whose `last_run_at` is null or older than
        `frequency_days`. Computed in Python rather than SQL because the
        cutoff is per-row (different `frequency_days` per subscription).
        """
        now = now or datetime.now(UTC)
        active = await self.list_active()
        due: list[AutoMatchSubscription] = []
        for sub in active:
            if sub.last_run_at is None:
                due.append(sub)
                continue
            cutoff = sub.last_run_at + timedelta(days=sub.frequency_days)
            if cutoff <= now:
                due.append(sub)
        return due

    async def upsert(
        self,
        *,
        subject_kind: SubjectKind,
        subject_id: UUID,
        frequency_days: int,
        email_subject_override: str | None,
        email_body_html_override: str | None,
    ) -> AutoMatchSubscription:
        existing = await self.get_by_subject(subject_kind, subject_id)
        if existing is not None:
            existing.active = True
            existing.frequency_days = frequency_days
            existing.email_subject_override = email_subject_override
            existing.email_body_html_override = email_body_html_override
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        sub = AutoMatchSubscription(
            subject_kind=subject_kind,
            subject_id=subject_id,
            active=True,
            frequency_days=frequency_days,
            email_subject_override=email_subject_override,
            email_body_html_override=email_body_html_override,
        )
        self.session.add(sub)
        await self.session.commit()
        await self.session.refresh(sub)
        return sub

    async def deactivate(
        self, subject_kind: SubjectKind, subject_id: UUID
    ) -> bool:
        """Soft-disable. Keeps the row so re-subscribing preserves history.
        Returns True if a row was changed."""
        sub = await self.get_by_subject(subject_kind, subject_id)
        if sub is None or not sub.active:
            return False
        sub.active = False
        await self.session.commit()
        return True

    async def mark_run(self, sub_id: UUID, when: datetime | None = None) -> None:
        when = when or datetime.now(UTC)
        sub = await self.get(sub_id)
        if sub is None:
            return
        sub.last_run_at = when
        await self.session.commit()


class AutoMatchSentDAO(BaseDAO[AutoMatchSent]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, AutoMatchSent)

    async def already_sent_target_ids(
        self,
        *,
        subject_kind: SubjectKind,
        subject_id: UUID,
        target_kind: TargetKind,
    ) -> set[UUID]:
        """Set of `target_id`s the subscriber has already been emailed for
        the given target kind. Used to filter the matcher's candidate pool."""
        stmt = select(AutoMatchSent.target_id).where(
            AutoMatchSent.subject_kind == subject_kind,
            AutoMatchSent.subject_id == subject_id,
            AutoMatchSent.target_kind == target_kind,
        )
        result = await self.session.execute(stmt)
        return {row[0] for row in result.all()}

    async def record(
        self,
        *,
        subject_kind: SubjectKind,
        subject_id: UUID,
        target_kind: TargetKind,
        target_id: UUID,
    ) -> AutoMatchSent:
        """Insert a sent-pair row. Caller commits. The unique constraint on
        the four-tuple prevents duplicates if two cron runs race."""
        row = AutoMatchSent(
            subject_kind=subject_kind,
            subject_id=subject_id,
            target_kind=target_kind,
            target_id=target_id,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def exists_pair(
        self,
        *,
        subject_kind: SubjectKind,
        subject_id: UUID,
        target_kind: TargetKind,
        target_id: UUID,
    ) -> bool:
        stmt = select(AutoMatchSent.id).where(
            and_(
                AutoMatchSent.subject_kind == subject_kind,
                AutoMatchSent.subject_id == subject_id,
                or_(
                    and_(
                        AutoMatchSent.target_kind == target_kind,
                        AutoMatchSent.target_id == target_id,
                    ),
                ),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None
