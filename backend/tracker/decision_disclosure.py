"""No Commission decision reaches a ministry before its letter does.

The Commission's outcome is only official once the signed letter has been served on
the ministry, so until a DecisionService row exists the ministry side is told that the
matter is with the Commission and nothing more. Before this, the stage change itself
notified the submitting officer, emailed them the outcome, showed Approved or Rejected
on the paper, and published it on the applicant's tracking page — all of it ahead of
the letter, which is what OPSC staff objected to.

Serving the letter is what tells the ministry, and `served_notice_recipients` names who
hears about it.
"""

from __future__ import annotations

# Stages that are a Commission outcome. Deferral is one of these: a letter is prepared
# for a deferral too, so it waits for service like any other.
DECISION_STAGES = frozenset({
    "approved",
    "noted",
    "not_approved",
    "rejected",
    "returned",
    "deferred",
    "deferred_back_to_hr",
    "deferred_back_to_unit",
})

# What a ministry-side viewer sees instead of the outcome, and what the applicant's
# public tracking page shows once a decision exists but has not been served.
PENDING_LETTER_LABEL = "The Commission has deliberated"
PUBLIC_PENDING_LABEL = "Decision issued to your ministry"


def is_decision_stage(stage) -> bool:
    return (stage or "") in DECISION_STAGES


def current_service(submission):
    """The decision service in force for this submission, or None."""
    from .models import DecisionService

    return (
        DecisionService.objects
        .filter(submission=submission, superseded=False)
        .order_by("-served_at")
        .first()
    )


def decision_visible_to_ministry(submission) -> bool:
    """True once the ministry may be told the outcome.

    Either the paper is not at a decision stage at all (nothing to hide), or the letter
    has been served.
    """
    if not is_decision_stage(submission.current_stage):
        return True
    return current_service(submission) is not None


def hide_from(submission, user) -> bool:
    """True when this viewer must not see the outcome yet."""
    from .opsc_access import is_opsc_internal

    if user is None or getattr(user, "is_anonymous", True):
        return not decision_visible_to_ministry(submission)
    if is_opsc_internal(user):
        return False
    return not decision_visible_to_ministry(submission)


def redact_audit_trail(entries, submission, user):
    """Drop the decision from a ministry-side audit trail until the letter is served.

    The trail is a merged timeline of workflow events and audit entries, and it spells
    the outcome out twice — "Commission Sitting → Approved" and the remark the
    Commission left. Entries are removed rather than reworded: inventing a stage that
    never happened would be worse in a record meant to be evidence, and they reappear
    in full once the decision has been served.
    """
    if not hide_from(submission, user):
        return entries
    kept = []
    for entry in entries:
        if entry.get("entry_type") == "workflow" and is_decision_stage(entry.get("new_stage")):
            continue
        if entry.get("entry_type") == "audit" and entry.get("action") == "DECISION":
            continue
        kept.append(entry)
    return kept


def served_notice_recipients(submission):
    """Who at the ministry is told that the letter has been served."""
    from django.contrib.auth.models import User

    from .models import Role

    qs = User.objects.filter(
        psc_profile__role__in=[Role.MINISTRY_HR, Role.DEPT_ADMIN],
        psc_profile__ministry_id=submission.ministry_id,
        is_active=True,
    )
    if submission.created_by_id:
        qs = qs | User.objects.filter(pk=submission.created_by_id, is_active=True)
    return qs.distinct()
