"""
PSC Forms 4.4 / 4.5 / 4.6 — travel & overseas mission workflows.

These are secretary-only (never Commission). Created by the traveller; ministry
endorsements are captured as in-system section signatures before submit.
Forms 4.5 and 4.6 require an official approval letter after Secretary sign-off.
"""

from __future__ import annotations

from tracker.models import Role

TRAVEL_CATEGORY_CODE = "TRAVEL"

TRAVEL_FORM_44 = "PSC 4.4"
TRAVEL_FORM_45 = "PSC 4.5"
TRAVEL_FORM_46 = "PSC 4.6"

TRAVEL_FORM_CODES = frozenset({TRAVEL_FORM_44, TRAVEL_FORM_45, TRAVEL_FORM_46})
TRAVEL_LETTER_FORM_CODES = frozenset({TRAVEL_FORM_45, TRAVEL_FORM_46})

# Signer role hints used by the sign-section API
SIGNER_CREATOR = "creator"
SIGNER_HOD = "hod"
SIGNER_DIRECTOR = "director"
SIGNER_DG = "dg"
SIGNER_MINISTER = "minister"
SIGNER_SECRETARY = "secretary"

TRAVEL_FORM_TYPES = (
    (TRAVEL_FORM_44, "Domestic Travel Allowance (Form 4.4)"),
    (TRAVEL_FORM_45, "Individual Overseas Travel Approval (Form 4.5)"),
    (TRAVEL_FORM_46, "Mission Group Overseas Travel Approval (Form 4.6)"),
)


def is_travel_form_code(code: str | None) -> bool:
    return bool(code and code in TRAVEL_FORM_CODES)


def requires_approval_letter(code: str | None) -> bool:
    return bool(code and code in TRAVEL_LETTER_FORM_CODES)


def endorsement_sections(form_type_code: str) -> list[dict]:
    """Ordered endorsement slots that must be signed before submit to PSC."""
    if form_type_code == TRAVEL_FORM_44:
        return [
            {"key": "claimant_signature", "label": "Travelling staff member", "signer": SIGNER_CREATOR},
            {"key": "hod_signature", "label": "Head of Department", "signer": SIGNER_HOD},
        ]
    if form_type_code == TRAVEL_FORM_45:
        return [
            {"key": "applicant_signature", "label": "Applicant", "signer": SIGNER_CREATOR},
            {"key": "director_signature", "label": "Director", "signer": SIGNER_DIRECTOR},
            {"key": "dg_signature", "label": "Director-General", "signer": SIGNER_DG},
            {"key": "minister_signature", "label": "Minister", "signer": SIGNER_MINISTER, "optional": True},
        ]
    if form_type_code == TRAVEL_FORM_46:
        return [
            {"key": "mission_leader_signature", "label": "Mission leader", "signer": SIGNER_CREATOR},
            {"key": "director_signature", "label": "Director", "signer": SIGNER_DIRECTOR},
            {"key": "dg_signature", "label": "Director-General", "signer": SIGNER_DG},
            {"key": "minister_signature", "label": "Minister / PM", "signer": SIGNER_MINISTER},
        ]
    return []


def secretary_decision_section(form_type_code: str) -> dict | None:
    if form_type_code in TRAVEL_LETTER_FORM_CODES or form_type_code == TRAVEL_FORM_44:
        return {"key": "secretary_decision", "label": "PSC Secretary", "signer": SIGNER_SECRETARY}
    return None


def missing_endorsements(form_type_code: str, signed_keys: set[str]) -> list[str]:
    missing = []
    for section in endorsement_sections(form_type_code):
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

    if signer == SIGNER_HOD and role == Role.DEPT_ADMIN:
        if submission.department_id and prof.department_id == submission.department_id:
            return True
    if signer == SIGNER_DIRECTOR and role == Role.DEPT_ADMIN:
        if submission.department_id and prof.department_id == submission.department_id:
            return True
    if signer == SIGNER_DG and role == Role.HEAD_OF_AGENCY:
        if submission.ministry_id and prof.ministry_id == submission.ministry_id:
            return True
    if signer == SIGNER_MINISTER and role == Role.HEAD_OF_AGENCY:
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
