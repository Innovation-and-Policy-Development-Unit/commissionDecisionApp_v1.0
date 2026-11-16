"""Decision implementation report: what the Secretary tables at a sitting.

Every decision still being worked on, plus the decisions finished since the
Commission last met, with who holds each one and its latest progress note.
Built from CommissionTask (the decisions from signed minutes) and rendered as
JSON for the on-screen page and as a PDF for printing.
"""

from __future__ import annotations

from datetime import date, datetime
from io import BytesIO
from typing import Any

from django.db.models import Prefetch, QuerySet
from django.template.loader import render_to_string
from django.utils import timezone

from ..models import (
    CommissionTask,
    CommissionTaskStatus,
    CommissionTaskUpdate,
    Meeting,
)

OPEN_STATUSES = (CommissionTaskStatus.OPEN, CommissionTaskStatus.IN_PROGRESS)


def last_sitting_date(today: date) -> date | None:
    """Date of the most recent sitting before today, if any."""
    m = Meeting.objects.filter(date__lt=today).order_by("-date").first()
    return m.date if m else None


def _latest_note(task) -> dict[str, Any] | None:
    updates = list(task.status_updates.all())  # newest first (prefetched)
    note = next((u for u in updates if u.kind == "comment"), None) or (updates[0] if updates else None)
    if not note:
        return None
    return {
        "body": note.body,
        "author": note.author.get_full_name() or note.author.username,
        "at": note.created_at.date().isoformat(),
    }


def build_decision_implementation_report(
    qs: QuerySet, since: date | None = None, today: date | None = None,
) -> dict[str, Any]:
    today = today or timezone.localdate()
    if since is None:
        since = last_sitting_date(today)
    since_dt = (
        timezone.make_aware(datetime.combine(since, datetime.min.time())) if since else None
    )

    tasks = (
        qs.select_related("assigned_manager", "meeting", "completed_by")
        .prefetch_related(
            "assigned_staff_m2m", "subtasks",
            Prefetch("status_updates", queryset=CommissionTaskUpdate.objects.select_related("author")),
        )
    )

    rows: list[dict[str, Any]] = []
    for t in tasks:
        is_open = t.status in OPEN_STATUSES
        done_since = (
            t.status == CommissionTaskStatus.COMPLETED
            and t.completed_at is not None
            and (since_dt is None or t.completed_at >= since_dt)
        )
        if not (is_open or done_since):
            continue
        subs = [s for s in t.subtasks.all() if s.status != CommissionTaskStatus.CANCELLED]
        rows.append({
            "task_id": t.id,
            "decision_number": t.decision_number or "",
            "meeting": t.meeting_reference or (t.meeting.title if t.meeting_id else ""),
            "title": t.title,
            "decision_detail": (t.decision_detail or "")[:400],
            "unit": t.get_action_unit_display() if t.action_unit else "Unassigned",
            "manager": t.assigned_manager.get_full_name() or t.assigned_manager.username,
            "staff": [u.get_full_name() or u.username for u in t.assigned_staff_m2m.all()],
            "status": t.status,
            "status_label": t.get_status_display(),
            "due_date": t.due_date.isoformat() if t.due_date else "",
            "days_overdue": (today - t.due_date).days if is_open and t.due_date and t.due_date < today else 0,
            "completed_at": t.completed_at.date().isoformat() if t.completed_at else "",
            "subtask_total": len(subs),
            "subtask_done": sum(1 for s in subs if s.status == CommissionTaskStatus.COMPLETED),
            "latest_note": _latest_note(t),
        })

    rows.sort(key=lambda r: (
        r["status"] == CommissionTaskStatus.COMPLETED,
        -r["days_overdue"],
        r["due_date"] or "9999",
        r["decision_number"],
    ))

    units: dict[str, dict[str, int]] = {}
    for r in rows:
        u = units.setdefault(r["unit"], {"unit": r["unit"], "open": 0, "in_progress": 0, "completed": 0, "overdue": 0})
        u[r["status"]] += 1
        if r["days_overdue"]:
            u["overdue"] += 1

    return {
        "as_of": today.isoformat(),
        "since": since.isoformat() if since else None,
        "summary": {
            "total": len(rows),
            "open": sum(1 for r in rows if r["status"] == CommissionTaskStatus.OPEN),
            "in_progress": sum(1 for r in rows if r["status"] == CommissionTaskStatus.IN_PROGRESS),
            "completed_since": sum(1 for r in rows if r["status"] == CommissionTaskStatus.COMPLETED),
            "overdue": sum(1 for r in rows if r["days_overdue"]),
        },
        "by_unit": sorted(units.values(), key=lambda u: (-u["overdue"], u["unit"])),
        "decisions": rows,
    }


def render_decision_implementation_pdf(report: dict[str, Any], prepared_by: str) -> bytes:
    from weasyprint import HTML

    html = render_to_string(
        "tracker/decision_implementation_pdf.html",
        {"report": report, "prepared_by": prepared_by},
    )
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    return buf.getvalue()
