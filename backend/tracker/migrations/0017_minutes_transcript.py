"""Create Minutes and MeetingTranscript models."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0016_feedback_workflow_notification"),
    ]

    operations = [
        migrations.CreateModel(
            name="MeetingTranscript",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "raw_text",
                    models.TextField(
                        blank=True,
                        help_text="Full verbatim transcript from AI transcription.",
                    ),
                ),
                (
                    "structured_data",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="AI-extracted structured data: speakers, topics, decisions, actions.",
                    ),
                ),
                (
                    "audio_file",
                    models.CharField(
                        blank=True,
                        help_text="Filename of the source audio recording in MEDIA_ROOT/recordings/.",
                        max_length=255,
                    ),
                ),
                (
                    "ai_processed",
                    models.BooleanField(
                        default=False,
                        help_text="True once transcription is complete.",
                    ),
                ),
                (
                    "processed_at",
                    models.DateTimeField(blank=True, null=True),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "meeting",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="transcript",
                        to="tracker.meeting",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Minutes",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Draft"), ("reviewed", "Reviewed"), ("signed", "Signed")],
                        default="draft",
                        max_length=16,
                    ),
                ),
                (
                    "content",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text=(
                            "Structured minutes content as JSON. "
                            "Top-level keys: opening, confirmation_previous_minutes, agenda_items (list), "
                            "any_other_business, closing, next_meeting_date."
                        ),
                    ),
                ),
                (
                    "pdf_version",
                    models.FileField(
                        blank=True,
                        help_text="Generated PDF version of the signed minutes.",
                        null=True,
                        upload_to="minutes/",
                    ),
                ),
                (
                    "signed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="signed_minutes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "signed_at",
                    models.DateTimeField(blank=True, null=True),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="created_minutes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "meeting",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="minutes",
                        to="tracker.meeting",
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "Minutes",
                "ordering": ["-meeting__date"],
            },
        ),
    ]
