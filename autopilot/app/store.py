"""Thin async DAOs over autopilot.db — config, run log, contact dedup."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select

from .db import AgentConfig, ContactedTalent, RunLog, session_factory

# =============================================================================
# Agent config (singleton)
# =============================================================================
async def load_config() -> dict:
    async with session_factory() as session:
        row = (await session.execute(select(AgentConfig).limit(1))).scalar_one_or_none()
        if row is None:
            row = AgentConfig(singleton_key="ONLY")
            session.add(row)
            await session.commit()
            await session.refresh(row)
        return _config_to_dict(row)


async def save_config(
    *,
    candidate_criteria: str,
    email_instructions: str,
    structured_filters: dict[str, Any],
    schedule_enabled: bool,
    cadence_hours: int,
) -> dict:
    async with session_factory() as session:
        row = (await session.execute(select(AgentConfig).limit(1))).scalar_one_or_none()
        if row is None:
            row = AgentConfig(singleton_key="ONLY")
            session.add(row)
        row.candidate_criteria = candidate_criteria
        row.email_instructions = email_instructions
        row.structured_filters = structured_filters
        row.schedule_enabled = schedule_enabled
        row.cadence_hours = max(1, cadence_hours)
        row.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(row)
        return _config_to_dict(row)


async def stamp_last_run() -> None:
    async with session_factory() as session:
        row = (await session.execute(select(AgentConfig).limit(1))).scalar_one_or_none()
        if row is None:
            return
        row.last_run_at = datetime.utcnow()
        await session.commit()


def _config_to_dict(row: AgentConfig) -> dict:
    return {
        "candidate_criteria": row.candidate_criteria or "",
        "email_instructions": row.email_instructions or "",
        "structured_filters": dict(row.structured_filters or {}),
        "schedule_enabled": bool(row.schedule_enabled),
        "cadence_hours": int(row.cadence_hours),
        "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


# =============================================================================
# Run log
# =============================================================================
async def start_run(trigger: str) -> int:
    async with session_factory() as session:
        run = RunLog(trigger=trigger, status="running")
        session.add(run)
        await session.commit()
        await session.refresh(run)
        return run.id


async def finish_run(
    run_id: int,
    *,
    status: str,
    candidates_considered: int = 0,
    emails_sent: int = 0,
    skipped: int = 0,
    error: str | None = None,
    notes: list[str] | None = None,
) -> None:
    async with session_factory() as session:
        row = await session.get(RunLog, run_id)
        if row is None:
            return
        row.finished_at = datetime.utcnow()
        row.status = status
        row.candidates_considered = candidates_considered
        row.emails_sent = emails_sent
        row.skipped = skipped
        row.error = error
        row.notes = list(notes or [])
        await session.commit()


async def list_runs(limit: int = 25) -> list[dict]:
    async with session_factory() as session:
        rows = (
            await session.execute(
                select(RunLog).order_by(RunLog.started_at.desc()).limit(limit)
            )
        ).scalars().all()
        return [_run_to_dict(r) for r in rows]


def _run_to_dict(r: RunLog) -> dict:
    return {
        "id": r.id,
        "started_at": r.started_at.isoformat(),
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        "trigger": r.trigger,
        "status": r.status,
        "candidates_considered": r.candidates_considered,
        "emails_sent": r.emails_sent,
        "skipped": r.skipped,
        "error": r.error,
        "notes": list(r.notes or []),
    }


# =============================================================================
# Contact dedup
# =============================================================================
async def is_contacted(talent_id: str) -> bool:
    async with session_factory() as session:
        row = (
            await session.execute(
                select(ContactedTalent).where(ContactedTalent.talent_id == talent_id)
            )
        ).scalar_one_or_none()
        return row is not None


async def list_contacted_ids() -> set[str]:
    async with session_factory() as session:
        rows = (
            await session.execute(select(ContactedTalent.talent_id))
        ).scalars().all()
        return set(rows)


async def record_contact(
    *,
    talent_id: str,
    name: str,
    email: str | None,
    status: str,
    subject: str | None,
    resend_id: str | None,
) -> None:
    async with session_factory() as session:
        existing = (
            await session.execute(
                select(ContactedTalent).where(ContactedTalent.talent_id == talent_id)
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.status = status
            existing.subject = subject
            existing.resend_id = resend_id
            existing.contacted_at = datetime.utcnow()
        else:
            session.add(
                ContactedTalent(
                    talent_id=talent_id,
                    name=name,
                    email=email,
                    status=status,
                    subject=subject,
                    resend_id=resend_id,
                )
            )
        await session.commit()
