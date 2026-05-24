"""
Cryptographic decision proof — canonical snapshot + SHA-256 at approval/rejection.

Used for tamper-evident audit trail badges in the UI.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any

from django.utils import timezone

from .models import WorkflowStage

# Stages that constitute a formal Commission / secretariat decision on the matter
DECISION_PROOF_STAGES = frozenset({
    WorkflowStage.APPROVED,
    WorkflowStage.REJECTED,
    WorkflowStage.RETURNED,
    WorkflowStage.RETURNED_FOR_CLARIFICATION,
    WorkflowStage.SECRETARY_REVIEW,  # internal fast-track approval path
})

PROOF_PAYLOAD_VERSION = 1


def _document_fingerprint(submission) -> str:
    from django.db.models import Count, Max

    from .models import SubmissionDocument

    stats = SubmissionDocument.objects.filter(submission=submission).aggregate(
        n=Count("id"),
        latest=Max("uploaded_at"),
    )
    names = list(
        SubmissionDocument.objects.filter(submission=submission)
        .order_by("id")
        .values_list("original_name", "uploaded_at")
    )
    parts = [
        str(stats["n"] or 0),
        stats["latest"].isoformat() if stats.get("latest") else "",
        json.dumps(names, sort_keys=True, default=str),
    ]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]


def _checklist_fingerprint(submission) -> str:
    from .models import SubmissionChecklistItem

    rows = list(
        SubmissionChecklistItem.objects.filter(submission=submission)
        .order_by("id")
        .values_list("document_id", "is_present", "notes")
    )
    return hashlib.sha256(json.dumps(rows, sort_keys=True, default=str).encode()).hexdigest()[:32]


def build_decision_proof_payload(
    *,
    submission,
    previous_stage: str,
    new_stage: str,
    actor,
    remarks: str = "",
    recorded_at: datetime | None = None,
) -> dict[str, Any]:
    """Immutable snapshot embedded in the audit trail."""
    when = recorded_at or timezone.now()
    actor_username = ""
    actor_id = None
    if actor is not None:
        actor_id = getattr(actor, "id", None)
        actor_username = getattr(actor, "username", "") or ""

    return {
        "v": PROOF_PAYLOAD_VERSION,
        "submission_id": submission.id,
        "reference_number": submission.reference_number or "",
        "title": submission.title or "",
        "ministry_id": submission.ministry_id,
        "department_id": submission.department_id,
        "form_type_code": submission.form_type_code or "",
        "is_internal": bool(submission.is_internal),
        "previous_stage": previous_stage,
        "new_stage": new_stage,
        "remarks": (remarks or "").strip(),
        "actor_id": actor_id,
        "actor_username": actor_username,
        "recorded_at": when.isoformat(),
        "document_fingerprint": _document_fingerprint(submission),
        "checklist_fingerprint": _checklist_fingerprint(submission),
        "parent_submission_id": submission.parent_submission_id,
    }


def hash_proof_payload(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def create_decision_proof(
    *,
    submission,
    previous_stage: str,
    new_stage: str,
    actor,
    remarks: str = "",
) -> tuple[str, dict[str, Any]]:
    payload = build_decision_proof_payload(
        submission=submission,
        previous_stage=previous_stage,
        new_stage=new_stage,
        actor=actor,
        remarks=remarks,
    )
    return hash_proof_payload(payload), payload


def verify_stored_proof(content_hash: str, proof_payload: dict[str, Any] | None) -> dict[str, Any]:
    """Recompute hash from stored payload; optional live comparison."""
    if not content_hash or not proof_payload:
        return {
            "verified": False,
            "status": "missing",
            "message": "No decision proof recorded for this event.",
        }
    expected = hash_proof_payload(proof_payload)
    if expected == content_hash:
        return {
            "verified": True,
            "status": "valid",
            "message": "Cryptographic hash matches the recorded decision snapshot.",
            "content_hash": content_hash,
            "recomputed_hash": expected,
        }
    return {
        "verified": False,
        "status": "mismatch",
        "message": "Hash does not match the stored snapshot — record integrity check failed.",
        "content_hash": content_hash,
        "recomputed_hash": expected,
    }


def is_decision_stage(stage: str) -> bool:
    return stage in DECISION_PROOF_STAGES


def build_visual_audit_trail(submission) -> list[dict[str, Any]]:
    """Merge workflow events and submission audit logs into one timeline."""
    from .models import AuditLog, WorkflowEvent

    entries: list[dict[str, Any]] = []

    for ev in WorkflowEvent.objects.filter(submission=submission).select_related("actor"):
        actor_username = ev.actor.username if ev.actor_id else (ev.actor_label or "System")
        entries.append({
            "id": f"workflow-{ev.id}",
            "entry_type": "workflow",
            "workflow_event_id": ev.id,
            "timestamp": ev.created_at.isoformat(),
            "actor_username": actor_username,
            "previous_stage": ev.previous_stage,
            "new_stage": ev.new_stage,
            "remarks": ev.remarks or "",
            "description": f"{ev.previous_stage} → {ev.new_stage}",
            "has_decision_proof": bool(ev.content_hash),
            "content_hash": ev.content_hash or "",
            "content_hash_short": (ev.content_hash[:16] + "…") if ev.content_hash else "",
        })

    sid = str(submission.id)
    for log in AuditLog.objects.filter(
        resource_type="Submission",
        resource_id=sid,
    ).order_by("timestamp"):
        entries.append({
            "id": f"audit-{log.id}",
            "entry_type": "audit",
            "audit_log_id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "actor_username": log.actor_username or "System",
            "action": log.action,
            "description": log.description or log.resource_label,
            "ip_address": log.ip_address,
            "extra_data": log.extra_data or {},
            "has_decision_proof": log.action == "DECISION" and bool(
                (log.extra_data or {}).get("content_hash")
            ),
            "content_hash": (log.extra_data or {}).get("content_hash", ""),
            "content_hash_short": "",
        })
        if entries[-1]["content_hash"]:
            h = entries[-1]["content_hash"]
            entries[-1]["content_hash_short"] = h[:16] + "…"

    entries.sort(key=lambda e: e["timestamp"])
    return entries
