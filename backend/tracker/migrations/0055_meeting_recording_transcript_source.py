from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0054_commissiontask_decision_register_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="meeting",
            name="recording_audio_source",
            field=models.CharField(
                blank=True,
                choices=[
                    ("logitech_group", "Logitech GROUP"),
                    ("zoom_export", "Zoom/Teams export"),
                    ("browser_exception", "Browser (remote/exception)"),
                    ("other", "Other"),
                ],
                help_text="How the boardroom recording was captured (Logitech GROUP policy).",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="meetingtranscript",
            name="source",
            field=models.CharField(
                choices=[
                    ("zoom_asr", "Zoom/Teams ASR"),
                    ("ai_whisper", "AI transcription (Gemini)"),
                    ("manual_paste", "Manual paste"),
                ],
                default="zoom_asr",
                help_text="Origin of raw_text (Zoom ASR paste, AI transcribe, etc.).",
                max_length=16,
            ),
        ),
    ]
