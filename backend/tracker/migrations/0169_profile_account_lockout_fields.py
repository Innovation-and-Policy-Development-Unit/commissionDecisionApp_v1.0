from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0168_compliancecasestage_outcome_notes_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="password_changed_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="When the password was last changed; drives password-expiry enforcement.",
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="temp_lock_count",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Temporary lockouts in the current cycle; reset on a successful login.",
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="hard_locked",
            field=models.BooleanField(
                default=False,
                help_text="Permanently locked after a repeat lockout; only a superuser can unlock.",
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="hard_locked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
