from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0327_vipam_submission_paper_form"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="comment",
            name="field_key",
            field=models.CharField(
                blank=True, db_index=True, default="", max_length=100,
                help_text="PSCFormField.field_key this comment is about; blank = whole submission.",
            ),
        ),
        migrations.AddField(
            model_name="comment",
            name="resolved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="comment",
            name="resolved_by",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="comments_resolved", to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
