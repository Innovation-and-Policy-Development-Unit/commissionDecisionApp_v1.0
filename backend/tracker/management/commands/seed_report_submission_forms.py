"""
Build out the digitized submission forms for Half Yearly Report and
Quarterly Report — the two report types that only had a bare PSCFormType
stub (see seed_report_checklists.py) with no actual fields, so nothing
could be submitted or reviewed yet. Field keys are chosen to match the
HALF-YEARLY-REPORT-CHECKLIST / QUARTERLY-REPORT-CHECKLIST source_key
mappings already registered in submission_checklist_prefill.py's
register_field_presence_checklist() calls, so ODU's checklist prefill
works against these forms without further wiring once this runs.

Also creates one fully-filled test submission per form, matching the
existing Annual Report / Business Plan / Corporate Plan test submissions,
so ODU has something to actually open and review.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone


# (form_type_code, digitized_form_key, [(section_label, [(field_key, label, field_type), ...]), ...])
HALF_YEARLY_REPORT_FIELDS = (
    "HALF-YEARLY-REPORT",
    "half_yearly_report",
    [
        ("Organisation Details", [
            ("ministry", "Ministry", "text"),
            ("department_name", "Departments Included in this Report", "text"),
            ("responsible_head", "Responsible Head / Director", "text"),
        ]),
        ("Reporting Period", [
            ("period_start_date", "Period Start Date", "date"),
            ("period_end_date", "Period End Date", "date"),
        ]),
        ("1. Director General's Statement", [
            ("dg_statement", "Director General's Statement", "textarea"),
        ]),
        ("2. Overview for January–June", [
            ("business_plan_objectives", "Progress Against Business Plan Objectives", "textarea"),
            ("main_activities", "Main Activities & Services Delivered", "textarea"),
            ("service_delivery", "Service Delivery & Access Improvements", "textarea"),
            ("quarterly_followup", "Progress Against Quarterly Report Issues", "textarea"),
        ]),
        ("3. ADR / NSDP Targets", [
            ("adr_targets", "Progress Against ADR/NSDP Targets", "textarea"),
        ]),
        ("4. Budget Narrative", [
            ("budget_narrative", "Performance Against Budget Narrative", "textarea"),
        ]),
        ("5. Policy & Legislative Framework", [
            ("policy_development", "Policy Development", "textarea"),
            ("legislation", "New Legislation & Transfers", "textarea"),
            ("conventions", "New Conventions & Ratification Status", "textarea"),
        ]),
        ("6. Human Resources", [
            ("staffing_totals", "Total Permanent Employees (by sex/language group)", "textarea"),
            ("staffing_breakdown", "Full-time/Probationary/Contract/Daily-rated Numbers", "textarea"),
            ("retirements", "Retirements in the Period", "textarea"),
            ("redundancies", "Redundancies in the Period", "textarea"),
            ("leave_accrual", "Leave Accrual Analysis", "textarea"),
            ("scholarships", "Scholarships (by sex/language group)", "textarea"),
            ("training", "Training Delivered Jan–Jun", "textarea"),
        ]),
        ("7. Financial & Projects", [
            ("financial_statements", "Financial Reporting on Budget Utilisation", "textarea"),
            ("dev_projects", "Development Projects", "textarea"),
            ("capital_expenditure", "Capital Expenditure", "textarea"),
        ]),
        ("8. Council of Ministers Decisions", [
            ("com_decisions_current", "COM Decisions Made This Period", "textarea"),
            ("com_decisions_prior", "Prior-Period COM Decisions Still In Progress", "textarea"),
        ]),
        ("9. Templates", [
            ("template1", "Template 1 — Report Against Budget Narrative", "textarea"),
            ("template2", "Template 2 — Development Project Implementation", "textarea"),
            ("template3", "Template 3 — Progress Against COM Decisions", "textarea"),
        ]),
    ],
)

QUARTERLY_REPORT_FIELDS = (
    "QUARTERLY-REPORT",
    "quarterly_report",
    [
        ("Organisation Details", [
            ("ministry", "Ministry", "text"),
            ("department_name", "Departments Included in this Report", "text"),
            ("responsible_head", "Responsible Head / Director", "text"),
        ]),
        ("Reporting Period", [
            ("period_start_date", "Period Start Date", "date"),
            ("period_end_date", "Period End Date", "date"),
        ]),
        ("1. Director General's Statement", [
            ("dg_statement", "Director General's Statement", "textarea"),
        ]),
        ("2. Overview — Progress Against Business Plan", [
            ("budget_narrative", "Performance Against Budget Narrative", "textarea"),
            ("template1", "Template 1 — Quarterly Report Against Budget Narrative", "textarea"),
        ]),
    ],
)

ALL_FORMS = [HALF_YEARLY_REPORT_FIELDS, QUARTERLY_REPORT_FIELDS]

# Sample data for the test submission of each form — filled in for every
# field so the checklist prefill has something to confirm against.
HALF_YEARLY_SAMPLE_DATA = {
    "ministry": "Ministry of Health",
    "department_name": "Curative & Public Health Services",
    "responsible_head": "Dr. Russel Tamata, Director General",
    "period_start_date": "2026-01-01",
    "period_end_date": "2026-06-30",
    "dg_statement": "The Ministry made steady progress against its Business Plan in the first half of 2026, "
                     "with the rollout of the rural health outreach program the standout achievement. "
                     "Staffing shortages in Sanma and Torba remain the principal challenge.",
    "business_plan_objectives": "Objective 1 (Strengthen primary health care access): 4 of 6 planned outreach "
                                 "clinics delivered. Objective 2 (Improve maternal health outcomes): antenatal "
                                 "clinic attendance up 12% against baseline.",
    "main_activities": "Rural outreach clinics in Sanma, Torba and Malampa; continuation of the immunisation "
                        "catch-up campaign; provincial hospital equipment audit completed.",
    "service_delivery": "Access to outpatient services improved in 3 of 6 provinces following the outreach "
                         "clinic rollout; average patient wait time reduced from 55 to 40 minutes at Vila Central.",
    "quarterly_followup": "The Q1 report flagged a cold-chain equipment shortfall in Torba — replacement units "
                           "were procured and deployed in May, resolving the issue.",
    "adr_targets": "On track against the ADR immunisation coverage target (currently 78% against an 85% "
                    "year-end target).",
    "budget_narrative": "Program 1 (Primary Health Care): 48% of annual budget appropriation utilised, "
                         "consistent with the six-month profile.",
    "policy_development": "Draft Primary Health Care Policy circulated for Ministry-wide consultation in April; "
                           "finalisation expected Q3.",
    "legislation": "No new health-sector legislation passed in the First Sitting this year.",
    "conventions": "No new Conventions ratified in this reporting period.",
    "staffing_totals": "312 permanent employees (178 female, 134 male); 268 Bislama-medium, 44 English-medium.",
    "staffing_breakdown": "Full-time: 286; Probationary: 14; Contract: 9; Daily-rated: 3.",
    "retirements": "4 retirements in the period (2 nursing, 1 administrative, 1 environmental health).",
    "redundancies": "None in the period.",
    "leave_accrual": "Average accrued leave across the Ministry is 18 days; 6 officers above the 40-day threshold "
                      "flagged for leave management action.",
    "scholarships": "3 officers on scholarship: 2 Bachelor of Nursing (female), 1 Master of Public Health (male).",
    "training": "Emergency obstetric care refresher delivered to 22 midwives (Jan–Feb); infection control "
                "training delivered to 40 provincial hospital staff (April).",
    "financial_statements": "Budget utilisation on track at 48% of annual appropriation; no material variance "
                             "against the six-month profile.",
    "dev_projects": "World Bank Health System Strengthening Project: Phase 2 clinic upgrades 60% complete "
                     "across 3 provinces.",
    "capital_expenditure": "2 outreach vehicles and cold-chain refrigeration units procured for Torba and Sanma.",
    "com_decisions_current": "No COM decisions specific to the Ministry made during this period.",
    "com_decisions_prior": "Prior COM decision on rural health worker allowances fully implemented as of March.",
    "template1": "Program: Primary Health Care | Outcome Indicator: Immunisation coverage | Target: 85% | "
                 "Performance to date: 78% | Comment: On track.",
    "template2": "Project: Health System Strengthening (World Bank) | Status: Ongoing | Total budget received: "
                 "VT 45,000,000 | Spending to date: VT 27,000,000.",
    "template3": "COM Decision: Rural health worker allowances | Progress: Fully implemented | Issues: None outstanding.",
}

QUARTERLY_SAMPLE_DATA = {
    "ministry": "Ministry of Agriculture, Livestock, Forestry and Biosecurity",
    "department_name": "Department of Agriculture",
    "responsible_head": "Livo Mele, Director General",
    "period_start_date": "2026-01-01",
    "period_end_date": "2026-03-31",
    "dg_statement": "Q1 activities focused on nursery establishment and seedling distribution under the "
                     "market/commodity production program; progress is broadly on schedule.",
    "budget_narrative": "Program: Increase market and commodity production. Activity 47BA (nursery "
                         "establishment): 1 of 6 nurseries upgraded. Activity 47BB (kava seedlings): "
                         "100,000 of 300,000 target achieved.",
    "template1": "Program: Increase market and commodity production | Activity: 47BA — No. of nurseries "
                 "established/upgraded | Target: 6 | Performance to date: 1 | Comment: On track. "
                 "Activity: 47BB — No. of noble kava seedlings and cuttings | Target: 300,000 | "
                 "Performance to date: 100,000 | Comment: Behind schedule due to heavy rain in February.",
}

SAMPLE_DATA = {
    "HALF-YEARLY-REPORT": HALF_YEARLY_SAMPLE_DATA,
    "QUARTERLY-REPORT": QUARTERLY_SAMPLE_DATA,
}

# Ministry HR account to attribute each test submission to, matching the
# convention used by the existing Annual Report test submission
# (PSC-2026-00041, created_by=hr.infra for Ministry of Infrastructure).
CREATED_BY_USERNAME = {
    "HALF-YEARLY-REPORT": "hr.health",
    "QUARTERLY-REPORT": "hr.agriculture",
}


class Command(BaseCommand):
    help = "Build the digitized submission forms for Half Yearly and Quarterly Report, plus one test submission each."

    def handle(self, *args, **options):
        from django.contrib.auth.models import User
        from tracker.models import (
            PSCFormType, PSCFormField, PSCFormResponse,
            Submission, Ministry, WorkflowStage, allocate_reference_number,
        )

        for code, digitized_form_key, groups in ALL_FORMS:
            ft = PSCFormType.objects.get(code=code)
            if not ft.is_digitized:
                ft.is_digitized = True
                ft.digitized_form_key = digitized_form_key
                ft.save(update_fields=["is_digitized", "digitized_form_key"])

            order = 0
            field_count = 0
            for section_label, items in groups:
                order += 10
                PSCFormField.objects.update_or_create(
                    form_type=ft,
                    field_key=f"sec_{order}",
                    defaults={
                        "label": section_label,
                        "field_type": "section_header",
                        "display_order": order,
                    },
                )
                for field_key, label, field_type in items:
                    order += 1
                    field_count += 1
                    PSCFormField.objects.update_or_create(
                        form_type=ft,
                        field_key=field_key,
                        defaults={
                            "label": label,
                            "field_type": field_type,
                            "display_order": order,
                        },
                    )
            self.stdout.write(self.style.SUCCESS(f"  [{code}] {field_count} submission fields"))

            # One fully-filled test submission per form, if one doesn't exist yet.
            if Submission.objects.filter(form_type_code=code).exists():
                self.stdout.write(f"      test submission already exists, skipping")
                continue

            ministry_name = SAMPLE_DATA[code]["ministry"]
            ministry = Ministry.objects.filter(name=ministry_name).first()
            if not ministry:
                self.stdout.write(self.style.WARNING(f"      ministry '{ministry_name}' not found, skipping test submission"))
                continue

            creator = User.objects.filter(username=CREATED_BY_USERNAME[code]).first()
            if not creator:
                self.stdout.write(self.style.WARNING(f"      creator '{CREATED_BY_USERNAME[code]}' not found, skipping test submission"))
                continue

            ref = allocate_reference_number()
            title = f"{ministry.name} {ft.name.replace(' Submission', '')} — H1 2026" if "Half" in ft.name else f"{ministry.name} {ft.name.replace(' Submission', '')} — Q1 2026"
            submission = Submission.objects.create(
                reference_number=ref,
                title=title,
                form_type_code=code,
                ministry=ministry,
                routed_unit="odu",
                current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
                received_at=timezone.now(),
                created_by=creator,
            )
            PSCFormResponse.objects.create(
                submission=submission,
                form_type=ft,
                data=SAMPLE_DATA[code],
            )
            self.stdout.write(self.style.SUCCESS(f"      [created] test submission {ref} — {title}"))

        self.stdout.write(self.style.SUCCESS("\n[OK] Report submission forms + test data seeded."))
