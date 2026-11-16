import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0311_profile_ui_preferences"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="commissiontask",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="commissiontask",
            name="completed_by",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="commission_tasks_completed", to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="commissiontaskupdate",
            name="kind",
            field=models.CharField(
                choices=[("comment", "Comment"), ("status", "Status change")],
                default="comment", max_length=16,
            ),
        ),
    ]
