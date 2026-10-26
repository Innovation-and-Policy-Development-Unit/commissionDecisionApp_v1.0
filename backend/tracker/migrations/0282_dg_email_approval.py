from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0281_seed_login_otp_template"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="dg_approval_method",
            field=models.CharField(
                blank=True, max_length=16,
                choices=[
                    ("paper", "Signed on paper (HR attested)"),
                    ("email_link", "Approved by emailed link"),
                    ("in_app", "Approved in SCDMS"),
                ],
                help_text="How the Director-General's approval was given. Blank for papers "
                          "submitted before this was recorded.",
            ),
        ),
        migrations.CreateModel(
            name="DGApprovalToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("cancelled_at", models.DateTimeField(blank=True, null=True)),
                ("outcome", models.CharField(
                    blank=True, max_length=16,
                    choices=[("approved", "Approved"), ("returned", "Returned for changes")],
                )),
                ("used_ip", models.GenericIPAddressField(blank=True, null=True)),
                ("used_user_agent", models.CharField(blank=True, max_length=512)),
                ("failed_pin_attempts", models.PositiveSmallIntegerField(default=0)),
                ("last_reminded_at", models.DateTimeField(blank=True, null=True)),
                ("dg_user", models.ForeignKey(
                    help_text="The Head of Agency account this link was issued to.",
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="dg_approval_tokens", to=settings.AUTH_USER_MODEL,
                )),
                ("submission", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="dg_approval_tokens", to="tracker.submission",
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
