"""
PSC Report engine — statistics dataset, generated from system data.

Builds the dataset behind the Commission's reporting for any period (a full
calendar year, a quarter, a month, or an on-the-go custom range): submission
intake, sittings held and their agenda load, decisions and outcomes, processing
timeliness, implementation performance, post-decision action items, and the
decision service/acknowledgement record. Every figure is derived from the
workflow record (WorkflowEvent timestamps and milestone fields), so the
numbers handed to Parliament are the numbers the system actually observed.

`build_report_dataset(start, end, ...)` is the general entry point;
`build_annual_report_dataset(year)` is a thin calendar-year wrapper kept for the
yearly schedule and existing callers.
"""

from __future__ import annotations

import calendar
from collections import Counter
from datetime import date, datetime, time

from django.utils import timezone

DECISION_STAGES = ["approved", "rejected", "returned"]

# Output sections a caller may include/exclude. `period` is always emitted.
ALL_SECTIONS = [
    "intake", "sittings", "decisions", "timeliness",
    "implementation", "tasks", "decision_service", "ministries",
]


def _period_bounds(start_date: date, end_date: date):
    """Inclusive timezone-aware datetime bounds for a [start, end] date range."""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(start_date, time.min), tz)
    end = timezone.make_aware(datetime.combine(end_date, time.max), tz)
    return start, end


def _as_date(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def resolve_period(
    period_type: str | None,
    *,
    year=None,
    quarter=None,
    month=None,
    date_from=None,
    date_to=None,
):
    """Resolve a period selector into (start_dt, end_dt, label, key).

    period_type ∈ {annual, quarterly, monthly, custom}. Falls back to the
    previous calendar year when nothing usable is supplied.
    """
    period_type = (period_type or "annual").lower()
    today = timezone.localdate()

    def _int(value, default):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    if period_type == "quarterly":
        y = _int(year, today.year)
        q = min(4, max(1, _int(quarter, 1)))
        start_month = (q - 1) * 3 + 1
        end_month = start_month + 2
        start = date(y, start_month, 1)
        end = date(y, end_month, calendar.monthrange(y, end_month)[1])
        return (*_period_bounds(start, end), f"Q{q} {y}", f"{y}-Q{q}")

    if period_type == "monthly":
        y = _int(year, today.year)
        m = min(12, max(1, _int(month, today.month)))
        start = date(y, m, 1)
        end = date(y, m, calendar.monthrange(y, m)[1])
        return (*_period_bounds(start, end), start.strftime("%B %Y"), f"{y}-{m:02d}")

    if period_type == "custom":
        df = _as_date(date_from) or today.replace(day=1)
        dt = _as_date(date_to) or today
        if dt < df:
            df, dt = dt, df
        label = f"{df.strftime('%d %b %Y')} – {dt.strftime('%d %b %Y')}"
        return (*_period_bounds(df, dt), label, f"{df.isoformat()}_{dt.isoformat()}")

    # Default: full calendar year (previous year when unspecified).
    y = _int(year, today.year - 1)
    start = date(y, 1, 1)
    end = date(y, 12, 31)
    return (*_period_bounds(start, end), f"Calendar year {y}", str(y))


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
    """Calendar-year wrapper kept for the yearly schedule and prior callers."""
    start, end, label, key = resolve_period("annual", year=year)
    return build_report_dataset(
        start, end,
        period={"type": "annual", "label": label, "key": key},
    )


def build_report_dataset(start, end, *, include=None, period=None) -> dict:
    from django.db.models import Count

    from tracker.models import (
        CommissionTask,
        DecisionService,
        Meeting,
        MeetingType,
        Submission,
        WorkflowStage,
    )
    from tracker.reports.implementation_rollup import build_implementation_rollup

    today = timezone.localdate()
    sections = set(include) if include else set(ALL_SECTIONS)
    period = period or {
        "type": "custom",
        "label": f"{timezone.localtime(start).date().isoformat()}"
                 f" – {timezone.localtime(end).date().isoformat()}",
        "key": f"{timezone.localtime(start).date().isoformat()}"
               f"_{timezone.localtime(end).date().isoformat()}",
    }

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

    # ── 2. Sittings and their agenda load ────────────────────────────────────
    sittings = Meeting.objects.filter(
        date__range=(start.date(), end.date()), status="completed",
    )
    sittings_by_type = Counter(sittings.values_list("type", flat=True))
    type_labels = dict(MeetingType.choices)

    sitting_detail = []
    agenda_counts: list[int] = []
    for row in sittings.annotate(n_agenda=Count("agenda_items")).order_by("date").values(
        "date", "type", "n_agenda",
    ).iterator():
        agenda_counts.append(row["n_agenda"])
        sitting_detail.append({
            "date": row["date"].isoformat() if row["date"] else None,
            "type": type_labels.get(row["type"], row["type"]),
            "agenda_count": row["n_agenda"],
        })
    total_agenda_items = sum(agenda_counts)

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

    full = {
        "year": timezone.localtime(start).year,
        "period": {
            "type": period.get("type"),
            "label": period.get("label"),
            "key": period.get("key"),
            "start": timezone.localtime(start).date().isoformat(),
            "end": timezone.localtime(end).date().isoformat(),
        },
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
            "detail": sitting_detail,
            "total_agenda_items": total_agenda_items,
            "avg_agenda_per_sitting": (
                round(total_agenda_items / len(agenda_counts), 1)
                if agenda_counts else 0
            ),
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

    # Drop excluded sections; period/year/timestamps are always retained.
    return {
        k: v for k, v in full.items()
        if k not in ALL_SECTIONS or k in sections
    }


def _dataset_for(report) -> dict:
    """Frozen dataset if present, else rebuild from the report's period."""
    if report.dataset:
        return report.dataset
    if getattr(report, "period_start", None) and getattr(report, "period_end", None):
        start, end = _period_bounds(report.period_start, report.period_end)
        return build_report_dataset(
            start, end,
            include=(report.options or {}).get("include"),
            period={
                "type": report.period_type,
                "label": report.period_label,
                "key": report.period_label,
            },
        )
    return build_annual_report_dataset(report.year)


def render_report_pdf(report) -> None:
    """Render the statistics chapter as a formal PDF (WeasyPrint)."""
    from io import BytesIO

    from django.core.files.base import ContentFile
    from django.template.loader import render_to_string
    from weasyprint import HTML

    dataset = _dataset_for(report)
    month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    monthly = [
        {**row, "name": month_names[row["month"] - 1]}
        for row in (dataset.get("intake", {}).get("monthly") or [])
    ]
    period_key = (dataset.get("period") or {}).get("key") or str(report.year)
    include = [s for s in ALL_SECTIONS if s in dataset]

    html = render_to_string("tracker/annual_report_pdf.html", {
        "report": report,
        "d": dataset,
        "monthly": monthly,
        "include": include,
        "period_key": period_key,
        "generated_on": timezone.localdate(),
    })

    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)

    report.dataset = dataset
    report.pdf_file.save(
        f"psc_report_statistics_{period_key}.pdf",
        ContentFile(buf.read()),
        save=False,
    )
    report.save(update_fields=["dataset", "pdf_file"])


# Back-compat alias for the yearly schedule and existing callers.
render_annual_report_pdf = render_report_pdf
