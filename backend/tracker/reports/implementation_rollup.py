"""
Decision implementation rollup — the "does anything happen after we decide?"
aggregate.

Builds % of approved Commission decisions implemented within target, by
ministry and by quarter, from the Submission milestone timestamps
(commission_approved_at / implementation_completed_at) and the per-submission
implementation_due_date (falling back to the IMPLEMENTATION_TARGET_DAYS
system setting).

Used by both the dashboard API endpoint and the quarterly WeasyPrint PDF.
"""

from __future__ import annotations

from datetime import date, timedelta

from django.utils import timezone

DEFAULT_TARGET_DAYS = 30


def _quarter_label(d: date) -> str:
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def quarter_bounds(year: int, quarter: int) -> tuple[date, date]:
    """Inclusive first/last day of a calendar quarter."""
    start = date(year, 3 * (quarter - 1) + 1, 1)
    if quarter == 4:
        end = date(year, 12, 31)
    else:
        end = date(year, 3 * quarter + 1, 1) - timedelta(days=1)
    return start, end


def previous_quarter(today: date | None = None) -> tuple[int, int]:
    """(year, quarter) of the quarter before the one containing today."""
    today = today or timezone.localdate()
    q = (today.month - 1) // 3 + 1
    if q == 1:
        return today.year - 1, 4
    return today.year, q - 1


def _median(values: list[int]) -> int | None:
    if not values:
        return None
    values = sorted(values)
    mid = len(values) // 2
    if len(values) % 2:
        return values[mid]
    return round((values[mid - 1] + values[mid]) / 2)


def _new_bucket() -> dict:
    return {
        "total": 0,
        "implemented": 0,
        "implemented_within_target": 0,
        "implemented_late": 0,
        "in_progress": 0,
        "overdue": 0,
        "not_implemented": 0,
        "explicit_target": 0,
        "missing_timing": 0,
        "_days": [],
    }


def _finalise(bucket: dict) -> dict:
    total = bucket["total"]
    bucket["pct_implemented"] = round(bucket["implemented"] / total * 100) if total else 0
    bucket["pct_within_target"] = (
        round(bucket["implemented_within_target"] / total * 100) if total else 0
    )
    bucket["median_days_to_implement"] = _median(bucket.pop("_days"))
    return bucket


def get_target_days() -> int:
    from tracker.models import SystemSetting

    days = SystemSetting.get_int("IMPLEMENTATION_TARGET_DAYS", DEFAULT_TARGET_DAYS)
    return days if days > 0 else DEFAULT_TARGET_DAYS


