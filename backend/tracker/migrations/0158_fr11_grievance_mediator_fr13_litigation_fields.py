import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0157_compliance_decision_model"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # FR-13: new fields on LitigationRecord
        migrations.AddField(
            model_name="litigationrecord",
            name="court_name",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="litigationrecord",
            name="opposing_counsel",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="litigationrecord",
            name="next_court_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="litigationrecord",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        # FR-11: GrievanceMediatorAppointment
        migrations.CreateModel(
            name="GrievanceMediatorAppointment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("mediator_name", models.CharField(max_length=200)),
                ("mediator_organisation", models.CharField(blank=True, max_length=200)),
                ("mediator_contact", models.CharField(blank=True, max_length=200)),
                ("appointment_date", models.DateField()),
                ("mediation_start_date", models.DateField(blank=True, null=True)),
                ("mediation_end_date", models.DateField(blank=True, null=True)),
                ("outcome", models.CharField(
                    choices=[
                        ("pending", "Pending"),
                        ("settled", "Settled"),
                        ("not_settled", "Not Settled"),
                    ],
                    default="pending",
                    max_length=20,
                )),
                ("mom_reference", models.CharField(
                    blank=True,
                    help_text="Reference / file number of the Form 6.8 MoM",
                    max_length=200,
                )),
                ("outcome_notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("case", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="mediator_appointment",
                    to="tracker.compliancecase",
                )),
                ("appointed_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="grievance_mediator_appointments",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["-appointment_date"],
            },
        ),
    ]
