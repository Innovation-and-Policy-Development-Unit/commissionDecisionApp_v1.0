from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import tracker.models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0027_submission_document"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DocumentAnnotation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("page_number", models.PositiveIntegerField(default=1)),
                ("fabric_json", models.JSONField(blank=True, default=list, help_text="Fabric.js objects array (no background) for this page.")),
                ("snapshot", models.ImageField(blank=True, null=True, help_text="Combined PDF-page + annotation PNG export.", upload_to=tracker.models._annotation_snapshot_path)),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "annotated_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="doc_annotations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "document",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="annotations",
                        to="tracker.submissiondocument",
                    ),
                ),
            ],
            options={
                "ordering": ["document", "annotated_by", "page_number"],
                "unique_together": {("document", "annotated_by", "page_number")},
            },
        ),
    ]
