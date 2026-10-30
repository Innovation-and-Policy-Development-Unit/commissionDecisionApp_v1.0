"""Flying agenda — the extra matters commissioners raise during a sitting.

The Commission endorses the agenda first, then sometimes raises a few further
matters. Those go at the end of the agenda and have no submission behind them
yet, so Manager CSU — in the room as minute taker — creates a shell submission
for each and names the unit responsible. That unit's Manager files a short
brief (subject, background, recommendation) while the Commission works its way
down the agenda; the deadline is positional, not a date, because the item is
taken when the Commission reaches it.

Two things here are deliberate departures from the normal route:

* the shell submission is created straight at Forwarded to Commission. It
  cannot walk checklist review → assessment → the Secretary's gate in the time
  available, and the Commission is about to deliberate it. This is the second
  sanctioned cutoff override after ``MeetingViewSet.admit_reserve``, audited
  the same way, and only reachable while the Secretary has opened the window
  for that meeting.
* the item does not count against ``Meeting.max_items``. The Commission raised
  it, so agenda capacity is no longer the question.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import (
    AgendaItem,
    AgendaStatus,
    FlyingAgendaBrief,
    MeetingStatus,
    MinuteAgendaIntake,
    Role,
    RoutedUnit,
    Submission,
    WorkflowEvent,
    WorkflowStage,
)

# Flying items are extra matters, so they sit in the "Other Matters" section.
FLYING_AGENDA_SECTION = "other"

# How many outstanding items ahead of it before the responsible unit Manager is
# warned that the Commission is close.
APPROACHING_ITEMS = 2

# Who may open and close the window, and who may add items once it is open.
_TOGGLE_ROLES = {Role.PSC_SECRETARY, Role.PSC_ADMIN}
_ADD_ROLES = {Role.CSU_MANAGER, Role.PSC_ADMIN}

# The unit Manager who has to file the brief, per responsible unit.
_UNIT_MANAGER_ROLE = {
    RoutedUnit.ODU: Role.ODU_MANAGER,
    RoutedUnit.HR: Role.HR_UNIT_MANAGER,
    RoutedUnit.VIPAM: Role.VIPAM_MANAGER,
    RoutedUnit.COMPLIANCE: Role.COMPLIANCE_MANAGER,
    RoutedUnit.CSU: Role.CSU_MANAGER,
    RoutedUnit.IPDU: Role.IPDU_MANAGER,
}


def unit_manager_role(routed_unit: str) -> str | None:
    return _UNIT_MANAGER_ROLE.get(routed_unit)


# ── The Secretary's per-meeting switch ───────────────────────────────────────

def set_enabled(meeting, *, user, profile, enabled: bool) -> None:
    if profile.role not in _TOGGLE_ROLES:
        raise PermissionDenied("Only the PSC Secretary can open or close the flying agenda.")
    if meeting.status in {MeetingStatus.COMPLETED, MeetingStatus.CANCELLED}:
        raise ValidationError(
            {"detail": "This sitting is over — the flying agenda cannot be changed."},
        )
    meeting.flying_agenda_enabled = bool(enabled)
    meeting.flying_agenda_enabled_by = user if enabled else None
    meeting.flying_agenda_enabled_at = timezone.now() if enabled else None
    meeting.save(update_fields=[
        "flying_agenda_enabled", "flying_agenda_enabled_by",
        "flying_agenda_enabled_at", "updated_at",
    ])


# ── Adding an item during the sitting ────────────────────────────────────────

def assert_may_add_item(meeting, profile) -> None:
    if profile.role not in _ADD_ROLES:
        raise PermissionDenied(
            "Only Manager CSU can add a flying agenda item — they take the minutes for the sitting.",
        )
    if not meeting.flying_agenda_enabled:
        raise ValidationError({
            "detail": "The Secretary has not opened the flying agenda for this sitting.",
        })
    if meeting.agenda_status != AgendaStatus.CIRCULATED:
        raise ValidationError({
            "detail": (
                "The Commission endorses the agenda before extra matters are added — "
                "this agenda has not been endorsed and circulated yet."
            ),
        })
    if meeting.status not in {MeetingStatus.SCHEDULED, MeetingStatus.IN_PROGRESS}:
        raise ValidationError({"detail": "This sitting is over — nothing further can be added."})


def _next_flying_sequence(meeting) -> int:
    last = (
        AgendaItem.objects.filter(meeting=meeting, is_flying=True)
        .order_by("-sequence")
        .values_list("sequence", flat=True)
        .first()
    )
    return (last or 0) + 1


@transaction.atomic
def add_item(meeting, *, actor, profile, title, responsible_unit, raised_by_label="", notes=""):
    """Create the shell submission and append it to the end of the agenda."""
    from .org_structure import resolve_opsc_submission_org

    assert_may_add_item(meeting, profile)

    title = (title or "").strip()
    if not title:
        raise ValidationError({"title": "Give the matter a title — it goes on the agenda as typed."})
    if responsible_unit not in _UNIT_MANAGER_ROLE:
        raise ValidationError({
            "responsible_unit": "Choose the unit responsible for briefing the Commission on this matter.",
        })

    try:
        org = resolve_opsc_submission_org(profile)
    except ValueError as exc:
        raise ValidationError({"detail": str(exc)}) from exc

    submission = Submission.objects.create(
        title=title,
        notes=notes or "",
        ministry_id=org["ministry_id"],
        department_id=org["department_id"],
        unit_id=org.get("unit_id"),
        routed_unit=responsible_unit,
        agenda_category=FLYING_AGENDA_SECTION,
        is_internal=True,
        # It skips the normal route by design — see the module docstring.
        follows_normal_route=False,
        current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        scheduled_meeting=meeting,
        received_at=timezone.now(),
        created_by=actor,
    )

    raised_by_label = (raised_by_label or "").strip()
    raised_note = f" raised by {raised_by_label}" if raised_by_label else ""
    WorkflowEvent.objects.create(
        submission=submission,
        actor=actor,
        previous_stage=WorkflowStage.DRAFT,
        new_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        remarks=(
            f"Added to {meeting.reference_number} as a flying agenda item{raised_note}. "
            f"The {responsible_unit.upper()} unit Manager files the brief before the "
            "Commission reaches it."
        ),
    )

    item = AgendaItem.objects.create(
        meeting=meeting,
        submission=submission,
        category=FLYING_AGENDA_SECTION,
        sequence=_next_flying_sequence(meeting),
        is_flying=True,
        raised_by_label=raised_by_label,
        form_type_code="",
    )
    FlyingAgendaBrief.objects.create(agenda_item=item, subject=title)
    return item


# ── The brief the responsible unit files ─────────────────────────────────────

def assert_may_fill_brief(item, profile) -> None:
    allowed = {Role.PSC_ADMIN, Role.PSC_SECRETARY, Role.CSU_MANAGER}
    role_for_unit = unit_manager_role(item.submission.routed_unit)
    if role_for_unit:
        allowed.add(role_for_unit)
    if profile.role not in allowed:
        raise PermissionDenied(
            "Only the responsible unit's Manager can file this brief.",
        )


def save_brief(item, *, user, subject=None, background=None, recommendation=None) -> FlyingAgendaBrief:
    brief, _ = FlyingAgendaBrief.objects.get_or_create(agenda_item=item)
    for field, value in (
        ("subject", subject), ("background", background), ("recommendation", recommendation),
    ):
        if value is not None:
            setattr(brief, field, value)
    was_complete = bool(brief.completed_at)
    if brief.is_complete and not was_complete:
        brief.completed_by = user
        brief.completed_at = timezone.now()
    elif not brief.is_complete:
        brief.completed_by = None
        brief.completed_at = None
    brief.save()
    # The agenda, the sitting pack and the minutes all read the item's title.
    if brief.subject.strip() and brief.subject.strip() != item.submission.title:
        item.submission.title = brief.subject.strip()[:512]
        item.submission.save(update_fields=["title", "updated_at"])
    return brief


# ── Where the Commission has got to ─────────────────────────────────────────

def _is_taken(row) -> bool:
    """An item is taken once the minute taker has written anything against it."""
    if row is None:
        return False
    return bool((row.discussion_notes or "").strip() or (row.decision_text or "").strip())


def sitting_progress(meeting) -> dict:
    """Ordered agenda items with how far the Commission has worked down them.

    Progress comes from the minute taker's own intake rows — Manager CSU fills
    those as the sitting runs, so nobody has to maintain a separate pointer.
    """
    items = list(
        meeting.agenda_items
        .select_related("submission", "flying_brief")
        .order_by("is_flying", "category", "sequence", "added_at")
    )
    rows = {r.agenda_item_id: r for r in MinuteAgendaIntake.objects.filter(meeting=meeting)}

    out = []
    outstanding_so_far = 0
    for item in items:
        taken = _is_taken(rows.get(item.id))
        brief = getattr(item, "flying_brief", None)
        out.append({
            "agenda_item_id": item.id,
            "submission_id": item.submission_id,
            "title": item.submission.title if item.submission_id else "",
            "category": item.category,
            "sequence": item.sequence,
            "is_flying": item.is_flying,
            "raised_by": item.raised_by_label,
            "taken": taken,
            "items_ahead_outstanding": outstanding_so_far,
            "brief_complete": bool(brief and brief.completed_at),
            "responsible_unit": item.submission.routed_unit if item.submission_id else "",
        })
        if not taken:
            outstanding_so_far += 1

    return {
        "meeting_id": meeting.id,
        "meeting_reference": meeting.reference_number,
        "flying_agenda_enabled": meeting.flying_agenda_enabled,
        "items": out,
    }


def on_minutes_saved(meeting) -> None:
    """Chase the flying items after the minute taker saves.

    Warn the responsible unit Manager when the Commission is within
    ``APPROACHING_ITEMS`` outstanding items of theirs, and tell the Secretary
    and Manager CSU if an item came up with no brief filed. Each fires once —
    the minute taker saves many times during a sitting.
    """
    from .email_notify import (
        notify_flying_item_approaching,
        notify_flying_item_incomplete,
    )

    progress = sitting_progress(meeting)
    by_id = {
        item.id: item
        for item in AgendaItem.objects
        .filter(meeting=meeting, is_flying=True)
        .select_related("submission", "flying_brief")
    }
    now = timezone.now()

    for row in progress["items"]:
        if not row["is_flying"]:
            continue
        item = by_id.get(row["agenda_item_id"])
        if item is None:
            continue
        brief, _ = FlyingAgendaBrief.objects.get_or_create(agenda_item=item)
        if brief.completed_at:
            continue

        if row["taken"] and not brief.incomplete_alerted_at:
            notify_flying_item_incomplete(item)
            brief.incomplete_alerted_at = now
            brief.save(update_fields=["incomplete_alerted_at", "updated_at"])
        elif (
            not row["taken"]
            and row["items_ahead_outstanding"] <= APPROACHING_ITEMS
            and not brief.approaching_notified_at
        ):
            notify_flying_item_approaching(item, row["items_ahead_outstanding"])
            brief.approaching_notified_at = now
            brief.save(update_fields=["approaching_notified_at", "updated_at"])
