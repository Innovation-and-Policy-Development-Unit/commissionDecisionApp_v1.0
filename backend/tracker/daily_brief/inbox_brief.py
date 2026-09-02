"""Build the personal inbox-brief card payload (in-app, not email).

Reuses the same section data as the staff email brief (see collectors.py)
but groups it by action needed and renders relative in-app links instead
of an HTML email fragment.
"""

from __future__ import annotations

from typing import Any

from django.contrib.auth.models import User

from tracker.models import CommissionTask, Meeting, Notification, Submission, WorkflowStage

from .collectors import collect_staff_brief, staff_brief_is_empty


def _stage_label(stage: str) -> str:
    try:
        return WorkflowStage(stage).label
    except ValueError:
        return stage.replace("_", " ").title()


def _task_ref(task: CommissionTask) -> str:
    if task.submission_id:
        return task.submission.reference_number
    return task.decision_number or "—"


def _task_item(task: CommissionTask, *, show_due: bool) -> dict[str, Any]:
    ref = _task_ref(task)
    label = f"{ref}: {task.title}"
    if show_due and task.due_date:
        label += f" (due {task.due_date.isoformat()})"
    return {"id": task.pk, "label": label, "url": "/secretariat/tasks"}


def _submission_item(sub: Submission) -> dict[str, Any]:
    label = f"{sub.reference_number}: {sub.title} — {_stage_label(sub.current_stage)}"
    return {"id": sub.pk, "label": label, "url": f"/submissions/{sub.pk}"}


def _notification_item(note: Notification) -> dict[str, Any]:
    url = f"/submissions/{note.submission_id}" if note.submission_id else "/secretariat/notifications"
    return {"id": note.pk, "label": note.title, "url": url}


def _meeting_item(meeting: Meeting) -> dict[str, Any]:
    label = f"{meeting.reference_number}: {meeting.title} at {meeting.time.strftime('%H:%M')}"
    return {"id": meeting.pk, "label": label, "url": "/secretariat/meetings"}


def build_inbox_brief(user: User) -> dict[str, Any]:
    """Personal, in-app brief for `user`: grouped by action needed, empty
    groups dropped entirely (mirrors an inbox-style AI briefing card)."""
    data = collect_staff_brief(user)

    groups: list[dict[str, Any]] = []
    suggested_actions: list[str] = []

    needs_action_items = [
        *(_task_item(t, show_due=True) for t in data["overdue_tasks"]),
        *(_submission_item(s) for s in data["submissions_attention"]),
    ]
    if needs_action_items:
        groups.append({"key": "needs_action", "count": len(needs_action_items), "items": needs_action_items[:10]})
        if data["overdue_tasks"]:
            t = data["overdue_tasks"][0]
            suggested_actions.append(
                f"Clear {len(data['overdue_tasks'])} overdue task(s), starting with {_task_ref(t)}: {t.title}"
            )
        if data["submissions_attention"]:
            s = data["submissions_attention"][0]
            suggested_actions.append(
                f"Review {len(data['submissions_attention'])} submission(s) waiting on you, "
                f"starting with {s.reference_number}"
            )

    due_today_items = [_task_item(t, show_due=False) for t in data["due_today_tasks"]]
    if due_today_items:
        groups.append({"key": "due_today", "count": len(due_today_items), "items": due_today_items[:10]})
        suggested_actions.append(f"Finish {len(due_today_items)} task(s) due today")

    meeting_items = [_meeting_item(m) for m in data["todays_meetings"]]
    if meeting_items:
        groups.append({"key": "meetings_today", "count": len(meeting_items), "items": meeting_items[:10]})
        m = data["todays_meetings"][0]
        suggested_actions.append(
            f"Prepare for {len(meeting_items)} meeting(s) today, starting with {m.title} at {m.time.strftime('%H:%M')}"
        )

    fyi_items = [_notification_item(n) for n in data["unread_notifications"]]
    if fyi_items:
        groups.append({"key": "fyi", "count": len(fyi_items), "items": fyi_items[:10]})
        suggested_actions.append(f"Check {len(fyi_items)} unread notification(s)")

    is_empty = staff_brief_is_empty(data)
    total_items = sum(g["count"] for g in groups)

    return {
        "is_empty": is_empty,
        "total_items": total_items,
        "groups": groups,
        "suggested_actions": suggested_actions[:5],
    }
