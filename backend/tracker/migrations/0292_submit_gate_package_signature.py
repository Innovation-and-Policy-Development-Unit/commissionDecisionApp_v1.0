from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0291_minutes_review_deadlines"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="ai_package_signature",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Fingerprint of docs/checklist/form when the package was last validated.",
                max_length=64,
            ),
        ),
    ]
