"""
PSC Forms 4.4 / 4.5 / 4.6 — travel workflows.

Workflow (v1.0 behaviour aligned with current policy):
- 4.4: Department Director / Ministry DG only. No ministry endorsements captured in SCDMS.
  Routed to ODU Manager review, then Secretary approval.
- 4.5 / 4.6: ODU Manager → Secretary. Department staff: Director → DG before submit.
  Ministry CSU staff (ministry HR without a department): DG only before submit.
  DG may delegate to Officer-in-Charge (< 5 days leave) or Acting DG (≥ 5 days).
"""

from __future__ import annotations

import re

from django.core.exceptions import PermissionDenied

from tracker.models import Role

TRAVEL_CATEGORY_CODE = "TRAVEL"

TRAVEL_FORM_44 = "PSC 4.4"
TRAVEL_FORM_45 = "PSC 4.5"
TRAVEL_FORM_46 = "PSC 4.6"

TRAVEL_FORM_CODES = frozenset({TRAVEL_FORM_44, TRAVEL_FORM_45, TRAVEL_FORM_46})
TRAVELLER_SECRETARY_FORM_CODES = frozenset({TRAVEL_FORM_45, TRAVEL_FORM_46})
TRAVEL_LETTER_FORM_CODES = frozenset({TRAVEL_FORM_45, TRAVEL_FORM_46})

FORM_44_CREATOR_ROLES = frozenset({Role.HEAD_OF_AGENCY})
SECRETARY_TRAVEL_CREATOR_ROLES = frozenset({
    Role.TRAVELLER,
    Role.MINISTRY_HR,
    Role.DEPT_ADMIN,
    Role.HEAD_OF_AGENCY,
    Role.PSC_OFFICER,
    Role.PSC_ADMIN,
    Role.PSC_SECRETARY,
})

# Signer role hints used by the sign-section API
SIGNER_CREATOR = "creator"
SIGNER_DIRECTOR = "director"
SIGNER_DG = "dg"
SIGNER_SECRETARY = "secretary"
SIGNER_ODU_MANAGER = "odu_manager"

TRAVEL_FORM_TYPES = (
    (TRAVEL_FORM_44, "Domestic Travel Allowance (Form 4.4)"),
    (TRAVEL_FORM_45, "Individual Overseas Travel Approval (Form 4.5)"),
    (TRAVEL_FORM_46, "Mission Group Overseas Travel Approval (Form 4.6)"),
)


def normalize_form_type_code(code: str | None) -> str:
    """Accept registry variants such as PSC4.4 vs PSC 4.4."""
    if not code:
        return ""
    c = re.sub(r"\s+", " ", str(code).strip())
    compact = c.upper().replace(" ", "")
    if compact == "PSC4.4":
        return TRAVEL_FORM_44
    if compact == "PSC4.5":
        return TRAVEL_FORM_45
    if compact == "PSC4.6":
        return TRAVEL_FORM_46
    return c


def is_travel_form_code(code: str | None) -> bool:
    return normalize_form_type_code(code) in TRAVEL_FORM_CODES


def is_form_44_code(code: str | None) -> bool:
    return normalize_form_type_code(code) == TRAVEL_FORM_44


def requires_approval_letter(code: str | None) -> bool:
    return normalize_form_type_code(code) in TRAVEL_LETTER_FORM_CODES


def can_create_form_44(profile) -> bool:
    return profile.role in FORM_44_CREATOR_ROLES


def _creator_profile(submission):
    if not submission or not submission.created_by_id:
        return None
    try:
        return submission.created_by.psc_profile
    except Exception:
        return None


def is_dept_director_submission(submission) -> bool:
    """Department director: head_of_agency with a department on profile or submission."""
    prof = _creator_profile(submission)
    if not prof or prof.role != Role.HEAD_OF_AGENCY:
        return False
    return bool(prof.department_id or getattr(submission, "department_id", None))


def is_ministry_dg_submission(submission) -> bool:
    """Ministry DG: head_of_agency without a department scope."""
    prof = _creator_profile(submission)
    if not prof or prof.role != Role.HEAD_OF_AGENCY:
        return False
    return not (prof.department_id or getattr(submission, "department_id", None))


def _submission_department_id(submission) -> int | None:
    if not submission:
        return None
    return getattr(submission, "department_id", None) or None


def is_ministry_csu_initiator(submission) -> bool:
    """
    Ministry central / CSU staff: ministry_hr with no department on profile or submission.
    They need DG endorsement only (not the department director).
    """
    prof = _creator_profile(submission)
    if not prof or prof.role != Role.MINISTRY_HR:
        return False
    if prof.department_id or _submission_department_id(submission):
        return False
    return True


