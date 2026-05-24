"""Build HTML fragments for daily brief emails."""

from __future__ import annotations

import html
from typing import Any

from django.utils import timezone

from tracker.email_templates import get_frontend_base_url
from tracker.models import CommissionTask, Meeting, Notification, Submission, WorkflowStage


def _esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def _stage_label(stage: str) -> str:
    try:
        return WorkflowStage(stage).label
    except ValueError:
        return stage.replace("_", " ").title()


def _task_link(task: CommissionTask, base: str) -> str:
    return f"{base}/commission-tasks/{task.pk}"


def _submission_link(sub: Submission, base: str) -> str:
    return f"{base}/submissions/{sub.pk}"


def _meeting_link(meeting: Meeting, base: str) -> str:
    return f"{base}/meetings/{meeting.pk}"


def _section(title: str, rows_html: str) -> str:
    if not rows_html:
        return ""
    return (
        f'<h3 style="margin:1.2em 0 0.4em;font-size:15px;color:#1e293b;">{_esc(title)}</h3>'
        f'<ul style="margin:0;padding-left:1.2em;">{rows_html}</ul>'
    )


def _li(text: str, url: str | None = None) -> str:
    if url:
        return (
            f'<li style="margin:0.35em 0;">'
            f'<a href="{_esc(url)}" style="color:#2563eb;">{text}</a></li>'
        )
    return f'<li style="margin:0.35em 0;">{text}</li>'


def render_staff_sections_html(data: dict[str, Any]) -> str:
    base = get_frontend_base_url()
    parts = []

    if data.get("overdue_tasks"):
        rows = ""
        for t in data["overdue_tasks"]:
            ref = t.submission.reference_number if t.submission_id else (t.decision_number or "—")
            label = _esc(f"{ref}: {t.title} (due {t.due_date})")
            rows += _li(label, _task_link(t, base))
        parts.append(_section("Overdue commission tasks", rows))

    if data.get("due_today_tasks"):
        rows = ""
        for t in data["due_today_tasks"]:
            ref = t.submission.reference_number if t.submission_id else (t.decision_number or "—")
            label = _esc(f"{ref}: {t.title}")
            rows += _li(label, _task_link(t, base))
        parts.append(_section("Tasks due today", rows))

    if data.get("submissions_attention"):
        rows = ""
        for s in data["submissions_attention"]:
            label = _esc(f"{s.reference_number}: {s.title} — {_stage_label(s.current_stage)}")
            rows += _li(label, _submission_link(s, base))
        parts.append(_section("Submissions needing attention", rows))

    if data.get("unread_notifications"):
        rows = ""
        for n in data["unread_notifications"]:
            label = _esc(n.title)
            url = _submission_link(n.submission, base) if n.submission_id else None
            rows += _li(label, url)
        parts.append(_section("Unread notifications", rows))

    if data.get("todays_meetings"):
        rows = ""
        for m in data["todays_meetings"]:
            label = _esc(f"{m.reference_number}: {m.title} at {m.time.strftime('%H:%M')}")
            rows += _li(label, _meeting_link(m, base))
        parts.append(_section("Today's meetings", rows))

    return "\n".join(p for p in parts if p)


def render_manager_kpis_html(data: dict[str, Any]) -> str:
    base = get_frontend_base_url()
    parts = []

    overdue_count = data.get("overdue_count") or 0
    rows = ""
    for t in data.get("overdue_top") or []:
        ref = t.submission.reference_number if t.submission_id else (t.decision_number or "—")
        label = _esc(f"{ref}: {t.title} (due {t.due_date})")
        rows += _li(label, _task_link(t, base))
    parts.append(
        f'<h3 style="margin:1.2em 0 0.4em;font-size:15px;color:#1e293b;">'
        f'Overdue commission tasks ({overdue_count})</h3>'
        + (f'<ul style="margin:0;padding-left:1.2em;">{rows}</ul>' if rows else "<p>None listed.</p>")
    )

    stage_counts = data.get("stage_counts") or []
    if stage_counts:
        rows = ""
        for row in stage_counts:
            stage = row.get("current_stage") or ""
            cnt = row.get("count") or 0
            rows += _li(_esc(f"{_stage_label(stage)}: {cnt}"))
        parts.append(_section("Open submissions by stage", rows))

    new_count = data.get("new_count") or 0
    rows = ""
    for s in data.get("new_list") or []:
        label = _esc(f"{s.reference_number}: {s.title}")
        rows += _li(label, _submission_link(s, base))
    parts.append(
        f'<h3 style="margin:1.2em 0 0.4em;font-size:15px;color:#1e293b;">'
        f'New submissions (24h): {new_count}</h3>'
        + (f'<ul style="margin:0;padding-left:1.2em;">{rows}</ul>' if rows else "<p>None.</p>")
    )

    meetings_count = data.get("meetings_count") or 0
    rows = ""
    for m in data.get("meetings_list") or []:
        label = _esc(f"{m.reference_number}: {m.title} at {m.time.strftime('%H:%M')}")
        rows += _li(label, _meeting_link(m, base))
    parts.append(
        f'<h3 style="margin:1.2em 0 0.4em;font-size:15px;color:#1e293b;">'
        f"Today's meetings ({meetings_count})</h3>"
        + (f'<ul style="margin:0;padding-left:1.2em;">{rows}</ul>' if rows else "<p>None scheduled.</p>")
    )

    return "\n".join(parts)


def count_staff_sections(data: dict[str, Any]) -> tuple[int, int]:
    keys = (
        "overdue_tasks",
        "due_today_tasks",
        "submissions_attention",
        "unread_notifications",
        "todays_meetings",
    )
    sections = sum(1 for k in keys if data.get(k))
    items = sum(len(data.get(k) or []) for k in keys)
    return sections, items


def count_manager_sections(data: dict[str, Any]) -> tuple[int, int]:
    sections = 0
    items = 0
    if data.get("overdue_count"):
        sections += 1
        items += data.get("overdue_count", 0)
    if data.get("stage_counts"):
        sections += 1
        items += sum(r.get("count", 0) for r in data["stage_counts"])
    if data.get("new_count"):
        sections += 1
        items += data.get("new_count", 0)
    if data.get("meetings_count"):
        sections += 1
        items += data.get("meetings_count", 0)
    return sections, items


def brief_date_label() -> str:
    return timezone.localdate().strftime("%A, %d %B %Y")
