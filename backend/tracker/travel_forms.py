"""
PSC Forms 4.4 / 4.5 / 4.6 — travel workflows (secretary-only; then ODU Manager → Secretary).

PSC 4.4 (domestic allowance):
- Department staff → department head endorsement → ODU → Secretary
- Ministry CSU staff → DG endorsement → ODU → Secretary
- Department director or ministry DG initiator → ODU → Secretary (no ministry endorsements)

PSC 4.5 / 4.6 (overseas):
- Department staff → department head → DG → ODU → Secretary
- Department director initiator → DG → ODU → Secretary
- Ministry CSU staff → DG → ODU → Secretary
- Ministry DG initiator → ODU → Secretary (no ministry endorsements)
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

# Only ministry HR managers lodge secretary travel; public servants (traveller) view only.
SECRETARY_TRAVEL_CREATOR_ROLES = frozenset({
    Role.MINISTRY_HR,
    Role.PSC_OFFICER,
    Role.PSC_ADMIN,
    Role.PSC_SECRETARY,
})

SECRETARY_TRAVEL_VIEW_ROLES = frozenset({
    Role.TRAVELLER,
    *SECRETARY_TRAVEL_CREATOR_ROLES,
    Role.DEPT_ADMIN,
    Role.HEAD_OF_AGENCY,
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
    return profile.role in SECRETARY_TRAVEL_CREATOR_ROLES


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


def default_head_position_title(department) -> str:
    """Department head label for endorsements (e.g. Chief Statistician, Director, Biosecurity)."""
    if not department:
        return "Department head"
    custom = (getattr(department, "head_position_title", None) or "").strip()
    if custom:
        return custom
    name = (getattr(department, "name", None) or "").strip()
    code = (getattr(department, "code", None) or "").upper()
    if "STATISTIC" in name.upper() or code in {"VNSO", "NSO", "VBS"}:
        return "Chief Statistician"
    if name:
        return f"Director, {name}"
    return "Director"


def ministry_dg_endorsement_label(submission) -> str:
    """DG of the ministry that owns the submission department."""
    ministry = None
    if submission:
        ministry = getattr(submission, "ministry", None)
        if ministry is None and submission.department_id:
            try:
                ministry = submission.department.ministry
            except Exception:
                pass
    if ministry and getattr(ministry, "name", None):
        return f"Director-General — {ministry.name}"
    return "Director-General (or Officer-in-Charge / Acting DG)"


def _submission_department_id(submission) -> int | None:
    if not submission:
        return None
    return getattr(submission, "department_id", None) or None


def is_ministry_csu_initiator(submission) -> bool:
    """Ministry corporate services staff: ministry_hr with no department scope."""
    prof = _creator_profile(submission)
    if not prof or prof.role != Role.MINISTRY_HR:
        return False
    if prof.department_id or _submission_department_id(submission):
        return False
    return True


def is_department_staff_initiator(submission) -> bool:
    """Department staff (not CSU, not director/DG head_of_agency)."""
    prof = _creator_profile(submission)
    if not prof or prof.role == Role.HEAD_OF_AGENCY:
        return False
    if is_ministry_csu_initiator(submission):
        return False
    if prof.role in {Role.TRAVELLER, Role.DEPT_ADMIN}:
        return True
    if prof.role == Role.MINISTRY_HR and (
        prof.department_id or _submission_department_id(submission)
    ):
        return True
    return False


def _submission_department(submission):
    if not submission or not submission.department_id:
        return None
    try:
        return submission.department
    except Exception:
        return None


def _dg_section(submission) -> dict:
    return {
        "key": "dg_signature",
        "label": ministry_dg_endorsement_label(submission),
        "signer": SIGNER_DG,
    }


def _director_section(submission) -> dict:
    return {
        "key": "director_signature",
        "label": default_head_position_title(_submission_department(submission)),
        "signer": SIGNER_DIRECTOR,
    }


def _endorsement_sections_44(submission) -> list[dict]:
    if is_ministry_dg_submission(submission) or is_dept_director_submission(submission):
        return []
    if is_ministry_csu_initiator(submission):
        return [_dg_section(submission)]
    if is_department_staff_initiator(submission):
        return [_director_section(submission)]
    return []


def _endorsement_sections_45_46(submission) -> list[dict]:
    if is_ministry_dg_submission(submission):
        return []
    sections: list[dict] = []
    if is_department_staff_initiator(submission):
        sections.append(_director_section(submission))
    sections.append(_dg_section(submission))
    return sections


def assert_may_create_secretary_travel_form(profile, form_code: str | None) -> None:
    code = normalize_form_type_code(form_code)
    if not code or code not in TRAVEL_FORM_CODES:
        return
    if code == TRAVEL_FORM_44:
        if profile.role in SECRETARY_TRAVEL_CREATOR_ROLES:
            return
        raise PermissionDenied("You are not authorised to create PSC Form 4.4.")
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
        return _endorsement_sections_44(submission)
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
        if prof.department_id:
            return False
        if submission.ministry_id and prof.ministry_id == submission.ministry_id:
            return True
    return False


def recipient_for_signer_slot(submission, signer: str):
    """Resolve the ministry official who should sign this slot (for notifications)."""
    from .models import Profile

    if not submission:
        return None
    if signer == SIGNER_DIRECTOR:
        if not submission.department_id:
            return None
        prof = (
            Profile.objects.filter(
                role=Role.HEAD_OF_AGENCY,
                department_id=submission.department_id,
                ministry_id=submission.ministry_id,
                user__is_active=True,
            )
            .select_related("user")
            .first()
        )
        return prof.user if prof else None
    if signer == SIGNER_DG:
        prof = (
            Profile.objects.filter(
                role=Role.HEAD_OF_AGENCY,
                ministry_id=submission.ministry_id,
                department__isnull=True,
                user__is_active=True,
            )
            .select_related("user")
            .first()
        )
        return prof.user if prof else None
    return None


def sync_travel_endorsers_from_roles(submission) -> dict:
    """Populate travel_endorsers user ids from ministry role assignments (not manual entry)."""
    endorsers: dict = {}
    sections = endorsement_sections(submission.form_type_code or "", submission)
    for section in sections:
        signer = section.get("signer")
        if signer in {SIGNER_DIRECTOR, SIGNER_DG}:
            user = recipient_for_signer_slot(submission, signer)
            if user:
                endorsers[signer] = user.id
    return endorsers


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
