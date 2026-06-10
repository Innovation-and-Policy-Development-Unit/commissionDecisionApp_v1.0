import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

BEAT_NAME = "remind-unacknowledged-decision-services"


def register_beat(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    daily_8am, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="8",
        day_of_month="*", month_of_year="*", day_of_week="*",
        timezone="Pacific/Efate",
    )
    PeriodicTask.objects.update_or_create(
        name=BEAT_NAME,
        defaults={
            "crontab": daily_8am,
            "task": "tracker.tasks.remind_unacknowledged_decision_services",
            "enabled": True,
        },
    )


def deregister_beat(apps, schema_editor):
    apps.get_model("django_celery_beat", "PeriodicTask").objects.filter(
        name=BEAT_NAME
    ).delete()


def seed_setting(apps, schema_editor):
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    SystemSetting.objects.get_or_create(
        key="DECISION_ACK_REMINDER_DAYS",
        defaults={
            "value": "5",
            "description": (
                "Days after a decision is served before the ministry is reminded "
                "to acknowledge receipt (reminders repeat at this interval)."
            ),
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0149_document_versioning"),
        ("django_celery_beat", "0018_improve_crontab_helptext"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DecisionService",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("decision_outcome", models.CharField(blank=True, help_text="Workflow stage of the decision at serve time (approved / rejected / …).", max_length=48)),
                ("letter_subject", models.CharField(blank=True, max_length=255)),
                ("letter_body", models.TextField(help_text="Letter text exactly as served — never edited after service.")),
                ("letter_pdf", models.FileField(blank=True, upload_to="decision_service/%Y/%m/")),
                ("content_hash", models.CharField(blank=True, db_index=True, help_text="SHA-256 of the canonical service snapshot (proof_payload).", max_length=64)),
                ("proof_payload", models.JSONField(blank=True, default=dict, help_text="Immutable JSON snapshot used to verify content_hash.")),
                ("served_at", models.DateTimeField(auto_now_add=True)),
                ("acknowledged_at", models.DateTimeField(blank=True, null=True)),
                ("acknowledgement_note", models.TextField(blank=True)),
                ("superseded", models.BooleanField(default=False, help_text="True when a corrected letter was re-served after this one.")),
                ("reminder_count", models.PositiveSmallIntegerField(default=0)),
                ("last_reminder_at", models.DateTimeField(blank=True, null=True)),
                ("acknowledged_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="decisions_acknowledged", to=settings.AUTH_USER_MODEL)),
                ("ministry", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="decision_services", to="tracker.ministry")),
                ("served_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="decisions_served", to=settings.AUTH_USER_MODEL)),
                ("submission", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="decision_services", to="tracker.submission")),
            ],
            options={
                "ordering": ["-served_at"],
            },
        ),
        migrations.RunPython(register_beat, deregister_beat),
        migrations.RunPython(seed_setting, migrations.RunPython.noop),
    ]
