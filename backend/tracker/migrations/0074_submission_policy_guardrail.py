from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0073_ui_translation"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="ai_policy_observations",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="List of {severity, category, message, evidence} policy observations.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_policy_confidence",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="0–100 likelihood of passing PSC review without return (higher is better).",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_policy_summary",
            field=models.TextField(
                blank=True,
                help_text="One-line policy guardrail summary for ministry submitters.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_policy_processed",
            field=models.BooleanField(
                default=False,
                help_text="True once the latest policy guardrail scan completed.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_policy_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_policy_context_key",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Fingerprint of form/category data when policy scan ran.",
                max_length=64,
            ),
        ),
    ]
