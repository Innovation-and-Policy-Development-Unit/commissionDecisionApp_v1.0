from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0068_submission_ai_package_validation"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="submissiondocument",
            name="document_type",
            field=models.CharField(
                choices=[
                    ("unclassified", "Unclassified"),
                    ("appointment_letter", "Appointment letter"),
                    ("medical_certificate", "Medical certificate"),
                    ("psc_form", "PSC form"),
                    ("position_description", "Position description"),
                    ("dg_endorsement", "DG / HoA endorsement"),
                    ("organisational_chart", "Organisational chart"),
                    ("legislation_policy", "Legislation / policy"),
                    ("financial_costing", "Financial / costing"),
                    ("correspondence", "Correspondence"),
                    ("supporting_evidence", "Supporting evidence"),
                    ("minutes_report", "Minutes / report"),
                    ("other", "Other"),
                ],
                db_index=True,
                default="unclassified",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="document_type_confidence",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="0–100 confidence for document_type classification.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="document_type_note",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="document_classified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="MeetingBriefingPack",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
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
                ("narrative_markdown", models.TextField(blank=True)),
                (
                    "pack_data",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Structured agenda sections, flags, and submission rows for the template.",
                    ),
                ),
                ("html_file", models.FileField(blank=True, upload_to="meeting_briefing_packs/%Y/%m/")),
                ("pdf_file", models.FileField(blank=True, upload_to="meeting_briefing_packs/%Y/%m/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "meeting",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="briefing_packs",
                        to="tracker.meeting",
                    ),
                ),
                (
                    "requested_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="meeting_briefing_packs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
