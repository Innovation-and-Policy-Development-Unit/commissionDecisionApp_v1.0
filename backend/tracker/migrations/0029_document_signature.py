from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import tracker.models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0028_document_annotation"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DocumentSignature",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("page_number", models.PositiveIntegerField(default=1)),
                ("position_x",  models.FloatField(default=0.1, help_text="Left edge as fraction of canvas width.")),
                ("position_y",  models.FloatField(default=0.7, help_text="Top edge as fraction of canvas height.")),
                ("sig_scale",   models.FloatField(default=1.0, help_text="Scale applied to the signature image.")),
                ("snapshot",    models.ImageField(blank=True, null=True, help_text="Combined PDF-page + signature PNG export.", upload_to=tracker.models._signature_snapshot_path)),
                ("signed_date", models.DateField(help_text="Date entered by the signer.")),
                ("created_at",  models.DateTimeField(auto_now_add=True)),
                ("updated_at",  models.DateTimeField(auto_now=True)),
                ("document",    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="signatures", to="tracker.submissiondocument")),
                ("signed_by",   models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="doc_signatures", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["document", "created_at"],
                "unique_together": {("document", "signed_by")},
            },
        ),
    ]
