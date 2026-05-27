from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0087_department_head_position_title"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="agenda_category",
            field=models.CharField(
                blank=True,
                choices=[
                    ("preliminaries", "1. Preliminaries & Endorsements"),
                    ("matters_arising", "2. Matters Arising"),
                    ("discipline_compliance", "3. Discipline / Compliance"),
                    ("health_commission", "4. Health Commission"),
                    ("appointment", "5. Appointment / Acting Appointment"),
                    ("direct_appointment", "6. Direct Appointment / Confirmation of Appointment"),
                    ("extra_responsibility", "7. Extra Responsibility / Overtime Allowance / Special Skills Allowance"),
                    ("contract", "8. Contract / Temporary Salaried Appointment"),
                    ("temporary_salaried", "9. Temporary Salaried Appointment"),
                    ("salary_adjustment", "10. Salary Adjustment"),
                    ("training", "11. Long Term Training / Scholarship / Internship / Cadetship / Extension / Direct Appointment"),
                    ("medical_claim", "12. Medical Claim"),
                    ("partial_severance", "13. Partial Severance"),
                    ("resignation", "14. Resignation / Retirement / Death"),
                    ("other", "15. Other Matters"),
                ],
                default="",
                help_text="Commission agenda section chosen at lodge (paper submissions).",
                max_length=32,
            ),
        ),
    ]
