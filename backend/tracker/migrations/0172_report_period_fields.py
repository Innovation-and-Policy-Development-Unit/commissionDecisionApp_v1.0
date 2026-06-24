from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0171_seed_commission_notice_templates"),
    ]

    operations = [
        migrations.AlterField(
            model_name="annualreport",
            name="year",
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                db_index=True,
                help_text="Calendar year for annual reports; the start year otherwise.",
            ),
        ),
        migrations.AddField(
            model_name="annualreport",
            name="period_type",
            field=models.CharField(
                max_length=12,
                default="annual",
                choices=[
                    ("annual", "Annual"),
                    ("quarterly", "Quarterly"),
                    ("monthly", "Monthly"),
                    ("custom", "Custom range"),
                ],
            ),
        ),
        migrations.AddField(
            model_name="annualreport",
            name="period_start",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="annualreport",
            name="period_end",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="annualreport",
            name="period_label",
            field=models.CharField(
                max_length=120,
                blank=True,
                help_text="Human label for the period, e.g. 'Q2 2025'.",
            ),
        ),
        migrations.AddField(
            model_name="annualreport",
            name="options",
            field=models.JSONField(
                default=dict,
                blank=True,
                help_text="Generation options, e.g. {'include': [...sections]}.",
            ),
        ),
    ]
