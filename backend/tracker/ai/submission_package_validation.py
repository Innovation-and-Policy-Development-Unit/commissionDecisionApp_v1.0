"""
A3 — Missing information detector (pre-submit package validation).
"""

from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone

from ..models import Submission, SubmissionDocument
from ..submission_checklist import ensure_submission_checklist_items, expected_documents_lines
from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are a PSC submissions quality officer for the Public Service Commission of Vanuatu.

Before a ministry or OPSC user submits a draft package, identify missing or weak items that would
cause "returned for clarification" or checklist rejection.

Review:
- Required checklist documents (confirmed present vs missing)
- Uploaded supporting files and whether they match the ask
- Digitized form fields (Form 3-7, dynamic PSC forms, restructure data) for blanks or placeholders
- DG / Head of Agency endorsement when expected for external ministry submissions
- Title clarity and whether the submission narrative is actionable

Severity:
- critical — will likely block processing or force return (missing required doc, empty mandatory form, no files)
- warning — should fix before submit if possible (weak title, optional doc missing, incomplete endorsement)
- info — nice-to-have improvements

Output valid JSON only:
{
  "ready": true,
  "summary": "One sentence overall assessment",
  "gaps": [
    {
      "severity": "critical",
      "category": "checklist",
      "message": "Short actionable bullet for the submitter"
    }
  ]
}

Set ready=true only when there are zero critical gaps."""


def _normalize_gap(raw: Any) -> dict[str, str] | None:
    if not isinstance(raw, dict):
        return None
    severity = str(raw.get("severity") or "warning").lower()
    if severity not in ("critical", "warning", "info"):
        severity = "warning"
    category = str(raw.get("category") or "other").lower()
    if category not in ("checklist", "form", "attachment", "endorsement", "other"):
        category = "other"
    message = str(raw.get("message") or "").strip()
    if not message:
        return None
    return {
        "severity": severity,
        "category": category,
        "message": message[:500],
    }


def _rule_based_gaps(submission: Submission) -> list[dict[str, str]]:
    """Deterministic gaps without calling Claude."""
    gaps: list[dict[str, str]] = []

    title = (submission.title or "").strip()
    if len(title) < 8:
        gaps.append({
            "severity": "warning",
            "category": "other",
            "message": "Submission title is very short — use a clear, specific title.",
        })

    if not submission.is_internal and not submission.is_attachment:
        ensure_submission_checklist_items(submission)
        from ..models import SubmissionChecklistItem

        missing_required = []
        for item in SubmissionChecklistItem.objects.filter(
            submission=submission, is_present=False
        ).select_related("document"):
            if item.document_id:
                missing_required.append(item.document.name)
        if missing_required:
            gaps.append({
                "severity": "critical",
                "category": "checklist",
                "message": "Required documents not confirmed: "
                + ", ".join(missing_required[:8])
                + ("…" if len(missing_required) > 8 else ""),
            })

        doc_count = SubmissionDocument.objects.filter(submission=submission).count()
        if doc_count == 0:
            gaps.append({
                "severity": "critical",
                "category": "attachment",
                "message": "No supporting documents uploaded yet.",
            })

        if not submission.dg_endorsed_by_id:
            gaps.append({
                "severity": "warning",
                "category": "endorsement",
                "message": "DG / Head of Agency endorsement is not recorded on this submission.",
            })

    return gaps


def _merge_gaps(*gap_lists: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, str]] = []
    for gaps in gap_lists:
        for g in gaps:
            key = (g.get("severity", ""), g.get("message", ""))
            if key in seen:
                continue
            seen.add(key)
            out.append(g)
    return out


def _compute_ready(gaps: list[dict[str, str]]) -> bool:
    return not any(g.get("severity") == "critical" for g in gaps)


def validate_package_from_context(
    submission: Submission, context: str
) -> tuple[dict[str, Any] | None, str | None]:
    """Return ({ready, summary, gaps}, error_message)."""
    rule_gaps = _rule_based_gaps(submission)

    if not ai_enabled():
        ready = _compute_ready(rule_gaps)
        summary = (
            "Rule-based check only (ANTHROPIC_API_KEY not configured). "
            + ("Package looks ready to submit." if ready else "Fix critical items before submitting.")
        )
        return {"ready": ready, "summary": summary, "gaps": rule_gaps}, None

    tier = FEATURE_MODEL_TIER.get("A3_missing_information", "haiku")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=(
            "Validate this draft submission package before submit.\n\n"
            f"{context}\n\n"
            "List concrete gaps only. Do not invent documents not listed in the context."
        ),
        tier=tier,
        max_tokens=2048,
    )
    if not data or not isinstance(data, dict):
        if rule_gaps:
            ready = _compute_ready(rule_gaps)
            return {
                "ready": ready,
                "summary": "AI validation unavailable; showing rule-based checks only.",
                "gaps": rule_gaps,
            }, err
        return None, err or "Empty AI response."

    ai_gaps = []
    for raw in data.get("gaps") or []:
        g = _normalize_gap(raw)
        if g:
            ai_gaps.append(g)

    gaps = _merge_gaps(rule_gaps, ai_gaps)
    ready = _compute_ready(gaps)
    if "ready" in data and not data.get("ready") and _compute_ready(gaps):
        pass
    elif not _compute_ready(gaps):
        ready = False
    else:
        ready = bool(data.get("ready", True))

    summary = str(data.get("summary") or "").strip()[:1000]
    if not summary:
        summary = (
            "No gaps found — package appears ready to submit."
            if ready
            else "Critical gaps must be resolved before submit."
        )

    return {"ready": ready, "summary": summary, "gaps": gaps}, None


def persist_package_validation(submission: Submission, result: dict[str, Any]) -> None:
    submission.ai_package_gaps = result.get("gaps") or []
    submission.ai_package_ready = bool(result.get("ready"))
    submission.ai_package_summary = str(result.get("summary") or "")[:2000]
    submission.ai_package_processed = True
    submission.ai_package_generated_at = timezone.now()
    submission.save(
        update_fields=[
            "ai_package_gaps",
            "ai_package_ready",
            "ai_package_summary",
            "ai_package_processed",
            "ai_package_generated_at",
            "updated_at",
        ]
    )
