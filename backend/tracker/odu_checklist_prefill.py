"""Auto-derive the ODU Restructure Checklist from the ministry's actual submitted data.

Confirmed with ODU (2026-08-06): the ministry should not have to manually click
Yes/No through the checklist — the system checks what they actually submitted
(their digitized form answers + the Required Documents they've attached) and
answers the items it can verify directly. The ministry then reviews the result
rather than filling in a blank 20-item form.

Not every item can be verified this way. Items 7–13 (structure/JD *quality*
judgments — span of control, KRA/KPI clarity, competency appropriateness) have
no corresponding submitted fact to check against; those stay as the ministry's
own self-certification. Items 17–20 describe ODU's own subsequent work (their
analysis, their final check) and were never in scope for the ministry at all —
see CHECKLIST_MINISTRY_REQUIRED_FIELDS in odu_checklist_rules.py.
"""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from .models import (
    ODURestructureChecklist,
    Role,
    Submission,
    SubmissionChecklistItem,
)

User = get_user_model()

_SECTION_A_FIELDS = (
    "ministry_department",
    "division_unit",
    "submission_type",
    "odu_officer_assigned",
    "manager_odu",
)

# Items the system can verify directly from the ministry's submitted data or
# their Required Documents — set to a definite True/False, not a suggestion.
_SYSTEM_VERIFIABLE_FIELDS = (
    "b1_cover_letter",
    "b2_org_chart",
    "b3_positions_list",
    "b4_jds_attached",
    "b5_rationale_stated",
    "b6_mandate_alignment",
    "b14_cost_analysis",
    "b15_grt_mapping",
    "b16_consultation",
)

# Items with no submitted fact to check against — content/quality judgments
# left as the ministry's own self-certification.
_MINISTRY_SELF_CERTIFIED_FIELDS = (
    "b7_reporting_lines",
    "b8_no_duplication",
    "b9_span_of_control",
    "b10_job_purpose_linked",
    "b11_kra_kta_kpi",
    "b12_competencies",
    "b13_qual_experience",
)

_ALL_MINISTRY_FIELDS = _SYSTEM_VERIFIABLE_FIELDS + _MINISTRY_SELF_CERTIFIED_FIELDS

# Which Required Documents (by name substring, case-insensitive) satisfy which
# system-verifiable items, for form types (PSC 2-1) that track document
# completeness via SubmissionChecklistItem.is_present.
_REQUIRED_DOC_NAME_HINTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("current organisation structure", ("b2_org_chart",)),
    ("proposed organisation structure", ("b2_org_chart",)),
    ("job description", ("b4_jds_attached",)),
    ("cost spreadsheet", ("b14_cost_analysis",)),
    ("costing", ("b14_cost_analysis",)),
)


def _user_display_name(user: User | None) -> str:
    if not user:
        return ""
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.username


def _manager_odu_name() -> str:
    profile = (
        User.objects.filter(psc_profile__role=Role.ODU_MANAGER)
        .order_by("id")
        .first()
    )
    return _user_display_name(profile)


def _dynamic_form_data(submission: Submission) -> dict[str, Any]:
    try:
        resp = submission.dynamic_form_response
    except Exception:
        return {}
    return resp.data if resp and isinstance(resp.data, dict) else {}


def _truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return bool(str(value).strip()) and str(value).strip().lower() not in ("no", "false", "0")


def _required_document_evidence(submission: Submission) -> dict[str, bool]:
    """Which system-verifiable items have a matching Required Document already
    marked present (SubmissionChecklistItem.is_present)."""
    evidence = {f: False for f in _SYSTEM_VERIFIABLE_FIELDS}
    items = SubmissionChecklistItem.objects.filter(
        submission=submission, is_present=True,
    ).select_related("document")
    for item in items:
        name = (item.document.name or "").lower()
        for needle, fields in _REQUIRED_DOC_NAME_HINTS:
            if needle in name:
                for f in fields:
                    evidence[f] = True
    return evidence


