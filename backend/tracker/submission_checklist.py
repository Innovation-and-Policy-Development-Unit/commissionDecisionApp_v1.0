"""Required-document checklist resolution (shared by API views and AI validation)."""
from __future__ import annotations

from django.db import models

from .models import PSCFormType, RequiredDocument, Submission, SubmissionChecklistItem


def resolve_required_documents(submission: Submission):
    """Return RequiredDocument queryset for this submission (same rules as GET checklist)."""
    if submission.is_attachment or submission.is_internal or submission.secretary_only:
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
