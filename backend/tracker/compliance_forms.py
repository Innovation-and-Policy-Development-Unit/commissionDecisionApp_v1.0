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


def _fields_header(order, subject_placeholder="", subject_help=""):
    """Standard 'PSC Submission Paper' header block shared by every compliance
    form: Meeting Number / Item No. are auto-assigned when the submission is
    placed on an agenda (see Submission.meeting_number/item_number), so only
    the manually-completed header fields are collected here."""
    return [
        _section("Submission details", "hdr_details", order),
        _fld("Subject matter", "subject_matter", order + 10, field_type="textarea", required=True,
             placeholder=subject_placeholder, help_text=subject_help),
        _fld("Submitted by", "submitted_by", order + 20, required=True,
             placeholder="e.g. Secretary, OPSC / Acting Secretary, OPSC"),
        _fld("Action Officer", "action_officer", order + 30, required=True,
             placeholder="e.g. Manager Compliance Unit"),
        _fld("Prepared by", "prepared_by", order + 40, required=True,
             placeholder="e.g. Compliance Officer"),
        _fld("Date prepared", "date_prepared", order + 50, field_type="date", required=True),
        _fld("Date received", "date_received", order + 60, field_type="date"),
    ]


def _fields_common_tail(order, issue_help="", law_help="", discussion_help="", recommendation_help=""):
    """Shared closing block present on every submission paper template:
    Issue -> The Law -> Discussion -> Recommendation -> Endorsement -> Attachments."""
    return [
        _section("Issue", "tail_issue_hdr", order, new_page=True),
        _fld("Issue(s) for the Commission's determination", "issue_for_commission", order + 10,
             field_type="textarea", required=True, help_text=issue_help),
        _section("The Law", "tail_law_hdr", order + 20),
        _fld("Relevant law / provisions", "relevant_law", order + 30, field_type="textarea", required=True,
             help_text=law_help or "Quote the relevant sections of the Constitution, Public Service Act "
                                    "[CAP 246], PSSM/PSSRM, or other applicable law relied on."),
        _section("Discussion", "tail_discussion_hdr", order + 40, new_page=True),
        _fld("Discussion / analysis", "discussion", order + 50, field_type="textarea", required=True,
             help_text=discussion_help),
        _section("Recommendation", "tail_recommendation_hdr", order + 60),
        _fld("Recommendation to the Commission", "recommendation", order + 70, field_type="textarea",
             required=True, help_text=recommendation_help or
             "Number each option the Commission may take, ending with "
             "\"Take any other measures as deemed appropriate but in accordance with the law.\""),
        _section("Endorsement", "tail_endorsement_hdr", order + 80, new_page=True),
        _fld("Endorsement role", "endorsement_role", order + 90, field_type="select", required=True,
             choices="Secretary\nActing Secretary\nChairman"),
        _fld("Endorsing officer name", "endorsing_officer", order + 100, required=True),
        _fld("Endorsement date", "endorsement_date", order + 110, field_type="date"),
        _section("Attachments", "tail_attachments_hdr", order + 120),
        _fld("Attachments list", "attachments_list", order + 130, field_type="textarea",
             help_text="List documents uploaded to this submission, e.g. suspension letter, SMDR, "
                       "witness statements, investigation report, evidentiary documents."),
    ]


