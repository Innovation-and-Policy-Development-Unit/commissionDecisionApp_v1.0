from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0068_submission_ai_package_validation"),
    ]

    operations = [
        migrations.AddField(
            model_name="submissionchecklistitem",
            name="notes",
            field=models.TextField(
                blank=True,
                help_text="Officer notes or AI-generated reason for this item's status.",
            ),
        ),
    ]
