from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0074_submission_policy_guardrail"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SittingPackSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("seal_code", models.CharField(db_index=True, max_length=16)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("last_heartbeat_at", models.DateTimeField(auto_now=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                (
                    "meeting",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sitting_pack_sessions",
                        to="tracker.meeting",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sitting_pack_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-started_at"],
                "indexes": [
                    models.Index(fields=["meeting", "user", "ended_at"], name="tracker_sit_meeting_8a1f2d_idx"),
                ],
            },
        ),
    ]
