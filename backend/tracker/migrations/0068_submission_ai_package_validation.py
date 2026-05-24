from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0067_submission_ai_quality_score"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="ai_package_gaps",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="List of {severity, category, message} gaps before submit.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_package_ready",
            field=models.BooleanField(
                default=False,
                help_text="True when AI/rules found no critical gaps for submit.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_package_summary",
            field=models.TextField(
                blank=True,
                help_text="One-line AI summary of package readiness.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_package_processed",
            field=models.BooleanField(
                default=False,
                help_text="True once the latest package validation completed.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_package_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
