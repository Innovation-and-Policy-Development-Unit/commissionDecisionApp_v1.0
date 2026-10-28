"""AI summary for the Director-General's emailed approval page."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0286_remove_lodge_signed_paper_permission"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="ai_dg_brief",
            field=models.JSONField(
                blank=True, default=dict,
                help_text="AI summary shown to the Director-General on the emailed approval page.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_dg_brief_status",
            field=models.CharField(
                blank=True, default="", max_length=8,
                help_text="'', 'pending', 'ready' or 'failed'.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_dg_brief_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
