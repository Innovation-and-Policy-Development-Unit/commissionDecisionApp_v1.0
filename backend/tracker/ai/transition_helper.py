"""
F1 — Transition helper: allowed next stages, rationale, checklist gates (Haiku).
"""

from __future__ import annotations

from typing import Any

from django.utils import timezone

from ..models import Submission, SubmissionChecklistItem, WorkflowStage
from ..submission_checklist import ensure_submission_checklist_items
from ..transitions import iter_allowed_targets
from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

DISCLAIMER = "AI draft — verify before acting."


def _stage_label(stage: str) -> str:
    try:
        return WorkflowStage(stage).label
    except ValueError:
        return stage.replace("_", " ").title()


def compute_transition_blockers(submission: Submission, target_stage: str) -> list[str]:
    """Deterministic gates (mirrors SubmissionViewSet.transition)."""
    blockers: list[str] = []
    prev = submission.current_stage

    if prev == WorkflowStage.MANAGER_CHECKLIST_REVIEW and target_stage == WorkflowStage.UNDER_ASSESSMENT:
        ensure_submission_checklist_items(submission)
        missing = [
            item.document.name
            for item in SubmissionChecklistItem.objects.filter(
                submission=submission, is_present=False
            ).select_related("document")
            if item.document_id
        ]
        if missing:
            blockers.append(
                f"You cannot go to {_stage_label(target_stage)} until "
                f"{len(missing)} required checklist item(s) are confirmed: "
                + ", ".join(missing[:6])
                + ("…" if len(missing) > 6 else "")
            )

    if (
        prev == WorkflowStage.DRAFT
        and target_stage == WorkflowStage.SUBMITTED
        and submission.ai_package_processed
        and not submission.ai_package_ready
    ):
        critical = [
            g.get("message")
            for g in (submission.ai_package_gaps or [])
            if g.get("severity") == "critical"
        ]
        if critical:
            blockers.append(
                "Package validation reported critical gaps — run Validate package or use acknowledge_gaps."
            )

    return blockers


def build_transition_context(submission: Submission, role: str, allowed: list[str]) -> str:
    lines = [
        f"Reference: {submission.reference_number}",
        f"Title: {submission.title}",
        f"Current stage: {submission.get_current_stage_display()} ({submission.current_stage})",
        f"Role: {role}",
        f"Allowed next stages: {', '.join(allowed) or 'none'}",
        f"Internal submission: {submission.is_internal}",
    ]
    ensure_submission_checklist_items(submission)
    for item in SubmissionChecklistItem.objects.filter(submission=submission).select_related("document"):
        label = item.document.name if item.document_id else "Item"
        lines.append(f"Checklist: {label} — {'present' if item.is_present else 'MISSING'}")
    if submission.ai_quality_score is not None:
        lines.append(f"Quality score: {submission.ai_quality_score}/100")
    return "\n".join(lines)


def generate_transition_guidance(
    submission: Submission, *, role: str, is_internal: bool = False
) -> dict[str, Any]:
    allowed = iter_allowed_targets(role, submission.current_stage, is_internal=is_internal)
    suggestions: list[dict[str, Any]] = []

    for stage in allowed:
        blockers = compute_transition_blockers(submission, stage)
        suggestions.append({
            "stage": stage,
            "label": _stage_label(stage),
            "can_proceed": len(blockers) == 0,
            "blockers": blockers,
            "rationale": "",
        })

    if ai_enabled() and allowed:
        tier = FEATURE_MODEL_TIER.get("F1_smart_routing", "haiku")
        ctx = build_transition_context(submission, role, allowed)
        data, _err = complete_json_with_error(
            system=(
                "You advise PSC staff on workflow transitions in SCDMS. "
                "For each allowed target stage, write one short rationale (max 2 sentences) "
                "why that move makes sense or what to prepare. Do not contradict blockers list. "
                'Output JSON: {"suggestions": [{"stage": "...", "rationale": "..."}]}'
            ),
            user=f"Submission:\n{ctx}\n\nExisting blockers per stage:\n"
            + "\n".join(
                f"- {s['stage']}: {s['blockers'] or 'none'}" for s in suggestions
            ),
            tier=tier,
            max_tokens=1024,
        )
        if data and isinstance(data.get("suggestions"), list):
            by_stage = {str(x.get("stage")): str(x.get("rationale") or "") for x in data["suggestions"]}
            for s in suggestions:
                s["rationale"] = by_stage.get(s["stage"], s["rationale"])[:500]

    for s in suggestions:
        if not s["rationale"]:
            if s["can_proceed"]:
                s["rationale"] = f"Ready to move to {s['label']} when you have completed local checks."
            else:
                s["rationale"] = "Resolve blockers before this transition."

    return {
        "processed": True,
        "generated_at": timezone.now().isoformat(),
        "current_stage": submission.current_stage,
        "allowed": allowed,
        "suggestions": suggestions,
        "disclaimer": DISCLAIMER,
    }
