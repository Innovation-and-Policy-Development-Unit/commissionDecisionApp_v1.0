"""Who reviews minutes, and how long each stage gets.

Three stages, each with its own window, all configurable so the Commission can
trial a duration without a deploy:

* the minute taker reads back their own draft and submits it on;
* the Secretary and the Chairman each approve independently — joined by the
  Compliance Manager when the sitting took compliance business;
* every Commissioner gets the reviewed minutes for comment.

The commissioners' window is the one nobody has settled on yet: the Commission
asked to trial it and see. That is why these are settings rather than numbers
in the code.
"""

from __future__ import annotations

from datetime import datetime, time

from django.utils import timezone

from .models import AgendaCategory, Role, RoutedUnit, SystemSetting, add_working_days

# SystemSetting keys, with the durations the Commission is starting from.
SETTING_DRAFT_REVIEW_DAYS = "MINUTES_DRAFT_REVIEW_DAYS"
SETTING_SECRETARIAT_REVIEW_DAYS = "MINUTES_SECRETARIAT_REVIEW_DAYS"
SETTING_COMMISSIONER_REVIEW_DAYS = "MINUTES_COMMISSIONER_REVIEW_DAYS"

DEFAULT_DRAFT_REVIEW_DAYS = 1
DEFAULT_SECRETARIAT_REVIEW_DAYS = 1
DEFAULT_COMMISSIONER_REVIEW_DAYS = 2

# Who takes the minutes. Manager CSU does it in practice; the Senior Admin
# Officer is the role the SOP names.
MINUTE_TAKER_ROLES = {Role.SENIOR_ADMIN_OFFICER, Role.CSU_MANAGER}


def _days(key: str, default: int) -> int:
    """A configured window, ignoring a nonsensical value rather than acting on it."""
    value = SystemSetting.get_int(key, default=default)
    return value if value >= 0 else default


def draft_review_days() -> int:
    return _days(SETTING_DRAFT_REVIEW_DAYS, DEFAULT_DRAFT_REVIEW_DAYS)


def secretariat_review_days() -> int:
    return _days(SETTING_SECRETARIAT_REVIEW_DAYS, DEFAULT_SECRETARIAT_REVIEW_DAYS)


def commissioner_review_days() -> int:
    return _days(SETTING_COMMISSIONER_REVIEW_DAYS, DEFAULT_COMMISSIONER_REVIEW_DAYS)


def due_in_working_days(days: int, *, start=None):
    """End of the working day `days` working days from `start` (default now)."""
    start = start or timezone.now()
    return timezone.make_aware(
        datetime.combine(add_working_days(start, days), time(23, 59, 59)),
        timezone.get_current_timezone(),
    )


# ── Who has to review these minutes ─────────────────────────────────────────

def requires_compliance_review(minutes) -> bool:
    """True when the sitting took compliance business.

    Either the agenda item sat in the Discipline / Compliance section, or the
    submission behind it belongs to the Compliance unit — a compliance matter
    placed in another section still needs the Compliance Manager's eye.
    """
    if not minutes.meeting_id:
        return False
    from django.db.models import Q

    from .models import AgendaItem

    return AgendaItem.objects.filter(
        Q(category=AgendaCategory.DISCIPLINE_COMPLIANCE)
        | Q(submission__routed_unit=RoutedUnit.COMPLIANCE),
        meeting_id=minutes.meeting_id,
    ).exists()


def pending_reviewers(minutes) -> list[str]:
    """Which approvals these minutes are still waiting on, as role codes."""
    waiting = []
    if not minutes.secretary_reviewed_by_id:
        waiting.append(Role.PSC_SECRETARY)
    if not minutes.chairman_reviewed_by_id:
        waiting.append(Role.CHAIRPERSON)
    if requires_compliance_review(minutes) and not minutes.compliance_reviewed_by_id:
        waiting.append(Role.COMPLIANCE_MANAGER)
    return waiting


def secretariat_review_complete(minutes) -> bool:
    return not pending_reviewers(minutes)
