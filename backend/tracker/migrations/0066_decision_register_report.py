from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0065_staff_chat_session_purpose"),
    ]

    operations = [
        migrations.CreateModel(
            name="DecisionRegisterReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("prompt", models.TextField(help_text="Natural-language report request from the user.")),
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
                ("filter_spec", models.JSONField(blank=True, default=dict)),
                ("column_spec", models.JSONField(blank=True, default=list)),
                ("narrative_markdown", models.TextField(blank=True)),
                ("include_summary", models.BooleanField(default=True)),
                ("row_count", models.PositiveIntegerField(default=0)),
                ("html_file", models.FileField(blank=True, upload_to="decision_register_reports/%Y/%m/")),
                ("pdf_file", models.FileField(blank=True, upload_to="decision_register_reports/%Y/%m/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "requested_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="decision_register_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
