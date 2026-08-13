"""Prefill dynamic (PSCFormField-based) checklist responses from data that
already exists on the submission — the ministry's own digitized form
answers, Required Documents, and submission model fields — so HR Unit
reviewers see a compiled one-page view instead of re-typing what's already
been submitted.

Mirrors the same approach as odu_checklist_prefill.py (system-checks what
it can, leaves genuine judgment calls blank), generalized for the
PSCFormType(is_checklist=True) + PSCFormField + SubmissionChecklistResponse
system so any unit's checklist can register a spec here — not just ODU's
bespoke ODURestructureChecklist model.

Prefill only ever fills a field that's currently empty — it never
overwrites an answer a reviewer already typed or a checkbox they already
ticked, so re-running it later (e.g. after a new document is uploaded)
is always safe.
"""

from __future__ import annotations

from typing import Any, Callable

from .models import Submission, SubmissionChecklistItem

PrefillGetter = Callable[[Submission], Any]


def _dynamic_form_data(submission: Submission) -> dict[str, Any]:
    try:
        resp = submission.dynamic_form_response
    except Exception:
        return {}
    return resp.data if resp and isinstance(resp.data, dict) else {}


def _required_document_present(submission: Submission, *name_substrings: str) -> bool | None:
    """True/False if a matching Required Document's presence has been
    recorded on this submission; None if no matching document is even
    configured (nothing to check against)."""
    needles = [s.lower() for s in name_substrings]
    matched = False
    items = SubmissionChecklistItem.objects.filter(submission=submission).select_related("document")
    for item in items:
        name = (item.document.name or "").lower()
        if any(n in name for n in needles):
            matched = True
            if item.is_present:
                return True
    return False if matched else None


def _truthy(value: Any) -> bool | None:
    """Yes/No radio (or any free-typed Yes/No text) -> tri-state bool."""
    if isinstance(value, bool):
        return value
    if value in (None, ""):
        return None
    s = str(value).strip().lower()
    if s in ("yes", "true", "1"):
        return True
    if s in ("no", "false", "0"):
        return False
    return None


def _first(*values: Any) -> Any:
    """First value that isn't None/empty — lets a getter prefer stronger
    evidence (e.g. an uploaded Required Document) and fall back to weaker
    evidence (the ministry's own self-reported form answer)."""
    for v in values:
        if v not in (None, ""):
            return v
    return None


_PREFILL_SPECS: dict[str, dict[str, PrefillGetter]] = {}


def register_prefill(checklist_code: str, spec: dict[str, PrefillGetter]) -> None:
    _PREFILL_SPECS[checklist_code] = spec


def build_prefill(submission: Submission, checklist_code: str) -> dict[str, Any]:
    spec = _PREFILL_SPECS.get(checklist_code)
    if not spec:
        return {}
    result: dict[str, Any] = {}
    for field_key, getter in spec.items():
        try:
            value = getter(submission)
        except Exception:
            value = None
        if value not in (None, ""):
            result[field_key] = value
    return result


def apply_prefill(response, submission: Submission, checklist_code: str) -> bool:
    """Fill only currently-empty keys in response.data. Returns True if
    anything changed (caller is responsible for saving)."""
    prefill = build_prefill(submission, checklist_code)
    if not prefill:
        return False
    data = dict(response.data or {})
    changed = False
    for key, value in prefill.items():
        if data.get(key) in (None, ""):
            data[key] = value
            changed = True
    if changed:
        response.data = data
    return changed


# ── Temporary Recruitment ───────────────────────────────────────────────────

register_prefill("RECRUIT-TEMPORARY-CHECKLIST", {
    "dg_endorsement_letter": lambda s: _first(
        True if s.dg_endorsed_at else None,
        _required_document_present(s, "DG's Endorsement Letter"),
    ),
    "officer_name": lambda s: _dynamic_form_data(s).get("candidate_name"),
    "position_title": lambda s: _dynamic_form_data(s).get("position_title"),
    "post_number": lambda s: _dynamic_form_data(s).get("post_number"),
    "department": lambda s: _first(s.department.name if s.department_id else None, _dynamic_form_data(s).get("department")),
    "ministry": lambda s: _first(s.ministry.name if s.ministry_id else None, _dynamic_form_data(s).get("ministry")),
    "date_received": lambda s: s.received_at.date().isoformat() if s.received_at else None,
    "effective_date": lambda s: _dynamic_form_data(s).get("effective_date"),
    "end_date": lambda s: _dynamic_form_data(s).get("end_date"),
    "salary_level": lambda s: _dynamic_form_data(s).get("salary_grade"),
    "jd_attached": lambda s: _first(
        _required_document_present(s, "Job Description"),
        _truthy(_dynamic_form_data(s).get("attachment_job_description")),
    ),
    "required_qualification": lambda s: _dynamic_form_data(s).get("required_qualification"),
    "highest_qualification": lambda s: _dynamic_form_data(s).get("candidate_qualification"),
    "work_experience": lambda s: _dynamic_form_data(s).get("candidate_experience"),
    "merit_process_followed": lambda s: _first(
        _required_document_present(s, "Evidence of Merit Process"),
        _truthy(_dynamic_form_data(s).get("merit_evidence")),
    ),
    "approved_fv_attached": lambda s: _first(
        _required_document_present(s, "Approved Financial Visa"),
        _truthy(_dynamic_form_data(s).get("financial_visa_attached")),
    ),
    "psc_form_37_attached": lambda s: _first(
        _required_document_present(s, "PSC Form 3-7"),
        _truthy(_dynamic_form_data(s).get("psc_form_37_attached")),
    ),
    # performance_appraisal_rating, performance_assessment_satisfactory, and
    # opsc_recommendation_approved have no submitted fact to check against —
    # left blank for HR Unit's own review.
})

