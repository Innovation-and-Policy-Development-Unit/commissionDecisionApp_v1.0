"""
Compliance unit submission types, role rules, and digitized form field definitions.

All COMP-* submissions are OPSC-internal: initiated by the Compliance unit (not
ministry HR), routed_unit=compliance, is_internal=True, and use the internal
Secretary workflow (no ministry checklist).
"""

from __future__ import annotations

from tracker.models import Role

COMPLIANCE_CATEGORY_CODE = "COMPLIANCE"

# Form type codes (also used as submission.form_type_code)
COMP_SMDR = "COMP-SMDR"
COMP_PAR = "COMP-PAR"
COMP_PSDB = "COMP-PSDB"
COMP_14D = "COMP-14D"
COMP_OMB = "COMP-OMB"
COMP_PSA = "COMP-PSA"

COMPLIANCE_FORM_CODES = (
    COMP_SMDR,
    COMP_PAR,
    COMP_PSDB,
    COMP_14D,
    COMP_OMB,
    COMP_PSA,
)

COMPLIANCE_SUBMITTER_ROLES = frozenset({
    Role.COMPLIANCE_SENIOR,
    Role.COMPLIANCE_PRINCIPAL,
    Role.COMPLIANCE_MANAGER,
})

# Principal and Manager only for PSA amendment submissions
COMPLIANCE_PSA_SUBMITTER_ROLES = frozenset({
    Role.COMPLIANCE_PRINCIPAL,
    Role.COMPLIANCE_MANAGER,
})

# Map CMS case_family → portal form_type_code when registering with the Commission Portal
CMS_CASE_FAMILY_TO_FORM_TYPE = {
    "employee_disciplinary": COMP_SMDR,
    "serious_misconduct_employee": COMP_SMDR,
    "temporary_suspension": COMP_SMDR,
    "grievance": COMP_OMB,
    "senior_serious_misconduct": COMP_SMDR,
    "senior_poor_performance": COMP_PAR,
    "policy_review": COMP_PSA,
}


def form_type_for_cms_case(case_family: str, form_type_code: str | None = None) -> str:
    if form_type_code and form_type_code in COMPLIANCE_FORM_CODES:
        return form_type_code
    return CMS_CASE_FAMILY_TO_FORM_TYPE.get((case_family or "").strip(), COMP_SMDR)

FORM_META = {
    COMP_SMDR: {
        "name": "Staff Member Disciplinary Report (SMDR)",
        "description": "OPSC internal — Compliance unit SMDR intake and commission routing.",
        "digitized_form_key": "comp_smdr",
        "display_order": 10,
        "psa_restricted": False,
    },
    COMP_PAR: {
        "name": "Preliminary Assessment Report",
        "description": "Preliminary assessment following disciplinary intake.",
        "digitized_form_key": "comp_par",
        "display_order": 20,
        "psa_restricted": False,
    },
    COMP_PSDB: {
        "name": "PSDB Order on Determination",
        "description": "Public Service Disciplinary Board order on determination.",
        "digitized_form_key": "comp_psdb",
        "display_order": 30,
        "psa_restricted": False,
    },
    COMP_14D: {
        "name": "Response to PSC 14 Days Notice",
        "description": "Formal response to a PSC 14-day notice.",
        "digitized_form_key": "comp_14d",
        "display_order": 40,
        "psa_restricted": False,
    },
    COMP_OMB: {
        "name": "Ombudsman Request for Information from PSC",
        "description": "PSC response to an Ombudsman request for information.",
        "digitized_form_key": "comp_omb",
        "display_order": 50,
        "psa_restricted": False,
    },
    COMP_PSA: {
        "name": "Proposed Amendment to Public Service Act",
        "description": "Compliance submission for proposed PSA amendments (Manager & Principal only).",
        "digitized_form_key": "comp_psa",
        "display_order": 60,
        "psa_restricted": True,
    },
}


def compliance_form_codes_for_role(role: str) -> list[str]:
    """Return active compliance form type codes the role may select when creating a submission."""
    if role not in COMPLIANCE_SUBMITTER_ROLES:
        return []
    codes = []
    for code, meta in FORM_META.items():
        if meta["psa_restricted"] and role not in COMPLIANCE_PSA_SUBMITTER_ROLES:
            continue
        codes.append(code)
    return codes


def assert_compliance_may_use_form_type(role: str, form_type_code: str) -> None:
    from django.core.exceptions import PermissionDenied

    if role not in COMPLIANCE_SUBMITTER_ROLES:
        raise PermissionDenied("Only Compliance unit staff may use compliance submission types.")
    if form_type_code not in COMPLIANCE_FORM_CODES:
        raise PermissionDenied("Unknown compliance submission type.")
    allowed = compliance_form_codes_for_role(role)
    if form_type_code not in allowed:
        raise PermissionDenied(
            "Your role cannot create this submission type. "
            "Proposed Amendment to the Public Service Act is limited to Compliance Principal and Manager."
        )


