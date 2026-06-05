"""
Query validator + executor for SCDMS Intelligence.

Translates a validated `query_spec` into a Django ORM aggregation over the dataset's
RBAC-scoped queryset. Only declared dimensions/metrics/filter-ops are honoured (the AI
and the UI both go through this whitelist); there is no raw SQL and every value is
ORM-parameterised.
"""

from __future__ import annotations

from typing import Any

from django.db.models import Avg, Count, Sum
from django.db.models.functions import (
    TruncDay,
    TruncMonth,
    TruncQuarter,
    TruncWeek,
    TruncYear,
)

from .datasets import get_dataset

TRUNC = {
    "day": TruncDay,
    "week": TruncWeek,
    "month": TruncMonth,
    "quarter": TruncQuarter,
    "year": TruncYear,
}
TIME_GRAINS = set(TRUNC)
FILTER_OPS = {"=", "!=", "in", "contains", "gte", "lte"}
CHART_TYPES = {"bar", "column", "line", "area", "pie", "table", "number"}
MAX_ROWS = 5000
DEFAULT_ROW_LIMIT = 1000


def _agg_for(metric):
    if metric.agg == "count":
        return Count("id")
    if metric.agg == "sum" and metric.column:
        return Sum(metric.column)
    if metric.agg == "avg" and metric.column:
        return Avg(metric.column)
    return Count("id")


def _apply_filters(qs, filters, dims, tdims):
    for f in filters or []:
        if not isinstance(f, dict):
            continue
        col, op, val = f.get("col"), f.get("op"), f.get("val")
        if (col not in dims and col not in tdims) or op not in FILTER_OPS:
            continue
        if op == "=":
            qs = qs.filter(**{col: val})
        elif op == "!=":
            qs = qs.exclude(**{col: val})
        elif op == "in" and isinstance(val, list):
            qs = qs.filter(**{f"{col}__in": val})
        elif op == "contains":
            qs = qs.filter(**{f"{col}__icontains": val})
        elif op == "gte":
            qs = qs.filter(**{f"{col}__gte": val})
        elif op == "lte":
            qs = qs.filter(**{f"{col}__lte": val})
    return qs


def execute_query(*, user, dataset_key: str, spec: dict[str, Any]) -> dict[str, Any]:
    ds = get_dataset(dataset_key)
    if not ds:
        raise ValueError(f"Unknown dataset '{dataset_key}'.")

    dims = {d.key: d for d in ds.dimensions()}
    tdims = {d.key: d for d in ds.time_dimensions()}
    metrics = {m.key: m for m in ds.metrics()}

    qs = _apply_filters(ds.queryset(user), spec.get("filters"), dims, tdims)

    columns: list[dict[str, Any]] = []
    value_fields: list[str] = []
    pre_annotations: dict[str, Any] = {}

    # ── X axis (a category dimension or a time dimension + grain) ──────────────
    x = spec.get("x") or {}
    xdim = x.get("dimension")
    x_out = None
    if xdim in tdims:
        grain = x.get("time_grain") if x.get("time_grain") in TIME_GRAINS else "month"
        pre_annotations["x_bucket"] = TRUNC[grain](xdim)
        value_fields.append("x_bucket")
        x_out = "x_bucket"
        columns.append({"key": "x_bucket", "label": tdims[xdim].label, "role": "dimension", "kind": "time"})
    elif xdim in dims:
        value_fields.append(xdim)
        x_out = xdim
        columns.append({"key": xdim, "label": dims[xdim].label, "role": "dimension", "kind": "category"})

    # ── Breakdown (series) dimensions ──────────────────────────────────────────
    breakdown: list[str] = []
    for d in spec.get("dimensions") or []:
        if d in dims and d != xdim and d not in breakdown:
            value_fields.append(d)
            breakdown.append(d)
            columns.append({"key": d, "label": dims[d].label, "role": "breakdown", "kind": "category"})

    # ── Metrics ────────────────────────────────────────────────────────────────
    metric_aggs: dict[str, Any] = {}
    for m in spec.get("metrics") or [{"key": "count"}]:
        mk = m.get("key") if isinstance(m, dict) else m
        if mk in metrics and mk not in metric_aggs:
            metric_aggs[mk] = _agg_for(metrics[mk])
            columns.append({"key": mk, "label": metrics[mk].label, "role": "metric"})
    if not metric_aggs:
        metric_aggs["count"] = Count("id")
        columns.append({"key": "count", "label": "Count", "role": "metric"})
    primary_metric = next(iter(metric_aggs))

    # ── No grouping → single aggregate (big-number) ────────────────────────────
    if not value_fields:
        agg = qs.aggregate(**metric_aggs)
        return {
            "columns": [c for c in columns if c["role"] == "metric"],
            "rows": [agg],
            "meta": {"row_count": 1, "x": None, "breakdown": None, "metric": primary_metric, "cached": False},
        }

    q = qs
    if pre_annotations:
        q = q.annotate(**pre_annotations)
    q = q.values(*value_fields).annotate(**metric_aggs)

    # ── Sort ───────────────────────────────────────────────────────────────────
    sort = spec.get("sort") or {}
    if x_out == "x_bucket":
        q = q.order_by("x_bucket")  # chronological for time series
    else:
        sort_by = sort.get("by")
        if sort_by not in set(metric_aggs) | set(value_fields):
            sort_by = primary_metric
        prefix = "-" if (sort.get("dir", "desc") == "desc") else ""
        q = q.order_by(f"{prefix}{sort_by}")

    row_limit = spec.get("row_limit") or DEFAULT_ROW_LIMIT
    try:
        row_limit = min(int(row_limit), MAX_ROWS)
    except (TypeError, ValueError):
        row_limit = DEFAULT_ROW_LIMIT

    rows: list[dict[str, Any]] = []
    for r in q[:row_limit]:
        out = dict(r)
        if out.get("x_bucket") is not None:
            b = out["x_bucket"]
            out["x_bucket"] = b.date().isoformat() if hasattr(b, "date") else str(b)
        for d in ([xdim] + breakdown):
            if d in dims and dims[d].choices and out.get(d) is not None:
                out[d] = dims[d].choices.get(out[d], out[d])
        rows.append(out)

    return {
        "columns": columns,
        "rows": rows,
        "meta": {
            "row_count": len(rows),
            "x": x_out,
            "breakdown": breakdown[0] if breakdown else None,
            "metric": primary_metric,
            "cached": False,
        },
    }
