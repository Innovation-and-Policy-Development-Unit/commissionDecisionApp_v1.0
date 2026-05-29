from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0094_refresh_password_reset_template"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="force_password_change",
            field=models.BooleanField(
                default=False,
                help_text="Require user to change password at first sign-in.",
            ),
        ),
    ]

