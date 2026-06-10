import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0137_dashboard"),
    ]

    operations = [
        migrations.CreateModel(
            name="IntelligenceReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("kind", models.CharField(choices=[("report", "Scheduled report"), ("alert", "Alert")], default="report", max_length=16)),
                ("dataset", models.CharField(max_length=64)),
                ("spec", models.JSONField(blank=True, default=dict)),
                ("alert_metric", models.CharField(blank=True, max_length=64)),
                ("alert_operator", models.CharField(blank=True, choices=[("gt", "greater than"), ("gte", "at least"), ("lt", "less than"), ("lte", "at most")], max_length=8)),
                ("alert_threshold", models.FloatField(blank=True, null=True)),
                ("frequency", models.CharField(choices=[("daily", "Daily"), ("weekly", "Weekly"), ("monthly", "Monthly")], default="daily", max_length=16)),
                ("hour", models.PositiveSmallIntegerField(default=7, help_text="Hour (0–23) to send.")),
                ("day_of_week", models.PositiveSmallIntegerField(default=0, help_text="Weekly: 0=Mon … 6=Sun.")),
                ("day_of_month", models.PositiveSmallIntegerField(default=1, help_text="Monthly: 1–28.")),
                ("recipients", models.JSONField(blank=True, default=list, help_text="List of email addresses.")),
                ("is_active", models.BooleanField(default=True)),
                ("last_run_at", models.DateTimeField(blank=True, null=True)),
                ("last_status", models.CharField(blank=True, choices=[("sent", "Sent"), ("triggered", "Alert triggered"), ("ok", "Checked — no alert"), ("skipped", "Skipped"), ("failed", "Failed")], max_length=16)),
                ("last_value", models.FloatField(blank=True, null=True)),
                ("last_error", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="intelligence_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.AddIndex(
            model_name="intelligencereport",
            index=models.Index(fields=["is_active", "frequency"], name="intel_report_active_idx"),
        ),
    ]
