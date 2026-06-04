"""
Smart Report catalog + spec construction/validation (Submissions domain).

The *spec* is the single source of truth the Quarto renderer consumes. Two paths
produce it:

  - catalog  → `build_catalog_spec(report_type, params)` — deterministic, no AI.
  - ad-hoc   → AI proposes a spec, then `validate_spec()` constrains it to the
               allowed vocabulary below.
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

# ── Catalog definitions ──────────────────────────────────────────────────────
CATALOG: dict[str, dict[str, Any]] = {
    "submissions_volume_turnaround": {
        "domain": "submissions",
        "title": "Submission Volume & Turnaround",
        "description": "Monthly submission volume, turnaround distribution, and breakdown by ministry.",
        "params": [
            {"key": "date_from", "type": "date", "label": "From"},
            {"key": "date_to", "type": "date", "label": "To"},
            {"key": "ministry_id", "type": "ministry", "label": "Ministry", "optional": True},
        ],
        "sections": ["kpis", "charts", "table"],
        "kpis": [
            {"label": "Total submissions", "source": "total"},
            {"label": "Active", "source": "active"},
            {"label": "Avg turnaround (days)", "source": "turnaround_avg"},
            {"label": "Median turnaround (days)", "source": "turnaround_median"},
        ],
        "charts": [
            {"id": "volume_trend", "type": "line", "title": "Submissions per month", "source": "by_month"},
            {"id": "by_ministry", "type": "bar", "title": "By ministry", "source": "by_ministry"},
            {"id": "turnaround", "type": "column", "title": "Turnaround distribution", "source": "turnaround_buckets"},
        ],
        "table": {"columns": ["reference_number", "title", "ministry", "stage", "created", "turnaround_days"]},
    },
    "submissions_by_ministry": {
        "domain": "submissions",
        "title": "Submissions by Ministry",
        "description": "Volume by ministry and form category, with current workload.",
        "params": [
            {"key": "date_from", "type": "date", "label": "From"},
            {"key": "date_to", "type": "date", "label": "To"},
            {"key": "stage", "type": "stage", "label": "Stage", "optional": True},
        ],
        "sections": ["kpis", "charts", "table"],
        "kpis": [
            {"label": "Total submissions", "source": "total"},
            {"label": "Active", "source": "active"},
            {"label": "Overdue assessments", "source": "overdue_assessments"},
        ],
        "charts": [
            {"id": "by_ministry", "type": "bar", "title": "By ministry", "source": "by_ministry"},
            {"id": "by_category", "type": "bar", "title": "By form category", "source": "by_category"},
        ],
        "table": {"columns": ["reference_number", "title", "ministry", "category", "stage", "created"]},
    },
    "submissions_stage_pipeline": {
        "domain": "submissions",
        "title": "Stage Pipeline & Aging",
        "description": "Where submissions sit in the workflow and how long they have been in scope.",
        "params": [
            {"key": "date_from", "type": "date", "label": "From"},
            {"key": "date_to", "type": "date", "label": "To"},
            {"key": "ministry_id", "type": "ministry", "label": "Ministry", "optional": True},
            {"key": "overdue_only", "type": "bool", "label": "Overdue assessments only", "optional": True},
        ],
        "sections": ["kpis", "charts", "table"],
        "kpis": [
            {"label": "Total submissions", "source": "total"},
            {"label": "Active", "source": "active"},
            {"label": "Overdue assessments", "source": "overdue_assessments"},
        ],
        "charts": [
            {"id": "by_stage", "type": "bar", "title": "By stage", "source": "by_stage"},
            {"id": "turnaround", "type": "column", "title": "Turnaround distribution", "source": "turnaround_buckets"},
        ],
        "table": {"columns": ["reference_number", "title", "ministry", "stage", "created", "turnaround_days"]},
    },
}


def catalog_for_api() -> list[dict[str, Any]]:
    """Catalog cards + param schemas for the frontend."""
    return [
        {
            "key": key,
            "domain": entry["domain"],
            "title": entry["title"],
            "description": entry.get("description", ""),
            "params": entry.get("params", []),
        }
        for key, entry in CATALOG.items()
    ]


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


def build_catalog_spec(report_type: str, raw_params: dict[str, Any] | None) -> dict[str, Any]:
    """Deterministically build a render spec from a catalog entry + user params."""
    entry = CATALOG.get(report_type)
    if not entry:
        raise KeyError(f"Unknown report type: {report_type}")
    domain = entry["domain"]
    params = coerce_params(domain, raw_params)
    return {
        "domain": domain,
        "report_type": report_type,
        "title": entry["title"],
        "subtitle": _date_range_subtitle(params),
        "params": params,
        "sections": entry.get("sections", list(SECTIONS)),
        "kpis": entry.get("kpis", []),
        "charts": entry.get("charts", []),
        "table": entry.get("table", {"columns": DEFAULT_TABLE_COLUMNS}),
        "narrative_markdown": "",
    }


def validate_spec(raw: dict[str, Any], *, domain: str = "submissions") -> dict[str, Any]:
    """Constrain an (AI-proposed) spec to the allowed vocabulary. Never trusts free text
    for anything executable: only known sources/types/columns survive."""
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

    # Sensible defaults so a sparse AI spec still renders something useful.
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
