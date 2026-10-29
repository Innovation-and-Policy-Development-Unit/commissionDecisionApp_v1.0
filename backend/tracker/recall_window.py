"""24-hour recall window for ministry submissions.

When ministry HR (or a department admin) submits a paper to PSC it stays at
"Submitted" for SUBMISSION_RECALL_WINDOW_HOURS: the ministry can recall it, or
send it on straight away ("Send now"). OPSC units are not told about it, and it
is not routed to a unit, until the window closes. A periodic task then routes
anything still waiting, exactly as the system does for an immediate submission.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

log = logging.getLogger("scdms.app")

TASK_NAME = "tracker.tasks.release_recall_window_submissions"
PERIODIC_NAME = "release-recall-window-submissions"
CRON = "*/5 * * * *"


# The training ministry (seed_opsc_training) lodges papers live during the OPSC staff
# training, so its papers go straight to the unit instead of waiting a day.
PRACTICE_MINISTRY_CODES = frozenset({"PRAC"})


def window_hours() -> int:
    return max(0, int(getattr(settings, "SUBMISSION_RECALL_WINDOW_HOURS", 24)))


def is_practice(submission) -> bool:
    return submission.ministry.code in PRACTICE_MINISTRY_CODES


def window_applies(submission, actor) -> bool:
    """True when this ministry-lodged submission should wait out the recall window."""
    from .models import Role

    if window_hours() <= 0 or is_practice(submission):
        return False
    role = getattr(getattr(actor, "psc_profile", None), "role", None)
    return (
        role in {Role.MINISTRY_HR, Role.DEPT_ADMIN}
        and not submission.is_internal
        and not submission.secretary_only
        and not submission.lodged_from_paper
    )


def submitted_at(submission):
    """When the ministry last pressed Submit (latest event into Submitted)."""
    from .models import WorkflowEvent, WorkflowStage

    event = (
        WorkflowEvent.objects.filter(submission=submission, new_stage=WorkflowStage.SUBMITTED)
        .order_by("-created_at").first()
    )
    return event.created_at if event else None


def window_end(submission, started):
    """When the recall window closes for a paper submitted at `started`: 24 hours later, or
    the due date of the sitting it is queued for if that comes first. The sitting's due
    date is the ministry's own deadline, so a paper submitted near it reaches OPSC no
    later than one submitted exactly on time would have."""
    end = started + timedelta(hours=window_hours())
    meeting = getattr(submission, "scheduled_meeting", None)
    if meeting is not None:
        end = min(end, meeting.effective_cutoff)
    return end


def holds_now(submission, actor) -> bool:
    """Whether a paper being submitted right now should wait out a recall window at all."""
    if not window_applies(submission, actor):
        return False
    now = timezone.now()
    return window_end(submission, now) > now + timedelta(minutes=1)


def recall_deadline(submission):
    """End of the recall window, or None when the paper is no longer waiting in it."""
    from .models import WorkflowStage

    if submission.current_stage != WorkflowStage.SUBMITTED or window_hours() <= 0:
        return None
    if submission.is_internal or submission.secretary_only or submission.lodged_from_paper:
        return None
    if is_practice(submission):
        return None
    started = submitted_at(submission)
    return window_end(submission, started) if started else None


def release(submission, actor=None) -> bool:
    """Route a waiting submission to its OPSC unit now and tell the unit.
    Returns True if it moved."""
    from . import views
    from .models import WorkflowStage

    if submission.current_stage != WorkflowStage.SUBMITTED:
        return False
    views.SubmissionViewSet()._auto_advance_submitted_to_checklist_review(submission)
    submission.refresh_from_db()
    if submission.current_stage == WorkflowStage.SUBMITTED:
        return False
    # The "new submission, needs your checklist review" notice normally goes out when
    # the ministry submits; it was held back for the recall window, so send it now.
    views._dispatch_transition_notifications(
        submission, WorkflowStage.DRAFT, WorkflowStage.SUBMITTED, actor, "", receipts=False,
    )
    log.info("RECALL_WINDOW_RELEASED | %s", submission.reference_number)
    return True


def release_due_submissions() -> int:
    """Release every ministry submission whose recall window has closed."""
    from .models import Submission, WorkflowStage

    now = timezone.now()
    moved = 0
    for submission in Submission.objects.filter(
        current_stage=WorkflowStage.SUBMITTED, is_internal=False, secretary_only=False,
    ).select_related("scheduled_meeting"):
        started = submitted_at(submission)
        if started and window_end(submission, started) <= now and release(submission):
            moved += 1
    return moved


def sync_recall_window_scheduler():
    """Ensure Celery Beat runs the release task."""
    try:
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        minute, hour, day, month, dow = CRON.split()
        cron, _ = CrontabSchedule.objects.get_or_create(
            minute=minute, hour=hour, day_of_month=day, month_of_year=month,
            day_of_week=dow, timezone="Pacific/Efate",
        )
        PeriodicTask.objects.update_or_create(
            name=PERIODIC_NAME, defaults={"crontab": cron, "task": TASK_NAME, "enabled": True},
        )
    except Exception as exc:  # noqa: BLE001
        log.error("Failed to sync recall-window schedule to Celery beat: %s", exc)
