"""
Smart Report spec vocabulary + construction/validation (Submissions domain).

The *spec* is the single source of truth the Quarto renderer consumes. It is produced
from a `ReportTemplate` (guided builder) via `build_template_spec`, or — internally — from
an AI proposal that `validate_spec` constrains to the allowed vocabulary below.

Report *templates* are stored in the database (tracker.models.ReportTemplate); the initial
set is seeded in migration 0129. This module owns only the validated vocabulary and the
spec builders — never persisted catalog data.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from .domains import get_resolver

# ── Allowed vocabulary (the renderer + validator enforce this) ───────────────
CHART_TYPES = {"bar", "column", "line", "pie"}

# Aggregate keys that are series ([{name, value}, ...]) → usable by charts.
LIST_SOURCES = {"by_stage", "by_ministry", "by_category", "by_month", "turnaround_buckets"}

# Scalar aggregate keys → usable by KPI cards.
KPI_SOURCES = {
    "total",
    "active",
    "overdue_assessments",
    "decided_total",
    "turnaround_avg",
    "turnaround_median",
}

KPI_LABELS = {
    "total": "Total submissions",
    "active": "Active",
    "overdue_assessments": "Overdue assessments",
    "decided_total": "Decided",
    "turnaround_avg": "Avg turnaround (days)",
    "turnaround_median": "Median turnaround (days)",
}

TABLE_COLUMNS = [
    "reference_number",
    "title",
    "ministry",
    "department",
    "category",
    "stage",
    "created",
    "turnaround_days",
    "status",
]
TABLE_COLUMN_SET = set(TABLE_COLUMNS)
DEFAULT_TABLE_COLUMNS = ["reference_number", "title", "ministry", "stage", "created"]

SECTIONS = {"kpis", "charts", "table"}


def vocabulary() -> dict[str, Any]:
    """Allowed building blocks for the guided-builder UI."""
    return {
        "chart_types": sorted(CHART_TYPES),
        "chart_sources": sorted(LIST_SOURCES),
        "kpi_sources": [{"key": k, "label": KPI_LABELS.get(k, k)} for k in sorted(KPI_SOURCES)],
        "table_columns": list(TABLE_COLUMNS),
        "param_types": ["date", "ministry", "form_category", "stage", "bool"],
    }


def coerce_params(domain: str, raw: dict[str, Any] | None) -> dict[str, Any]:
    """Coerce/whitelist params against the domain resolver's schema."""
    raw = raw or {}
    resolver = get_resolver(domain)
    schema = resolver.param_schema() if resolver else {}
    clean: dict[str, Any] = {}
    for key, typ in schema.items():
        if key not in raw or raw[key] in (None, ""):
            continue
        val = raw[key]
        if typ == "int":
            try:
                clean[key] = int(val)
            except (TypeError, ValueError):
                continue
        elif typ == "bool":
            clean[key] = val in (True, "true", "True", 1, "1", "on")
        elif typ == "date":
            try:
                clean[key] = datetime.strptime(str(val)[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
            except (TypeError, ValueError):
                continue
        else:
            clean[key] = str(val)[:200]
    return clean


def _date_range_subtitle(params: dict[str, Any]) -> str:
    df, dt = params.get("date_from"), params.get("date_to")
    if df and dt:
        return f"{df} → {dt}"
    if df:
        return f"From {df}"
    if dt:
        return f"Up to {dt}"
    return "All dates"


def validate_spec(raw: dict[str, Any], *, domain: str = "submissions") -> dict[str, Any]:
    """Constrain a (template- or AI-proposed) spec to the allowed vocabulary. Never trusts
    free text for anything executable: only known sources/types/columns survive."""
    raw = raw or {}

    kpis = []
    for k in raw.get("kpis") or []:
        if isinstance(k, dict) and k.get("source") in KPI_SOURCES:
            kpis.append({
                "label": str(k.get("label") or KPI_LABELS.get(k["source"], k["source"]))[:60],
                "source": k["source"],
            })

    charts = []
    for c in raw.get("charts") or []:
        if not isinstance(c, dict):
            continue
        ctype = c.get("type")
        source = c.get("source")
        if ctype in CHART_TYPES and source in LIST_SOURCES:
            charts.append({
                "id": str(c.get("id") or source)[:40],
                "type": ctype,
                "title": str(c.get("title") or source.replace("_", " ").title())[:120],
                "source": source,
            })

    table_in = raw.get("table") or {}
    cols = [c for c in (table_in.get("columns") or []) if c in TABLE_COLUMN_SET]
    if not cols:
        cols = list(DEFAULT_TABLE_COLUMNS)

    narrative = str(raw.get("narrative_markdown") or "").strip()[:8000]
    for bad in ("<script", "<iframe", "javascript:"):
        if bad in narrative.lower():
            narrative = ""

    # Sensible defaults so a sparse spec still renders something useful.
    if not kpis and not charts:
        kpis = [{"label": KPI_LABELS["total"], "source": "total"},
                {"label": KPI_LABELS["active"], "source": "active"}]
        charts = [{"id": "by_stage", "type": "bar", "title": "By stage", "source": "by_stage"}]

    return {
        "domain": domain,
        "report_type": "adhoc",
        "title": str(raw.get("title") or "Submissions Report").strip()[:200],
        "subtitle": str(raw.get("subtitle") or "").strip()[:300],
        "params": coerce_params(domain, raw.get("params")),
        "sections": ["kpis", "charts", "table"],
        "kpis": kpis,
        "charts": charts,
        "table": {"columns": cols},
        "narrative_markdown": narrative,
    }


def build_template_spec(template, raw_params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build a render spec from a ReportTemplate + user-supplied params."""
    domain = template.domain or "submissions"
    merged = {**(template.default_params or {}), **(raw_params or {})}
    params = coerce_params(domain, merged)
    spec_in = template.spec or {}
    cleaned = validate_spec({**spec_in, "title": template.name}, domain=domain)
    cleaned["report_type"] = template.slug
    cleaned["params"] = params
    cleaned["subtitle"] = _date_range_subtitle(params)
    return cleaned
