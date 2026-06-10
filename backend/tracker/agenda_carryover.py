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
