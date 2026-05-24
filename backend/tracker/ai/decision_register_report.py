"""
AI interprets a natural-language report request into a validated filter spec + narrative.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import get_model_tier

logger = logging.getLogger("scdms.app")

ALLOWED_FILTER_KEYS = frozenset({
    "date_from",
    "date_to",
    "status",
    "manager_id",
    "action_unit",
    "decision_outcome",
    "implementation_status",
    "decision_type",
    "overdue_only",
    "open_only",
})

ALLOWED_COLUMNS = frozenset({
    "decision_number",
    "title",
    "submission_ref",
    "submission_title",
    "meeting_ref",
    "decision_outcome",
    "decision_detail",
    "action_unit",
    "implementation_status",
    "way_forward",
    "manager",
    "staff",
    "status",
    "due_date",
    "decision_type",
    "subtask_count",
    "subtask_completed",
    "days_overdue",
})

SYSTEM = """You are a reporting assistant for the Public Service Commission of Vanuatu
Commission Decision Register (post-decision implementation tracker).

Given the user's natural-language request and a JSON summary of available data,
produce a report specification as JSON only.

Rules:
- Only use filter keys from: date_from, date_to, status, manager_id, action_unit,
  decision_outcome, implementation_status, decision_type, overdue_only, open_only.
- status values: open, in_progress, completed, cancelled
- action_unit values: CIU, CSU, FHU, HRMU, ODU, OPSC_Secretary, VIPAM_HRDU
- decision_outcome: approved, deferred_next, deferred_info, rejected
- implementation_status: with_unit, matters_arising, actioned, now_irrelevant
- decision_type: appointment, discipline, policy_change, termination, promotion, other
- columns must be chosen from the allowed column list provided in the user message
- narrative_markdown: professional English summary (markdown, no HTML). Max 400 words.
- title: short report title; subtitle: optional one line
- If the request is vague, default to a sensible register overview for the date range implied

Output schema:
{
  "title": "string",
  "subtitle": "string",
  "filters": { },
  "columns": ["decision_number", "title", ...],
  "narrative_markdown": "string",
  "include_summary": true
}"""


def _sanitize_spec(raw: dict[str, Any]) -> dict[str, Any]:
    filters = raw.get("filters") or {}
    if not isinstance(filters, dict):
        filters = {}
    clean_filters = {}
    for key, val in filters.items():
        if key not in ALLOWED_FILTER_KEYS:
            continue
        if val is None or val == "":
            continue
        if key in ("overdue_only", "open_only"):
            clean_filters[key] = bool(val)
        elif key == "manager_id":
            try:
                clean_filters[key] = int(val)
            except (TypeError, ValueError):
                pass
        else:
            clean_filters[key] = str(val)

    columns = raw.get("columns") or []
    if not isinstance(columns, list):
        columns = []
    clean_columns = [c for c in columns if c in ALLOWED_COLUMNS]
    if not clean_columns:
        clean_columns = [
            "decision_number",
            "title",
            "submission_ref",
            "decision_outcome",
            "action_unit",
            "manager",
            "implementation_status",
            "status",
            "due_date",
            "days_overdue",
        ]

    title = str(raw.get("title") or "Commission Decision Register Report").strip()[:200]
    subtitle = str(raw.get("subtitle") or "").strip()[:300]
    narrative = str(raw.get("narrative_markdown") or "").strip()[:8000]
    # Strip risky raw HTML tags from AI narrative
    for tag in ("<script", "<iframe", "javascript:"):
        if tag.lower() in narrative.lower():
            narrative = ""

    return {
        "title": title,
        "subtitle": subtitle,
        "filters": clean_filters,
        "columns": clean_columns,
        "narrative_markdown": narrative,
        "include_summary": bool(raw.get("include_summary", True)),
    }


def interpret_report_request(
    *,
    user_prompt: str,
    data_summary: dict[str, Any],
    extra_filters: dict[str, Any] | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (spec, error_message)."""
    if not ai_enabled():
        return None, "AI is not configured (ANTHROPIC_API_KEY missing)."

    prompt = user_prompt.strip()
    if not prompt:
        return None, "Describe the report you need."

    user_msg = json.dumps(
        {
            "user_request": prompt,
            "ui_filters": extra_filters or {},
            "data_summary": data_summary,
            "allowed_columns": sorted(ALLOWED_COLUMNS),
        },
        indent=2,
        default=str,
    )

    data, err = complete_json_with_error(
        system=SYSTEM,
        user=user_msg,
        tier=get_model_tier("C1_nl_report"),
        max_tokens=4096,
    )
    if not data:
        return None, err or "Could not interpret report request."

    if not isinstance(data, dict):
        return None, "AI returned an invalid report specification."

    spec = _sanitize_spec(data)
    # UI date filters override when provided
    if extra_filters:
        for key in ("date_from", "date_to", "status", "manager_id"):
            if extra_filters.get(key):
                spec["filters"][key] = extra_filters[key]

    return spec, None
