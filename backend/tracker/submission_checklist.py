"""Required-document checklist resolution (shared by API views and AI validation)."""
from __future__ import annotations

from django.db import models

from .models import PSCFormType, RequiredDocument, Submission, SubmissionChecklistItem


def resolve_required_documents(submission: Submission):
    """Return RequiredDocument queryset for this submission (same rules as GET checklist)."""
    if submission.is_attachment or submission.secretary_only:
        return RequiredDocument.objects.none()
    if submission.is_internal and not submission.follows_normal_route:
        return RequiredDocument.objects.none()

    form_type_obj = None
    if submission.form_type_code:
        form_type_obj = PSCFormType.objects.filter(code=submission.form_type_code).first()

    if form_type_obj:
        type_specific = RequiredDocument.objects.filter(
            is_active=True, form_type=form_type_obj
        )
        if type_specific.exists():
            return type_specific
        return RequiredDocument.objects.filter(
            is_active=True, form_type__isnull=True
        ).filter(
            models.Q(form_category=submission.form_category)
            | models.Q(form_category__isnull=True)
        )

    return RequiredDocument.objects.filter(
        is_active=True, form_type__isnull=True
    ).filter(
        models.Q(form_category=submission.form_category)
        | models.Q(form_category__isnull=True)
    )


def ensure_submission_checklist_items(submission: Submission) -> None:
    """Create SubmissionChecklistItem rows for each applicable RequiredDocument."""
    for doc in resolve_required_documents(submission):
        SubmissionChecklistItem.objects.get_or_create(
            submission=submission, document=doc
        )


def apply_content_mismatch_check(document) -> None:
    """Compare an uploaded document's classified type against the expected type
    of the required-document checklist slot it was attached to.

    This is the non-AI content-validation step (E1 extraction + A2 classification
    both have local, no-API-key fallbacks): a confident mismatch un-ticks the
    checklist item and flags it, instead of trusting that any attached file
    satisfies the slot. An inconclusive classification (unclassified, or below
    the confidence floor) is never treated as evidence of a wrong document.
    """
    from .models import DocumentClassificationType

    required_document = document.required_document
    if required_document is None or not required_document.expected_document_type:
        return
    if document.document_type == DocumentClassificationType.UNCLASSIFIED:
        return
    if (document.document_type_confidence or 0) < 50:
        return

    item, _ = SubmissionChecklistItem.objects.get_or_create(
        submission=document.submission, document=required_document,
    )

    if document.document_type == required_document.expected_document_type:
        if item.content_mismatch:
            item.content_mismatch = False
            item.save(update_fields=["content_mismatch"])
        return

    # Don't clobber notes an officer has since written by hand.
    if item.notes and not item.notes.startswith("[Content check]"):
        return

    actual_label = DocumentClassificationType(document.document_type).label
    expected_label = DocumentClassificationType(required_document.expected_document_type).label
    item.is_present = False
    item.content_mismatch = True
    item.notes = (
        f"[Content check] Attached file looks like '{actual_label}', not "
        f"'{expected_label}' — please check the upload."
    )
    item.save(update_fields=["is_present", "content_mismatch", "notes"])


def expected_documents_lines(submission: Submission) -> list[str]:
    """Human-readable expected checklist for AI / rule checks."""
    ensure_submission_checklist_items(submission)
    lines = []
    for item in SubmissionChecklistItem.objects.filter(submission=submission).select_related(
        "document"
    ):
        label = item.document.name if item.document_id else "Item"
        status = "confirmed present" if item.is_present else "NOT confirmed"
        lines.append(f"- {label} (required): {status}")
    return lines
