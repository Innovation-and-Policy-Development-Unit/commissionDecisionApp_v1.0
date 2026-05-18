from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0032_drop_documentsignature_fabric_json"),
    ]

    operations = [
        migrations.CreateModel(
            name="PSCForm37Data",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("proposed_employee_name", models.CharField(blank=True, max_length=255)),
                ("is_established_post", models.BooleanField(default=False)),
                ("post_title", models.CharField(blank=True, max_length=255)),
                ("post_number", models.CharField(blank=True, max_length=64)),
                ("post_level", models.CharField(blank=True, max_length=64)),
                ("reasons_for_employment", models.TextField(blank=True)),
                ("how_selected", models.TextField(blank=True)),
                (
                    "employment_type",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("temporary_salaried", "Temporary Salaried Employee"),
                            ("daily_rated", "Daily Rated Worker"),
                            ("contract", "Contract Employee"),
                        ],
                        max_length=24,
                    ),
                ),
                ("period_from", models.DateField(blank=True, null=True)),
                ("period_to", models.DateField(blank=True, null=True)),
                ("salary_vt", models.CharField(blank=True, help_text="VT amount", max_length=64)),
                ("salary_scale", models.CharField(blank=True, help_text="e.g. P12.1 or C2.2", max_length=32)),
                ("director_name", models.CharField(blank=True, max_length=255)),
                ("director_department", models.CharField(blank=True, max_length=255)),
                ("director_date", models.DateField(blank=True, null=True)),
                ("dg_name", models.CharField(blank=True, max_length=255)),
                ("dg_ministry", models.CharField(blank=True, max_length=255)),
                ("dg_date", models.DateField(blank=True, null=True)),
                ("approved", models.BooleanField(blank=True, null=True)),
                ("secretary_name", models.CharField(blank=True, max_length=255)),
                ("secretary_date", models.DateField(blank=True, null=True)),
                ("ministry_advised_date", models.DateField(blank=True, null=True)),
                ("job_offer_letter_date", models.DateField(blank=True, null=True)),
                ("agreement_service_date", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "submission",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="form37_data",
                        to="tracker.submission",
                    ),
                ),
            ],
        ),
    ]
