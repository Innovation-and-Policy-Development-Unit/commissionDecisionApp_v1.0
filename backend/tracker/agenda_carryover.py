"""Carry-over list logic.

A submission that becomes commission-ready *after* a sitting's effective cutoff is
"late" for that sitting — it sits on the **carry-over list** and is automatically
routed to the next eligible sitting (continuous), with a reconcile pass when a
sitting closes so any on-time-but-unscheduled items also roll forward.

The Chairman may still admit a carry-over item into the agenda during endorsement
(see ``MeetingViewSet.admit_reserve``) — the only sanctioned cutoff override.
"""

from __future__ import annotations

from django.utils import timezone


def compute_scheduled_meeting(submission, exclude_meeting=None):
    """The sitting a commission-ready submission should be queued for.

    Picks the next upcoming sitting; if its effective cutoff has already passed,
    rolls to the sitting after it. ``exclude_meeting`` skips a just-closed sitting
    during reconcile.
    """
    from .models import Meeting, MeetingStatus

    now = timezone.now()
    qs = Meeting.objects.filter(
        status__in=(MeetingStatus.SCHEDULED, MeetingStatus.IN_PROGRESS),
        date__gte=now.date(),
    )
    if exclude_meeting is not None:
        qs = qs.exclude(pk=exclude_meeting.pk)
    nxt = qs.order_by("date").first()
    if not nxt:
        return None
    if now > nxt.effective_cutoff:
        later = (
            Meeting.objects.filter(status=MeetingStatus.SCHEDULED, date__gt=nxt.date)
            .order_by("date")
            .first()
        )
        return later or nxt
    return nxt


def is_carryover(submission, meeting):
    """True if a commission-ready submission is *late* for this sitting."""
    return bool(
        submission.received_at
        and submission.received_at > meeting.effective_cutoff
    )


def _meeting_brief(meeting):
    if not meeting:
        return None
    return {
        "id": meeting.id,
        "ref": meeting.reference_number,
        "title": meeting.title,
        "date": meeting.date.isoformat(),
        "due_date": meeting.effective_cutoff.isoformat(),
    }


def carryover_status(submission):
    """Late/queued status for a commission-bound submission — used to tell HR and
    unit managers, in plain terms, that a submission missed a sitting's due date
    and where it is queued.

    Returns ``None`` when there is no upcoming sitting or no receipt timestamp.
    Otherwise a small dict: whether it is late for the nearest sitting, whether it
    has been carried to a later one, and briefs (ref/date/due_date) for both.
    """
    from .models import Meeting, MeetingStatus

    now = timezone.now()
    # Before PSC receipt, received_at is null — fall back to "now" so the late
    # signal is available at submit time too.
    ref_time = submission.received_at or now
    nearest = (
        Meeting.objects.filter(
            status__in=(MeetingStatus.SCHEDULED, MeetingStatus.IN_PROGRESS),
            date__gte=now.date(),
        )
        .order_by("date")
        .first()
    )
    if not nearest:
        return None
    target = compute_scheduled_meeting(submission)
    is_late = ref_time > nearest.effective_cutoff
    carried_over = bool(target and target.id != nearest.id)
    return {
        "is_late": is_late,
        "carried_over": carried_over,
        "nearest_meeting": _meeting_brief(nearest),
        "target_meeting": _meeting_brief(target),
    }


def reconcile_carryover(meeting):
    """Roll any commission-ready submissions left on a closed sitting (not placed
    on its agenda) forward to the next eligible sitting. Idempotent."""
    from .models import Submission, WorkflowStage

    leftover = (
        Submission.objects.filter(
            scheduled_meeting=meeting,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        )
        .exclude(agenda_placements__meeting=meeting)
    )
    moved = 0
    for sub in leftover:
        target = compute_scheduled_meeting(sub, exclude_meeting=meeting)
        if target and target.id != meeting.id:
            Submission.objects.filter(pk=sub.pk).update(scheduled_meeting=target)
            moved += 1
    return moved
