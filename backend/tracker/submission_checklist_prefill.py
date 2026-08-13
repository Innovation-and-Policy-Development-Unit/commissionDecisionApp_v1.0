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


def _only_if(condition: Callable[[Submission], bool], getter: PrefillGetter) -> PrefillGetter:
    """Gate a getter behind a submission-level condition — e.g. a field that
    only means something for a contract *extension* shouldn't be answered
    from Required Document evidence when the submission is actually a new
    (first-time) contract, even if that document happens to be marked
    present (auto-created checklist items default across all configured
    documents regardless of whether they apply to this submission)."""
    def wrapped(s: Submission) -> Any:
        return getter(s) if condition(s) else None
    return wrapped


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

# ── Contract Employment ─────────────────────────────────────────────────────

_CONTRACT_HISTORY_MAP = {
    "new": "First Time",
    "new contract": "First Time",
    "extension": "Been Engaged Before",
    "extension of existing contract": "Been Engaged Before",
}


def _contract_history(s: Submission) -> str | None:
    raw = str(_dynamic_form_data(s).get("contract_type") or "").strip().lower()
    return _CONTRACT_HISTORY_MAP.get(raw)


register_prefill("RECRUIT-CONTRACT-CHECKLIST", {
    "dg_endorsement_letter": lambda s: _first(
        True if s.dg_endorsed_at else None,
        _required_document_present(s, "DG's Endorsement Letter"),
    ),
    "officer_name": lambda s: _dynamic_form_data(s).get("officer_name"),
    "position_title": lambda s: _dynamic_form_data(s).get("position_title"),
    "department": lambda s: _first(s.department.name if s.department_id else None, _dynamic_form_data(s).get("department")),
    "ministry": lambda s: _first(s.ministry.name if s.ministry_id else None, _dynamic_form_data(s).get("ministry")),
    "date_received": lambda s: s.received_at.date().isoformat() if s.received_at else None,
    "contract_history": _contract_history,
    "salary_level": lambda s: _dynamic_form_data(s).get("salary_level"),
    "required_qualification_stated": lambda s: bool(_dynamic_form_data(s).get("required_qualification")) or None,
    "start_date": lambda s: _dynamic_form_data(s).get("start_date"),
    "end_date": lambda s: _dynamic_form_data(s).get("end_date"),
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
    "tor_jd_attached": lambda s: _first(
        _required_document_present(s, "Terms of Reference", "Job Description"),
        _truthy(_dynamic_form_data(s).get("tor_jd_attached")),
    ),
    "candidates_qualification": lambda s: _dynamic_form_data(s).get("candidate_qualification"),
    # performance_assessment_satisfactory and break_in_service_observed only
    # apply to an extension — gated on contract_type first, so a Required
    # Document that happens to be marked present (auto-created for every
    # submission of this form type regardless of applicability) can't
    # answer "Yes" for a first-time contract where the item is N/A, not No.
    "performance_assessment_satisfactory": _only_if(
        lambda s: _contract_history(s) == "Been Engaged Before",
        lambda s: _first(
            _required_document_present(s, "Performance Assessment"),
            _truthy(_dynamic_form_data(s).get("pa_attached")),
        ),
    ),
    "break_in_service_observed": _only_if(
        lambda s: _contract_history(s) == "Been Engaged Before",
        lambda s: _first(
            _required_document_present(s, "Break-in-Service"),
            _truthy(_dynamic_form_data(s).get("break_in_service_observed")),
        ),
    ),
    "unsigned_agreement_attached": lambda s: _first(
        _required_document_present(s, "Unsigned Agreement of Service"),
        _truthy(_dynamic_form_data(s).get("unsigned_agreement_attached")),
    ),
    # comments, checked_by, and opsc_recommendation_approved have no
    # submitted fact to check against — left blank for HR Unit's own review.
})

# ── Confirmation of Appointment ─────────────────────────────────────────────

