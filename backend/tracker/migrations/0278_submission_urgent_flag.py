import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0277_seed_pilot_flow_integrity_reports"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="is_urgent",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="submission",
            name="urgent_reason",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
        migrations.AddField(
            model_name="submission",
            name="urgent_marked_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="urgent_marked_submissions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="urgent_marked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
