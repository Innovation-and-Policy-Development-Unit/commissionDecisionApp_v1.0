from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0283_seed_dg_approval_link_template"),
    ]

    operations = [
        migrations.AddField(
            model_name="dgapprovaltoken",
            name="expiry_notified_at",
            field=models.DateTimeField(
                blank=True, null=True,
                help_text="When HR was told this link expired or was locked (so the daily job tells them once).",
            ),
        ),
    ]
