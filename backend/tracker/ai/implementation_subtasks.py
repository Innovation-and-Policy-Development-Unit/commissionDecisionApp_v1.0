"""Draft implementation subtasks for ODU/HR units from Commission decision register (Haiku)."""

from __future__ import annotations

from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

SYSTEM = """You draft implementation subtasks for the OPSC unit responsible for a Commission decision.

Output valid JSON only:
{
  "disclaimer": "AI draft — verify before creating tasks.",
  "subtasks": [
    {
      "title": "short action title",
      "description": "2-3 sentences with concrete deliverable",
      "suggested_due_days": 30
    }
  ]
}

Provide 3–6 subtasks. Align with action_unit and way_forward."""


def draft_subtasks_from_task(task) -> tuple[dict[str, Any] | None, str | None]:
    if not ai_enabled():
        return None, "ANTHROPIC_API_KEY is not configured."

    lines = [
        f"Decision: {task.decision_number or '—'}",
        f"Title: {task.title}",
        f"Decision detail: {task.decision_detail or '—'}",
        f"Outcome: {task.get_decision_outcome_display() if task.decision_outcome else '—'}",
        f"Action unit: {task.get_action_unit_display() if task.action_unit else task.action_unit or '—'}",
        f"Implementation status: {task.get_implementation_status_display() if task.implementation_status else '—'}",
        f"Way forward: {task.way_forward or '—'}",
        f"Submission: {task.submission.reference_number if task.submission_id else '—'}",
    ]
    tier = FEATURE_MODEL_TIER.get("C4_minutes_action_items", "haiku")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user="\n".join(lines),
        tier=tier,
        max_tokens=2048,
    )
    if not data or not isinstance(data, dict):
        return None, err or "Empty response."
    subtasks = data.get("subtasks") or []
    if not isinstance(subtasks, list):
        subtasks = []
    clean = []
    for raw in subtasks[:8]:
        if not isinstance(raw, dict):
            continue
        title = str(raw.get("title") or "").strip()[:255]
        if not title:
            continue
        clean.append({
            "title": title,
            "description": str(raw.get("description") or "").strip()[:2000],
            "suggested_due_days": min(365, max(1, int(raw.get("suggested_due_days") or 30))),
        })
    return {
        "disclaimer": str(data.get("disclaimer") or "AI draft — verify before creating tasks."),
        "subtasks": clean,
    }, None
