"""Natural-language smart search → filter JSON for submission list API (Sonnet)."""

from __future__ import annotations

import json
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

ALLOWED_FILTER_KEYS = {
    "current_stage",
    "ministry_id",
    "department_id",
    "form_type_code",
    "is_internal",
    "assigned_to_id",
    "routed_unit",
    "assessment_overdue",
    "quality_score_lte",
    "quality_score_gte",
    "search",
    "received_after",
    "received_before",
}

SYSTEM = """You convert natural-language queries about PSC submissions into API filter JSON.

Allowed keys only:
- current_stage (workflow stage slug, e.g. deferred, under_assessment, commission_sitting)
- ministry_id, department_id (integers — use null if unknown)
- form_type_code (string, e.g. "PSC 3.6")
- is_internal (boolean)
- assigned_to_id (integer user id — usually null)
- routed_unit (odu, hr, vipam, compliance, csu)
- assessment_overdue (boolean)
- quality_score_lte, quality_score_gte (0-100 integers)
- search (free text for reference/title)
- received_after, received_before (YYYY-MM-DD)

Output valid JSON only:
{
  "filters": { },
  "explanation": "one sentence for the user",
  "disclaimer": "AI draft — verify filters."
}

Use stage slugs from SCDMS. For "deferred in 2025" use current_stage deferred and received_after 2025-01-01, received_before 2026-01-01."""


def parse_nl_search_query(user_query: str, *, role: str = "") -> tuple[dict[str, Any] | None, str | None]:
    if not user_query.strip():
        return None, "Query is empty."
    if not ai_enabled():
        return {
            "filters": {"search": user_query.strip()[:200]},
            "explanation": "Simple text search (AI unavailable).",
            "disclaimer": "AI draft — verify filters.",
        }, None

    tier = FEATURE_MODEL_TIER.get("submission_nl_search", "sonnet")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=f"User role: {role}\nQuery: {user_query}",
        tier=tier,
        max_tokens=512,
    )
    if not data:
        return None, err or "Could not parse query."

    filters = data.get("filters") if isinstance(data.get("filters"), dict) else {}
    clean = {k: v for k, v in filters.items() if k in ALLOWED_FILTER_KEYS and v is not None}
    return {
        "filters": clean,
        "explanation": str(data.get("explanation") or "").strip()[:500],
        "disclaimer": str(data.get("disclaimer") or "AI draft — verify filters."),
    }, None


def apply_smart_filters(qs, filters: dict[str, Any]):
    """Apply parsed filters to Submission queryset."""
    from django.db.models import Q
    from django.utils.dateparse import parse_date

    if filters.get("current_stage"):
        qs = qs.filter(current_stage=filters["current_stage"])
    if filters.get("ministry_id"):
        qs = qs.filter(ministry_id=int(filters["ministry_id"]))
    if filters.get("department_id"):
        qs = qs.filter(department_id=int(filters["department_id"]))
    if filters.get("form_type_code"):
        qs = qs.filter(form_type_code__icontains=str(filters["form_type_code"]))
    if "is_internal" in filters:
        qs = qs.filter(is_internal=bool(filters["is_internal"]))
    if filters.get("assigned_to_id"):
        qs = qs.filter(assigned_to_id=int(filters["assigned_to_id"]))
    if filters.get("routed_unit"):
        qs = qs.filter(routed_unit=filters["routed_unit"])
    if filters.get("assessment_overdue"):
        from ..models import Submission

        ids = [s.id for s in qs if getattr(s, "is_assessment_overdue", False)]
        qs = Submission.objects.filter(id__in=ids)
    if filters.get("quality_score_lte") is not None:
        qs = qs.filter(ai_quality_score__lte=int(filters["quality_score_lte"]))
    if filters.get("quality_score_gte") is not None:
        qs = qs.filter(ai_quality_score__gte=int(filters["quality_score_gte"]))
    if filters.get("search"):
        term = str(filters["search"]).strip()
        qs = qs.filter(
            Q(reference_number__icontains=term)
            | Q(title__icontains=term)
            | Q(notes__icontains=term)
        )
    if filters.get("received_after"):
        d = parse_date(str(filters["received_after"]))
        if d:
            qs = qs.filter(received_at__date__gte=d)
    if filters.get("received_before"):
        d = parse_date(str(filters["received_before"]))
        if d:
            qs = qs.filter(received_at__date__lte=d)
    return qs
