from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0055_meeting_recording_transcript_source"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="ai_brief_summary",
            field=models.TextField(
                blank=True,
                help_text="AI-generated executive brief for PSC Secretary review.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_brief_processed",
            field=models.BooleanField(
                default=False,
                help_text="True once the latest brief generation completed.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_brief_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
