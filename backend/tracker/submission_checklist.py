"""Required-document checklist resolution (shared by API views and AI validation)."""
from __future__ import annotations

from django.db import models

from .models import PSCFormResponse, PSCFormType, RequiredDocument, Submission, SubmissionChecklistItem


def _is_department_level_restructure(submission: Submission) -> bool:
    """True when the submission's Organisation Restructure form (ORG-3.1 /
    PSC 2-1, both reuse the same dynamic-form storage) has restructure_scope
    set to 'department'. Missing form data means "not yet known" — treated
    as not department-level, so the extra DG letter only appears once the
    ministry has actually chosen a scope."""
    try:
        data = submission.dynamic_form_response.data or {}
    except PSCFormResponse.DoesNotExist:
        return False
    return data.get('restructure_scope') == 'department'


def resolve_required_documents(submission: Submission):
    """Return RequiredDocument queryset for this submission (same rules as GET checklist)."""
    if submission.is_attachment or submission.secretary_only:
        return RequiredDocument.objects.none()
    if submission.is_internal and not submission.follows_normal_route:
        return RequiredDocument.objects.none()

    # OPSC-internal submissions that follow the normal route (e.g. CSU/ODU
    # appointing OPSC staff) have no Director-General in their workflow, so
    # ministry-only items (DG endorsement letters, etc.) don't apply.
    skip_ministry_only = submission.is_internal and submission.follows_normal_route
    # ORG-3.1's extra DG Endorsement Letter only applies to department-level
    # restructures — see 0203_org_3_1_conditional_dg_letter.py.
    skip_department_only = not _is_department_level_restructure(submission)

    form_type_obj = None
    if submission.form_type_code:
        form_type_obj = PSCFormType.objects.filter(code=submission.form_type_code).first()

    if form_type_obj:
        type_specific = RequiredDocument.objects.filter(
            is_active=True, form_type=form_type_obj
        )
        if skip_ministry_only:
            type_specific = type_specific.exclude(ministry_only=True)
        if skip_department_only:
            type_specific = type_specific.exclude(restructure_department_only=True)
        if type_specific.exists():
            return type_specific
        qs = RequiredDocument.objects.filter(
            is_active=True, form_type__isnull=True
        ).filter(
            models.Q(form_category=submission.form_category)
            | models.Q(form_category__isnull=True)
        )
        if skip_ministry_only:
            qs = qs.exclude(ministry_only=True)
        if skip_department_only:
            qs = qs.exclude(restructure_department_only=True)
        return qs

    qs = RequiredDocument.objects.filter(
        is_active=True, form_type__isnull=True
    ).filter(
        models.Q(form_category=submission.form_category)
        | models.Q(form_category__isnull=True)
    )
    if skip_ministry_only:
        qs = qs.exclude(ministry_only=True)
    if skip_department_only:
        qs = qs.exclude(restructure_department_only=True)
    return qs


def ensure_submission_checklist_items(submission: Submission) -> None:
    """Sync SubmissionChecklistItem rows to the currently applicable RequiredDocuments.

    Creates rows for newly-applicable documents and removes rows for documents
    that no longer apply (e.g. scoping rules changed, or the submission's
    is_internal/follows_normal_route flags were corrected after creation).
    """
    applicable = list(resolve_required_documents(submission))
    for doc in applicable:
        SubmissionChecklistItem.objects.get_or_create(
            submission=submission, document=doc
        )
    applicable_ids = {doc.id for doc in applicable}
    SubmissionChecklistItem.objects.filter(submission=submission).exclude(
        document_id__in=applicable_ids
    ).delete()


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
