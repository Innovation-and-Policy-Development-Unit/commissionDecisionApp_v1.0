import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0148_implementation_dashboard_report"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="submissiondocument",
            name="version_num",
            field=models.PositiveSmallIntegerField(
                default=1,
                help_text="Current version number; superseded files live in DocumentVersion.",
            ),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="archived_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Soft-removal timestamp — archived documents are hidden, not destroyed.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="archived_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="archived_documents",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
