"""Satisfy the pre-submit gate in tests that are about something else.

Since submit_gate landed, a ministry paper only leaves Draft once every required
document is uploaded and a package validation has passed. Tests that exercise what
happens *after* submit should call `satisfy_submit_gate` in setUp rather than
re-create that package by hand; tests about the gate itself live in test_submit_gate.
"""

from django.core.files.base import ContentFile
from django.utils import timezone


def satisfy_submit_gate(submission, user=None):
    """Attach anything still missing and record a clean validation of the result."""
    from tracker import submit_gate
    from tracker.models import SubmissionChecklistItem, SubmissionDocument
    from tracker.submission_checklist import ensure_submission_checklist_items

    ensure_submission_checklist_items(submission)
    uploaded = set(
        submission.documents.filter(
            required_document_id__isnull=False, archived_at__isnull=True,
        ).values_list("required_document_id", flat=True)
    )
    for item in (
        SubmissionChecklistItem.objects
        .filter(submission=submission, document__is_active=True)
        .select_related("document")
    ):
        if not item.document_id or item.document_id in uploaded:
            continue
        doc = SubmissionDocument(
            submission=submission, required_document=item.document, uploaded_by=user,
            original_name=f"{item.document.name}.pdf",
        )
        doc.file.save(f"gate-{item.document_id}.pdf", ContentFile(b"%PDF-1.4 test"), save=True)
        item.is_present = True
        item.save(update_fields=["is_present"])

    submission.refresh_from_db()
    submission.ai_package_gaps = []
    submission.ai_package_ready = True
    submission.ai_package_processed = True
    submission.ai_package_generated_at = timezone.now()
    submission.ai_package_signature = submit_gate.package_signature(submission)
    submission.save(update_fields=[
        "ai_package_gaps", "ai_package_ready", "ai_package_processed",
        "ai_package_generated_at", "ai_package_signature", "updated_at",
    ])
    return submission
