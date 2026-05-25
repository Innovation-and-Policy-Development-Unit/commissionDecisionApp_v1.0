"""Minute intake helpers — preload from approved agenda, apply to Minutes JSON."""

from __future__ import annotations

from django.utils import timezone

from .models import (
    AgendaCategory,
    AgendaItem,
    AgendaStatus,
    Meeting,
    MinuteAgendaIntake,
    Minutes,
    MinutesStatus,
)


APPROVED_AGENDA_STATUSES = {
    AgendaStatus.CHAIRMAN_APPROVED,
    AgendaStatus.CIRCULATED,
}


def meeting_allows_minute_intake(meeting: Meeting) -> bool:
    return meeting.agenda_status in APPROVED_AGENDA_STATUSES


def _agenda_title_description(item: AgendaItem) -> tuple[str, str]:
    sub = item.submission
    if item.category == AgendaCategory.MATTERS_ARISING and item.matters_arising_meeting_ref:
        title = f"Matters arising — {item.matters_arising_agenda_no or ''}".strip()
        if item.matters_arising_meeting_ref:
            title = f"{title} ({item.matters_arising_meeting_ref})".strip()
    else:
        title = sub.title if sub else f"Agenda item {item.sequence}"
    description = (item.agenda_blurb or "").strip()
    if not description and sub and sub.notes:
        description = (sub.notes or "")[:2000]
    return title, description


def ensure_intake_rows(meeting: Meeting) -> list[MinuteAgendaIntake]:
    """Create empty intake rows for each agenda item if missing."""
    rows = []
    for item in meeting.agenda_items.select_related("submission").order_by("sequence", "id"):
        title, description = _agenda_title_description(item)
        row, _ = MinuteAgendaIntake.objects.get_or_create(
            meeting=meeting,
            agenda_item=item,
            defaults={
                "agenda_title": title,
                "agenda_description": description,
            },
        )
        if row.agenda_title != title or row.agenda_description != description:
            row.agenda_title = title
            row.agenda_description = description
            row.save(update_fields=["agenda_title", "agenda_description", "updated_at"])
        rows.append(row)
    return rows


def meeting_info_block(meeting: Meeting) -> str:
    return (
        f"Reference: {meeting.reference_number}\n"
        f"Title: {meeting.title}\n"
        f"Date: {meeting.date} at {meeting.time}\n"
        f"Venue: {meeting.venue}\n"
        f"Type: {meeting.get_type_display()}"
    )


def apply_intake_to_minutes(meeting: Meeting, user) -> Minutes:
    """Merge formatted intake rows into Minutes.content.agenda_items."""
    rows = (
        MinuteAgendaIntake.objects.filter(meeting=meeting)
        .select_related("agenda_item", "agenda_item__submission")
        .order_by("agenda_item__sequence", "agenda_item__id")
    )

    agenda_items = []
    for row in rows:
        sub = row.agenda_item.submission
        ref = getattr(sub, "reference_number", "") if sub else ""
        entry = {
            "agenda_item_id": row.agenda_item_id,
            "sequence": row.agenda_item.sequence,
            "submission_ref": ref,
            "title": row.agenda_title,
            "discussion": row.formatted_discussion or row.discussion_notes,
            "decision": row.formatted_decision or row.decision_text,
            "decision_type": row.formatted_decision_type or "",
            "action_items": row.formatted_action_items or [],
        }
        if row.action_officer and not entry["action_items"]:
            entry["action_items"] = [
                {"action": "As recorded in the minutes.", "responsible": row.action_officer, "deadline": None}
            ]
        agenda_items.append(entry)

    minutes_obj, created = Minutes.objects.get_or_create(
        meeting=meeting,
        defaults={
            "status": MinutesStatus.DRAFT,
            "created_by": user,
            "content": {},
        },
    )
    content = dict(minutes_obj.content or {})
    content["agenda_items"] = agenda_items
    if not content.get("opening"):
        content["opening"] = ""
    if not content.get("confirmation_previous_minutes"):
        content["confirmation_previous_minutes"] = ""
    if "any_other_business" not in content:
        content["any_other_business"] = ""
    if "closing" not in content:
        content["closing"] = ""
    minutes_obj.content = content
    minutes_obj.save(update_fields=["content", "updated_at"])
    return minutes_obj


def store_formatted_result(row: MinuteAgendaIntake, data: dict) -> None:
    row.formatted_discussion = (data.get("discussion") or "").strip()
    row.formatted_decision = (data.get("decision") or "").strip()
    row.formatted_decision_type = (data.get("decision_type") or "").strip()[:32]
    actions = data.get("action_items")
    row.formatted_action_items = actions if isinstance(actions, list) else []
    row.formatted_at = timezone.now()
    row.save(
        update_fields=[
            "formatted_discussion",
            "formatted_decision",
            "formatted_decision_type",
            "formatted_action_items",
            "formatted_at",
            "updated_at",
        ]
    )
