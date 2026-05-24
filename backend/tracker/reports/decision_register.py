"""
Build Commission Decision Register datasets and render Quarto HTML reports.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
import tempfile
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.files import File
from django.utils import timezone
from jinja2 import Environment, FileSystemLoader, select_autoescape

from tracker.models import (
    CommissionActionUnit,
    CommissionDecisionOutcome,
    CommissionImplementationStatus,
    CommissionTask,
    CommissionTaskDecisionType,
    CommissionTaskStatus,
    DecisionRegisterReport,
)

logger = logging.getLogger("scdms.app")

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
COLUMN_LABELS = {
    "decision_number": "Decision No.",
    "title": "Agenda item",
    "submission_ref": "Submission ref.",
    "submission_title": "Submission title",
    "meeting_ref": "Meeting",
    "decision_outcome": "Outcome",
    "decision_detail": "Decision detail",
    "action_unit": "Action unit",
    "implementation_status": "Impl. status",
    "way_forward": "Way forward",
    "manager": "Manager",
    "staff": "Staff",
    "status": "Task status",
    "due_date": "Due date",
    "decision_type": "Decision type",
    "subtask_count": "Subtasks",
    "subtask_completed": "Subtasks done",
    "days_overdue": "Days overdue",
}


def _quarto_bin() -> str:
    return getattr(settings, "QUARTO_BIN", "quarto")


def quarto_available() -> bool:
    return shutil.which(_quarto_bin()) is not None


def apply_filters(qs, filters: dict[str, Any]):
    """Apply validated filter spec to a CommissionTask queryset."""
    if filters.get("date_from"):
        try:
            qs = qs.filter(created_at__gte=datetime.strptime(filters["date_from"], "%Y-%m-%d"))
        except ValueError:
            pass
    if filters.get("date_to"):
        try:
            qs = qs.filter(
                created_at__lte=datetime.strptime(filters["date_to"], "%Y-%m-%d") + timedelta(days=1)
            )
        except ValueError:
            pass
    if filters.get("status"):
        qs = qs.filter(status=filters["status"])
    if filters.get("manager_id"):
        qs = qs.filter(assigned_manager_id=filters["manager_id"])
    if filters.get("action_unit"):
        qs = qs.filter(action_unit=filters["action_unit"])
    if filters.get("decision_outcome"):
        qs = qs.filter(decision_outcome=filters["decision_outcome"])
    if filters.get("implementation_status"):
        qs = qs.filter(implementation_status=filters["implementation_status"])
    if filters.get("decision_type"):
        qs = qs.filter(decision_type=filters["decision_type"])
    if filters.get("open_only"):
        qs = qs.filter(status__in=[CommissionTaskStatus.OPEN, CommissionTaskStatus.IN_PROGRESS])
    return qs


def build_register_rows(qs) -> list[dict[str, Any]]:
    """Same shape as CommissionTaskViewSet.report."""
    today = date.today()
    rows = []
    for t in qs.select_related("submission", "assigned_manager", "meeting").prefetch_related(
        "assigned_staff_m2m", "subtasks"
    ):
        staff_names = [u.get_full_name() or u.username for u in t.assigned_staff_m2m.all()]
        subtask_qs = t.subtasks.all()
        subtask_total = subtask_qs.count()
        subtask_done = subtask_qs.filter(status=CommissionTaskStatus.COMPLETED).count()
        overdue_days = (today - t.due_date).days if t.due_date and t.due_date < today else 0

        rows.append({
            "task_id": t.id,
            "decision_number": t.decision_number or "",
            "title": t.title,
            "submission_ref": t.submission.reference_number if t.submission_id else "",
            "submission_title": t.submission.title if t.submission_id else "",
            "meeting_ref": t.meeting_reference or (t.meeting.title if t.meeting_id else ""),
            "decision_detail": (t.decision_detail or "")[:500],
            "decision_outcome": t.get_decision_outcome_display() if t.decision_outcome else "",
            "action_unit": t.get_action_unit_display() if t.action_unit else t.action_unit or "",
            "implementation_status": (
                t.get_implementation_status_display() if t.implementation_status else ""
            ),
            "way_forward": (t.way_forward or "")[:300],
            "manager": t.assigned_manager.get_full_name() or t.assigned_manager.username,
            "staff": "; ".join(staff_names),
            "status": t.get_status_display(),
            "due_date": t.due_date.isoformat() if t.due_date else "",
            "decision_type": t.get_decision_type_display() if t.decision_type else "",
            "subtask_count": subtask_total,
            "subtask_completed": subtask_done,
            "days_overdue": overdue_days,
        })

    return rows


def filter_rows_by_spec(rows: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    if filters.get("overdue_only"):
        rows = [r for r in rows if (r.get("days_overdue") or 0) > 0]
    return rows


def build_data_summary(qs) -> dict[str, Any]:
    total = qs.count()
    by_status = dict(Counter(qs.values_list("status", flat=True)))
    by_unit = dict(Counter(qs.exclude(action_unit="").values_list("action_unit", flat=True)))
    by_outcome = dict(Counter(qs.exclude(decision_outcome="").values_list("decision_outcome", flat=True)))
    return {
        "total_tasks": total,
        "by_status": by_status,
        "by_action_unit": by_unit,
        "by_decision_outcome": by_outcome,
        "status_choices": list(CommissionTaskStatus.values),
        "action_unit_choices": list(CommissionActionUnit.values),
        "outcome_choices": list(CommissionDecisionOutcome.values),
        "implementation_choices": list(CommissionImplementationStatus.values),
        "decision_type_choices": list(CommissionTaskDecisionType.values),
    }


def _escape_md_cell(val: Any) -> str:
    s = str(val or "").replace("|", "\\|").replace("\n", " ")
    return s


def rows_to_markdown_table(rows: list[dict[str, Any]], columns: list[str]) -> str:
    if not rows:
        return "_No register entries match this report._\n"

    headers = [COLUMN_LABELS.get(c, c) for c in columns]
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(columns)) + " |",
    ]
    for row in rows:
        cells = [_escape_md_cell(row.get(c, "")) for c in columns]
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines) + "\n"


def build_summary_markdown(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "## Summary\n\nNo records in scope.\n"

    overdue = sum(1 for r in rows if (r.get("days_overdue") or 0) > 0)
    by_unit = Counter(r.get("action_unit") or "—" for r in rows)
    by_status = Counter(r.get("status") or "—" for r in rows)

    lines = [
        "## Summary",
        "",
        f"- **Total decisions in report:** {len(rows)}",
        f"- **Overdue tasks:** {overdue}",
        "",
        "### By action unit",
        "",
    ]
    for unit, count in by_unit.most_common():
        lines.append(f"- {unit}: {count}")
    lines.extend(["", "### By task status", ""])
    for st, count in by_status.most_common():
        lines.append(f"- {st}: {count}")
    lines.append("")
    return "\n".join(lines)


def render_quarto_report(
    *,
    spec: dict[str, Any],
    rows: list[dict[str, Any]],
    generated_by: str,
    user_prompt: str,
) -> Path:
    """Render .qmd via Quarto; return html_path in a temp directory."""
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(default_for_string=False),
    )
    template = env.get_template("decision_register_report.qmd.j2")

    columns = spec.get("columns") or []
    narrative = spec.get("narrative_markdown") or ""
    summary_md = build_summary_markdown(rows) if spec.get("include_summary", True) else ""
    table_md = rows_to_markdown_table(rows, columns)

    qmd_body = template.render(
        title=spec.get("title", "Commission Decision Register Report"),
        subtitle=spec.get("subtitle", ""),
        narrative=narrative,
        summary_md=summary_md,
        table_md=table_md,
        generated_at=timezone.localtime().strftime("%d %B %Y %H:%M"),
        generated_by=generated_by,
        row_count=len(rows),
        user_prompt=user_prompt,
        filters_json=json.dumps(spec.get("filters") or {}, indent=2),
    )

    work_dir = Path(tempfile.mkdtemp(prefix="scdms_register_report_"))
    qmd_path = work_dir / "report.qmd"
    qmd_path.write_text(qmd_body, encoding="utf-8")

    quarto = _quarto_bin()
    if not quarto_available():
        raise RuntimeError(
            "Quarto is not installed on the server. Install Quarto CLI to generate HTML reports."
        )

    cmd = [quarto, "render", str(qmd_path), "--to", "html", "--quiet"]
    logger.info("QUARTO_RENDER | %s", " ".join(cmd))
    proc = subprocess.run(
        cmd,
        cwd=str(work_dir),
        capture_output=True,
        text=True,
        timeout=getattr(settings, "QUARTO_RENDER_TIMEOUT", 180),
    )
    if proc.returncode != 0:
        logger.error("QUARTO_FAIL | stdout=%s stderr=%s", proc.stdout, proc.stderr)
        raise RuntimeError(
            f"Quarto render failed: {(proc.stderr or proc.stdout or 'unknown error')[:500]}"
        )

    html_path = work_dir / "report.html"
    if not html_path.is_file():
        raise RuntimeError("Quarto did not produce report.html")
    return html_path


def _safe_slug(title: str) -> str:
    slug = re.sub(r"[^\w\-]+", "_", title.lower()).strip("_")
    return (slug[:60] or "report")


def run_report_generation(report_id: int) -> None:
    """Celery/sync worker: load DecisionRegisterReport, generate files, update status."""
    report = DecisionRegisterReport.objects.select_related("requested_by").get(pk=report_id)
    report.status = DecisionRegisterReport.Status.PROCESSING
    report.save(update_fields=["status", "updated_at"])

    work_dir = None
    try:
        from tracker.views import _commission_task_queryset_for

        base_qs = _commission_task_queryset_for(report.requested_by)
        filters = report.filter_spec or {}
        qs = apply_filters(base_qs, filters)
        rows = filter_rows_by_spec(build_register_rows(qs), filters)

        generated_by = report.requested_by.get_full_name() or report.requested_by.username
        html_path = render_quarto_report(
            spec={
                "title": report.title,
                "subtitle": report.subtitle,
                "filters": filters,
                "columns": report.column_spec,
                "narrative_markdown": report.narrative_markdown,
                "include_summary": report.include_summary,
            },
            rows=rows,
            generated_by=generated_by,
            user_prompt=report.prompt,
        )
        work_dir = html_path.parent
        slug = _safe_slug(report.title)

        with html_path.open("rb") as fh:
            report.html_file.save(f"{slug}.html", File(fh), save=False)

        report.status = DecisionRegisterReport.Status.READY
        report.row_count = len(rows)
        report.error_message = ""
        report.completed_at = timezone.now()
        report.save(
            update_fields=[
                "status",
                "row_count",
                "error_message",
                "completed_at",
                "html_file",
                "updated_at",
            ]
        )
        logger.info("REGISTER_REPORT_OK | id=%s rows=%s", report_id, len(rows))
    except Exception as exc:
        logger.exception("REGISTER_REPORT_FAIL | id=%s", report_id)
        report.status = DecisionRegisterReport.Status.FAILED
        report.error_message = str(exc)[:2000]
        report.completed_at = timezone.now()
        report.save(update_fields=["status", "error_message", "completed_at", "updated_at"])
    finally:
        if work_dir and work_dir.is_dir():
            shutil.rmtree(work_dir, ignore_errors=True)
