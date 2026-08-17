"""
Daily workflow-integrity sweep — a set of named checks flagging submissions
in a state that shouldn't be reachable, surfaced on the "Integrity Flags"
admin page (Administration -> Integrity Flags) instead of only being
discovered when someone happens to notice, as PSC-2026-00054 was.

Each check returns (submission, detail) pairs. run_sweep() runs every
check, creates/updates an open IntegrityFlag per (submission, check_name),
and auto-resolves flags whose condition no longer holds — the table always
reflects what's currently wrong, not a growing history.

Deliberately rule-based, not AI: these are structural/logical checks a plain
query answers reliably; an LLM would be slower, costlier, and no more
trustworthy for "does this row violate an invariant".

The actual Celery task (run_integrity_sweep) lives in tasks.py, matching
every other scheduled task in this codebase — Celery's autodiscover_tasks()
only scans tasks.py per app, so a @shared_task defined here would only get
registered as a side effect of this module happening to be imported first;
keeping the convention avoids relying on that.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.db.models import Count, Max, Q
from django.utils import timezone

log = logging.getLogger("scdms.app")


def _check_orphaned_commission_sitting():
    """Reached Commission Sitting without ever being placed on a real
    meeting's agenda — the exact PSC-2026-00054 bug. Should be prevented
    going forward by the transition guard in views.py, but a direct DB edit
    or a future code change could still produce this state."""
    from .models import Submission, WorkflowStage

    qs = (
        Submission.objects.filter(current_stage=WorkflowStage.COMMISSION_SITTING)
        .annotate(agenda_count=Count("agenda_placements"))
        .filter(agenda_count=0)
    )
    return [
        (s, "Reached Commission Sitting with no AgendaItem placement on any meeting.")
        for s in qs
    ]


def _check_stale_after_meeting():
    """Submission is scheduled on a meeting whose date has already passed,
    but never reached a decision stage — it fell through the cracks between
    the sitting happening and someone recording the outcome."""
    from .models import Submission, WorkflowStage

    cutoff = timezone.now().date() - timedelta(days=2)
    qs = (
        Submission.objects.filter(
            current_stage__in=[WorkflowStage.FORWARDED_TO_COMMISSION, WorkflowStage.COMMISSION_SITTING],
            agenda_placements__meeting__date__lt=cutoff,
        )
        .distinct()
    )
    results = []
    for s in qs:
        latest = s.agenda_placements.select_related("meeting").order_by("-meeting__date").first()
        if not latest:
            continue
        results.append((
            s,
            f"Scheduled on {latest.meeting.reference_number} ({latest.meeting.date}), "
            f"which has passed, but still at '{s.get_current_stage_display()}' with no decision recorded.",
        ))
    return results


# stage -> days with no activity before it's considered stale
_STALE_STAGE_DAYS = {
    "manager_checklist_review": 21,
    "under_assessment": 30,
    "pending_secretary_approval": 14,
}


def _check_stale_stage():
    """Sitting in an active-work stage far longer than expected with no
    recent WorkflowEvent — likely abandoned/forgotten rather than genuinely
    still being worked.

    Deliberately keyed off WorkflowEvent.created_at, not Submission.updated_at
    — background AI tasks (brief regeneration, quality scoring, etc.) touch
    updated_at on every run regardless of real workflow activity, which would
    otherwise mask a submission that's genuinely stuck."""
    from .models import Submission

    results = []
    for stage, days in _STALE_STAGE_DAYS.items():
        cutoff = timezone.now() - timedelta(days=days)
        qs = (
            Submission.objects.filter(current_stage=stage)
            .annotate(last_event_at=Max("events__created_at"))
            .filter(Q(last_event_at__lt=cutoff) | Q(last_event_at__isnull=True))
        )
        for s in qs:
            results.append((
                s,
                f"At '{s.get_current_stage_display()}' for over {days} days with no recent activity.",
            ))
    return results


CHECKS = {
    "orphaned_commission_sitting": _check_orphaned_commission_sitting,
    "stale_after_meeting": _check_stale_after_meeting,
    "stale_stage": _check_stale_stage,
}


PERIODIC_NAME = "workflow-integrity-sweep"
TASK_NAME = "tracker.tasks.run_integrity_sweep"
# Once daily, 03:00 — quiet hours, well clear of business-hours load.
CRON = "0 3 * * *"


def sync_integrity_sweep_scheduler():
    """Ensure Celery Beat has the daily integrity-sweep task."""
    try:
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        minute, hour, day, month, dow = CRON.split()
        cron, _ = CrontabSchedule.objects.get_or_create(
            minute=minute, hour=hour,
            day_of_month=day, month_of_year=month,
            day_of_week=dow, timezone="Pacific/Efate",
        )
        PeriodicTask.objects.update_or_create(
            name=PERIODIC_NAME,
            defaults={"crontab": cron, "task": TASK_NAME, "enabled": True},
        )
        log.info("Workflow-integrity sweep schedule synced to Celery beat")
    except Exception as exc:  # noqa: BLE001
        log.error("Failed to sync workflow-integrity sweep schedule: %s", exc)


def run_sweep():
    """Run every check, upsert open flags, auto-resolve ones no longer found."""
    from .models import IntegrityFlag

    open_flags = {
        (f.submission_id, f.check_name): f
        for f in IntegrityFlag.objects.filter(resolved_at__isnull=True)
    }
    found_keys = set()

    for check_name, check_fn in CHECKS.items():
        try:
            results = check_fn()
        except Exception:
            log.exception("INTEGRITY_CHECK_FAIL | check=%s", check_name)
            continue
        for submission, detail in results:
            key = (submission.id, check_name)
            found_keys.add(key)
            existing = open_flags.get(key)
            if existing:
                if existing.detail != detail:
                    existing.detail = detail
                    existing.save(update_fields=["detail"])
            else:
                IntegrityFlag.objects.create(
                    submission=submission, check_name=check_name, detail=detail,
                )

    stale_keys = set(open_flags.keys()) - found_keys
    if stale_keys:
        resolved_ids = [open_flags[k].id for k in stale_keys]
        IntegrityFlag.objects.filter(id__in=resolved_ids).update(resolved_at=timezone.now())

    log.info(
        "INTEGRITY_SWEEP | open=%s newly_resolved=%s",
        len(found_keys), len(stale_keys),
    )
