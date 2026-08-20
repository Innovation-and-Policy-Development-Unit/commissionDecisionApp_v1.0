"""
Renumber AgendaSection labels into one consistent 1-23 sequence.

The original template used a clean "1. Preliminaries & Endorsements" through
"15. Other Matters" numbering (display_order in round tens: 10, 20, ... 150).
Eight sections added later for newer submission types — restructure, job
description, business plan, corporate plan, anomalies, annual report,
special skills allowance, extra responsibility allowance — were squeezed in
at display_order 61-68 (between old #6 and old #7) without ever being given
a number, so the dropdown read 1, 2, ..., 6, then eight unnumbered entries,
then 7, ..., 15.

This renumbers every section 1-23 in the same relative order they already
sit in (nothing is reordered relative to today), with display_order spaced
in round tens (10, 20, ... 230) to leave room for future insertions. Only
`label` and `display_order` change — `code` (the stable identifier stored on
AgendaItem.category and PSCFormType.agenda_category) is untouched, so this
is a pure display-text correction with no functional/routing impact.
"""
from django.db import migrations

# (code, new_label, new_display_order)
NEW_NUMBERING = [
    ("preliminaries", "1. Preliminaries & Endorsements", 10),
    ("matters_arising", "2. Matters Arising", 20),
    ("discipline_compliance", "3. Discipline / Compliance", 30),
    ("health_commission", "4. Health Commission", 40),
    ("appointment", "5. Appointment / Acting Appointment", 50),
    ("direct_appointment", "6. Direct Appointment / Confirmation of Appointment", 60),
    ("restructure", "7. Organisation Restructure / Establishment Variation", 70),
    ("job_description", "8. Job Description — Upgrade, Downgrade or Removal of Positions", 80),
    ("business_plan", "9. Ministry Business Plan Submission", 90),
    ("corporate_plan", "10. Ministry Corporate Plan Submission", 100),
    ("anomalies", "11. Anomalies", 110),
    ("annual_report", "12. Ministry Annual Report Submission", 120),
    ("special_skills_allowance", "13. Request for Approval of Special Skills Allowance", 130),
    ("extra_responsibility_allowance", "14. Extra Responsibility Allowance", 140),
    ("extra_responsibility", "15. Extra Responsibility / Overtime Allowance / Special Skills Allowance", 150),
    ("contract", "16. Contract / Temporary Salaried Appointment", 160),
    ("temporary_salaried", "17. Temporary Salaried Appointment", 170),
    ("salary_adjustment", "18. Salary Adjustment", 180),
    ("training", "19. Long Term Training / Scholarship / Internship / Cadetship / Extension / Direct Appointment", 190),
    ("medical_claim", "20. Medical Claim", 200),
    ("partial_severance", "21. Partial Severance", 210),
    ("resignation", "22. Resignation / Retirement / Death", 220),
    ("other", "23. Other Matters", 230),
]

OLD_NUMBERING = [
    ("preliminaries", "1. Preliminaries & Endorsements", 10),
    ("matters_arising", "2. Matters Arising", 20),
    ("discipline_compliance", "3. Discipline / Compliance", 30),
    ("health_commission", "4. Health Commission", 40),
    ("appointment", "5. Appointment / Acting Appointment", 50),
    ("direct_appointment", "6. Direct Appointment / Confirmation of Appointment", 60),
    ("restructure", "Organisation Restructure / Establishment Variation", 61),
    ("job_description", "Job Description — Upgrade, Downgrade or Removal of Positions", 62),
    ("business_plan", "Ministry Business Plan Submission", 63),
    ("corporate_plan", "Ministry Corporate Plan Submission", 64),
    ("anomalies", "Anomalies", 65),
    ("annual_report", "Ministry Annual Report Submission", 66),
    ("special_skills_allowance", "Request for Approval of Special Skills Allowance", 67),
    ("extra_responsibility_allowance", "Extra Responsibility Allowance", 68),
    ("extra_responsibility", "7. Extra Responsibility / Overtime Allowance / Special Skills Allowance", 70),
    ("contract", "8. Contract / Temporary Salaried Appointment", 80),
    ("temporary_salaried", "9. Temporary Salaried Appointment", 90),
    ("salary_adjustment", "10. Salary Adjustment", 100),
    ("training", "11. Long Term Training / Scholarship / Internship / Cadetship / Extension / Direct Appointment", 110),
    ("medical_claim", "12. Medical Claim", 120),
    ("partial_severance", "13. Partial Severance", 130),
    ("resignation", "14. Resignation / Retirement / Death", 140),
    ("other", "15. Other Matters", 150),
]


def _apply_numbering(apps, rows):
    AgendaSection = apps.get_model("tracker", "AgendaSection")
    for code, label, display_order in rows:
        AgendaSection.objects.filter(code=code).update(
            label=label, display_order=display_order,
        )


def apply(apps, schema_editor):
    _apply_numbering(apps, NEW_NUMBERING)


def revert(apps, schema_editor):
    _apply_numbering(apps, OLD_NUMBERING)


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0244_alter_meeting_agenda_status"),
    ]

    operations = [
        migrations.RunPython(apply, revert),
    ]
