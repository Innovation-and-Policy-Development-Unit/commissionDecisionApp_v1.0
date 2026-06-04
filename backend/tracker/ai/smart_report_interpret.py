"""
Ad-hoc Smart Report interpreter (Submissions domain).

Claude maps a natural-language request to a *spec* (the same shape the catalog
produces). The model never returns code or HTML — only a JSON spec drawn from a fixed
vocabulary, which `validate_spec` then enforces before the renderer ever sees it.
"""

from __future__ import annotations

import json
from typing import Any

from ..reports.catalog import (
    CHART_TYPES,
    KPI_SOURCES,
    LIST_SOURCES,
    TABLE_COLUMNS,
    validate_spec,
)
from .claude_client import ai_enabled, complete_json_with_error

SYSTEM = """You are the reporting assistant for the Public Service Commission of Vanuatu
(SCDMS). Convert the user's natural-language request into a report SPECIFICATION as JSON
only. The report is always about SUBMISSIONS.

You do NOT write code, SQL, or HTML. You ONLY choose from the fixed vocabulary below.

KPI sources (scalar cards): total, active, overdue_assessments, decided_total,
  turnaround_avg, turnaround_median
Chart types: bar, column, line, pie
Chart sources (series data): by_stage, by_ministry, by_category, by_month,
  turnaround_buckets
Table columns: reference_number, title, ministry, department, category, stage, created,
  turnaround_days, status

Guidance:
- Pick KPIs + 1-3 charts + a sensible table that answer the request.
- "trend / over time / monthly" → a line chart on by_month.
- "by ministry / by category / by stage" → a bar chart on the matching source.
- "turnaround / how long / aging" → turnaround_buckets (column) + turnaround KPIs.
- title: short; subtitle: optional one line.
- narrative_markdown: a short professional English summary (markdown, no HTML, <=300 words).
- params: optional {date_from, date_to, ministry_id, form_category_id, stage, overdue_only}.

Output schema:
{
  "title": "string",
  "subtitle": "string",
  "params": {},
  "kpis": [{"label": "string", "source": "total"}],
  "charts": [{"id": "by_ministry", "type": "bar", "title": "By ministry", "source": "by_ministry"}],
  "table": {"columns": ["reference_number", "title", "ministry", "stage", "created"]},
  "narrative_markdown": "string"
}"""


def interpret_submissions_report(
    *,
    user_prompt: str,
    data_summary: dict[str, Any],
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (validated_spec, error_message)."""
    if not ai_enabled():
        return None, "AI is not configured (ANTHROPIC_API_KEY missing)."

    prompt = (user_prompt or "").strip()
    if not prompt:
        return None, "Describe the report you need."

    user_msg = json.dumps(
        {
            "user_request": prompt,
            "data_summary": data_summary,
            "vocabulary": {
                "kpi_sources": sorted(KPI_SOURCES),
                "chart_types": sorted(CHART_TYPES),
                "chart_sources": sorted(LIST_SOURCES),
                "table_columns": list(TABLE_COLUMNS),
            },
        },
        indent=2,
        default=str,
    )

    data, err = complete_json_with_error(
        system=SYSTEM,
        user=user_msg,
        tier="sonnet",
        max_tokens=4096,
    )
    if not data:
        return None, err or "Could not interpret the report request."
    if not isinstance(data, dict):
        return None, "AI returned an invalid report specification."

    return validate_spec(data, domain="submissions"), None
