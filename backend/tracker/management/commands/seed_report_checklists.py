"""
Seed ODU review checklists for the five PSC planning/reporting submission
types (Annual Report, Business Plan, Corporate Plan, Half Yearly Report,
Quarterly Report), derived from the PSC Planning & Reporting Guidelines
(2021) and the official PSC checklists for Annual Reports and Business
Plans, reconciled against each other during drafting.

Where a checklist item corresponds to an existing digitized-form field on
ANNUAL-REPORT / BUSINESS-PLAN / CORPORATE-PLAN, it's a straight presence
check wired up in submission_checklist_prefill.py. Items with no matching
digitized-form field (flagged with source_key=None below) are real gaps —
either the digitized form is missing that section, or Half Yearly/Quarterly
Report have no digitized form at all yet — so those stay manual/AI-review
only until a form field exists to check against.
"""

from django.core.management.base import BaseCommand


# Each checklist: (form_type_code, form_type_name, groups)
# Each group: (section_label, [(field_key, item_label, source_key_or_None), ...])
# source_key_or_None is the digitized-form field_key this item verifies the
# presence of (see submission_checklist_prefill.py) — None means no
# corresponding field exists yet, so it's manual/AI-review only.

ANNUAL_REPORT_CHECKLIST = (
    "ANNUAL-REPORT-CHECKLIST",
    "Annual Report — ODU Review Checklist",
    [
        ("A. Statements", [
            ("minister_statement_check", "Minister's Statement completed", "minister_statement"),
            ("dg_statement_check", "Director General's Statement completed", "dg_statement"),
            ("dg_issues_table_check", "Issues Overview Table completed", "dg_issues_table"),
        ]),
        ("B. Corporate Structure & Overview", [
            ("org_chart_check", "Organisation Chart reference provided", "org_chart_reference"),
            ("structural_changes_check", "Significant structural changes summarised", "structural_changes"),
            ("ministry_functions_check", "Ministry Functions stated", "ministry_functions"),
            ("vision_statement_check", "Vision Statement included", "vision_statement"),
            ("mission_statement_check", "Mission Statement included", "mission_statement"),
            ("core_values_check", "Core Values included", "core_values"),
        ]),
        ("C. Performance Reporting", [
            ("objectives_performance_check", "Performance against Corporate Plan objectives reported", "objectives_performance"),
            ("main_activities_check", "Main activities & services provided described", "main_activities"),
            ("service_delivery_check", "Service delivery improvements highlighted", "service_delivery"),
            ("adr_targets_check", "Performance against ADR/NSDP targets reported", "adr_targets"),
            ("budget_performance_check", "Performance against Budget Narrative reported", "budget_performance"),
            ("policy_summary_check", "Policy development (new/reviewed/retired) reported", "policy_summary"),
            ("legislation_changes_check", "New legislation / transfers of responsibility listed", "legislation_changes"),
            ("conventions_check", "New Conventions & ratification status listed", "conventions"),
            ("major_risks_check", "Major risks & challenges identified", "major_risks"),
        ]),
        ("D. Human Resources", [
            ("staffing_data_check", "Staffing summary (disaggregated) included", "staffing_data"),
            ("cessation_data_check", "Cessation of employment data included", "cessation_data"),
            ("compliance_report_check", "Discipline & compliance report included", "compliance_report"),
            ("training_delivered_check", "Training delivered reported", "training_delivered"),
            ("scholarships_check", "Scholarships reported", "scholarships"),
            ("equity_initiatives_check", "Equity & inclusivity initiatives summarised", "equity_initiatives"),
        ]),
        ("E. Financial & External Oversight", [
            ("financial_note_check", "Financial Statements referenced/attached", "financial_note"),
            ("dev_projects_check", "Development projects & technical assistance listed", "dev_projects"),
            ("statutory_authorities_check", "Statutory authorities listed", "statutory_authorities"),
            ("non_statutory_bodies_check", "Non-statutory bodies listed", "non_statutory_bodies"),
            ("auditor_general_reports_check", "Auditor-General reports listed", "auditor_general_reports"),
            ("ombudsman_response_check", "Ombudsman reports & responses listed", "ombudsman_response"),
            ("rti_requests_check", "Right to Information requests listed", "rti_requests"),
            ("court_decisions_check", "Court decisions/legal matters listed", "court_decisions"),
            ("complaints_summary_check", "Complaints mechanism summarised", "complaints_summary"),
        ]),
        ("F. Not yet captured in the digitized form", [
            ("capital_expenditure_check", "Capital expenditure summarised", None),
            ("fraud_control_check", "Fraud control actions summarised", None),
            ("contact_officer_check", "Contact officer details provided", None),
        ]),
    ],
)

