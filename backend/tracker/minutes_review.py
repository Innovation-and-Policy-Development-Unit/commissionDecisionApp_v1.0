"""Who takes and reviews minutes, and how long each stage gets.

Three stages, each with its own window, all configurable so the Commission can
trial a duration without a deploy:

* the minute takers read back the draft and submit it on. Manager CSU takes the
  minutes; when the sitting took compliance business the Compliance Manager
  takes the compliance items, and both have to be satisfied with the draft
  before it leaves them;
* the Secretary approves, then the Chairman (one after the other by default —
  the Chairman reads what the Secretary has already corrected). Either can
  send the draft back to the minute takers with a note;
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
# "sequential" (Secretary, then Chairman) or "parallel" (both at once).
SETTING_REVIEW_MODE = "MINUTES_REVIEW_MODE"
REVIEW_MODE_SEQUENTIAL = "sequential"
REVIEW_MODE_PARALLEL = "parallel"

DEFAULT_DRAFT_REVIEW_DAYS = 1
DEFAULT_SECRETARIAT_REVIEW_DAYS = 1
DEFAULT_COMMISSIONER_REVIEW_DAYS = 3

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


def review_is_sequential() -> bool:
    """Secretary first, then Chairman — unless the Commission has switched the
    two to review at the same time. Anything unrecognised means sequential."""
    value = (SystemSetting.get_val(SETTING_REVIEW_MODE, REVIEW_MODE_SEQUENTIAL) or "").strip().lower()
    return value != REVIEW_MODE_PARALLEL


# ── Compliance business: the second minute taker ────────────────────────────

def compliance_item_ids(meeting_id) -> set[int]:
    """Agenda items on this sitting that are compliance business.

    Either the item sat in the Discipline / Compliance section, or the
    submission behind it belongs to the Compliance unit — a compliance matter
    placed in another section is still the Compliance Manager's to minute.
    """
    if not meeting_id:
        return set()
    from django.db.models import Q

    from .models import AgendaItem

    return set(
        AgendaItem.objects.filter(
            Q(category=AgendaCategory.DISCIPLINE_COMPLIANCE)
            | Q(submission__routed_unit=RoutedUnit.COMPLIANCE),
            meeting_id=meeting_id,
        ).values_list("id", flat=True)
    )


def meeting_has_compliance_business(meeting_id) -> bool:
    return bool(compliance_item_ids(meeting_id))


def requires_compliance_review(minutes) -> bool:
    """True when the sitting took compliance business, which makes the
    Compliance Manager a minute taker of it."""
    return meeting_has_compliance_business(minutes.meeting_id)


def is_compliance_minute_taker(user, meeting_id) -> bool:
    """The Compliance Manager, on a sitting that took compliance business."""
    profile = getattr(user, "psc_profile", None)
    if not profile or profile.role != Role.COMPLIANCE_MANAGER:
        return False
    return meeting_has_compliance_business(meeting_id)


def compliance_confirmation_outstanding(minutes) -> bool:
    """The draft still needs the Compliance Manager to confirm their items."""
    return requires_compliance_review(minutes) and not minutes.compliance_reviewed_by_id


# ── Who has to review these minutes ─────────────────────────────────────────

def pending_reviewers(minutes) -> list[str]:
    """Which approvals these minutes are still waiting on, as role codes, in
    the order they are given."""
    waiting = []
    if not minutes.secretary_reviewed_by_id:
        waiting.append(Role.PSC_SECRETARY)
    if not minutes.chairman_reviewed_by_id:
        waiting.append(Role.CHAIRPERSON)
    return waiting


def current_reviewers(minutes) -> list[str]:
    """Whose turn it is right now. One after the other, that is only the first
    of those still to approve; at the same time, it is all of them."""
    waiting = pending_reviewers(minutes)
    return waiting[:1] if review_is_sequential() else waiting


def secretariat_review_complete(minutes) -> bool:
    return not pending_reviewers(minutes)
