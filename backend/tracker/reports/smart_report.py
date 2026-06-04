"""
Smart Report engine — build a spec, resolve the scoped dataset, render Quarto HTML.

Generalizes the Decision-Register pipeline across data domains. Quarto runs Python in a
subprocess that only reads files we write into the work dir (data.json, spec.json,
render_helpers.py, highcharts.bundle.js); it never connects to the database.
"""

from __future__ import annotations

import json
import logging
import shutil
import tempfile
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.files import File
from django.utils import timezone
from jinja2 import Environment, FileSystemLoader, select_autoescape

from tracker.models import SmartReport

from .decision_register import _quarto_bin, _safe_slug, quarto_available
from .domains import get_resolver

logger = logging.getLogger("scdms.app")

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
VENDOR_HIGHCHARTS = TEMPLATE_DIR / "vendor" / "highcharts.bundle.js"
HELPERS_SRC = Path(__file__).resolve().parent / "render_helpers.py"


def build_spec(report: SmartReport) -> tuple[dict[str, Any] | None, str | None]:
    """Catalog → deterministic spec. Ad-hoc → AI-proposed, validated spec."""
    from .catalog import build_catalog_spec

    if report.report_type and report.report_type != "adhoc":
        try:
            return build_catalog_spec(report.report_type, report.params or {}), None
        except KeyError as exc:
            return None, str(exc)

    # Ad-hoc: ground the model with a quick scoped summary, then interpret.
    from ..ai.smart_report_interpret import interpret_submissions_report

    resolver = get_resolver(report.domain)
    if not resolver:
        return None, f"No resolver registered for domain '{report.domain}'."
    summary_ds = resolver.resolve(user=report.requested_by, params=report.params or {})
    agg = summary_ds.aggregates
    data_summary = {
        "total": agg.get("total"),
        "active": agg.get("active"),
        "overdue_assessments": agg.get("overdue_assessments"),
        "by_stage": agg.get("by_stage", []),
        "by_ministry": agg.get("by_ministry", [])[:10],
        "by_category": agg.get("by_category", [])[:10],
    }
    spec, err = interpret_submissions_report(user_prompt=report.prompt, data_summary=data_summary)
    if not spec:
        return None, err
    # Carry any UI-provided params the AI didn't set.
    for key, val in (report.params or {}).items():
        spec.setdefault("params", {}).setdefault(key, val)
    return spec, None


def render_quarto(*, spec: dict[str, Any], dataset, generated_by: str, user_prompt: str) -> Path:
    """Render the .qmd via Quarto; return the html path inside a temp work dir."""
    if not quarto_available():
        raise RuntimeError(
            "Quarto is not installed on the server. Install Quarto CLI to generate reports."
        )

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(default_for_string=False),
    )
    template = env.get_template("smart_report.qmd.j2")
    qmd_body = template.render(
        title=spec.get("title", "Submissions Report"),
        subtitle=spec.get("subtitle", ""),
        narrative=spec.get("narrative_markdown", ""),
        generated_at=timezone.localtime().strftime("%d %B %Y %H:%M"),
        generated_by=generated_by,
        row_count=dataset.meta.get("row_count", 0),
        user_prompt=user_prompt or "",
        lang="en",
    )

    work_dir = Path(tempfile.mkdtemp(prefix="scdms_smart_report_"))
    (work_dir / "report.qmd").write_text(qmd_body, encoding="utf-8")
    (work_dir / "data.json").write_text(
        json.dumps(dataset.to_payload(), default=str), encoding="utf-8"
    )
    (work_dir / "spec.json").write_text(json.dumps(spec, default=str), encoding="utf-8")
    shutil.copyfile(HELPERS_SRC, work_dir / "render_helpers.py")
    if VENDOR_HIGHCHARTS.is_file():
        shutil.copyfile(VENDOR_HIGHCHARTS, work_dir / "highcharts.bundle.js")
    else:
        (work_dir / "highcharts.bundle.js").write_text("/* PLACEHOLDER */", encoding="utf-8")

    import subprocess

    cmd = [_quarto_bin(), "render", "report.qmd", "--to", "html", "--quiet"]
    logger.info("SMART_REPORT_RENDER | %s", " ".join(cmd))
    proc = subprocess.run(
        cmd,
        cwd=str(work_dir),
        capture_output=True,
        text=True,
        timeout=getattr(settings, "QUARTO_RENDER_TIMEOUT", 180),
    )
    if proc.returncode != 0:
        logger.error("SMART_REPORT_QUARTO_FAIL | stdout=%s stderr=%s", proc.stdout, proc.stderr)
        raise RuntimeError(
            f"Quarto render failed: {(proc.stderr or proc.stdout or 'unknown error')[:500]}"
        )

    html_path = work_dir / "report.html"
    if not html_path.is_file():
        raise RuntimeError("Quarto did not produce report.html")
    return html_path


def run_smart_report(report_id: int) -> None:
    """Celery worker: build spec → resolve dataset → render Quarto HTML → store."""
    report = SmartReport.objects.select_related("requested_by").get(pk=report_id)
    report.status = SmartReport.Status.PROCESSING
    report.save(update_fields=["status", "updated_at"])

    work_dir = None
    try:
        spec, err = build_spec(report)
        if not spec:
            raise RuntimeError(err or "Could not build the report specification.")

        report.spec = spec
        report.title = (spec.get("title") or "Submissions Report")[:200]
        report.subtitle = (spec.get("subtitle") or "")[:300]
        report.save(update_fields=["spec", "title", "subtitle", "updated_at"])

        resolver = get_resolver(spec["domain"])
        if not resolver:
            raise RuntimeError(f"No resolver registered for domain '{spec['domain']}'.")
        dataset = resolver.resolve(user=report.requested_by, params=spec.get("params") or {})

        generated_by = report.requested_by.get_full_name() or report.requested_by.username
        html_path = render_quarto(
            spec=spec, dataset=dataset, generated_by=generated_by, user_prompt=report.prompt
        )
        work_dir = html_path.parent
        slug = _safe_slug(report.title)
        with html_path.open("rb") as fh:
            report.html_file.save(f"{slug}.html", File(fh), save=False)

        report.status = SmartReport.Status.READY
        report.row_count = dataset.meta.get("row_count", 0)
        report.error_message = ""
        report.completed_at = timezone.now()
        report.save(update_fields=[
            "status", "row_count", "error_message", "completed_at", "html_file", "updated_at",
        ])
        logger.info("SMART_REPORT_OK | id=%s rows=%s", report_id, report.row_count)
    except Exception as exc:
        logger.exception("SMART_REPORT_FAIL | id=%s", report_id)
        report.status = SmartReport.Status.FAILED
        report.error_message = str(exc)[:2000]
        report.completed_at = timezone.now()
        report.save(update_fields=["status", "error_message", "completed_at", "updated_at"])
    finally:
        if work_dir and work_dir.is_dir():
            shutil.rmtree(work_dir, ignore_errors=True)