def _section(label, key, order, new_page=False):
    return {
        "label": label,
        "field_key": key,
        "field_type": "section_header",
        "is_required": False,
        "display_order": order,
        "start_new_page": new_page,
    }


def _fld(label, key, order, field_type="text", required=False, placeholder="", help_text="", choices=""):
    row = {
        "label": label,
        "field_key": key,
        "field_type": field_type,
        "is_required": required,
        "display_order": order,
        "placeholder": placeholder,
        "help_text": help_text,
        "start_new_page": False,
    }
    if choices:
        row["choices"] = choices
    return row


def fields_for_form_type(code: str) -> list[dict]:
    builders = {
        COMP_SMDR: _fields_smdr,
        COMP_PAR: _fields_par,
        COMP_PSDB: _fields_psdb,
        COMP_14D: _fields_14d,
        COMP_OMB: _fields_omb,
        COMP_PSA: _fields_psa,
    }
    return builders[code]()


def _fields_smdr():
    return [
        _section("Staff member details", "smdr_staff_hdr", 10),
        _fld("Employee full name", "employee_full_name", 20, required=True),
        _fld("Employee ID / file number", "employee_id", 30),
        _fld("Ministry / agency", "employee_ministry", 40, required=True),
        _fld("Department / unit", "employee_department", 50),
        _fld("Position title", "position_title", 60, required=True),
        _fld("Salary scale / grade", "salary_grade", 70),
        _section("Disciplinary matter", "smdr_matter_hdr", 80, new_page=True),
        _fld("Date of incident / conduct", "incident_date", 90, field_type="date", required=True),
        _fld("Place of incident", "incident_place", 100),
        _fld("Summary of alleged conduct", "conduct_summary", 110, field_type="textarea", required=True),
        _fld("Policy / regulation breached", "policy_breached", 120, field_type="textarea"),
        _fld("Witnesses (names & contact)", "witnesses", 130, field_type="textarea"),
        _fld("Prior warnings or related cases", "prior_warnings", 140, field_type="textarea"),
        _section("Reporting officer", "smdr_report_hdr", 150),
        _fld("Reporting officer name & title", "reporting_officer", 160, required=True),
        _fld("Date of report", "report_date", 170, field_type="date", required=True),
        _fld("Attachments list", "attachments_list", 180, field_type="textarea",
             help_text="List documents uploaded to this submission."),
    ]


def _fields_par():
    return [
        _section("Case reference", "par_ref_hdr", 10),
        _fld("Linked SMDR / case reference", "case_reference", 20, required=True),
        _fld("Subject employee name", "subject_name", 30, required=True),
        _fld("Ministry / agency", "subject_ministry", 40, required=True),
        _section("Preliminary assessment", "par_assess_hdr", 50, new_page=True),
        _fld("Date of assessment", "assessment_date", 60, field_type="date", required=True),
        _fld("Summary of facts considered", "facts_summary", 70, field_type="textarea", required=True),
        _fld("Preliminary findings", "preliminary_findings", 80, field_type="textarea", required=True),
        _fld("Recommended next steps", "recommended_steps", 90, field_type="textarea", required=True),
        _fld("Risk / urgency notes", "risk_notes", 100, field_type="textarea"),
        _section("Sign-off", "par_sign_hdr", 110),
        _fld("Assessing officer", "assessing_officer", 120, required=True),
        _fld("Compliance Manager endorsement", "manager_endorsement", 130, field_type="textarea"),
    ]


def _fields_psdb():
    return [
        _section("PSDB order", "psdb_hdr", 10),
        _fld("Order reference number", "order_reference", 20, required=True),
        _fld("Date of order", "order_date", 30, field_type="date", required=True),
        _fld("Subject employee / matter", "order_subject", 40, required=True),
        _fld("Ministry / agency", "order_ministry", 50, required=True),
        _section("Determination", "psdb_det_hdr", 60, new_page=True),
        _fld("Summary of determination", "determination_summary", 70, field_type="textarea", required=True),
        _fld("Orders made (sanction / outcome)", "orders_made", 80, field_type="textarea", required=True),
        _fld("Effective date", "effective_date", 90, field_type="date"),
        _fld("Appeal / review rights noted", "appeal_rights", 100, field_type="textarea"),
        _fld("Distribution list", "distribution", 110, field_type="textarea"),
        _fld("Recording officer", "recording_officer", 120, required=True),
    ]


