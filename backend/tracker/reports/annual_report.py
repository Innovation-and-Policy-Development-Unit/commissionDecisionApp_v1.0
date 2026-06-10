"""
PSC Annual Report — statistics chapter, generated from system data.

Builds the calendar-year dataset behind the Commission's statutory reporting:
submission intake, sittings held, decisions and outcomes, processing
timeliness, implementation performance, post-decision action items, and the
decision service/acknowledgement record. Every figure is derived from the
workflow record (WorkflowEvent timestamps and milestone fields), so the
numbers handed to Parliament are the numbers the system actually observed.
"""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime, time

from django.utils import timezone

DECISION_STAGES = ["approved", "rejected", "returned"]


def _year_bounds(year: int):
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(date(year, 1, 1), time.min), tz)
    end = timezone.make_aware(datetime.combine(date(year, 12, 31), time.max), tz)
    return start, end


def _median(values: list[int]) -> int | None:
    if not values:
        return None
    values = sorted(values)
    mid = len(values) // 2
    if len(values) % 2:
        return values[mid]
    return round((values[mid - 1] + values[mid]) / 2)


def _avg(values: list[int]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def _first_decisions(start, end) -> dict[int, dict]:
    """First Commission decision per submission recorded inside the year:
    {submission_id: {outcome, decided_at}}."""
    from tracker.models import WorkflowEvent

    decided: dict[int, dict] = {}
    events = (
        WorkflowEvent.objects.filter(
            new_stage__in=DECISION_STAGES,
            created_at__range=(start, end),
        )
        .order_by("created_at")
        .values("submission_id", "new_stage", "created_at")
    )
    for event in events.iterator():
        decided.setdefault(event["submission_id"], {
            "outcome": event["new_stage"],
            "decided_at": event["created_at"],
        })
    return decided


def build_annual_report_dataset(year: int) -> dict:
    from tracker.models import (
        CommissionTask,
        DecisionService,
        Meeting,
        MeetingType,
        Submission,
        WorkflowStage,
    )
    from tracker.reports.implementation_rollup import build_implementation_rollup

    start, end = _year_bounds(year)
    today = timezone.localdate()

    # ── 1. Submission intake ─────────────────────────────────────────────────
    received = Submission.objects.filter(
        received_at__range=(start, end), is_attachment=False,
    )
    monthly = Counter()
    by_ministry: dict[int, dict] = {}
    by_category = Counter()
    for row in received.values(
        "received_at", "ministry_id", "ministry__name", "agenda_category", "form_type_code",
    ).iterator():
        monthly[timezone.localtime(row["received_at"]).month] += 1
        ministry = by_ministry.setdefault(row["ministry_id"], {
            "ministry": row["ministry__name"], "received": 0, "decided": 0,
            "approved": 0, "rejected": 0, "returned": 0,
        })
        ministry["received"] += 1
        by_category[row["agenda_category"] or row["form_type_code"] or "other"] += 1

    # ── 2. Sittings ──────────────────────────────────────────────────────────
    sittings = Meeting.objects.filter(
        date__range=(start.date(), end.date()), status="completed",
    )
    sittings_by_type = Counter(sittings.values_list("type", flat=True))
    type_labels = dict(MeetingType.choices)

    # ── 3. Decisions recorded in the year ────────────────────────────────────
    decided = _first_decisions(start, end)
    outcome_counts = Counter(d["outcome"] for d in decided.values())
    total_decided = len(decided)

    decided_rows = Submission.objects.filter(id__in=decided.keys()).values(
        "id", "ministry_id", "ministry__name", "received_at",
    )
    days_to_decision: list[int] = []
    for row in decided_rows.iterator():
        info = decided[row["id"]]
        ministry = by_ministry.setdefault(row["ministry_id"], {
            "ministry": row["ministry__name"], "received": 0, "decided": 0,
            "approved": 0, "rejected": 0, "returned": 0,
        })
        ministry["decided"] += 1
        ministry[info["outcome"]] += 1
        if row["received_at"]:
            days_to_decision.append(
                max(0, (info["decided_at"] - row["received_at"]).days)
            )

    # ── 4. Implementation performance (decisions approved in the year) ──────
    implementation = build_implementation_rollup(
        date_from=start.date(), date_to=end.date(),
    )

    # ── 5. Post-decision action items ────────────────────────────────────────
    tasks_created = CommissionTask.objects.filter(created_at__range=(start, end))
    tasks_completed = CommissionTask.objects.filter(
        status="completed", updated_at__range=(start, end),
    )

    # ── 6. Formal decision service ───────────────────────────────────────────
    services = DecisionService.objects.filter(served_at__range=(start, end))
    served_count = services.count()
    ack_days: list[int] = []
    acknowledged = 0
    for row in services.filter(acknowledged_at__isnull=False).values(
        "served_at", "acknowledged_at",
    ):
        acknowledged += 1
        ack_days.append(max(0, (row["acknowledged_at"] - row["served_at"]).days))

    ministries = sorted(
        by_ministry.values(), key=lambda m: m["received"], reverse=True,
    )
    stage_labels = dict(WorkflowStage.choices)

    return {
        "year": year,
        "generated_at": timezone.now().isoformat(),
        "intake": {
            "total_received": received.count(),
            "monthly": [
                {"month": m, "count": monthly.get(m, 0)} for m in range(1, 13)
            ],
            "by_category": [
                {"category": cat, "count": n}
                for cat, n in by_category.most_common()
            ],
        },
        "sittings": {
            "total": sittings.count(),
            "by_type": [
                {"type": type_labels.get(t, t), "count": n}
                for t, n in sittings_by_type.most_common()
            ],
        },
        "decisions": {
            "total_decided": total_decided,
            "approved": outcome_counts.get("approved", 0),
            "rejected": outcome_counts.get("rejected", 0),
            "returned": outcome_counts.get("returned", 0),
            "approval_rate": (
                round(outcome_counts.get("approved", 0) / total_decided * 100)
                if total_decided else 0
            ),
            "outcome_labels": {s: stage_labels.get(s, s) for s in DECISION_STAGES},
        },
        "timeliness": {
            "median_days_to_decision": _median(days_to_decision),
            "avg_days_to_decision": _avg(days_to_decision),
            "decisions_measured": len(days_to_decision),
        },
        "implementation": {
            "target_days": implementation["target_days"],
            "overall": implementation["overall"],
            "by_ministry": implementation["by_ministry"],
        },
        "tasks": {
            "created": tasks_created.count(),
            "completed": tasks_completed.count(),
        },
        "decision_service": {
            "served": served_count,
            "acknowledged": acknowledged,
            "pct_acknowledged": round(acknowledged / served_count * 100) if served_count else 0,
            "median_days_to_acknowledge": _median(ack_days),
        },
        "ministries": ministries,
        "as_of": today.isoformat(),
    }


def render_annual_report_pdf(report) -> None:
    """Render the statistics chapter as a formal PDF (WeasyPrint)."""
    from io import BytesIO

    from django.core.files.base import ContentFile
    from django.template.loader import render_to_string
    from weasyprint import HTML

    dataset = report.dataset or build_annual_report_dataset(report.year)
    month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    monthly = [
        {**row, "name": month_names[row["month"] - 1]}
        for row in dataset["intake"]["monthly"]
    ]

    html = render_to_string("tracker/annual_report_pdf.html", {
        "report": report,
        "d": dataset,
        "monthly": monthly,
        "generated_on": timezone.localdate(),
    })

    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)

    report.dataset = dataset
    report.pdf_file.save(
        f"psc_annual_report_statistics_{report.year}.pdf",
        ContentFile(buf.read()),
        save=False,
    )
    report.save(update_fields=["dataset", "pdf_file"])
