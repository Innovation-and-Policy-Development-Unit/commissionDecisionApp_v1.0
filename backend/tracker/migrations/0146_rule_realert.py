from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("tracker", "0145_automation")]

    operations = [
        migrations.AddField(
            model_name="submissionrule",
            name="realert",
            field=models.BooleanField(
                default=False,
                help_text="Re-alert an open flag every cooldown window (anti-spam); off = alert once.",
            ),
        ),
    ]
