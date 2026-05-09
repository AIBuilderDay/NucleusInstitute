"""AutoMatchService — orchestrator for the weekly auto-match digest.

Responsibilities:
- Manage the subscription registry (subscribe / unsubscribe / list).
- For each due subscription:
    1. Run the configured matcher (default `rule_filter`, swappable per
       request via the existing MatchingProvider registry).
    2. Filter out targets already in `auto_match_sent`.
    3. Drop targets the subscriber swiped 'no' on (passed_*_ids).
    4. Bubble targets the subscriber swiped 'yes' on (liked_*_ids) to the
       top of the candidate list.
    5. Cap at `settings.auto_match_max_per_email` matches per digest.
    6. For each match, either use the subscription's verbatim overrides
       OR run AutoMatchEmailDrafter for a per-recipient agent draft.
    7. Send via Resend, write the sent-pair row, update last_run_at.

This service is the only place that mutates `auto_match_subscription`
or `auto_match_sent`. Routes call it; APScheduler calls it.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import resend
from fastapi import Depends, HTTPException, status

from app.core.config import settings
from app.dao.daos.auto_match_dao import SubjectKind, TargetKind
from app.dao.factory import DAOFactory
from app.model.database.auto_match import AutoMatchSubscription
from app.model.database.startup import Startup
from app.model.database.swipe_list import SwipeList
from app.model.database.talent import Talent
from app.model.schema.auto_match import (
    RunReport,
    SubscribeRequest,
    SubscriptionResponse,
)
from app.model.schema.match import MatchResult
from app.provider.auto_match.email_drafter import AutoMatchEmailDrafter
from app.service.matching_service import MatchingService

# One drafter instance shared across runs — Anthropic client lazy-inits.
_drafter = AutoMatchEmailDrafter()


class AutoMatchService:
    def __init__(self, dao_factory: DAOFactory = Depends(DAOFactory)):
        self.dao_factory = dao_factory
        self.sub_dao = dao_factory.get_auto_match_subscription_dao()
        self.sent_dao = dao_factory.get_auto_match_sent_dao()
        self.swipe_dao = dao_factory.get_swipe_list_dao()
        self.talent_dao = dao_factory.get_talent_dao()
        self.startup_dao = dao_factory.get_startup_dao()
        # Pass the DAOFactory explicitly — `Depends(DAOFactory)` is just the
        # FastAPI default and is overridden by an explicit kwarg.
        self.matching = MatchingService(dao_factory=dao_factory)

    # =========================================================================
    # Registry
    # =========================================================================
    async def subscribe(self, payload: SubscribeRequest) -> SubscriptionResponse:
        """Create or reactivate a subscription. Validates subject exists."""
        await self._validate_subject(payload.subject_kind, payload.subject_id)
        sub = await self.sub_dao.upsert(
            subject_kind=payload.subject_kind,
            subject_id=payload.subject_id,
            frequency_days=payload.frequency_days,
            email_subject_override=payload.email_subject_override,
            email_body_html_override=payload.email_body_html_override,
        )
        return _to_response(sub)

    async def unsubscribe(
        self, subject_kind: SubjectKind, subject_id: UUID
    ) -> bool:
        return await self.sub_dao.deactivate(subject_kind, subject_id)

    async def list_subscriptions(self) -> list[SubscriptionResponse]:
        rows = await self.sub_dao.list_all()
        return [_to_response(r) for r in rows]

    async def get_one(
        self, subject_kind: SubjectKind, subject_id: UUID
    ) -> SubscriptionResponse | None:
        sub = await self.sub_dao.get_by_subject(subject_kind, subject_id)
        return _to_response(sub) if sub is not None else None

    # =========================================================================
    # Cron loop
    # =========================================================================
    async def run_due(self) -> list[RunReport]:
        """Run the digest for every active+due subscription. Errors per
        subscription are captured in the report so one bad row doesn't
        abort the whole tick."""
        due = await self.sub_dao.list_due()
        reports: list[RunReport] = []
        for sub in due:
            try:
                report = await self.run_for_subscription(sub)
            except Exception as exc:  # noqa: BLE001
                settings.logger.warning(
                    f"auto-match run failed for {sub.subject_kind}:{sub.subject_id}: {exc}"
                )
                report = RunReport(
                    subscription_id=sub.id,
                    subject_kind=sub.subject_kind,  # type: ignore[arg-type]
                    subject_id=sub.subject_id,
                    matches_considered=0,
                    emails_sent=0,
                    skipped=0,
                    used_override=bool(sub.email_subject_override),
                    notes=[f"error: {exc}"],
                )
            reports.append(report)
        return reports

    async def run_for_subject(
        self, subject_kind: SubjectKind, subject_id: UUID
    ) -> RunReport:
        """Manual-trigger path: run the digest for one subscriber regardless
        of `last_run_at`. Used by POST /auto-match/run-now/{kind}/{id}."""
        sub = await self.sub_dao.get_by_subject(subject_kind, subject_id)
        if sub is None or not sub.active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active auto-match subscription for {subject_kind}:{subject_id}",
            )
        return await self.run_for_subscription(sub)

    async def run_for_subscription(self, sub: AutoMatchSubscription) -> RunReport:
        """Generate + send the digest for one subscription. Updates
        last_run_at on success even if zero emails go out — the
        subscriber stays "fresh" so we don't re-loop them next tick."""
        notes: list[str] = []
        target_kind: TargetKind = (
            "startup" if sub.subject_kind == "talent" else "talent"
        )
        used_override = bool(sub.email_subject_override and sub.email_body_html_override)

        # 1. Pull a wide candidate pool. Headroom matters because we're about
        #    to filter and re-sort.
        try:
            sender, matches = await self._fetch_matches(
                sub.subject_kind,  # type: ignore[arg-type]
                sub.subject_id,
                pool_size=settings.auto_match_candidate_pool,
            )
        except HTTPException as exc:
            await self.sub_dao.mark_run(sub.id)
            return RunReport(
                subscription_id=sub.id,
                subject_kind=sub.subject_kind,  # type: ignore[arg-type]
                subject_id=sub.subject_id,
                matches_considered=0,
                emails_sent=0,
                skipped=0,
                used_override=used_override,
                notes=[f"matcher error: {exc.detail}"],
            )

        considered = len(matches)

        # 2. Apply exclusion sets (already-sent + already-passed-on swipes).
        already_sent_ids = await self.sent_dao.already_sent_target_ids(
            subject_kind=sub.subject_kind,  # type: ignore[arg-type]
            subject_id=sub.subject_id,
            target_kind=target_kind,
        )
        swipes = await self.swipe_dao.get(sub.subject_id, sub.subject_kind)  # type: ignore[arg-type]
        passed_ids, liked_ids = _swipe_id_sets(swipes, target_kind)

        eligible: list[tuple[MatchResult, UUID, bool]] = []
        for m in matches:
            target_id = m.startup_id if target_kind == "startup" else m.talent_id
            if target_id in already_sent_ids or target_id in passed_ids:
                continue
            eligible.append((m, target_id, target_id in liked_ids))

        # 3. Sort: liked-first by score, then unswiped by score.
        eligible.sort(key=lambda row: (row[2], row[0].score), reverse=True)

        # 4. Cap at the global per-email max (5 by default).
        cap = settings.auto_match_max_per_email
        chosen = eligible[:cap]

        emails_sent = 0
        skipped = considered - len(chosen)

        # 5. Render + send each one.
        for match, target_id, _was_liked in chosen:
            target = await self._load_entity(target_kind, target_id)
            if target is None:
                notes.append(f"target {target_kind}:{target_id} vanished")
                continue
            recipient_name = _entity_name(target)
            sender_name = _entity_name(sender)
            sender_email = _entity_email(sender)
            if not sender_email:
                notes.append(f"subscriber {sub.subject_kind}:{sub.subject_id} has no email — abort run")
                await self.sub_dao.mark_run(sub.id)
                return RunReport(
                    subscription_id=sub.id,
                    subject_kind=sub.subject_kind,  # type: ignore[arg-type]
                    subject_id=sub.subject_id,
                    matches_considered=considered,
                    emails_sent=emails_sent,
                    skipped=skipped,
                    used_override=used_override,
                    notes=notes,
                )

            if used_override:
                subject_line = sub.email_subject_override or ""
                body_html = sub.email_body_html_override or ""
            else:
                drafted = await _drafter.draft(
                    daos=self.dao_factory,
                    sender_kind=sub.subject_kind,  # type: ignore[arg-type]
                    sender_id=sub.subject_id,
                    sender_name=sender_name,
                    recipient_kind=target_kind,
                    recipient_id=target_id,
                    recipient_name=recipient_name,
                    match=match,
                )
                subject_line = drafted.subject
                body_html = drafted.body_html
                if drafted.fallback_used:
                    notes.append(f"drafter fell back for {target_kind}:{target_id}")

            sent_ok, send_note = await self._send_via_resend(
                to=sender_email,
                subject=subject_line,
                body_html=body_html,
            )
            if send_note:
                notes.append(send_note)
            if not sent_ok:
                continue

            # Record the sent-pair AFTER a successful send so a Resend
            # outage doesn't permanently exclude the candidate.
            await self.sent_dao.record(
                subject_kind=sub.subject_kind,  # type: ignore[arg-type]
                subject_id=sub.subject_id,
                target_kind=target_kind,
                target_id=target_id,
            )
            await self.dao_factory.commit()
            emails_sent += 1

        await self.sub_dao.mark_run(sub.id)

        return RunReport(
            subscription_id=sub.id,
            subject_kind=sub.subject_kind,  # type: ignore[arg-type]
            subject_id=sub.subject_id,
            matches_considered=considered,
            emails_sent=emails_sent,
            skipped=skipped,
            used_override=used_override,
            notes=notes,
        )

    # =========================================================================
    # Internals
    # =========================================================================
    async def _validate_subject(
        self, subject_kind: SubjectKind, subject_id: UUID
    ) -> None:
        entity = await self._load_entity(subject_kind, subject_id)
        if entity is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{subject_kind} {subject_id} not found",
            )

    async def _load_entity(
        self, kind: SubjectKind | TargetKind, eid: UUID
    ) -> Talent | Startup | None:
        if kind == "talent":
            return await self.talent_dao.get(eid)
        return await self.startup_dao.get(eid)

    async def _fetch_matches(
        self,
        subject_kind: SubjectKind,
        subject_id: UUID,
        *,
        pool_size: int,
    ) -> tuple[Talent | Startup, list[MatchResult]]:
        """Reuse MatchingService — same matcher registry the REST endpoints
        and frontend already use, controlled by `default_matcher`."""
        if subject_kind == "talent":
            talent, _name, matches = await self.matching.match_talent_to_startups(
                subject_id, top_k=pool_size
            )
            return talent, matches
        startup, _name, matches = await self.matching.match_startup_to_talent(
            subject_id, top_k=pool_size
        )
        return startup, matches

    async def _send_via_resend(
        self, *, to: str, subject: str, body_html: str
    ) -> tuple[bool, str | None]:
        """Send through Resend. Logs and skips the row when the API key is
        missing — useful for dry-run / dev so the rest of the loop still runs."""
        if not settings.resend_api_key:
            settings.logger.info(
                f"[auto-match dry-run] would send to={to} subject={subject!r}"
            )
            return False, "resend_api_key not configured (dry-run)"
        resend.api_key = settings.resend_api_key
        params: dict[str, Any] = {
            "from": settings.email_from_address,
            "to": [to],
            "subject": subject,
            "html": body_html,
        }
        if settings.email_reply_to_default:
            params["reply_to"] = settings.email_reply_to_default
        try:
            resend.Emails.send(params)
            return True, None
        except Exception as exc:  # noqa: BLE001
            settings.logger.warning(f"Resend send failed in auto-match: {exc}")
            return False, f"resend error: {exc}"


