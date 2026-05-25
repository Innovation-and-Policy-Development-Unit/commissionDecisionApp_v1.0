"""Whisper + Claude transcript pipeline status fields."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0080_travel_forms"),
    ]

    operations = [
        migrations.AddField(
            model_name="meetingtranscript",
            name="transcription_error",
            field=models.TextField(
                blank=True,
                help_text="Last pipeline error message when transcription_status is failed.",
            ),
        ),
        migrations.AddField(
            model_name="meetingtranscript",
            name="transcription_status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("idle", "Idle"),
                    ("pending", "Queued"),
                    ("transcribing", "Transcribing (Whisper)"),
                    ("refining", "Refining (Claude)"),
                    ("ready", "Ready for review"),
                    ("failed", "Failed"),
                ],
                default="idle",
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name="meetingtranscript",
            name="source",
            field=models.CharField(
                choices=[
                    ("zoom_asr", "Zoom/Teams ASR"),
                    ("ai_whisper", "Whisper + Claude refine"),
                    ("manual_paste", "Manual paste"),
                ],
                default="zoom_asr",
                help_text="Origin of raw_text (Zoom ASR paste, AI transcribe, etc.).",
                max_length=16,
            ),
        ),
    ]