def _submitted_form_evidence(submission: Submission) -> dict[str, bool]:
    """Which system-verifiable items are satisfied by the ministry's own
    digitized form answers (PSC 2-1's PSCForm21Fields data)."""
    data = _dynamic_form_data(submission)
    evidence = {f: False for f in _SYSTEM_VERIFIABLE_FIELDS}
    if not data:
        return evidence

    if _truthy(data.get("dg_endorsement_confirmed")) or (data.get("dg_name") or "").strip():
        evidence["b1_cover_letter"] = True
    if _truthy(data.get("attachment_current_structure")) and _truthy(data.get("attachment_proposed_structure")):
        evidence["b2_org_chart"] = True
    if (data.get("positions_deleted_regraded") or "").strip() or (data.get("new_positions_sought") or "").strip():
        evidence["b3_positions_list"] = True
    if _truthy(data.get("attachment_job_descriptions")):
        evidence["b4_jds_attached"] = True
    if (data.get("background_reasons") or "").strip():
        evidence["b5_rationale_stated"] = True
    if (data.get("policy_legislative_basis") or "").strip():
        evidence["b6_mandate_alignment"] = True
    if _truthy(data.get("attachment_cost_spreadsheet")) or (data.get("cost_breakdown_detail") or "").strip():
        evidence["b14_cost_analysis"] = True
    if (data.get("proposed_grading") or "").strip():
        evidence["b15_grt_mapping"] = True
    if (data.get("funds_allocated_current_year") or "").strip():
        evidence["b16_consultation"] = True
    return evidence


def _submission_type_value(submission: Submission) -> str:
    data = _dynamic_form_data(submission)
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
    if submission.form_type_code in ("PSC 2-1", "ORG-3.1"):
        return ODURestructureChecklist.SubmissionType.FULL_RESTRUCTURE
    return ""


def build_odu_checklist_prefill(submission: Submission, *, user: User | None = None) -> dict[str, Any]:
    """
    Build checklist values from the ministry's actual submitted data.
    System-verifiable items (1-6, 14-16) are set to a definite True/False.
    Self-certified items (7-13) and ODU's own items (17-20) are left unset
    for the relevant party to answer.
    """
    ministry_name = submission.ministry.name if submission.ministry_id else ""
    division = submission.department.name if submission.department_id else ""

    doc_evidence = _required_document_evidence(submission)
    form_evidence = _submitted_form_evidence(submission)

    section_b: dict[str, bool | None] = {}
    for field in _SYSTEM_VERIFIABLE_FIELDS:
        section_b[field] = doc_evidence.get(field) or form_evidence.get(field) or False
    for field in _MINISTRY_SELF_CERTIFIED_FIELDS:
        section_b[field] = None

    # Prefer the officer the Manager ODU has actually assigned via the
    # standard "Allocate to officer" mechanism (Submission.assigned_to) over
    # whoever merely happens to be viewing the form right now.
    officer_name = _user_display_name(submission.assigned_to) if submission.assigned_to_id else ""
    if not officer_name and user:
        officer_name = _user_display_name(user)

    return {
        "ministry_department": ministry_name,
        "division_unit": division,
        "submission_type": _submission_type_value(submission),
        "odu_officer_assigned": officer_name,
        "manager_odu": _manager_odu_name(),
        **section_b,
        "officer_comments": _build_prefill_comment(submission, doc_evidence, form_evidence),
    }


def _build_prefill_comment(
    submission: Submission,
    doc_evidence: dict[str, bool],
    form_evidence: dict[str, bool],
) -> str:
    lines = [
        f"System-checked against submission {submission.reference_number} and its "
        "Required Documents. Items 7-13 need your own confirmation — the system has "
        "no way to verify content quality (span of control, KRA/KPI clarity, etc.).",
    ]
    if submission.title:
        lines.append(f"Title: {submission.title}")
    confirmed = [
        f.replace("b", "B", 1).replace("_", " ")
        for f in _SYSTEM_VERIFIABLE_FIELDS
        if doc_evidence.get(f) or form_evidence.get(f)
    ]
    missing = [
        f.replace("b", "B", 1).replace("_", " ")
        for f in _SYSTEM_VERIFIABLE_FIELDS
        if not (doc_evidence.get(f) or form_evidence.get(f))
    ]
    if confirmed:
        lines.append("Confirmed Yes: " + ", ".join(confirmed))
    if missing:
        lines.append("Confirmed No (not found in submission): " + ", ".join(missing))
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

    # Only re-apply the system-verifiable items — never overwrite a
    # self-certified item the ministry has already answered themselves.
    for field in _SYSTEM_VERIFIABLE_FIELDS:
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
    from .odu_checklist_rules import submission_viewable_odu_checklist

    if not submission_viewable_odu_checklist(submission):
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