def _fields_smdr():
    return [
        *_fields_header(10, "e.g. Discipline Report — Ministry of X v. Mr/Ms Y, Disciplinary Case No. N of YYYY"),
        _section("Employee details", "smdr_staff_hdr", 100, new_page=True),
        _fld("Employee full name", "employee_full_name", 110, required=True),
        _fld("Ministry / agency", "employee_ministry", 120, required=True),
        _fld("Department / unit", "employee_department", 130),
        _fld("Position title", "position_title", 140, required=True),
        _fld("Employment history", "employment_history", 150, field_type="textarea",
             help_text="One row per PSC letter/decision: date of PSC letter | action/decision | "
                       "post & grade (with salary scale) | employment type | effective period."),
        _section("The matter before the Commission", "smdr_matter_hdr", 160, new_page=True),
        _fld("Background to the suspension and referral", "matter_background", 170,
             field_type="textarea", required=True,
             help_text="Suspension date, suspending officer, SMDR provided, officer's written response, "
                       "date SMDR returned."),
        _fld("Section 36(1) ground(s) relied on", "section_36_grounds", 180, field_type="textarea"),
        _section("Prior discipline history", "smdr_prior_hdr", 190),
        _fld("Prior disciplinary history", "prior_discipline_history", 200, field_type="textarea",
             help_text="Chronological list of prior warnings, suspensions, or related cases."),
        _section("Allegations", "smdr_allegations_hdr", 210, new_page=True),
        _fld("Allegations", "allegations", 220, field_type="textarea", required=True,
             help_text="State each numbered allegation as put to the employee in the suspension letter/SMDR."),
        _section("Employee's response", "smdr_response_hdr", 230),
        _fld("Employee's response / defence", "employee_response", 240, field_type="textarea",
             help_text="Summary of SMDR Section 4 and any written response provided by the employee."),
        _section("Evidence", "smdr_evidence_hdr", 250, new_page=True),
        _fld("Evidence from the department", "department_evidence", 260, field_type="textarea",
             help_text="Witness statements, incident reports, investigation report findings."),
        _section("Assessment", "smdr_assessment_hdr", 270, new_page=True),
        _fld("Serious misconduct assessment", "serious_misconduct_assessment", 280, field_type="textarea",
             help_text="Assessment against PSSM Chapter 6, clause 2.3.6(2) — serious misconduct test."),
        _fld("Allegation-by-allegation assessment", "allegation_assessment_table", 290, field_type="textarea",
             help_text="One row per allegation: allegation | evidence | assessment outcome "
                       "(proven / not proven / partially proven)."),
        _fld("Mitigating factors", "mitigating_factors", 300, field_type="textarea"),
        _fld("Aggravating factors", "aggravating_factors", 310, field_type="textarea"),
        _fld("Compliance analysis and risk assessment", "compliance_analysis", 320, field_type="textarea",
             required=True,
             help_text="Whether facts are disputed, and the risks of the Commission determining the matter "
                       "without a PSDB hearing (natural justice, procedural fairness, judicial review)."),
        *_fields_common_tail(
            400,
            issue_help="e.g. Whether the Commission should refer the matter to the PSDB, or determine it directly.",
            recommendation_help="e.g. refer to PSDB given disputed facts / partial admission; or take other measures.",
        ),
    ]


def _fields_par():
    return [
        *_fields_header(10, "e.g. Preliminary Assessment Report against [officer/position]"),
        _fld("Linked SMDR / case reference", "case_reference", 75),
        _fld("Subject officer name", "subject_name", 80, required=True),
        _fld("Position / Ministry / agency", "subject_position", 90, required=True),
        _section("Background", "par_background_hdr", 100, new_page=True),
        _fld("Brief background of the matter before PSC", "matter_background", 110, field_type="textarea",
             required=True),
        _section("Allegations", "par_allegations_hdr", 120, new_page=True),
        _fld("Allegations / complaints", "allegations_table", 130, field_type="textarea", required=True,
             help_text="One row per allegation: allegation/complaint | submitted by (complainant) | "
                       "scope or impact of the complaint and severity."),
        _section("Findings", "par_findings_hdr", 140, new_page=True),
        _fld("Key findings of the preliminary assessment team", "key_findings", 150, field_type="textarea",
             required=True, help_text="Summarize findings by category, e.g. conflict of interest, "
                                       "overriding council/board decisions, financial misuse."),
        _fld("Observation / analysis of allegations", "team_observation", 160, field_type="textarea"),
        _fld("Response of the subject officer", "subject_response", 170, field_type="textarea"),
        _section("Recommendation options considered", "par_options_hdr", 180, new_page=True),
        _fld("Options considered by the assessment team", "options_considered", 190, field_type="textarea",
             required=True,
             help_text="One row per option (e.g. suspend, terminate, transfer, appoint an advisor, "
                       "maintain position) with justification."),
        *_fields_common_tail(
            250,
            issue_help="e.g. Whether the Commission should refer the matter to the relevant Ministry / "
                      "Ministerial Disciplinary Committee, or take other action, following the preliminary assessment.",
        ),
    ]


def _fields_psdb():
    return [
        *_fields_header(10, "e.g. Commission to consider the Order on determination on disciplinary case No. N of YYYY"),
        _fld("Subject employee", "subject_employee", 75, required=True),
        _fld("Ministry / agency", "subject_ministry", 80, required=True),
        _section("Background", "psdb_background_hdr", 90, new_page=True),
        _fld("Background to the Commission's referral and PSDB hearing", "matter_background", 100,
             field_type="textarea", required=True,
             help_text="Commission meeting/decision referring the matter to the PSDB, and the date the "
                       "PSDB convened to hear the case."),
        _section("Charges and plea", "psdb_charges_hdr", 110),
        _fld("Charges laid", "charges_laid", 120, field_type="textarea", required=True),
        _fld("Plea entered", "plea_entered", 130),
        _section("The Board's order", "psdb_order_hdr", 140, new_page=True),
        _fld("Order on determination", "order_on_determination", 150, field_type="textarea", required=True,
             help_text="Quote the Board's order as issued, e.g. \"NOW THEREFORE IT IS HEREBY ORDERED...\"."),
        _fld("Analysis of each charge", "charge_analysis_table", 160, field_type="textarea",
             help_text="One row per charge: charge | evidence | whether the allegation is refuted."),
        _fld("Other factors to consider", "other_factors", 170, field_type="textarea",
             help_text="e.g. remorse, guilty plea, mitigating circumstances raised by the officer."),
        *_fields_common_tail(
            250,
            issue_help="e.g. Whether the Commission should confirm, vary, or quash the PSDB's decision "
                      "pursuant to section 37(12) of the Public Service Act [CAP 246].",
            recommendation_help="State the Commission's options to confirm, vary, or quash the PSDB decision.",
        ),
    ]


