"""Rule-based prefill for the ODU Restructure Checklist from submission data and uploads."""

from __future__ import annotations

import re
from typing import Any

from django.contrib.auth import get_user_model

from .models import (
    DocumentClassificationType,
    ODURestructureChecklist,
    RestructureSubmissionData,
    Role,
    Submission,
    SubmissionDocument,
)

User = get_user_model()

_SECTION_A_FIELDS = (
    "ministry_department",
    "division_unit",
    "submission_type",
    "odu_officer_assigned",
    "manager_odu",
)

_SECTION_B_FIELDS = (
    "b1_cover_letter",
    "b2_org_chart",
    "b3_positions_list",
    "b4_jds_attached",
    "b5_rationale_stated",
    "b6_mandate_alignment",
    "b7_reporting_lines",
    "b8_no_duplication",
    "b9_span_of_control",
    "b10_job_purpose_linked",
    "b11_kra_kta_kpi",
    "b12_competencies",
    "b13_qual_experience",
    "b14_cost_analysis",
    "b15_grt_mapping",
    "b16_consultation",
)

# Document-type → checklist items (document evidence only; officer confirms)
_DOC_TYPE_HINTS: dict[str, tuple[str, ...]] = {
    DocumentClassificationType.DG_ENDORSEMENT: ("b1_cover_letter",),
    DocumentClassificationType.ORGANISATIONAL_CHART: ("b2_org_chart",),
    DocumentClassificationType.POSITION_DESCRIPTION: (
        "b4_jds_attached",
        "b10_job_purpose_linked",
        "b12_competencies",
        "b13_qual_experience",
    ),
    DocumentClassificationType.FINANCIAL_COSTING: ("b14_cost_analysis", "b15_grt_mapping"),
    DocumentClassificationType.CORRESPONDENCE: ("b1_cover_letter", "b16_consultation"),
    DocumentClassificationType.SUPPORTING_EVIDENCE: ("b16_consultation",),
}

# Keywords in file name / description / OCR snippet
_KEYWORD_HINTS: tuple[tuple[tuple[str, ...], str], ...] = (
    (("cover letter", "covering letter", "head of agency", "director general", "dg letter", "endorsement"), "b1_cover_letter"),
    (("org chart", "organisational chart", "organizational chart", "organisation structure", "organization structure"), "b2_org_chart"),
    (("position list", "establishment list", "staffing table", "post list", "schedule of posts"), "b3_positions_list"),
    (("job description", "position description", " jd ", ".jd"), "b4_jds_attached"),
    (("rationale", "justification", "background", "proposal"), "b5_rationale_stated"),
    (("mandate", "strategic plan", "corporate plan"), "b6_mandate_alignment"),
    (("reporting line", "reporting structure", "line of report"), "b7_reporting_lines"),
    (("cost", "financial impact", "budget impact", "costing", "cost spreadsheet", "excel cost"), "b14_cost_analysis"),
    (("grt", "remuneration table", "government remuneration"), "b15_grt_mapping"),
    (("doft", "dsspac", "consultation", "grt consultation"), "b16_consultation"),
    (("kra", "key result", "kta", "kpi", "performance indicator"), "b11_kra_kta_kpi"),
    (("competenc", "skill requirement"), "b12_competencies"),
    (("qualification", "experience requirement", "minimum qualification"), "b13_qual_experience"),
)


def _manager_odu_name() -> str:
    profile = (
        User.objects.filter(profile__role=Role.ODU_MANAGER)
        .order_by("id")
        .first()
    )
    if not profile:
        return ""
    full = f"{profile.first_name} {profile.last_name}".strip()
    return full or profile.username


def _doc_search_text(doc: SubmissionDocument) -> str:
    parts = [doc.original_name or "", doc.description or "", doc.document_type or ""]
    if doc.extracted_text:
        parts.append(doc.extracted_text[:2500])
    elif isinstance(doc.extracted_facts, dict):
        summary = doc.extracted_facts.get("document_summary") or ""
        if summary:
            parts.append(str(summary)[:1500])
    return " ".join(parts).lower()


def _documents_for(submission: Submission) -> list[SubmissionDocument]:
    return list(
        SubmissionDocument.objects.filter(submission=submission).order_by("uploaded_at")
    )


def _keyword_hits(corpus: str) -> set[str]:
    hits: set[str] = set()
    for keywords, field in _KEYWORD_HINTS:
        if any(kw in corpus for kw in keywords):
            hits.add(field)
    return hits


def _document_evidence(submission: Submission) -> dict[str, bool]:
    evidence = {field: False for field in _SECTION_B_FIELDS}
    for doc in _documents_for(submission):
        for field in _DOC_TYPE_HINTS.get(doc.document_type, ()):
            evidence[field] = True
        for field in _keyword_hits(_doc_search_text(doc)):
            evidence[field] = True
    return evidence


def _restructure_hints(submission: Submission) -> dict[str, bool]:
    hints = {field: False for field in _SECTION_B_FIELDS}
    try:
        rd: RestructureSubmissionData = submission.restructure_data
    except RestructureSubmissionData.DoesNotExist:
        return hints

    if rd.attach_current_org_chart or rd.attach_proposed_org_chart:
        hints["b2_org_chart"] = True
    if rd.attach_job_descriptions:
        hints["b4_jds_attached"] = True
    if rd.dg_endorses is True or (rd.dg_name or "").strip():
        hints["b1_cover_letter"] = True
    if (rd.background or "").strip() or (rd.proposal or "").strip():
        hints["b5_rationale_stated"] = True
    if (rd.proposal or "").strip():
        hints["b6_mandate_alignment"] = True
    rows = rd.costing_rows if isinstance(rd.costing_rows, list) else []
    if rows:
        hints["b3_positions_list"] = True
        hints["b14_cost_analysis"] = True
    if (rd.costing_notes or "").strip():
        hints["b14_cost_analysis"] = True
    if re.search(r"\bgrt\b", (rd.costing_notes or "").lower()):
        hints["b15_grt_mapping"] = True
    return hints


