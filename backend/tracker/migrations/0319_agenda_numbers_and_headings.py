from django.db import migrations, models

# Headings as the Commission's agenda prints them. Applied only to sections whose heading is still blank,
# so nothing an administrator has already set is overwritten. Display order is left alone.
HEADINGS = {
    "COMPLIANCE NEW SUBMISSION": ["discipline_compliance"],
    "STRUCTURE / ANOMALIES": ["restructure", "anomalies", "salary_adjustment", "job_description"],
    "APPOINTMENT & ACTING APPOINTMENT / ACTING DIRECTOR": ["appointment"],
    "DIRECT APPOINTMENT / CONFIRMATION OF PERMANENT APPOINTMENT": ["direct_appointment"],
    "TEMPORARY / CONTRACT / DAILY RATED / ACTING APPOINTMENT / TERMINATION / TRANSFER": ["contract", "temporary_salaried"],
    "LONG TERM TRAINING / SCHOLARSHIP / INTERNSHIP / CADETSHIP / EXTENSION / SECONDMENT / BONDING": ["training"],
    "ALLOWANCES / LEAVE / SEVERANCE / ARREARS / CLAIM": [
        "special_skills_allowance", "extra_responsibility", "extra_responsibility_allowance", "partial_severance",
    ],
    "RESIGNATION / CESSATION OF EMPLOYMENT / RETIREMENT / DEATH BENEFIT / MEDICAL CLAIM": ["resignation", "medical_claim"],
    "OTHER BUSINESS": ["other", "annual_report", "business_plan", "corporate_plan", "health_commission"],
}


def set_headings(apps, schema_editor):
    Section = apps.get_model("tracker", "AgendaSection")
    for heading, codes in HEADINGS.items():
        Section.objects.filter(code__in=codes, agenda_heading="").update(agenda_heading=heading)


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0318_schedule_weekly_security_scan"),
    ]

    operations = [
        migrations.AddField(
            model_name="agendaitem",
            name="agenda_no",
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, help_text="The item's number on the printed agenda: Adoption of Agenda is 1, the minutes 2, Matters Arising 3, and submissions run on from 4. Renumbered automatically while the agenda is being built; fixed once it is circulated, so references in minutes and Matters Arising stay true. Empty for Preliminaries and Matters Arising items, which sit under items 2 and 3."),
        ),
        migrations.AddField(
            model_name="agendasection",
            name="agenda_heading",
            field=models.CharField(blank=True, default="", max_length=200, help_text="Heading printed on the agenda above this section's items. Sections that sit next to each other and share the same heading are listed together under it (for example Resignation and Medical claim under one heading). Leave blank to use the section's own label."),
        ),
        migrations.RunPython(set_headings, migrations.RunPython.noop),
    ]
