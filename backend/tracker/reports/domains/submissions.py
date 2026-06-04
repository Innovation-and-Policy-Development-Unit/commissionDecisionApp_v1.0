"""
Submissions domain resolver for the Smart Report engine.

Reuses the application's RBAC-scoped submission queryset verbatim, so reports expose
exactly the same data the requesting user can already see elsewhere in SCDMS.
"""

from __future__ import annotations

import statistics
from datetime import datetime, timedelta
from typing import Any

from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.utils import timezone

from tracker.models import WorkflowStage

from .base import ResolvedDataset, register_resolver

# Caps so a single report can never serialize an unbounded dataset into data.json.
MAX_DETAIL_ROWS = 5000

_STAGE_LABELS = dict(WorkflowStage.choices)

ACTIVE_STAGES = [
    WorkflowStage.RECEIVED_BY_PSC,
    WorkflowStage.REGISTERED_ROUTED,
    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
    WorkflowStage.UNDER_ASSESSMENT,
    WorkflowStage.DEFERRED,
    WorkflowStage.RESUBMITTED,
    WorkflowStage.FORWARDED_TO_COMMISSION,
    WorkflowStage.COMMISSION_SITTING,
]
TERMINAL_STAGES = [
    WorkflowStage.APPROVED,
    WorkflowStage.REJECTED,
    WorkflowStage.RETURNED,
]


def _parse_date(val: Any):
    if not val:
        return None
    try:
        return datetime.strptime(str(val)[:10], "%Y-%m-%d")
    except (TypeError, ValueError):
        return None


def _turnaround_days(sub) -> int | None:
    """Approximate turnaround: received → last update, for decided submissions.

    Precise per-event timing is a later enhancement; created→last-update is a stable
    proxy for P1 and is only computed for terminal-stage submissions.
    """
    if sub.current_stage not in TERMINAL_STAGES:
        return None
    start = sub.received_at or sub.created_at
    end = sub.updated_at
    if not start or not end:
        return None
    return max((end - start).days, 0)


def _bucketize(days_values: list[int]) -> list[dict[str, Any]]:
    buckets = [
        ("0–7 days", lambda d: d <= 7),
        ("8–14 days", lambda d: 8 <= d <= 14),
        ("15–30 days", lambda d: 15 <= d <= 30),
        ("31–60 days", lambda d: 31 <= d <= 60),
        ("60+ days", lambda d: d > 60),
    ]
    return [
        {"name": label, "value": sum(1 for d in days_values if pred(d))}
        for label, pred in buckets
    ]


class SubmissionsResolver:
    key = "submissions"

    def param_schema(self) -> dict[str, str]:
        return {
            "date_from": "date",
            "date_to": "date",
            "ministry_id": "int",
            "form_category_id": "int",
            "stage": "str",
            "overdue_only": "bool",
        }

    def _queryset(self, *, user, params: dict[str, Any]):
        # Lazy import avoids a circular dependency (views imports models/serializers).
        from tracker.views import _submission_queryset_for

        qs = _submission_queryset_for(user)

        date_from = _parse_date(params.get("date_from"))
        date_to = _parse_date(params.get("date_to"))
        if date_from:
            qs = qs.filter(created_at__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__lt=date_to + timedelta(days=1))
        if params.get("ministry_id"):
            qs = qs.filter(ministry_id=params["ministry_id"])
        if params.get("form_category_id"):
            qs = qs.filter(form_category_id=params["form_category_id"])
        if params.get("stage"):
            qs = qs.filter(current_stage=params["stage"])
        if params.get("overdue_only"):
            qs = qs.filter(
                current_stage=WorkflowStage.UNDER_ASSESSMENT,
                assessment_deadline_at__isnull=False,
                assessment_deadline_at__lt=timezone.now(),
            )
        return qs

    def resolve(self, *, user, params: dict[str, Any]) -> ResolvedDataset:
        qs = self._queryset(user=user, params=params)

        total = qs.count()
        active = qs.filter(current_stage__in=ACTIVE_STAGES).count()
        overdue = qs.filter(
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            assessment_deadline_at__isnull=False,
            assessment_deadline_at__lt=timezone.now(),
        ).count()

        by_stage = [
            {"name": _STAGE_LABELS.get(r["current_stage"], r["current_stage"]), "value": r["c"]}
            for r in qs.values("current_stage").annotate(c=Count("id")).order_by("-c")
        ]
        by_ministry = [
            {"name": r["ministry__name"] or "—", "value": r["c"]}
            for r in qs.values("ministry__name").annotate(c=Count("id")).order_by("-c")[:20]
        ]
        by_category = [
            {"name": r["form_category__name"] or "—", "value": r["c"]}
            for r in qs.values("form_category__name").annotate(c=Count("id")).order_by("-c")[:20]
        ]
        by_month = [
            {"name": r["m"].strftime("%Y-%m") if r["m"] else "—", "value": r["c"]}
            for r in qs.annotate(m=TruncMonth("created_at"))
            .values("m")
            .annotate(c=Count("id"))
            .order_by("m")
        ]

        rows: list[dict[str, Any]] = []
        turnarounds: list[int] = []
        for sub in qs.order_by("-created_at")[:MAX_DETAIL_ROWS]:
            ta = _turnaround_days(sub)
            if ta is not None:
                turnarounds.append(ta)
            rows.append({
                "reference_number": sub.reference_number,
                "title": sub.title,
                "ministry": sub.ministry.name if sub.ministry_id else "",
                "department": sub.department.name if sub.department_id else "",
                "category": sub.form_category.name if sub.form_category_id else "",
                "stage": _STAGE_LABELS.get(sub.current_stage, sub.current_stage),
                "created": sub.created_at.date().isoformat() if sub.created_at else "",
                "turnaround_days": ta if ta is not None else "",
                "status": _STAGE_LABELS.get(sub.current_stage, sub.current_stage),
            })

        aggregates = {
            "total": total,
            "active": active,
            "overdue_assessments": overdue,
            "decided_total": len(turnarounds),
            "turnaround_avg": round(statistics.mean(turnarounds), 1) if turnarounds else 0,
            "turnaround_median": round(statistics.median(turnarounds), 1) if turnarounds else 0,
            "turnaround_buckets": _bucketize(turnarounds),
            "by_stage": by_stage,
            "by_ministry": by_ministry,
            "by_category": by_category,
            "by_month": by_month,
        }

        meta = {
            "row_count": total,
            "rows_shown": len(rows),
            "truncated": total > len(rows),
            "scope": "submissions",
            "filters": {k: v for k, v in params.items() if v not in (None, "")},
            "generated_at": timezone.localtime().strftime("%d %B %Y %H:%M"),
        }

        return ResolvedDataset(rows=rows, aggregates=aggregates, meta=meta)


register_resolver(SubmissionsResolver())
