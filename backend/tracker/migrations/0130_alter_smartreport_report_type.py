from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0129_seed_report_templates"),
    ]

    operations = [
        migrations.AlterField(
            model_name="smartreport",
            name="report_type",
            field=models.CharField(
                default="adhoc",
                help_text='Template slug or "adhoc".',
                max_length=64,
            ),
        ),
    ]