BUSINESS_PLAN_CHECKLIST = (
    "BUSINESS-PLAN-CHECKLIST",
    "Business Plan — ODU Review Checklist",
    [
        ("A. Organisation & Period", [
            ("department_name_check", "Departments included in this Plan stated", "department_name"),
            ("ministry_check", "Ministry stated", "ministry"),
            ("responsible_head_check", "Responsible Head / Director stated", "responsible_head"),
            ("plan_type_check", "Plan Type (duration) selected", "plan_type"),
            ("period_dates_check", "Planning period start/end dates set", "period_start_date"),
        ]),
        ("B. Executive Summary", [
            ("key_outcomes_check", "Key outcomes & strategic focus described", "key_outcomes"),
            ("main_programs_check", "Main programs/initiatives described", "main_programs"),
            ("nsdp_alignment_check", "Alignment with Corporate Plan/NSDP stated", "nsdp_alignment"),
        ]),
        ("C. Program / Activity M&E Framework", [
            ("me_matrix_check", "Program & Activity M&E matrix completed", "me_matrix"),
            ("kpis_check", "KPIs stated", "kpis"),
            ("risks_mitigation_check", "Risks & mitigation strategies stated", "risks_mitigation"),
            ("me_matrix_columns_check", "Matrix includes OIC and Location columns", None),
        ]),
        ("D. Budget Narrative (per Department)", [
            ("budget_narrative_mandate_check", "Mandate Statement included, per Department", None),
            ("budget_narrative_objectives_check", "Objectives included, per Department", None),
            ("budget_narrative_service_delivery_check", "Means of Service Delivery included, per Department", None),
            ("budget_narrative_performance_check", "Performance Measures/Service Targets included, per Department", None),
        ]),
        ("E. Human Resource Operational Plan", [
            ("staffing_table_check", "Staffing table (current & authorised) completed", "staffing_table"),
            ("retirement_severance_check", "Retirement & severance tracking completed", "retirement_severance"),
            ("vacancy_plan_check", "Vacancy management plan (priority posts) completed", "vacancy_plan"),
            ("training_budget_check", "Training & development budget completed", "training_budget"),
            ("scholarship_programs_check", "Scholarship/advancement programs listed", "scholarship_programs"),
        ]),
        ("F. Cash Flow Forecast", [
            ("cashflow_matrix_check", "Cash flow by activity & month completed", "cashflow_matrix"),
            ("payroll_projection_check", "Payroll projection completed", "payroll_projection"),
            ("overheads_forecast_check", "Operational overheads forecast completed", "overheads_forecast"),
            ("funding_gaps_check", "Cash constraints/funding gaps noted", "funding_gaps"),
        ]),
        ("G. Procurement Plan", [
            ("procurement_schedule_check", "Procurement schedule by activity completed", "procurement_schedule"),
            ("capital_equipment_check", "Capital equipment procurement listed", "capital_equipment"),
            ("service_contracts_check", "Service contracts & renewals listed", "service_contracts"),
            ("procurement_risks_check", "Procurement risks & contingency noted", "procurement_risks"),
            ("procurement_approvals_check", "DG cash-flow endorsement & document approvals (CSU/Tender Board) recorded", None),
            ("procurement_complex_stages_check", "Complex procurement staging + Ministerial/COM approvals detailed where applicable", None),
        ]),
        ("H. Provincial Priorities", [
            ("provincial_priorities_check", "Priorities addressed for Torba, Sanma, Penama, Malampa, Shefa, Tafea", None),
        ]),
        ("I. Submission", [
            ("issue_check", "Issue statement completed", "issue"),
            ("discussion_check", "Discussion completed", "discussion"),
            ("recommendation_check", "Recommendation completed", "recommendation"),
        ]),
    ],
)

