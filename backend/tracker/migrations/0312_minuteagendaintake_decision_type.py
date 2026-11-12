from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tracker", "0311_profile_ui_preferences")]

    operations = [
        migrations.AddField(
            model_name="minuteagendaintake",
            name="decision_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("approved", "Approved"),
                    ("rejected", "Not approved"),
                    ("deferred", "Deferred"),
                    ("noted", "Noted"),
                    ("returned", "Returned"),
                    ("tabled", "Tabled"),
                ],
                help_text="Outcome the minute-taker picked from the list (optional).",
                max_length=32,
            ),
        ),
    ]