register_prefill("RECRUIT-CONFIRM-CHECKLIST", {
    "dg_endorsement_letter": lambda s: _first(
        True if s.dg_endorsed_at else None,
        _required_document_present(s, "DG's Endorsement Letter"),
    ),
    "officer_name": lambda s: _dynamic_form_data(s).get("officer_name"),
    "position_title": lambda s: _dynamic_form_data(s).get("position_title"),
    "department": lambda s: _first(s.department.name if s.department_id else None, _dynamic_form_data(s).get("department")),
    "ministry": lambda s: _first(s.ministry.name if s.ministry_id else None, _dynamic_form_data(s).get("ministry")),
    "date_received": lambda s: s.received_at.date().isoformat() if s.received_at else None,
    "salary_level": lambda s: _dynamic_form_data(s).get("salary_level"),
    "officer_pa_rating": lambda s: _dynamic_form_data(s).get("pa_rating"),
    "performance_assessment_satisfactory": lambda s: _first(
        _required_document_present(s, "Performance Appraisal Report"),
        _truthy(_dynamic_form_data(s).get("pa_attached")),
    ),
    # opsc_recommendation_approved has no submitted fact to check against —
    # left blank for HR Unit's own review.
})

# ── Appointment (Probation) ─────────────────────────────────────────────────


def _merit_process_evidence(s: Submission) -> bool | None:
    data = _dynamic_form_data(s)
    documented = any(
        (data.get(k) or "").strip()
        for k in ("panel_constitution", "shortlist_results", "interview_results")
    )
    return _first(
        True if documented else None,
        _required_document_present(s, "Comparative Assessment", "Selection Outcome Report"),
    )


register_prefill("RECRUIT-PROBATION-CHECKLIST", {
    "dg_endorsement_letter": lambda s: _first(
        True if s.dg_endorsed_at else None,
        _required_document_present(s, "DG's Endorsement Letter"),
    ),
    "recommended_officer_name": lambda s: _dynamic_form_data(s).get("recommended_name"),
    "eligible_officer_name": lambda s: _dynamic_form_data(s).get("eligible_name"),
    "position_title": lambda s: _dynamic_form_data(s).get("position_title"),
    "post_number": lambda s: _dynamic_form_data(s).get("post_number"),
    "department": lambda s: _first(s.department.name if s.department_id else None, _dynamic_form_data(s).get("department")),
    "ministry": lambda s: _first(s.ministry.name if s.ministry_id else None, _dynamic_form_data(s).get("ministry")),
    "essential_productive_services": lambda s: _truthy(_dynamic_form_data(s).get("is_essential_service")),
    "salary_grade": lambda s: _dynamic_form_data(s).get("salary_grade"),
    "merit_process_followed": _merit_process_evidence,
    "approved_fv_attached": lambda s: _first(
        _required_document_present(s, "Approved Financial Visa"),
        _truthy(_dynamic_form_data(s).get("financial_visa_attached")),
    ),
    "comparative_selection_outcome_report_attached": lambda s: _required_document_present(
        s, "Selection Outcome Report", "Comparative Assessment",
    ),
    "jd_structure_attached": lambda s: _required_document_present(
        s, "Job Description", "Organisation Structure Chart",
    ),
    "vacancy_notice_attached": lambda s: _required_document_present(s, "Vacancy Notice"),
    "application_recommend_eligible_attached": lambda s: _required_document_present(
        s, "Recommended Candidate's Application", "Eligible Candidate's Application",
    ),
    "psc_form_32_attached": lambda s: _required_document_present(
        s, "Recommended Candidate's Application", "Eligible Candidate's Application",
    ),
    "recommended_highest_qualification": lambda s: _dynamic_form_data(s).get("recommended_qualification"),
    "recommended_work_experience": lambda s: _dynamic_form_data(s).get("recommended_experience"),
    "eligible_highest_qualification": lambda s: _dynamic_form_data(s).get("eligible_qualification"),
    "eligible_work_experience": lambda s: _dynamic_form_data(s).get("eligible_experience"),
    # qualification_as_per_jd, special_business_education, comments,
    # checked_by, and opsc_recommendation_approved have no submitted fact
    # to check against — left blank for HR Unit's own review.
})
