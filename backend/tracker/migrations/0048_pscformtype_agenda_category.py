"""
Add agenda_category to PSCFormType and seed the correct value for every
known form code.  This drives auto-categorisation when a submission is
added to a meeting agenda.

Agenda section order (matches real PSC agenda template):
  matters_arising · discipline_compliance · health_commission · appointment
  direct_appointment · extra_responsibility · contract · temporary_salaried
  salary_adjustment · training · medical_claim · partial_severance
  resignation · other
"""
from django.db import migrations, models


# ---------------------------------------------------------------------------
# Mapping: PSCFormType.code  →  AgendaCategory value
# ---------------------------------------------------------------------------
FORM_CODE_MAP = {
    # ── Organizational Structure & Job Evaluation ──────────────────────────
    # These are structural / establishment submissions — no specific agenda
    # section, kept as 'other'.
    "PSC 2-1":      "other",
    "PSC 2-2":      "other",

    # ── Recruitment & Selection ────────────────────────────────────────────
    "PSC 3-1":      "appointment",          # Approval to Advertise
    "PSC 3-2":      "appointment",          # Job Application (supporting doc)
    "PSC 3-3":      "appointment",          # Individual Applicant Assessment
    "PSC 3-4":      "appointment",          # Comparative Assessment
    "PSC 3-5":      "appointment",          # Selection Outcome Report
    "PSC 3-6":      "appointment",          # Permanent Appointment Report
    "PSC 3-7":      "contract",             # Temporary / Contract / Daily-Rated
    "PSC 3-8":      "other",                # Non-Disclosure Agreement
    "PSC 3-9":      "other",                # Code of Conduct

    # ── Terms & Conditions / Allowances & Claims ───────────────────────────
    "PSC 4-1":      "extra_responsibility", # Overtime & Unsocial Hours
    "PSC 4-2":      "appointment",          # Acting Allowance → Acting Appointment
    "PSC 4-3":      "other",                # Domestic Travel
    "PSC 4-4":      "other",                # Individual Overseas Travel
    "PSC 4-5":      "other",                # Mission Group Overseas Travel
    "PSC 4-6":      "salary_adjustment",    # Child Allowance
    "PSC 4-7":      "other",                # Application for Leave
    "PSC 4-8":      "other",                # Annual Leave Travel Claim
    "PSC 4-9":      "medical_claim",        # Medical Expenses Claim
    "PSC 4-10":     "extra_responsibility", # Risk Allowance

    # ── Education, Training & Development ─────────────────────────────────
    "PSC 5-1":      "training",
    "PSC 5-2":      "training",

    # ── Discipline & Grievance Management ─────────────────────────────────
    "PSC 6-1":      "discipline_compliance",
    "PSC 6-2":      "discipline_compliance",
    "PSC 6-3":      "discipline_compliance",
    "PSC 6-4":      "discipline_compliance",
    "PSC 6-5":      "discipline_compliance",
    "PSC 6-6":      "discipline_compliance",
    "PSC 6-7":      "discipline_compliance",
    "PSC 6-8":      "discipline_compliance",

    # ── Housing Management ─────────────────────────────────────────────────
    "PSC 8-1":      "other",
    "PSC 8-2":      "other",
    "PSC 8-3":      "other",
    "PSC 8-4":      "other",

    # ── Government Fleet / Vehicle Management ─────────────────────────────
    "PSC 9-1":      "other",
    "PSC 9-2":      "discipline_compliance", # Unauthorised Vehicle Use
    "PSC 9-3":      "other",
    "PSC 9-4":      "other",
    "PSC 9-5":      "other",

    # ── Performance Management ─────────────────────────────────────────────
    "PSC 10-1":     "other",
    "PSC 10-2":     "other",
    "PSC 10-2abc":  "other",
    "PSC 10-3":     "other",
    "PSC 10-4a":    "other",
    "PSC 10-4b":    "other",
    "PSC 10-5":     "other",
    "PSC 10-6":     "other",

    # ── Internal Submissions (OPSC CSU Manager) ────────────────────────────
    "INT-1":        "appointment",          # Recruitment + Other Benefits
    "INT-2":        "resignation",          # Voluntary Resignation
    "INT-3":        "partial_severance",    # Leave Payout
    "INT-4":        "salary_adjustment",    # Bonus
    "INT-5":        "other",                # Office Closure
    "INT-6":        "contract",             # Contract
    "INT-7":        "temporary_salaried",   # Temporary
    "INT-8":        "extra_responsibility", # Special Skills Allowance
}


def seed_agenda_categories(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    for code, cat in FORM_CODE_MAP.items():
        PSCFormType.objects.filter(code=code).update(agenda_category=cat)


def reverse_seed(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormType.objects.all().update(agenda_category="other")


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0047_agendaitem_category_and_matters_arising"),
    ]

    operations = [
        migrations.AddField(
            model_name="pscformtype",
            name="agenda_category",
            field=models.CharField(
                max_length=32,
                choices=[
                    ("matters_arising",       "MATTERS ARISING"),
                    ("discipline_compliance", "DISCIPLINE / COMPLIANCE"),
                    ("health_commission",     "HEALTH COMMISSION"),
                    ("appointment",           "APPOINTMENT / ACTING APPOINTMENT"),
                    ("direct_appointment",    "DIRECT APPOINTMENT / CONFIRMATION OF APPOINTMENT"),
                    ("extra_responsibility",  "EXTRA RESPONSIBILITY / OVERTIME ALLOWANCE / SPECIAL SKILLS ALLOWANCE"),
                    ("contract",             "CONTRACT / TEMPORARY SALARIED APPOINTMENT"),
                    ("temporary_salaried",   "TEMPORARY SALARIED APPOINTMENT"),
                    ("salary_adjustment",    "SALARY ADJUSTMENT"),
                    ("training",             "LONG TERM TRAINING / SCHOLARSHIP / INTERNSHIP / CADETSHIP / EXTENSION"),
                    ("medical_claim",        "MEDICAL CLAIM"),
                    ("partial_severance",    "PARTIAL SEVERANCE"),
                    ("resignation",          "RESIGNATION / RETIREMENT / DEATH"),
                    ("other",               "OTHER MATTERS"),
                ],
                default="other",
                blank=True,
                help_text=(
                    "Which PSC agenda section this form type belongs to. "
                    "Used to auto-categorize agenda items when added to a meeting."
                ),
            ),
        ),
        migrations.RunPython(seed_agenda_categories, reverse_seed),
    ]
