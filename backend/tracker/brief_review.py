"""The responsible unit signs off the AI brief before the paper leaves the unit.

The Commission reads the same brief the Secretariat does, so a brief nobody in the
unit has read must not travel with the paper. The officer the Manager allocated the
paper to (and any co-analyst) is the reviewer; the unit Manager and Admin may also
confirm it. The reviewer can correct the text — the corrected text is what everyone
downstream reads — and confirming records who, when, and whether it was edited.

Nothing is demanded when there is no brief to review because generation failed, AI is
switched off, or it never ran: the gate would otherwise strand papers behind an AI outage.
The one exception is a brief that is being written right now: the paper is held back for
a short grace period so it cannot slip past the review before the brief exists.
"""

from __future__ import annotations

from datetime import timedelta

# How long after the paper last changed we still treat an unfinished brief as "being
# written". The generation task retries for about 4 minutes; past this window an
# unfinished brief means it was never queued or the worker is down, so the paper is
# released rather than stranded.
GENERATION_GRACE = timedelta(minutes=10)

# Failure messages written into ai_brief_summary by tasks._mark_submission_brief_failed.
_FAILURE_PREFIXES = ("AI brief could not be generated",)


def has_reviewable_brief(submission) -> bool:
    text = (submission.ai_brief_summary or "").strip()
    return bool(
        submission.ai_brief_processed
        and text
        and not text.startswith(_FAILURE_PREFIXES)
    )


def brief_generation_pending(submission) -> bool:
    """True while an AI brief is expected within minutes but has not been written yet."""
    from django.utils import timezone

    from .ai.claude_client import ai_enabled

    if submission.ai_brief_processed:
        return False
    if not ai_enabled():
        return False  # the task would only record a failure; nothing is coming
    return timezone.now() - submission.updated_at < GENERATION_GRACE


def brief_review_pending(submission) -> bool:
    return has_reviewable_brief(submission) and submission.ai_brief_reviewed_at is None


def can_review_brief(user, submission) -> bool:
    from .models import Role
    from .opsc_access import MANAGER_ROLE_TO_ROUTED_UNIT
    from .profile_utils import ensure_psc_profile

    if user.is_staff or user.is_superuser:
        return True
    role = ensure_psc_profile(user).role
    if role == Role.PSC_ADMIN:
        return True
    if submission.assigned_to_id == user.id:
        return True
    if submission.co_assignments.filter(principal=user).exists():
        return True
    unit = MANAGER_ROLE_TO_ROUTED_UNIT.get(role)
    return bool(unit) and unit == submission.routed_unit


def blocker(submission) -> str:
    """Message to refuse a hand-off with, or '' when the brief is in order."""
    if brief_generation_pending(submission):
        return (
            "The AI brief for this paper is still being prepared. Wait a minute, then "
            "review it before sending the paper on."
        )
    if brief_review_pending(submission):
        return (
            "Review the AI brief before sending this paper on: the Commission reads the "
            "same brief. Open the brief on the submission, correct it if needed, and "
            "confirm it."
        )
    return ""


def confirm(submission, user, *, text: str | None = None) -> None:
    from django.utils import timezone

    update = ["ai_brief_reviewed_by", "ai_brief_reviewed_at", "updated_at"]
    cleaned = (text or "").strip()
    if cleaned and cleaned != (submission.ai_brief_summary or "").strip():
        submission.ai_brief_summary = cleaned
        submission.ai_brief_edited = True
        update += ["ai_brief_summary", "ai_brief_edited"]
    submission.ai_brief_reviewed_by = user
    submission.ai_brief_reviewed_at = timezone.now()
    submission.save(update_fields=update)


def clear_review(submission) -> list[str]:
    """Reset sign-off when the brief is regenerated; returns the fields to save."""
    submission.ai_brief_reviewed_by = None
    submission.ai_brief_reviewed_at = None
    submission.ai_brief_edited = False
    return ["ai_brief_reviewed_by", "ai_brief_reviewed_at", "ai_brief_edited"]
