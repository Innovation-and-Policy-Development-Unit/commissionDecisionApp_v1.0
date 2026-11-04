"""Chase decisions whose letter has not been served.

Since 0292's companion change, a ministry is told its outcome only when the decision
letter is served on them. Nothing chased an unserved decision, because the outcome
used to reach them regardless — so a decision nobody served would leave a ministry
unable to tell "not yet decided" from "decided and not sent".

Adds the mark that stops the sweep chasing the same unit every morning, the window
as a setting rather than a number in the code, and the daily task itself.
"""

from django.db import migrations, models

SETTING_KEY = "DECISION_SERVICE_DAYS"
SETTING_DESCRIPTION = (
    "Working days after a Commission decision before the responsible unit is chased "
    "to serve the decision letter on the ministry."
)


def seed_setting(apps, schema_editor):
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    SystemSetting.objects.get_or_create(
        key=SETTING_KEY, defaults={"value": "2", "description": SETTING_DESCRIPTION},
    )


def unseed_setting(apps, schema_editor):
    apps.get_model("tracker", "SystemSetting").objects.filter(key=SETTING_KEY).delete()


def register_sweep(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    daily_8am, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="8",
        day_of_month="*", month_of_year="*", day_of_week="*",
        timezone="Pacific/Efate",
    )
    PeriodicTask.objects.update_or_create(
        name="remind-unserved-decisions",
        defaults={
            "crontab": daily_8am,
            "task": "tracker.tasks.remind_unserved_decisions",
            "enabled": True,
        },
    )


def deregister_sweep(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="remind-unserved-decisions").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0292_submit_gate_package_signature"),
        ("django_celery_beat", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="decision_service_reminded_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="When the unit was last chased to serve this decision letter.",
            ),
        ),
        migrations.RunPython(seed_setting, unseed_setting),
        migrations.RunPython(register_sweep, deregister_sweep),
    ]
