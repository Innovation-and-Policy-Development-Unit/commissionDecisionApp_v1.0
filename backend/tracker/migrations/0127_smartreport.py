from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0126_remove_submission_cms_case_closed_at_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="SmartReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "domain",
                    models.CharField(
                        choices=[("submissions", "Submissions")],
                        default="submissions",
                        max_length=24,
                    ),
                ),
                (
                    "report_type",
                    models.CharField(
                        default="adhoc",
                        help_text='Catalog key (e.g. "submissions_volume_turnaround") or "adhoc".',
                        max_length=64,
                    ),
                ),
                ("prompt", models.TextField(blank=True, help_text="Ad-hoc natural-language request.")),
                ("params", models.JSONField(blank=True, default=dict, help_text="Catalog params / filters.")),
                ("spec", models.JSONField(blank=True, default=dict, help_text="Resolved render spec.")),
                ("title", models.CharField(blank=True, max_length=200)),
                ("subtitle", models.CharField(blank=True, max_length=300)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("processing", "Processing"),
                            ("ready", "Ready"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("error_message", models.TextField(blank=True)),
                ("row_count", models.PositiveIntegerField(default=0)),
                ("html_file", models.FileField(blank=True, upload_to="smart_reports/%Y/%m/")),
                ("pdf_file", models.FileField(blank=True, upload_to="smart_reports/%Y/%m/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "requested_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="smart_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="smartreport",
            index=models.Index(fields=["requested_by", "-created_at"], name="smartrep_req_created_idx"),
        ),
        migrations.AddIndex(
            model_name="smartreport",
            index=models.Index(fields=["status"], name="smartrep_status_idx"),
        ),
    ]
