"""
C2 — Build meeting briefing data and render Quarto HTML.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.files import File
from django.utils import timezone
from jinja2 import Environment, FileSystemLoader, select_autoescape

from tracker.models import (
    Meeting,
    MeetingBriefingPack,
    Submission,
    WorkflowStage,
)

logger = logging.getLogger("scdms.app")

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"

DEFERRED_STAGES = {
    WorkflowStage.DEFERRED,
    WorkflowStage.DEFERRED_BACK_TO_HR,
    WorkflowStage.TABLED,
}

READY_STAGES = {
    WorkflowStage.COMMISSION_SITTING,
    WorkflowStage.FORWARDED_TO_COMMISSION,
    WorkflowStage.UNDER_ASSESSMENT,
    WorkflowStage.SECRETARY_REVIEW,
    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
    WorkflowStage.REGISTERED_ROUTED,
    WorkflowStage.SUBMITTED,
    WorkflowStage.MATTERS_ARISING,
}


def _quarto_bin() -> str:
    return getattr(settings, "QUARTO_BIN", "quarto")


def quarto_available() -> bool:
    return shutil.which(_quarto_bin()) is not None


def _submission_row(sub: Submission, *, on_agenda: bool, agenda_category: str = "") -> dict[str, Any]:
    quality = sub.ai_quality_score
    flags = []
    if sub.is_assessment_overdue:
        flags.append("overdue_assessment")
    if sub.current_stage in DEFERRED_STAGES:
        flags.append("deferred")
    if quality is not None and quality < 60:
        flags.append("low_quality")
    elif quality is not None and quality >= 80:
        flags.append("high_quality")

    return {
        "reference": sub.reference_number,
        "title": sub.title,
        "stage": sub.current_stage,
        "stage_display": sub.get_current_stage_display(),
        "ministry": sub.ministry.name if sub.ministry_id else "",
        "form_type": sub.form_type_code or "",
        "on_agenda": on_agenda,
        "agenda_category": agenda_category,
        "overdue": sub.is_assessment_overdue,
        "quality_score": quality,
        "quality_effort": sub.ai_quality_review_effort or "",
        "assessment_deadline": (
            sub.assessment_deadline_at.isoformat() if sub.assessment_deadline_at else ""
        ),
        "flags": flags,
    }


def collect_meeting_submissions(meeting: Meeting) -> list[dict[str, Any]]:
    seen: set[int] = set()
    rows: list[dict[str, Any]] = []

    for item in meeting.agenda_items.select_related(
        "submission", "submission__ministry"
    ).order_by("category", "sequence"):
        sub = item.submission
        if sub.id in seen:
            continue
        seen.add(sub.id)
        rows.append(_submission_row(sub, on_agenda=True, agenda_category=item.category))

    queued = Submission.objects.filter(scheduled_meeting=meeting).select_related("ministry")
    for sub in queued:
        if sub.id in seen:
            continue
        seen.add(sub.id)
        rows.append(_submission_row(sub, on_agenda=False))

    return rows


def build_meeting_briefing_pack_data(meeting: Meeting) -> dict[str, Any]:
    rows = collect_meeting_submissions(meeting)
    deferred = [r for r in rows if "deferred" in r["flags"]]
    overdue = [r for r in rows if "overdue_assessment" in r["flags"]]
    low_quality = [r for r in rows if "low_quality" in r["flags"]]
    ready = [r for r in rows if r["stage"] in READY_STAGES and "deferred" not in r["flags"]]

    return {
        "meeting": {
            "reference": meeting.reference_number,
            "title": meeting.title,
            "date": str(meeting.date),
            "time": str(meeting.time),
            "venue": meeting.venue,
            "type": meeting.type,
            "status": meeting.status,
            "agenda_status": meeting.agenda_status,
            "agenda_count": meeting.agenda_items.count(),
            "max_items": meeting.max_items,
        },
        "stats": {
            "agenda_count": len([r for r in rows if r["on_agenda"]]),
            "queued_count": len([r for r in rows if not r["on_agenda"]]),
            "total_submissions": len(rows),
            "ready_count": len(ready),
            "deferred_count": len(deferred),
            "overdue_count": len(overdue),
            "low_quality_count": len(low_quality),
        },
        "submissions": rows,
        "ready": ready,
        "deferred": deferred,
        "overdue": overdue,
        "low_quality": low_quality,
    }


def build_meeting_context_text(meeting: Meeting, pack_data: dict[str, Any]) -> str:
    m = pack_data["meeting"]
    lines = [
        f"Meeting: {m['reference']} — {m['title']}",
        f"Date: {m['date']} {m['time']} | Venue: {m['venue']}",
        f"Type: {m['type']} | Status: {m['status']} | Agenda status: {m['agenda_status']}",
        f"Stats: {json.dumps(pack_data['stats'])}",
    ]
    for r in pack_data.get("submissions") or []:
        flags = ", ".join(r["flags"]) or "none"
        q = r["quality_score"] if r["quality_score"] is not None else "—"
        lines.append(
            f"- {r['reference']}: {r['title'][:80]} | {r['stage_display']} | "
            f"agenda={r['on_agenda']} | quality={q} | flags={flags}"
        )
    return "\n".join(lines)


def sections_to_markdown(pack_data: dict[str, Any]) -> str:
    parts = []
    stats = pack_data.get("stats") or {}

    parts.append("## At a glance\n")
    parts.append(
        f"- **{stats.get('ready_count', 0)}** ready / active | "
        f"**{stats.get('deferred_count', 0)}** deferred | "
        f"**{stats.get('overdue_count', 0)}** overdue assessment | "
        f"**{stats.get('low_quality_count', 0)}** low quality score (<60)\n"
    )

    def _table(title: str, items: list[dict], cols: list[str]):
        if not items:
            return
        parts.append(f"\n## {title}\n\n")
        parts.append("| " + " | ".join(cols) + " |\n")
        parts.append("| " + " | ".join(["---"] * len(cols)) + " |\n")
        for r in items:
            if cols == ["Ref", "Title", "Stage", "Quality"]:
                q = r.get("quality_score")
                parts.append(
                    f"| {r['reference']} | {r['title'][:60]} | {r['stage_display']} | "
                    f"{q if q is not None else '—'} |\n"
                )

    _table("Agenda items — deferred", pack_data.get("deferred") or [], ["Ref", "Title", "Stage", "Quality"])
    _table("Overdue assessments", pack_data.get("overdue") or [], ["Ref", "Title", "Stage", "Quality"])
    _table("Low quality scores", pack_data.get("low_quality") or [], ["Ref", "Title", "Stage", "Quality"])

    ready = pack_data.get("ready") or []
    if ready:
        parts.append("\n## Ready for sitting\n\n")
        for r in ready[:30]:
            parts.append(f"- **{r['reference']}** — {r['title'][:70]} ({r['stage_display']})\n")

    return "".join(parts)


def render_meeting_briefing_quarto(
    *,
    meeting: Meeting,
    narrative: str,
    pack_data: dict[str, Any],
    generated_by: str,
) -> Path:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(default_for_string=False),
    )
    template = env.get_template("meeting_briefing_pack.qmd.j2")
    m = pack_data["meeting"]
    qmd_body = template.render(
        title=f"Commission Sitting Briefing — {m['reference']}",
        subtitle=m["title"],
        meeting_date=m["date"],
        meeting_time=m["time"],
        venue=m["venue"],
        narrative=narrative,
        tables_md=sections_to_markdown(pack_data),
        generated_at=timezone.localtime().strftime("%d %B %Y %H:%M"),
        generated_by=generated_by,
        stats_json=json.dumps(pack_data.get("stats") or {}, indent=2),
    )

    work_dir = Path(tempfile.mkdtemp(prefix="scdms_meeting_briefing_"))
    qmd_path = work_dir / "briefing.qmd"
    qmd_path.write_text(qmd_body, encoding="utf-8")

    quarto = _quarto_bin()
    if not quarto_available():
        raise RuntimeError("Quarto is not installed on the server.")

    cmd = [quarto, "render", str(qmd_path), "--to", "html", "--quiet"]
    proc = subprocess.run(
        cmd,
        cwd=str(work_dir),
        capture_output=True,
        text=True,
        timeout=getattr(settings, "QUARTO_RENDER_TIMEOUT", 180),
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "Quarto failed")[:500])

    html_path = work_dir / "briefing.html"
    pdf_path = work_dir / "briefing.pdf"
    if not html_path.is_file() or not pdf_path.is_file():
        raise RuntimeError("Quarto did not produce briefing HTML/PDF.")
    return html_path, pdf_path


def _safe_slug(ref: str) -> str:
    slug = re.sub(r"[^\w\-]+", "_", ref.lower()).strip("_")
    return slug[:60] or "briefing"


def run_meeting_briefing_generation(pack_id: int) -> None:
    pack = MeetingBriefingPack.objects.select_related(
        "meeting", "requested_by"
    ).get(pk=pack_id)
    pack.status = MeetingBriefingPack.Status.PROCESSING
    pack.save(update_fields=["status", "updated_at"])

    work_dir = None
    try:
        meeting = pack.meeting
        pack_data = build_meeting_briefing_pack_data(meeting)
        pack.pack_data = pack_data

        from tracker.ai.meeting_briefing import generate_briefing_narrative

        ctx = build_meeting_context_text(meeting, pack_data)
        narrative, _err = generate_briefing_narrative(meeting_context=ctx, pack_data=pack_data)
        pack.narrative_markdown = narrative

        generated_by = pack.requested_by.get_full_name() or pack.requested_by.username
        html_path = render_meeting_briefing_quarto(
            meeting=meeting,
            narrative=narrative,
            pack_data=pack_data,
            generated_by=generated_by,
        )
        work_dir = html_path.parent
        slug = _safe_slug(meeting.reference_number)

        with html_path.open("rb") as fh:
            pack.html_file.save(f"{slug}_briefing.html", File(fh), save=False)

        pack.status = MeetingBriefingPack.Status.READY
        pack.error_message = ""
        pack.completed_at = timezone.now()
        pack.save()
        logger.info("MEETING_BRIEFING_OK | pack=%s meeting=%s", pack_id, meeting.id)
    except Exception as exc:
        logger.exception("MEETING_BRIEFING_FAIL | pack=%s", pack_id)
        pack.status = MeetingBriefingPack.Status.FAILED
        pack.error_message = str(exc)[:2000]
        pack.completed_at = timezone.now()
        pack.save(update_fields=["status", "error_message", "completed_at", "updated_at", "pack_data", "narrative_markdown"])
    finally:
        if work_dir and work_dir.is_dir():
            shutil.rmtree(work_dir, ignore_errors=True)