def needs_department_director_endorsement(submission) -> bool:
    """Department staff path for 4.5 / 4.6: Director then DG."""
    prof = _creator_profile(submission)
    if not prof:
        return True
    if prof.role == Role.HEAD_OF_AGENCY:
        return False
    if is_ministry_csu_initiator(submission):
        return False
    return True


def _endorsement_sections_45_46(submission) -> list[dict]:
    prof = _creator_profile(submission)
    if prof and prof.role == Role.HEAD_OF_AGENCY:
        return []
    sections: list[dict] = []
    if needs_department_director_endorsement(submission):
        sections.append(
            {
                "key": "director_signature",
                "label": "Department Director",
                "signer": SIGNER_DIRECTOR,
            }
        )
    sections.append(
        {
            "key": "dg_signature",
            "label": "Director-General (or Officer-in-Charge / Acting DG)",
            "signer": SIGNER_DG,
        }
    )
    return sections


def assert_may_create_secretary_travel_form(profile, form_code: str | None) -> None:
    code = normalize_form_type_code(form_code)
    if not code or code not in TRAVEL_FORM_CODES:
        return
    if code == TRAVEL_FORM_44:
        if profile.role in FORM_44_CREATOR_ROLES:
            return
        if profile.role in {Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY}:
            return
        raise PermissionDenied(
            "PSC Form 4.4 is only for department directors and ministry Director-General. "
            "Staff domestic travel is approved within your ministry and is not lodged here."
        )
    if code in TRAVELLER_SECRETARY_FORM_CODES:
        if profile.role in SECRETARY_TRAVEL_CREATOR_ROLES:
            return
        raise PermissionDenied(
            "You are not authorised to create this travel form."
        )


def endorsement_sections(form_type_code: str, submission=None) -> list[dict]:
    """Ordered endorsement slots that must be signed before submit to PSC."""
    code = normalize_form_type_code(form_type_code)
    if code == TRAVEL_FORM_44:
        # 4.4 goes directly to ODU Manager review; no ministry endorsement slots.
        return []
    if code in {TRAVEL_FORM_45, TRAVEL_FORM_46}:
        return _endorsement_sections_45_46(submission)
    return []


def secretary_decision_section(form_type_code: str) -> dict | None:
    code = normalize_form_type_code(form_type_code)
    if code in TRAVEL_LETTER_FORM_CODES or code == TRAVEL_FORM_44:
        return {"key": "secretary_decision", "label": "PSC Secretary", "signer": SIGNER_SECRETARY}
    return None


def missing_endorsements(
    form_type_code: str, signed_keys: set[str], submission=None
) -> list[str]:
    missing = []
    for section in endorsement_sections(form_type_code, submission):
        if section.get("optional"):
            continue
        if section["key"] not in signed_keys:
            missing.append(section["key"])
    return missing


def user_may_sign_section(
    *,
    section: dict,
    user,
    submission,
    endorsers: dict,
) -> bool:
    """Return True if user is allowed to sign this endorsement section."""
    from django.contrib.auth.models import User

    if not user or not user.is_authenticated:
        return False
    signer = section.get("signer")
    if signer == SIGNER_CREATOR:
        return submission.created_by_id == user.id
    if signer == SIGNER_SECRETARY:
        try:
            return user.psc_profile.role in {Role.PSC_SECRETARY, Role.PSC_ADMIN}
        except Exception:
            return user.is_staff or user.is_superuser

    uid = endorsers.get(signer) or endorsers.get(f"{signer}_id")
    if uid and int(uid) == user.id:
        return True

    try:
        role = user.psc_profile.role
        prof = user.psc_profile
    except Exception:
        return False

    if signer == SIGNER_DIRECTOR and role == Role.HEAD_OF_AGENCY:
        if submission.department_id and prof.department_id == submission.department_id:
            return True
    if signer == SIGNER_DIRECTOR and role == Role.DEPT_ADMIN:
        if submission.department_id and prof.department_id == submission.department_id:
            return True
    if signer == SIGNER_DG and role == Role.HEAD_OF_AGENCY:
        if submission.ministry_id and prof.ministry_id == submission.ministry_id:
            return True
    return False


def _field(label, key, ftype="text", required=False, order=0, **extra):
    row = {
        "label": label,
        "field_key": key,
        "field_type": ftype,
        "is_required": required,
        "display_order": order,
    }
    row.update(extra)
    return row


def _section(label, order, new_page=False):
    return _field(label, f"section_{order}", "section_header", order=order, start_new_page=new_page)


