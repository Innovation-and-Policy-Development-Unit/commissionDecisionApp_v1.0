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
from .render_helpers import COLUMN_LABELS

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

# Vocabulary of the Submissions domain. Other domains declare their own `vocab` on the
# resolver (same keys); `domain_vocab` picks the right one.
SUBMISSIONS_VOCAB: dict[str, Any] = {
    "kpi_labels": KPI_LABELS,
    "list_sources": LIST_SOURCES,
    "table_columns": TABLE_COLUMNS,
    "column_labels": COLUMN_LABELS,
    "default_table_columns": DEFAULT_TABLE_COLUMNS,
    "default_kpis": ["total", "active"],
    "default_charts": [("by_stage", "bar", "By stage")],
}

DOMAIN_LABELS = {
    "submissions": "Submissions",
    "pilot_adoption": "Pilot adoption",
    "stage_flow": "Stage flow",
    "integrity": "Integrity & access",
}


def domain_vocab(domain: str) -> dict[str, Any]:
    resolver = get_resolver(domain)
    return getattr(resolver, "vocab", None) or SUBMISSIONS_VOCAB


def vocabulary(domain: str | None = None) -> dict[str, Any]:
    """Allowed building blocks for the guided-builder UI (default: Submissions)."""
    domain = domain if domain in DOMAIN_LABELS else "submissions"
    v = domain_vocab(domain)
    return {
        "domain": domain,
        "domains": [{"key": k, "label": lbl} for k, lbl in DOMAIN_LABELS.items()],
        "chart_types": sorted(CHART_TYPES),
        "chart_sources": sorted(v["list_sources"]),
        "kpi_sources": [{"key": k, "label": v["kpi_labels"].get(k, k)} for k in sorted(v["kpi_labels"])],
        "table_columns": list(v["table_columns"]),
        "param_types": ["date", "ministry", "form_category", "stage", "routed_unit", "bool"],
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
    vocab = domain_vocab(domain)
    kpi_labels = vocab["kpi_labels"]
    list_sources = vocab["list_sources"]
    table_columns = set(vocab["table_columns"])

    kpis = []
    for k in raw.get("kpis") or []:
        if isinstance(k, dict) and k.get("source") in kpi_labels:
            kpis.append({
                "label": str(k.get("label") or kpi_labels.get(k["source"], k["source"]))[:60],
                "source": k["source"],
            })

    charts = []
    for c in raw.get("charts") or []:
        if not isinstance(c, dict):
            continue
        ctype = c.get("type")
        source = c.get("source")
        if ctype in CHART_TYPES and source in list_sources:
            charts.append({
                "id": str(c.get("id") or source)[:40],
                "type": ctype,
                "title": str(c.get("title") or source.replace("_", " ").title())[:120],
                "source": source,
            })

    table_in = raw.get("table") or {}
    cols = [c for c in (table_in.get("columns") or []) if c in table_columns]
    if not cols:
        cols = list(vocab["default_table_columns"])

    narrative = str(raw.get("narrative_markdown") or "").strip()[:8000]
    for bad in ("<script", "<iframe", "javascript:"):
        if bad in narrative.lower():
            narrative = ""

    # Sensible defaults so a sparse spec still renders something useful.
    if not kpis and not charts:
        kpis = [{"label": kpi_labels[k], "source": k} for k in vocab["default_kpis"]]
        charts = [
            {"id": source, "type": ctype, "title": title, "source": source}
            for source, ctype, title in vocab["default_charts"]
        ]

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
    cleaned["table"]["labels"] = dict(domain_vocab(domain)["column_labels"])
    return cleaned
