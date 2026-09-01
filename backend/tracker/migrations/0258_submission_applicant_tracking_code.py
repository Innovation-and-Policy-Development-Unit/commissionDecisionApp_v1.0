from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0257_submission_is_test"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="applicant_email",
            field=models.EmailField(
                max_length=254,
                blank=True,
                default="",
                help_text=(
                    "Email of the employee/public servant this submission concerns. When set, "
                    "an auto-generated tracking code is emailed to them so they can check status "
                    "via reference number + code, without needing an SCDMS account."
                ),
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="applicant_tracking_code",
            field=models.CharField(
                max_length=16,
                unique=True,
                null=True,
                blank=True,
                default=None,
                editable=False,
                help_text=(
                    "Auto-generated, hard-to-guess code paired with applicant_email for "
                    "anonymous tracking (reference_number + code). Distinct from the legacy "
                    "orphaned 'tracking_code' DB column from an unmerged branch — see "
                    "migration 0255 — which this deliberately does not reuse."
                ),
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="applicant_tracking_code_sent_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
