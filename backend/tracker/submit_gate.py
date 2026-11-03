"""What stops a ministry paper going to PSC.

HR may only submit once the package is actually complete: every required document
uploaded, the digitized form filled in, and a package validation run that came back
clean. The same list drives the API refusal and the disabled Submit button, so the
button can never disagree with the server about whether a paper may go.

Validation freshness is checked against a signature of the package rather than
``updated_at``: uploading or deleting a document does not touch the submission row,
so a paper validated while complete would otherwise stay "ready" after a required
document was removed.
"""

from __future__ import annotations

import hashlib

# Blocker codes, for the frontend to key on rather than matching message text.
MISSING_DOCUMENTS = "missing_documents"
FORM_INCOMPLETE = "form_incomplete"
NOT_VALIDATED = "not_validated"
VALIDATION_STALE = "validation_stale"
VALIDATION_FAILED = "validation_failed"


def gate_applies(submission, role) -> bool:
    """True for ministry-lodged papers being submitted by the ministry itself."""
    from .models import Role

    return (
        role in {Role.MINISTRY_HR, Role.DEPT_ADMIN}
        and not submission.is_internal
        and not getattr(submission, "secretary_only", False)
        and not submission.is_attachment
        and not submission.lodged_from_paper
    )


def package_signature(submission) -> str:
    """Fingerprint of everything a validation result depends on.

    Changes when a document is added, replaced, archived or deleted, when a checklist
    item is ticked, or when the digitized form is saved again.
    """
    from django.db.models import Count, Max

    from .models import PSCFormResponse, SubmissionChecklistItem, SubmissionDocument

    docs = SubmissionDocument.objects.filter(submission=submission).aggregate(
        n=Count("id"), latest=Max("uploaded_at"),
    )
    items = SubmissionChecklistItem.objects.filter(submission=submission)
    form_stamp = ""
    try:
        response = submission.dynamic_form_response
    except PSCFormResponse.DoesNotExist:
        response = None
    if response is not None:
        stamp = getattr(response, "updated_at", None) or getattr(response, "created_at", None)
        form_stamp = stamp.isoformat() if stamp else "saved"
    parts = [
        submission.current_stage or "",
        submission.form_type_code or "",
        str(docs["n"] or 0),
        docs["latest"].isoformat() if docs["latest"] else "",
        "%s/%s" % (items.filter(is_present=True).count(), items.count()),
        form_stamp,
    ]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]


def missing_required_documents(submission) -> list[str]:
    """Names of required-document slots with nothing uploaded to them."""
    from .models import SubmissionChecklistItem
    from .submission_checklist import ensure_submission_checklist_items

    ensure_submission_checklist_items(submission)
    uploaded = set(
        submission.documents.filter(
            required_document_id__isnull=False, archived_at__isnull=True,
        ).values_list("required_document_id", flat=True)
    )
    missing = []
    for item in (
        SubmissionChecklistItem.objects
        .filter(submission=submission, document__is_active=True)
        .select_related("document")
    ):
        if item.document_id and item.document_id not in uploaded:
            missing.append(item.document.name)
    return missing


def critical_gaps(submission) -> list[str]:
    """Messages from the last validation that are serious enough to stop a submit."""
    return [
        str(g.get("message") or "").strip()
        for g in (submission.ai_package_gaps or [])
        if isinstance(g, dict) and g.get("severity") == "critical" and g.get("message")
    ]


def submit_blockers(submission, role) -> list[dict[str, str]]:
    """Everything stopping this paper going to PSC, worst first. Empty means ready."""
    from .dynamic_form_validation import digitized_form_gap

    if not gate_applies(submission, role):
        return []

    blockers: list[dict[str, str]] = []

    missing = missing_required_documents(submission)
    if missing:
        shown = "; ".join(missing[:3]) + (" (+%d more)" % (len(missing) - 3) if len(missing) > 3 else "")
        blockers.append({
            "code": MISSING_DOCUMENTS,
            "message": "Upload every required document before submitting — still missing: %s." % shown,
        })

    form_gap = digitized_form_gap(submission)
    if form_gap:
        blockers.append({"code": FORM_INCOMPLETE, "message": form_gap})

    if not submission.ai_package_processed:
        blockers.append({
            "code": NOT_VALIDATED,
            "message": "Run Validate package before submitting, so the checks pass before PSC sees this.",
        })
    elif submission.ai_package_signature != package_signature(submission):
        blockers.append({
            "code": VALIDATION_STALE,
            "message": "The package changed since it was last validated — run Validate package again.",
        })
    elif not submission.ai_package_ready:
        gaps = critical_gaps(submission)
        detail = (" Outstanding: " + "; ".join(gaps[:3]) + ".") if gaps else ""
        blockers.append({
            "code": VALIDATION_FAILED,
            "message": "Validation found items to fix before this can go to PSC.%s" % detail,
        })

    return blockers
