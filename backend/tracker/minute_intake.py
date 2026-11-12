"""Minute intake helpers — preload from approved agenda, apply to Minutes JSON."""

from __future__ import annotations

from django.utils import timezone

from .models import (
    AgendaCategory,
    AgendaItem,
    AgendaStatus,
    Meeting,
    MeetingStatus,
    MinuteAgendaIntake,
    MinuteIntakeDecision,
    Minutes,
    MinutesStatus,
)


APPROVED_AGENDA_STATUSES = {
    AgendaStatus.CIRCULATED,
}

# Minute-taking records what happened at the sitting, so it can't start
# before the sitting has actually launched — a circulated-but-not-yet-
# convened meeting has nothing to take notes on yet.
CONVENED_MEETING_STATUSES = {
    MeetingStatus.IN_PROGRESS,
    MeetingStatus.COMPLETED,
}


def meeting_allows_minute_intake(meeting: Meeting) -> bool:
    return (
        meeting.agenda_status in APPROVED_AGENDA_STATUSES
        and meeting.status in CONVENED_MEETING_STATUSES
    )


def _agenda_title_description(item: AgendaItem) -> tuple[str, str]:
    sub = item.submission
    # A flying item's substance is the brief the responsible unit filed, not
    # an agenda blurb — there was never an endorsed agenda entry to blurb.
    brief = getattr(item, "flying_brief", None)
    if item.is_flying and brief:
        title = (brief.subject or "").strip() or (sub.title if sub else f"Agenda item {item.sequence}")
        return title, (brief.background or "").strip()
    if item.category == "matters_arising" and item.matters_arising_meeting_ref:
        title = f"Matters arising — {item.matters_arising_agenda_no or ''}".strip()
        if item.matters_arising_meeting_ref:
            title = f"{title} ({item.matters_arising_meeting_ref})".strip()
    else:
        title = sub.title if sub else f"Agenda item {item.sequence}"
    description = (item.agenda_blurb or "").strip()
    if not description and sub and sub.notes:
        description = (sub.notes or "")[:2000]
    return title, description


# How much of the paper's summary the formatter is given. Enough for a
# paragraph on what the Commission had before it, not the whole paper.
_SUBMISSION_SUMMARY_LIMIT = 3000


def row_has_input(row: MinuteAgendaIntake) -> bool:
    """True when the minute taker has given the formatter something to work
    from: typed notes, or just an outcome picked from the list."""
    return bool(
        (row.discussion_notes or "").strip()
        or (row.decision_text or "").strip()
        or row.decision_type
    )


def decision_label(row: MinuteAgendaIntake) -> str:
    if not row.decision_type:
        return ""
    return str(MinuteIntakeDecision(row.decision_type).label)


def submission_summary(row: MinuteAgendaIntake) -> str:
    """What the paper is about, so the minute can say what the Commission
    considered without the minute taker retyping it. Flying items use the
    brief the unit filed; everything else its executive summary, falling back
    to the paper's own notes."""
    item = row.agenda_item
    brief = getattr(item, "flying_brief", None) if item.is_flying else None
    if brief and (brief.background or "").strip():
        text = brief.background
    else:
        sub = item.submission
        text = (getattr(sub, "ai_brief_summary", "") or getattr(sub, "notes", "") or "") if sub else ""
    return text.strip()[:_SUBMISSION_SUMMARY_LIMIT]


def format_kwargs(row: MinuteAgendaIntake, meeting_info: str) -> dict:
    """Everything format_minute_intake_item needs for one row."""
    from .agenda_sections import agenda_section_label

    sub = row.agenda_item.submission
    return {
        "meeting_info": meeting_info,
        "agenda_title": row.agenda_title,
        "agenda_description": row.agenda_description,
        "submission_ref": getattr(sub, "reference_number", "") if sub else "",
        "category_display": agenda_section_label(row.agenda_item.category or ""),
        "discussion_notes": row.discussion_notes,
        "decision_text": row.decision_text,
        "action_officer": row.action_officer,
        "selected_decision": row.decision_type,
        "selected_decision_label": decision_label(row),
        "submission_summary": submission_summary(row),
    }


def ensure_intake_rows(meeting: Meeting) -> list[MinuteAgendaIntake]:
    """Create empty intake rows for each agenda item if missing."""
    rows = []
    for item in (
        meeting.agenda_items
        .select_related("submission", "flying_brief")
        .order_by("is_flying", "category", "sequence", "id")
    ):
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
        .order_by("agenda_item__category", "agenda_item__sequence", "agenda_item__id")
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
            # An outcome picked from the list stands on its own: an item that
            # was never formatted still carries its decision into the minutes.
            "decision": row.formatted_decision or row.decision_text
            or (f"{decision_label(row)}." if row.decision_type else ""),
            "decision_type": row.decision_type or row.formatted_decision_type or "",
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
    fields = ["content", "updated_at"]
    # The minute taker's own read-back window starts when the draft first
    # exists, and only then — rebuilding it later must not reset the clock.
    if created and minutes_obj.status == MinutesStatus.DRAFT:
        from .minutes_review import draft_review_days, due_in_working_days

        minutes_obj.draft_review_due_at = due_in_working_days(draft_review_days())
        fields.append("draft_review_due_at")
    minutes_obj.save(update_fields=fields)
    return minutes_obj


def store_formatted_result(row: MinuteAgendaIntake, data: dict) -> None:
    row.formatted_discussion = (data.get("discussion") or "").strip()
    row.formatted_decision = (data.get("decision") or "").strip()
    # The minute taker's own pick is the record; the model only supplies the
    # type when none was picked.
    row.formatted_decision_type = row.decision_type or (data.get("decision_type") or "").strip()[:32]
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