CORPORATE_PLAN_CHECKLIST = (
    "CORPORATE-PLAN-CHECKLIST",
    "Corporate Plan — ODU Review Checklist",
    [
        ("A. Ministry & Period", [
            ("ministry_name_check", "Ministry Name stated", "ministry_name"),
            ("minister_name_check", "Minister / Portfolio Head stated", "minister_name"),
            ("ps_name_check", "Permanent/Principal Secretary stated", "ps_name"),
            ("plan_duration_check", "Plan duration stated (5-year framework)", "plan_duration"),
        ]),
        ("B. Strategic Framework", [
            ("vision_statement_check", "Vision Statement included", "vision_statement"),
            ("mission_statement_check", "Mission Statement included", "mission_statement"),
            ("core_values_check", "Core Values included", "core_values"),
            ("nsdp_alignment_check", "NSDP alignment & Government priorities stated", "nsdp_alignment"),
            ("minister_preface_check", "Preface from the Minister endorsing the Plan included", None),
        ]),
        ("C. Program Structure & Strategic Priorities", [
            ("strategic_programs_check", "Strategic priority programs (2–6) listed", "strategic_programs"),
            ("program_activity_matrix_check", "Program-Activity alignment matrix completed", "program_activity_matrix"),
            ("strategic_priorities_check", "Strategic priorities & focus areas stated", "strategic_priorities"),
            ("kpis_by_program_check", "KPIs by program stated", "kpis_by_program"),
        ]),
        ("D. Organisational Structure & Capacity", [
            ("org_structure_check", "Organisational structure overview included", "org_structure"),
            ("org_chart_reference_check", "Organisational chart reference provided", "org_chart_reference"),
            ("staffing_structure_check", "Staffing structure & allocation included", "staffing_structure"),
            ("staffing_allocation_check", "Total approved staffing allocation stated", "staffing_allocation"),
            ("capability_gaps_check", "Critical capability gaps identified", "capability_gaps"),
            ("fit_for_purpose_check", "Fit-for-Purpose self-assessment completed (where restructure proposed)", None),
        ]),
        ("E. Financial & Resource Planning", [
            ("budget_allocation_check", "Total budget allocation by program stated", "budget_allocation"),
            ("payroll_costs_check", "Payroll & personnel costs stated", "payroll_costs"),
            ("operational_expenses_check", "Operational expenses & overheads stated", "operational_expenses"),
            ("capital_investment_check", "Capital investment program stated", "capital_investment"),
            ("resource_gaps_check", "Resource gaps & constraints identified", "resource_gaps"),
        ]),
        ("F. Capacity Building & Development", [
            ("training_programs_check", "Staff training & development programs listed", "training_programs"),
            ("succession_planning_check", "Succession planning included", "succession_planning"),
            ("technology_upgrades_check", "Technology & systems upgrades noted", "technology_upgrades"),
            ("institutional_strengthening_check", "Institutional strengthening initiatives noted", "institutional_strengthening"),
            ("retirement_plan_check", "Retirement Plan for the 5-year period included", None),
        ]),
        ("G. Risk & Compliance", [
            ("major_risks_check", "Major risks & challenges identified", "major_risks"),
            ("risk_mitigation_check", "Risk mitigation strategies stated", "risk_mitigation"),
            ("compliance_requirements_check", "Compliance & legislative requirements noted", "compliance_requirements"),
            ("me_framework_check", "Monitoring & evaluation framework included", "me_framework"),
        ]),
        ("H. Submission", [
            ("issue_check", "Issue statement completed", "issue"),
            ("discussion_check", "Discussion completed", "discussion"),
            ("recommendation_check", "Recommendation completed", "recommendation"),
        ]),
    ],
)

HALF_YEARLY_REPORT_CHECKLIST = (
    "HALF-YEARLY-REPORT-CHECKLIST",
    "Half Yearly Report — ODU Review Checklist",
    [
        ("A. Director General's Statement", [
            ("dg_statement_check", "Brief DG statement on achievements, challenges, emerging issues", None),
        ]),
        ("B. Overview for January–June", [
            ("business_plan_objectives_check", "Reports against each Business Plan objective", None),
            ("main_activities_check", "Main activities/services delivered described, incl. provincial data", None),
            ("service_delivery_check", "Service delivery & access improvements highlighted", None),
            ("quarterly_followup_check", "Progress against Quarterly Report issues addressed", None),
            ("adr_targets_check", "Reports against ADR/NSDP targets", None),
            ("budget_narrative_check", "Reports against Ministry Budget Narrative performance measures", None),
            ("policy_development_check", "Policy development reported in tabular form", None),
            ("legislation_check", "New legislation (First Sitting) listed", None),
            ("conventions_check", "New Conventions listed with ratification/implementation status", None),
        ]),
        ("C. Human Resources", [
            ("staffing_totals_check", "Total permanent employees, by sex and language group", None),
            ("staffing_breakdown_check", "Full-time/probationary/contract/daily-rated numbers, by sex and language group", None),
            ("retirements_check", "Retirements in the period", None),
            ("redundancies_check", "Redundancies in the period (if any)", None),
            ("leave_accrual_check", "Leave accrual analysis", None),
            ("scholarships_check", "Scholarships, by sex and language group", None),
            ("training_check", "Training delivered Jan–Jun", None),
        ]),
        ("D. Financial & Projects", [
            ("financial_statements_check", "Financial reporting on budget utilisation included", None),
            ("dev_projects_check", "Development projects listed (Template 2)", None),
            ("capital_expenditure_check", "Capital expenditure summarised", None),
        ]),
        ("E. Council of Ministers Decisions", [
            ("com_decisions_current_check", "COM decisions made during the period reported (Template 3)", None),
            ("com_decisions_prior_check", "Prior-period COM decisions still in progress reported", None),
        ]),
        ("F. Templates", [
            ("template1_check", "Template 1 (Report Against Budget Narrative) completed", None),
            ("template2_check", "Template 2 (Development Project Implementation) completed, where applicable", None),
            ("template3_check", "Template 3 (Progress Against COM Decisions) completed, where applicable", None),
        ]),
    ],
)