def _submission_type_value(submission: Submission) -> str:
    if submission.form_type_code == "ORG-3.1":
        return ODURestructureChecklist.SubmissionType.FULL_RESTRUCTURE
    try:
        resp = submission.dynamic_form_response
        data = resp.data if resp and isinstance(resp.data, dict) else {}
    except Exception:
        data = {}
    proposal = str(
        data.get("proposal_type")
        or data.get("type_of_proposal")
        or data.get("submission_type")
        or ""
    ).lower()
    if "regrad" in proposal:
        return ODURestructureChecklist.SubmissionType.PARTIAL_REVIEW
    if "jd" in proposal or "job description" in proposal:
        return ODURestructureChecklist.SubmissionType.NEW_JD
    if "amend" in proposal:
        return ODURestructureChecklist.SubmissionType.AMENDMENT
    if submission.form_type_code == "PSC 2-1":
        return ODURestructureChecklist.SubmissionType.FULL_RESTRUCTURE
    return ""


def build_odu_checklist_prefill(submission: Submission, *, user: User | None = None) -> dict[str, Any]:
    """
    Build default field values from submission metadata, ORG-3.1 data, and uploads.
    Section B values are suggestions (True) where evidence exists; officer must confirm.
    Items b17–b20 are left unset for ODU officer/manager review.
    """
    ministry_name = submission.ministry.name if submission.ministry_id else ""
    division = submission.department.name if submission.department_id else ""

    doc_evidence = _document_evidence(submission)
    restructure = _restructure_hints(submission)

    section_b: dict[str, bool | None] = {}
    for field in _SECTION_B_FIELDS:
        if field in ("b17_odu_analysis", "b18_feedback_provided", "b19_final_docs_ready", "b20_manager_final_check"):
            section_b[field] = None
            continue
        section_b[field] = True if (doc_evidence.get(field) or restructure.get(field)) else None

    officer_name = ""
    if user:
        officer_name = f"{user.first_name} {user.last_name}".strip() or user.username

    return {
        "ministry_department": ministry_name,
        "division_unit": division,
        "submission_type": _submission_type_value(submission),
        "odu_officer_assigned": officer_name,
        "manager_odu": _manager_odu_name(),
        **section_b,
        "officer_comments": _build_prefill_comment(submission, doc_evidence, restructure),
    }


def _build_prefill_comment(
    submission: Submission,
    doc_evidence: dict[str, bool],
    restructure: dict[str, bool],
) -> str:
    lines = [
        f"Pre-filled from submission {submission.reference_number} and uploaded documents. "
        "Please verify each checklist item before submitting for manager approval.",
    ]
    if submission.title:
        lines.append(f"Title: {submission.title}")
    try:
        rd = submission.restructure_data
        if (rd.subject_title or "").strip():
            lines.append(f"Subject: {rd.subject_title.strip()}")
    except RestructureSubmissionData.DoesNotExist:
        pass
    suggested = [
        f.replace("b", "B", 1).replace("_", " ")
        for f in _SECTION_B_FIELDS
        if f not in ("b17_odu_analysis", "b18_feedback_provided", "b19_final_docs_ready", "b20_manager_final_check")
        and (doc_evidence.get(f) or restructure.get(f))
    ]
    if suggested:
        lines.append("Suggested Yes (verify): " + ", ".join(suggested[:8]) + ("…" if len(suggested) > 8 else ""))
    return "\n".join(lines)


def apply_prefill_to_checklist(
    checklist: ODURestructureChecklist,
    submission: Submission,
    *,
    user: User | None = None,
    overwrite_empty_only: bool = True,
) -> bool:
    """Merge prefill into an existing draft checklist. Returns True if saved."""
    prefill = build_odu_checklist_prefill(submission, user=user)
    changed = False

    for field in _SECTION_A_FIELDS + ("officer_comments",):
        new_val = prefill.get(field)
        if new_val in (None, ""):
            continue
        current = getattr(checklist, field, None)
        if overwrite_empty_only and current not in (None, ""):
            continue
        if current != new_val:
            setattr(checklist, field, new_val)
            changed = True

    for field in _SECTION_B_FIELDS:
        if field in ("b17_odu_analysis", "b18_feedback_provided", "b19_final_docs_ready", "b20_manager_final_check"):
            continue
        new_val = prefill.get(field)
        if new_val is None:
            continue
        current = getattr(checklist, field, None)
        if overwrite_empty_only and current is not None:
            continue
        if current != new_val:
            setattr(checklist, field, new_val)
            changed = True

    if changed:
        checklist.save()
    return changed


def ensure_odu_checklist_for_submission(
    submission: Submission,
    *,
    user: User,
    allow_create: bool,
) -> ODURestructureChecklist | None:
    from .odu_checklist_rules import submission_eligible_for_odu_checklist

    if not submission_eligible_for_odu_checklist(submission):
        return None

    existing = (
        ODURestructureChecklist.objects.filter(submission=submission)
        .select_related("submission", "created_by")
        .first()
    )
    if existing:
        from .models import ODUChecklistStatus

        if existing.status == ODUChecklistStatus.DRAFT:
            apply_prefill_to_checklist(existing, submission, user=user)
        return existing

    if not allow_create:
        return None

    prefill = build_odu_checklist_prefill(submission, user=user)
    return ODURestructureChecklist.objects.create(
        submission=submission,
        created_by=user,
        **{k: prefill[k] for k in prefill if hasattr(ODURestructureChecklist, k)},
    )