# ── Voluntary Resignation ───────────────────────────────────────────────────

register_prefill("CESSATION-RESIGNATION-CHECKLIST", {
    "original_resignation_letter_attached": lambda s: _required_document_present(s, "Original Resignation Letter"),
    "dg_acknowledgement_letter_attached": lambda s: _required_document_present(s, "DG's Acknowledgement Letter"),
    "officer_name": lambda s: _dynamic_form_data(s).get("officer_name"),
    "position_title": lambda s: _dynamic_form_data(s).get("position_title"),
    "post_number": lambda s: _dynamic_form_data(s).get("post_number"),
    "department": lambda s: _first(s.department.name if s.department_id else None, _dynamic_form_data(s).get("department")),
    "ministry": lambda s: _first(s.ministry.name if s.ministry_id else None, _dynamic_form_data(s).get("ministry")),
    "salary_grade": lambda s: _dynamic_form_data(s).get("salary_grade"),
    "effective_date_resignation": lambda s: _dynamic_form_data(s).get("resignation_date"),
    "notice_period_compliance": lambda s: _dynamic_form_data(s).get("notice_period_complied"),
    "under_discipline": lambda s: _first(
        _required_document_present(s, "Under Discipline Clearance"),
        _truthy(_dynamic_form_data(s).get("under_discipline")),
    ),
    "bonding_agreement": lambda s: _first(
        _required_document_present(s, "Bonding Agreement"),
        _truthy(_dynamic_form_data(s).get("bonding_agreement")),
    ),
    "highest_qualification": lambda s: None,  # not captured on the digitized form — genuine HR Unit input
    "experience": lambda s: _dynamic_form_data(s).get("employment_history"),
    "reason_of_resignation": lambda s: _dynamic_form_data(s).get("reason_for_resignation"),
    "date_received": lambda s: s.received_at.date().isoformat() if s.received_at else None,
    # performance_rating_latest, qualification_as_per_jd,
    # special_business_education_jd, checked_by, and
    # opsc_recommendation_approved have no submitted fact to check against —
    # left blank for HR Unit's own review.
})

# ── Direct Appointment ──────────────────────────────────────────────────────

register_prefill("RECRUIT-DIRECT-CHECKLIST", {
    "dg_endorsement_letter": lambda s: _first(
        True if s.dg_endorsed_at else None,
        _required_document_present(s, "DG's Endorsement Letter"),
    ),
    "officer_name": lambda s: _dynamic_form_data(s).get("officer_name"),
    "position_title": lambda s: _dynamic_form_data(s).get("position_title"),
    "post_number": lambda s: _dynamic_form_data(s).get("post_number"),
    "department": lambda s: _first(s.department.name if s.department_id else None, _dynamic_form_data(s).get("department")),
    "ministry": lambda s: _first(s.ministry.name if s.ministry_id else None, _dynamic_form_data(s).get("ministry")),
    "date_received": lambda s: s.received_at.date().isoformat() if s.received_at else None,
    "salary_level": lambda s: _dynamic_form_data(s).get("salary_grade"),
    "approved_fv_attached": lambda s: _first(
        _required_document_present(s, "Approved Financial Visa"),
        _truthy(_dynamic_form_data(s).get("financial_visa_attached")),
    ),
    "psc_form_36_attached": lambda s: _first(
        _required_document_present(s, "PSC Form 3-6"),
        _truthy(_dynamic_form_data(s).get("psc_form_36_attached")),
    ),
    "officer_pa_rating": lambda s: _dynamic_form_data(s).get("pa_rating"),
    "performance_assessment_satisfactory": lambda s: _first(
        _required_document_present(s, "Performance Appraisal Report"),
        _truthy(_dynamic_form_data(s).get("pa_attached")),
    ),
    "copies_of_academic_qualifications": lambda s: _required_document_present(s, "Academic Qualifications"),
    # criteria_of_post_as_per_jd, highest_qualification_trainings, experience,
    # comments, checked_by, and opsc_recommendation_approved have no
    # submitted fact to check against — left blank for HR Unit's own review.
})