QUARTERLY_REPORT_CHECKLIST = (
    "QUARTERLY-REPORT-CHECKLIST",
    "Quarterly Report — ODU Review Checklist",
    [
        ("A. Director General's Statement", [
            ("dg_statement_check", "Brief DG statement on achievements, challenges, emerging issues", None),
        ]),
        ("B. Overview — Progress Against Business Plan", [
            ("budget_narrative_check", "Reports against Ministry Budget Narrative performance measures", None),
            ("template1_check", "Template 1 (Quarterly Report Against Budget Narrative) completed", None),
        ]),
    ],
)

ALL_CHECKLISTS = [
    ANNUAL_REPORT_CHECKLIST,
    BUSINESS_PLAN_CHECKLIST,
    CORPORATE_PLAN_CHECKLIST,
    HALF_YEARLY_REPORT_CHECKLIST,
    QUARTERLY_REPORT_CHECKLIST,
]

# Minimal submission-type stubs for the two report types that don't have a
# digitized submission form yet — just enough for their checklist to attach
# to something and route to ODU. Not a full digitized form: building the
# actual Half Yearly / Quarterly submission form (like ANNUAL-REPORT has) is
# separate follow-up work, not part of this checklist task.
SUBMISSION_STUBS = [
    ("HALF-YEARLY-REPORT", "Half Yearly Report Submission"),
    ("QUARTERLY-REPORT", "Quarterly Report Submission"),
]

# submission form_type_code -> checklist form_type_code
LINKS = {
    "ANNUAL-REPORT": "ANNUAL-REPORT-CHECKLIST",
    "BUSINESS-PLAN": "BUSINESS-PLAN-CHECKLIST",
    "CORPORATE-PLAN": "CORPORATE-PLAN-CHECKLIST",
    "HALF-YEARLY-REPORT": "HALF-YEARLY-REPORT-CHECKLIST",
    "QUARTERLY-REPORT": "QUARTERLY-REPORT-CHECKLIST",
}


class Command(BaseCommand):
    help = "Seed ODU review checklists for the five PSC planning/reporting submission types."

    def handle(self, *args, **options):
        from tracker.models import FormCategory, PSCFormType, PSCFormField

        odu_category, _ = FormCategory.objects.get_or_create(
            code="organisational_development",
            defaults={"name": "Organisational Development (ODU)"},
        )

        for code, name in SUBMISSION_STUBS:
            ft, created = PSCFormType.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "form_category": odu_category,
                    "routed_unit": "odu",
                    "is_digitized": False,
                    "is_active": True,
                },
            )
            self.stdout.write(self.style.SUCCESS(f"  [{'created' if created else 'exists'}] {code}"))

        for code, name, groups in ALL_CHECKLISTS:
            checklist_ft, created = PSCFormType.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "form_category": odu_category,
                    "is_checklist": True,
                    "is_active": True,
                },
            )
            self.stdout.write(self.style.SUCCESS(f"  [{'created' if created else 'exists'}] {code}"))

            order = 0
            field_count = 0
            for section_label, items in groups:
                order += 10
                PSCFormField.objects.update_or_create(
                    form_type=checklist_ft,
                    field_key=f"sec_{order}",
                    defaults={
                        "label": section_label,
                        "field_type": "section_header",
                        "display_order": order,
                    },
                )
                for field_key, label, _source_key in items:
                    order += 1
                    field_count += 1
                    help_text = (
                        "Not captured by a digitized-form field yet — manual/AI review only."
                        if _source_key is None else ""
                    )
                    PSCFormField.objects.update_or_create(
                        form_type=checklist_ft,
                        field_key=field_key,
                        defaults={
                            "label": label,
                            "field_type": "checkbox",
                            "help_text": help_text,
                            "display_order": order,
                        },
                    )
            self.stdout.write(f"      {field_count} checklist items")

        for submission_code, checklist_code in LINKS.items():
            submission_ft = PSCFormType.objects.get(code=submission_code)
            checklist_ft = PSCFormType.objects.get(code=checklist_code)
            if submission_ft.checklist_form_type_id != checklist_ft.id:
                submission_ft.checklist_form_type = checklist_ft
                submission_ft.save(update_fields=["checklist_form_type"])
            self.stdout.write(self.style.SUCCESS(f"  [linked] {submission_code} -> {checklist_code}"))

        self.stdout.write(self.style.SUCCESS("\n[OK] Report checklists seeded."))
