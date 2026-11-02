"""Minute-review deadlines, and the Compliance Manager as a reviewer.

The three review windows become settings rather than numbers in the code: the
Commission asked to trial how long Commissioners should get rather than fix it
up front, and the minute taker's own read-back of the draft was never tracked
at all. Seeded here with the durations the Commission is starting from, so they
are visible and editable in the admin.

Also registers the daily sweep that chases the two windows that were already
being recorded but never followed up.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

# Mirrors tracker.minutes_review — keep the defaults in step.
REVIEW_SETTINGS = [
    (
        "MINUTES_DRAFT_REVIEW_DAYS", "1",
        "Working days the minute taker has to read back the draft minutes and "
        "submit them to the Secretary and Chairman.",
    ),
    (
        "MINUTES_SECRETARIAT_REVIEW_DAYS", "1",
        "Working days the Secretary, Chairman and (on compliance business) the "
        "Compliance Manager each have to approve the minutes.",
    ),
    (
        "MINUTES_COMMISSIONER_REVIEW_DAYS", "2",
        "Working days Commissioners get to comment on reviewed minutes. The "
        "Commission is trialling this figure — change it here, not in code.",
    ),
]


def seed_settings(apps, schema_editor):
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    for key, value, description in REVIEW_SETTINGS:
        SystemSetting.objects.get_or_create(
            key=key, defaults={"value": value, "description": description},
        )


def unseed_settings(apps, schema_editor):
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    SystemSetting.objects.filter(key__in=[k for k, _, _ in REVIEW_SETTINGS]).delete()


def register_sweep(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    daily_8am, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="8",
        day_of_month="*", month_of_year="*", day_of_week="*",
        timezone="Pacific/Efate",
    )
    PeriodicTask.objects.update_or_create(
        name="remind-overdue-minute-reviews",
        defaults={
            "crontab": daily_8am,
            "task": "tracker.tasks.remind_overdue_minute_reviews",
            "enabled": True,
        },
    )


def deregister_sweep(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="remind-overdue-minute-reviews").delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0290_direct_appointment_to_hr_unit'),
        ('django_celery_beat', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='minutes',
            name='compliance_reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='minutes',
            name='compliance_reviewed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='compliance_reviewed_minutes', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='minutes',
            name='draft_review_due_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='minutes',
            name='draft_review_reminded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='minutes',
            name='review_reminded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(seed_settings, unseed_settings),
        migrations.RunPython(register_sweep, deregister_sweep),
    ]
