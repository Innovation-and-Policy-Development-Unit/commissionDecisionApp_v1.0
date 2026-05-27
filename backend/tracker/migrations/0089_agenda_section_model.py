from django.db import migrations, models


AGENDA_SECTIONS = [
    ("preliminaries", "1. Preliminaries & Endorsements", 10, True),
    ("matters_arising", "2. Matters Arising", 20, True),
    ("discipline_compliance", "3. Discipline / Compliance", 30, False),
    ("health_commission", "4. Health Commission", 40, False),
    ("appointment", "5. Appointment / Acting Appointment", 50, False),
    ("direct_appointment", "6. Direct Appointment / Confirmation of Appointment", 60, False),
    (
        "extra_responsibility",
        "7. Extra Responsibility / Overtime Allowance / Special Skills Allowance",
        70,
        False,
    ),
    ("contract", "8. Contract / Temporary Salaried Appointment", 80, False),
    ("temporary_salaried", "9. Temporary Salaried Appointment", 90, False),
    ("salary_adjustment", "10. Salary Adjustment", 100, False),
    (
        "training",
        "11. Long Term Training / Scholarship / Internship / Cadetship / Extension / Direct Appointment",
        110,
        False,
    ),
    ("medical_claim", "12. Medical Claim", 120, False),
    ("partial_severance", "13. Partial Severance", 130, False),
    ("resignation", "14. Resignation / Retirement / Death", 140, False),
    ("other", "15. Other Matters", 150, False),
]


def seed_agenda_sections(apps, schema_editor):
    AgendaSection = apps.get_model("tracker", "AgendaSection")
    for code, label, order, is_special in AGENDA_SECTIONS:
        AgendaSection.objects.update_or_create(
            code=code,
            defaults={
                "label": label,
                "display_order": order,
                "is_special": is_special,
                "is_active": True,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0088_submission_agenda_category"),
    ]

    operations = [
        migrations.CreateModel(
            name="AgendaSection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "code",
                    models.SlugField(
                        help_text="Stable key stored on submissions and agenda items (e.g. appointment).",
                        max_length=32,
                        unique=True,
                    ),
                ),
                (
                    "label",
                    models.CharField(
                        help_text="Display label including section number, e.g. '5. Appointment / Acting Appointment'.",
                        max_length=255,
                    ),
                ),
                ("display_order", models.PositiveIntegerField(default=0)),
                (
                    "is_special",
                    models.BooleanField(
                        default=False,
                        help_text="Meeting-only sections (Preliminaries, Matters Arising) — hidden from ministry lodge form.",
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Agenda section",
                "verbose_name_plural": "Agenda sections",
                "ordering": ["display_order", "id"],
            },
        ),
        migrations.RunPython(seed_agenda_sections, migrations.RunPython.noop),
    ]
