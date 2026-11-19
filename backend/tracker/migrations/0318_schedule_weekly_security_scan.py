from django.db import migrations


def register_task(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    # Sunday 03:00 Vanuatu time: after the 02:00 backup, outside business hours.
    sunday = CrontabSchedule.objects.get_or_create(
        minute="0", hour="3", day_of_month="*", month_of_year="*", day_of_week="0",
        timezone="Pacific/Efate",
    )[0]
    PeriodicTask.objects.update_or_create(
        name="weekly-security-scan",
        defaults={"crontab": sunday, "task": "tracker.tasks.run_scheduled_security_scan", "enabled": True},
    )


def deregister_task(apps, schema_editor):
    apps.get_model("django_celery_beat", "PeriodicTask").objects.filter(name="weekly-security-scan").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0317_live_outcomes"),
        ("django_celery_beat", "0018_improve_crontab_helptext"),
    ]

    operations = [migrations.RunPython(register_task, deregister_task)]
