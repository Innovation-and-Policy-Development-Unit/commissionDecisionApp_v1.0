"""Combined-scan upload: split one PDF into several required documents."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0287_submission_ai_dg_brief"),
    ]

    operations = [
        migrations.AddField(
            model_name="submissiondocument",
            name="ai_summary",
            field=models.TextField(blank=True, help_text="Short summary of this document, written when a combined scan is split."),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="pack_source",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="pack_parts", to="tracker.submissiondocument",
                help_text="The combined scan this document was split out of.",
            ),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="page_range",
            field=models.CharField(blank=True, max_length=32, help_text="Pages of the combined scan this document covers, e.g. 3-5."),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="pack_status",
            field=models.CharField(blank=True, max_length=16, help_text="Set only on a combined scan itself: queued / processing / done / failed."),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="pack_error",
            field=models.TextField(blank=True),
        ),
    ]
