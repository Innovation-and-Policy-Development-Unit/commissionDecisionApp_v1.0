from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0278_seed_dg_paper_notice_template"),
    ]

    operations = [
        migrations.AddField(
            model_name="ministry",
            name="dg_contact_email",
            field=models.EmailField(
                blank=True, max_length=254,
                help_text="Fallback address for the notice sent to the Director-General when HR "
                          "submits a paper, used when the ministry has no Head of Agency account "
                          "with an email.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="dg_approval_name",
            field=models.CharField(
                blank=True, max_length=255,
                help_text="Director-General who signed the paper, as entered by HR when submitting.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="dg_approval_date",
            field=models.DateField(
                blank=True, null=True, help_text="Date the DG signed the paper (HR attestation).",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="dg_approval_attested_by",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=models.deletion.SET_NULL,
                related_name="dg_approval_attestations", to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="dg_approval_attested_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