def fields_for_form_44() -> list[dict]:
    o = 10
    rows = [
        _section("Claimant details", o),
        _field("Name of claimant", "claimant_name", required=True, order=o + 10),
        _field("Payroll number", "payroll_number", required=True, order=o + 20),
        _field("Post title", "post_title", required=True, order=o + 30),
        _field("Post number", "post_number", order=o + 40),
        _field("Employment status", "employment_status", order=o + 50),
        _field("Normal work location", "normal_work_location", required=True, order=o + 60),
        _section("Purpose of travel", o + 100),
        _field(
            "Purpose",
            "travel_purpose",
            "radio",
            required=True,
            order=o + 110,
            choices="Duty Travel\nWorkshop/Training\nTemporary Transfer\nOthers",
        ),
        _field("Other purpose (specify)", "travel_purpose_other", order=o + 120),
        _section("Itinerary & accommodation", o + 200, new_page=True),
        _field(
            "Itinerary details",
            "itinerary_details",
            "textarea",
            required=True,
            order=o + 210,
            help_text="Place(s), arrival/departure dates and times, accommodation type and cost.",
        ),
        _field("Total amount (VT)", "total_amount_vt", "number", required=True, order=o + 220),
    ]
    return rows


def fields_for_form_45() -> list[dict]:
    o = 10
    return [
        _section("Applicant information", o),
        _field("Name", "applicant_name", required=True, order=o + 10),
        _field("Payroll number", "payroll_number", required=True, order=o + 20),
        _field("Post title", "post_title", required=True, order=o + 30),
        _field("Post number", "post_number", order=o + 40),
        _field("Department", "department_name", required=True, order=o + 50),
        _field("Ministry", "ministry_name", required=True, order=o + 60),
        _field(
            "Previous overseas official travel",
            "previous_overseas_travel",
            "radio",
            order=o + 70,
            choices="Yes\nNo",
        ),
        _section("Justification and duration", o + 100),
        _field("Purpose of travel", "travel_purpose", "textarea", required=True, order=o + 110),
        _field("Duration from", "duration_from", "date", required=True, order=o + 120),
        _field("Duration to", "duration_to", "date", required=True, order=o + 130),
        _field("Benefit to Vanuatu", "benefit_to_vanuatu", "textarea", required=True, order=o + 140),
        _section("Places to visit", o + 200),
        _field("Itinerary / places", "places_itinerary", "textarea", required=True, order=o + 210),
        _section("Acting arrangements", o + 300),
        _field("Acting officer name", "acting_name", order=o + 310),
        _field("Acting post title", "acting_post_title", order=o + 320),
        _field("Acting post number", "acting_post_number", order=o + 330),
        _field("Acting salary (VT)", "acting_salary_vt", "number", order=o + 340),
        _section("Cost of proposed travel", o + 400, new_page=True),
        _field("Funding source", "funding_source", "textarea", required=True, order=o + 410),
        _field("Total estimated travel cost (VT)", "estimated_cost_vt", "number", required=True, order=o + 420),
        _field("Total acting allowance (VT)", "acting_allowance_vt", "number", order=o + 430),
        _field("Travelling with imprest?", "with_imprest", "radio", order=o + 440, choices="Yes\nNo"),
        _field("Government imprest amount (VT)", "imprest_amount_vt", "number", order=o + 450),
        _field("DG is the applicant (Minister approval required)", "dg_is_applicant", "checkbox", order=o + 460),
    ]


def fields_for_form_46() -> list[dict]:
    o = 10
    return [
        _section("Mission description", o),
        _field("Purpose of mission", "mission_purpose", "textarea", required=True, order=o + 10),
        _field("Benefits to Vanuatu", "benefits_to_vanuatu", "textarea", required=True, order=o + 20),
        _section("Mission members", o + 100),
        _field(
            "Mission group members",
            "mission_members",
            "textarea",
            required=True,
            order=o + 110,
            help_text="Name, post title, and justification for each member.",
        ),
        _field(
            "Acting arrangements",
            "acting_arrangements",
            "textarea",
            order=o + 120,
        ),
        _section("Places and dates", o + 200),
        _field("Places / organizations / dates", "places_and_dates", "textarea", required=True, order=o + 210),
        _section("Cost of mission", o + 300, new_page=True),
        _field("Funding source", "funding_source", "textarea", required=True, order=o + 310),
        _field("Total estimated travel costs (VT)", "estimated_cost_vt", "number", required=True, order=o + 320),
        _field("Total acting allowances (VT)", "acting_allowance_vt", "number", order=o + 330),
    ]


def fields_for_form_type(code: str) -> list[dict]:
    builders = {
        TRAVEL_FORM_44: fields_for_form_44,
        TRAVEL_FORM_45: fields_for_form_45,
        TRAVEL_FORM_46: fields_for_form_46,
    }
    fn = builders.get(code)
    return fn() if fn else []
