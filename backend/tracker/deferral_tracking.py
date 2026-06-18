"""Deferred-agenda tracking.

A single place to record an agenda item being deferred (so the Deferred Agenda
register stays accurate) and to resolve open deferrals when an item is finally
decided. Called from the transition flow, the pre-sitting push-to-next action,
and the in-sitting defer-to-next-meeting carry.
"""

from __future__ import annotations

from django.utils import timezone


def record_deferral(
    submission,
    *,
    deferral_type: str,
    deferred_by=None,
    from_meeting=None,
    to_meeting=None,
    agenda_item=None,
    reason: str = "",
):
    """Create an AgendaDeferral row. Best-effort: never raises into the caller."""
    from .models import AgendaDeferral

    try:
        return AgendaDeferral.objects.create(
            submission=submission,
            agenda_item=agenda_item,
            from_meeting=from_meeting,
            to_meeting=to_meeting,
            deferral_type=deferral_type,
            reason=reason or "",
            deferred_by=deferred_by,
        )
    except Exception:
        import logging

        logging.getLogger("scdms.app").exception(
            "DEFERRAL_RECORD_FAIL | submission=%s type=%s", getattr(submission, "id", None), deferral_type
        )
        return None


def resolve_open_deferrals(submission):
    """Mark all open deferrals for a submission resolved — called when the item
    reaches a concluding decision. Returns the number resolved."""
    from .models import AgendaDeferral

    return AgendaDeferral.objects.filter(submission=submission, resolved=False).update(
        resolved=True, resolved_at=timezone.now()
    )
