"""APScheduler tick — checks every AUTOPILOT_TICK_MINUTES whether the saved
cadence has elapsed, and if so fires the agent."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from . import store
from .agent import run_agent
from .bootstrap import ensure_heal_startup
from .config import settings
from .nucleus_client import NucleusClient

logger = logging.getLogger("autopilot.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _tick() -> None:
    """Fired every AUTOPILOT_TICK_MINUTES. Decides whether to run the agent."""
    cfg = await store.load_config()
    if not cfg["schedule_enabled"]:
        return

    last = cfg.get("last_run_at")
    cadence_h = max(1, int(cfg.get("cadence_hours", 24)))
    if last:
        last_dt = datetime.fromisoformat(last)
        if datetime.utcnow() - last_dt < timedelta(hours=cadence_h):
            return

    logger.info(
        f"Scheduled tick firing — cadence {cadence_h}h elapsed since {last or 'never'}"
    )
    await execute_run(trigger="scheduled")


async def execute_run(trigger: str) -> dict:
    """One agent run. Used by /run-now and the scheduler tick."""
    run_id = await store.start_run(trigger=trigger)

    nucleus = NucleusClient()
    try:
        heal_id = await ensure_heal_startup(nucleus)
        cfg = await store.load_config()
        result = await run_agent(
            heal_startup_id=heal_id,
            candidate_criteria=cfg["candidate_criteria"],
            email_instructions=cfg["email_instructions"],
            structured_filters=cfg["structured_filters"],
            nucleus=nucleus,
        )
        status = "error" if result.error else "ok"
        notes = list(result.notes)
        if result.final_text:
            notes.append(f"agent summary: {result.final_text[:1200]}")
        await store.finish_run(
            run_id,
            status=status,
            candidates_considered=result.candidates_considered,
            emails_sent=result.emails_sent,
            skipped=result.skipped,
            error=result.error,
            notes=notes,
        )
        await store.stamp_last_run()
        return {
            "run_id": run_id,
            "status": status,
            "candidates_considered": result.candidates_considered,
            "emails_sent": result.emails_sent,
            "skipped": result.skipped,
            "error": result.error,
            "notes": notes,
        }
    except Exception as exc:
        logger.exception("agent run crashed")
        await store.finish_run(run_id, status="error", error=str(exc))
        return {"run_id": run_id, "status": "error", "error": str(exc)}
    finally:
        await nucleus.aclose()


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    sched = AsyncIOScheduler()
    sched.add_job(
        _tick,
        trigger="interval",
        minutes=max(1, settings.autopilot_tick_minutes),
        id="autopilot_tick",
        coalesce=True,
        max_instances=1,
    )
    sched.start()
    logger.info(
        f"Scheduler started; tick every {settings.autopilot_tick_minutes} min "
        f"(cadence honoured per config.cadence_hours)"
    )
    _scheduler = sched
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
