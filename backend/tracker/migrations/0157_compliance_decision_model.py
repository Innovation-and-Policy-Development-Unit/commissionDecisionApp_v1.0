import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0156_compliance_decision_model"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ComplianceCaseDecision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("outcome", models.CharField(
                    choices=[
                        ("reinstate", "Reinstated"),
                        ("terminate", "Terminated / Dismissed"),
                        ("warn", "Formal Warning Issued"),
                        ("demote", "Demotion"),
                        ("suspend_no_pay", "Suspension Without Pay"),
                        ("compulsory_retire", "Compulsory Retirement"),
                        ("no_action", "No Further Action"),
                        ("referred_psdb", "Referred to PSDB"),
                        ("settled", "Settled (Grievance)"),
                        ("not_settled", "Not Settled (Grievance)"),
                    ],
                    max_length=30,
                )),
                ("decision_body", models.CharField(
                    choices=[
                        ("commission", "PSC Commission"),
                        ("psdb", "PSDB"),
                        ("hod", "Head of Department"),
                        ("minister", "Minister"),
                        ("secretary", "Secretary OPSC"),
                    ],
                    default="commission",
                    max_length=20,
                )),
                ("decision_date", models.DateField()),
                ("narrative", models.TextField(blank=True)),
                ("stage_reference", models.CharField(blank=True, max_length=60)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("case", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="decisions",
                    to="tracker.compliancecase",
                )),
                ("decided_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="compliance_decisions_recorded",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["-decision_date", "-created_at"],
            },
        ),
    ]