def build_implementation_rollup(
    date_from: date | None = None,
    date_to: date | None = None,
    ministry_id: int | None = None,
) -> dict:
    """Aggregate implementation performance for decisions approved in the
    given window (filtering on commission_approved_at; both bounds inclusive).

    Definitions (consistent with notify_overdue_implementation_reports):
      implemented    — implementation_status == "implemented"
      within target  — implemented and implementation_completed_at on or
                       before the target date
      target date    — implementation_due_date if set, else approval date
                       + IMPLEMENTATION_TARGET_DAYS calendar days
      overdue        — not implemented/failed and target date has passed
    """
    from tracker.models import ImplementationStatus, Submission

    target_days = get_target_days()
    today = timezone.localdate()

    qs = Submission.objects.filter(
        commission_approved_at__isnull=False,
        is_attachment=False,
    )
    if date_from:
        qs = qs.filter(commission_approved_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(commission_approved_at__date__lte=date_to)
    if ministry_id:
        qs = qs.filter(ministry_id=ministry_id)

    rows = qs.values(
        "id",
        "reference_number",
        "title",
        "ministry_id",
        "ministry__name",
        "ministry__code",
        "current_stage",
        "implementation_status",
        "implementation_due_date",
        "commission_approved_at",
        "implementation_completed_at",
    )

    overall = _new_bucket()
    by_ministry: dict[int, dict] = {}
    by_quarter: dict[str, dict] = {}
    overdue_rows: list[dict] = []

    for row in rows.iterator():
        approved_date = timezone.localtime(row["commission_approved_at"]).date()
        explicit_target = row["implementation_due_date"] is not None
        target_date = row["implementation_due_date"] or (
            approved_date + timedelta(days=target_days)
        )

        status = row["implementation_status"]
        implemented = status == ImplementationStatus.IMPLEMENTED
        failed = status == ImplementationStatus.NOT_IMPLEMENTED

        completed_date = None
        if implemented and row["implementation_completed_at"]:
            completed_date = timezone.localtime(row["implementation_completed_at"]).date()

        within_target = implemented and completed_date is not None and completed_date <= target_date
        overdue = not implemented and not failed and target_date < today

        ministry_bucket = by_ministry.setdefault(
            row["ministry_id"],
            {
                "ministry_id": row["ministry_id"],
                "ministry": row["ministry__name"],
                "ministry_code": row["ministry__code"],
                **_new_bucket(),
            },
        )
        quarter_bucket = by_quarter.setdefault(
            _quarter_label(approved_date), _new_bucket()
        )

        for bucket in (overall, ministry_bucket, quarter_bucket):
            bucket["total"] += 1
            if explicit_target:
                bucket["explicit_target"] += 1
            if implemented:
                bucket["implemented"] += 1
                if completed_date is None:
                    bucket["missing_timing"] += 1
                elif within_target:
                    bucket["implemented_within_target"] += 1
                    bucket["_days"].append((completed_date - approved_date).days)
                else:
                    bucket["implemented_late"] += 1
                    bucket["_days"].append((completed_date - approved_date).days)
            elif failed:
                bucket["not_implemented"] += 1
            elif overdue:
                bucket["overdue"] += 1
            else:
                bucket["in_progress"] += 1

        if overdue:
            overdue_rows.append(
                {
                    "id": row["id"],
                    "reference_number": row["reference_number"],
                    "title": row["title"],
                    "ministry": row["ministry__name"],
                    "approved_on": approved_date.isoformat(),
                    "target_date": target_date.isoformat(),
                    "days_overdue": (today - target_date).days,
                    "stage": row["current_stage"],
                }
            )

    ministries = [_finalise(b) for b in by_ministry.values()]
    # Worst-first: lowest % within target on top — that sort is the
    # accountability feature.
    ministries.sort(key=lambda b: (b["pct_within_target"], -b["overdue"]))

    quarters = [
        {"quarter": label, **_finalise(bucket)}
        for label, bucket in sorted(by_quarter.items())
    ]

    overdue_rows.sort(key=lambda r: r["days_overdue"], reverse=True)

    return {
        "generated_at": timezone.now().isoformat(),
        "target_days": target_days,
        "filters": {
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "ministry": ministry_id,
        },
        "overall": _finalise(overall),
        "by_ministry": ministries,
        "quarterly": quarters,
        "top_overdue": overdue_rows[:15],
    }


# ── Quarterly PDF (WeasyPrint) ────────────────────────────────────────────────


def render_implementation_report_pdf(report) -> None:
    """Build the rollup for the report's period and write the PDF file.

    Mirrors the minutes PDF pipeline: Django template → WeasyPrint.
    Synchronous — callers wanting async wrap this in a Celery task.
    """
    from io import BytesIO

    from django.core.files.base import ContentFile
    from django.template.loader import render_to_string
    from weasyprint import HTML

    from tracker.models import WorkflowStage

    rollup = build_implementation_rollup(
        date_from=report.period_start, date_to=report.period_end
    )
    stage_labels = dict(WorkflowStage.choices)
    for row in rollup["top_overdue"]:
        row["stage"] = stage_labels.get(row["stage"], row["stage"])

    html = render_to_string(
        "tracker/implementation_dashboard_pdf.html",
        {
            "report": report,
            "rollup": rollup,
            "overall": rollup["overall"],
            "ministries": rollup["by_ministry"],
            "quarters": rollup["quarterly"],
            "top_overdue": rollup["top_overdue"],
            "generated_on": timezone.localdate(),
        },
    )

    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)

    filename = f"implementation_report_{report.label.replace(' ', '_').lower()}.pdf"
    report.summary = rollup["overall"]
    report.target_days = rollup["target_days"]
    report.pdf_file.save(filename, ContentFile(buf.read()), save=False)
    report.save(update_fields=["summary", "target_days", "pdf_file"])
