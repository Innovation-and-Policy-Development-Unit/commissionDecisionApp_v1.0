from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0071_merge_0069_checklist_and_ai_assist"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="ai_brief_context_key",
            field=models.CharField(
                blank=True,
                default="",
                max_length=64,
                help_text="Fingerprint of stage/docs/checklist when brief was generated.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_quality_context_key",
            field=models.CharField(
                blank=True,
                default="",
                max_length=64,
                help_text="Fingerprint of stage/docs/checklist when quality was scored.",
            ),
        ),
    ]