def _fields_14d():
    return [
        _section("PSC notice", "d14_notice_hdr", 10),
        _fld("PSC notice reference", "notice_reference", 20, required=True),
        _fld("Date notice received", "notice_received_date", 30, field_type="date", required=True),
        _fld("Original 14-day deadline", "notice_deadline", 40, field_type="date", required=True),
        _fld("Ministry / agency responding", "responding_ministry", 50, required=True),
        _section("Response", "d14_resp_hdr", 60, new_page=True),
        _fld("Summary of notice requirements", "notice_requirements", 70, field_type="textarea", required=True),
        _fld("Response narrative", "response_narrative", 80, field_type="textarea", required=True),
        _fld("Action taken to comply", "actions_taken", 90, field_type="textarea", required=True),
        _fld("Response submitted on time?", "on_time", 100, field_type="select", required=True,
             choices="Yes\nNo\nPartially"),
        _fld("Authorised signatory", "signatory", 110, required=True),
        _fld("Date of response", "response_date", 120, field_type="date", required=True),
    ]


def _fields_omb():
    return [
        _section("Ombudsman correspondence", "omb_hdr", 10),
        _fld("Ombudsman reference", "omb_reference", 20, required=True),
        _fld("Date received at PSC", "received_date", 30, field_type="date", required=True),
        _fld("Response due date", "due_date", 40, field_type="date"),
        _fld("Requesting party", "requesting_party", 50),
        _section("Information request", "omb_req_hdr", 60, new_page=True),
        _fld("Information requested (verbatim summary)", "information_requested", 70, field_type="textarea", required=True),
        _fld("PSC units consulted", "units_consulted", 80, field_type="textarea"),
        _fld("Draft PSC response", "draft_response", 90, field_type="textarea", required=True),
        _fld("Confidentiality / redaction notes", "confidentiality_notes", 100, field_type="textarea"),
        _fld("Responsible compliance officer", "responsible_officer", 110, required=True),
    ]


def _fields_psa():
    return [
        _section("Amendment proposal", "psa_hdr", 10),
        _fld("Short title of proposed amendment", "amendment_title", 20, required=True),
        _fld("Bill / instrument reference", "bill_reference", 30),
        _fld("Sections / schedules affected", "sections_affected", 40, field_type="textarea", required=True),
        _section("Policy assessment", "psa_policy_hdr", 50, new_page=True),
        _fld("Purpose and policy rationale", "policy_rationale", 60, field_type="textarea", required=True),
        _fld("Impact on ministries / agencies", "impact_summary", 70, field_type="textarea", required=True),
        _fld("Legal / HR implications", "legal_implications", 80, field_type="textarea"),
        _fld("Compliance unit recommendation", "compliance_recommendation", 90, field_type="textarea", required=True),
        _section("Endorsement", "psa_endorse_hdr", 100),
        _fld("Prepared by (Compliance Principal / Manager)", "prepared_by", 110, required=True),
        _fld("Date prepared", "prepared_date", 120, field_type="date", required=True),
        _fld("Further comments for Secretary / Commission", "secretary_comments", 130, field_type="textarea"),
    ]


def seed_compliance_form_types(apps):
    """Idempotent seed for FormCategory, PSCFormType, and PSCFormField rows."""
    FormCategory = apps.get_model("tracker", "FormCategory")
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormField = apps.get_model("tracker", "PSCFormField")

    category, _ = FormCategory.objects.update_or_create(
        code=COMPLIANCE_CATEGORY_CODE,
        defaults={
            "name": "Compliance Submissions (OPSC Internal)",
            "psc_forms_summary": (
                "OPSC-internal submissions initiated by the Compliance unit "
                "(disciplinary, PSDB, Ombudsman, PSA amendments). Not ministry submissions."
            ),
            "display_order": 25,
        },
    )

    for code, meta in FORM_META.items():
        form_type, _ = PSCFormType.objects.update_or_create(
            code=code,
            defaults={
                "name": meta["name"],
                "description": meta["description"],
                "form_category": category,
                "is_digitized": True,
                "digitized_form_key": meta["digitized_form_key"],
                "is_active": True,
                "display_order": meta["display_order"],
                "agenda_category": "discipline_compliance",
            },
        )
        for field_def in fields_for_form_type(code):
            PSCFormField.objects.update_or_create(
                form_type=form_type,
                field_key=field_def["field_key"],
                defaults={
                    "label": field_def["label"],
                    "field_type": field_def["field_type"],
                    "placeholder": field_def.get("placeholder", ""),
                    "help_text": field_def.get("help_text", ""),
                    "choices": field_def.get("choices", ""),
                    "is_required": field_def.get("is_required", False),
                    "display_order": field_def["display_order"],
                    "start_new_page": field_def.get("start_new_page", False),
                },
            )
