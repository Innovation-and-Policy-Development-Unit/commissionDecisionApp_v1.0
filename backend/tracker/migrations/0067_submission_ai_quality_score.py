from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0066_decision_register_report"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="ai_quality_score",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="0–100 AI quality score (higher = less review work expected).",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_quality_explanation",
            field=models.TextField(
                blank=True,
                help_text="Brief AI explanation of the quality score.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_quality_dimensions",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Per-dimension scores: completeness, clarity, evidence_quality, psc_formatting.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_quality_review_effort",
            field=models.CharField(
                blank=True,
                help_text="low | moderate | high — expected reviewer effort.",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_quality_processed",
            field=models.BooleanField(
                default=False,
                help_text="True once the latest quality scoring completed.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_quality_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
