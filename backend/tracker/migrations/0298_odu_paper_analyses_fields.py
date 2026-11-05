from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0297_training_forms_route_to_vipam"),
    ]

    operations = [
        migrations.AddField(
            model_name="odurestructureboardpaper", name="dsspac_summary",
            field=models.TextField(blank=True, help_text="Summary of the attached DSSPAC analysis."),
        ),
        migrations.AddField(
            model_name="odurestructureboardpaper", name="grt_summary",
            field=models.TextField(blank=True, help_text="Summary of the attached GRT analysis."),
        ),
        migrations.AddField(
            model_name="odurestructureboardpaper", name="finance_summary",
            field=models.TextField(blank=True, help_text="Summary of the attached Finance analysis."),
        ),
        migrations.AddField(
            model_name="odurestructureboardpaper", name="ai_draft",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="odurestructureboardpaper", name="ai_draft_state",
            field=models.CharField(blank=True, default="", max_length=12),
        ),
        migrations.AddField(
            model_name="odurestructureboardpaper", name="ai_draft_error",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="odurestructureboardpaper", name="ai_draft_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="requireddocument", name="opsc_supplied",
            field=models.BooleanField(
                default=False,
                help_text="Supplied by OPSC itself (e.g. ODU's DSSPAC / GRT / Finance analyses), "
                          "not asked of the ministry. Kept off the ministry's checklist and out of "
                          "its submit gate; the owning unit uploads it on its own paper.",
            ),
        ),
    ]