# =============================================================================
# Helpers
# =============================================================================
def _to_response(sub: AutoMatchSubscription) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=sub.id,
        subject_kind=sub.subject_kind,  # type: ignore[arg-type]
        subject_id=sub.subject_id,
        active=sub.active,
        frequency_days=sub.frequency_days,
        last_run_at=sub.last_run_at,
        has_email_override=bool(
            sub.email_subject_override and sub.email_body_html_override
        ),
        created_at=sub.created_at,
        updated_at=sub.updated_at,
    )


def _swipe_id_sets(
    swipes: SwipeList | None, target_kind: TargetKind
) -> tuple[set[UUID], set[UUID]]:
    """Return (passed_ids, liked_ids) for the relevant target kind, parsed
    from the JSON arrays on the swipe row. Empty sets if no swipe row."""
    if swipes is None:
        return set(), set()
    if target_kind == "startup":
        passed_raw = swipes.passed_startup_ids or []
        liked_raw = swipes.liked_startup_ids or []
    else:
        passed_raw = swipes.passed_talent_ids or []
        liked_raw = swipes.liked_talent_ids or []
    return _coerce_uuid_set(passed_raw), _coerce_uuid_set(liked_raw)


def _coerce_uuid_set(raw: list) -> set[UUID]:
    out: set[UUID] = set()
    for x in raw:
        if isinstance(x, UUID):
            out.add(x)
            continue
        try:
            out.add(UUID(str(x)))
        except (ValueError, AttributeError):
            continue
    return out


def _entity_name(entity: Talent | Startup) -> str:
    return entity.name


def _entity_email(entity: Talent | Startup) -> str | None:
    """The subscriber's email is on talent.email; startups don't have one
    on the model, so the auto-match digest only goes to talent subscribers
    OR to a contact email pulled from the startup row if added later."""
    return getattr(entity, "email", None)


# =============================================================================
# Background tick — entry point for APScheduler / any non-request caller
# =============================================================================
async def run_auto_match_tick() -> list[RunReport]:
    """Open a fresh session and run the digest for due subscriptions.

    This is the single entry point for non-request callers (APScheduler,
    one-off scripts). main.py imports only this function so the lifespan
    layer never sees DAOFactory.
    """
    # Local import keeps the connection module out of the wider import graph
    # of any caller that imports just AutoMatchService.
    from app.database.connection import session_factory

    async with session_factory() as session:
        daos = DAOFactory(session=session)
        service = AutoMatchService(dao_factory=daos)
        return await service.run_due()
