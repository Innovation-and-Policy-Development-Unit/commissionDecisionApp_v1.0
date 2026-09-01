from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0256_seed_commissioner_meeting_email_templates"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="is_test",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Marks a demo/walkthrough submission created to exercise the real "
                    "workflow (e.g. by a training/demo account) rather than a genuine "
                    "matter. Excluded from automatic agenda placement and AI brief "
                    "generation, and blocks agenda submission/endorsement if still on a "
                    "meeting's agenda — a test submission must never silently reach an "
                    "endorsed, Commissioner-facing agenda."
                ),
            ),
        ),
    ]