def _fields_14d():
    return [
        *_fields_header(10, "e.g. Commission to consider the response to PSC 14 days' Notice as to why "
                            "the Commission should not terminate the employment of [officer]"),
        _fld("Subject employee", "subject_employee", 75, required=True),
        _fld("Ministry / agency", "subject_ministry", 80, required=True),
        _fld("Employment history", "employment_history", 90, field_type="textarea",
             help_text="Date of appointment, position, and relevant employment history."),
        _section("Background", "d14_background_hdr", 100, new_page=True),
        _fld("Background to the PSDB referral, hearing, and 14-day notice", "matter_background", 110,
             field_type="textarea", required=True,
             help_text="Commission decision referring the matter to the PSDB, PSDB decision, Commission's "
                       "decision to issue a 14-day notice, and date the notice was issued."),
        _section("Officer's response", "d14_response_hdr", 120, new_page=True),
        _fld("Officer's response to the 14-day notice", "officer_response", 130, field_type="textarea",
             required=True),
        _section("Compliance assessment of the response", "d14_assessment_hdr", 140, new_page=True),
        _fld("Strengths of the response", "response_strengths", 150, field_type="textarea"),
        _fld("Weaknesses / risks of the response", "response_weaknesses", 160, field_type="textarea"),
        *_fields_common_tail(
            250,
            issue_help="e.g. Whether the Commission should proceed to terminate the employment of the officer.",
            recommendation_help="State the Commission's options, e.g. maintain the decision to terminate, "
                               "refer to Police, or take other measures.",
        ),
    ]


def _fields_omb():
    return [
        *_fields_header(10, "e.g. Commission to consider the Ombudsman Office letter requesting "
                            "information relating to [matter]"),
        _fld("Ombudsman reference", "omb_reference", 75),
        _fld("Requesting party / investigator", "requesting_party", 80),
        _fld("Response due date", "due_date", 90, field_type="date"),
        _section("Background", "omb_background_hdr", 100, new_page=True),
        _fld("Background to the Ombudsman's request", "matter_background", 110, field_type="textarea",
             required=True, help_text="Date of the Ombudsman's letter, the officer who wrote it, and a "
                                      "summary of the information/documents requested."),
        *_fields_common_tail(
            180,
            issue_help="e.g. Whether the Commission should endorse the release of the information/documents "
                      "requested by the Office of the Ombudsman.",
            law_help="Constitution Article 60 and 62; Ombudsman Act sections 18, 19, 22, 23.",
            recommendation_help="e.g. approve disclosure through the Office of the Secretary; or take other measures.",
        ),
    ]


def _fields_psa():
    return [
        *_fields_header(10, "e.g. Seeking the Commission's endorsement on proposed amendment to the "
                            "Public Service Act [CAP 246]"),
        _fld("Sections / subsections affected", "sections_affected", 75, field_type="textarea", required=True,
             help_text="List each section/subsection proposed for amendment, e.g. Subsection 5(b), "
                       "Subsection 17A(1)."),
        _section("Background", "psa_background_hdr", 100, new_page=True),
        _fld("Background to the proposed amendment", "matter_background", 110, field_type="textarea",
             required=True,
             help_text="e.g. outcome of the OPSC Senior Management meeting that identified the need for "
                       "amendment. Full detail of existing provisions, challenges, and proposed wording "
                       "belongs in the attached amendment table."),
        *_fields_common_tail(
            180,
            issue_help="e.g. Whether the Commission should endorse the proposed amendments to enhance "
                      "administrative clarity, accountability, and PSC functions per section 8 of the "
                      "Public Service Act [CAP 246].",
            law_help="Quote the relevant PSC functions/powers under section 8 of the Public Service Act "
                    "[CAP 246] and any other law engaged by the proposed amendment.",
            recommendation_help="e.g. note and endorse the proposed amendment; or take other measures.",
        ),
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
        field_defs = fields_for_form_type(code)
        for field_def in field_defs:
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
        # Prune fields from a previous schema revision that are no longer defined.
        current_keys = {fd["field_key"] for fd in field_defs}
        PSCFormField.objects.filter(form_type=form_type).exclude(
            field_key__in=current_keys
        ).delete()
