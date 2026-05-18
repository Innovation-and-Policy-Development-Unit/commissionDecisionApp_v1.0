from django.db import migrations


def create_due_date_notification_beat(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    cron, _ = CrontabSchedule.objects.get_or_create(
        minute="0",
        hour="8",
        day_of_month="*",
        month_of_year="*",
        day_of_week="*",
        timezone="Pacific/Efate",
    )

    PeriodicTask.objects.update_or_create(
        name="notify-approaching-due-dates",
        defaults={
            "crontab": cron,
            "task": "tracker.tasks.notify_approaching_due_dates",
            "enabled": True,
        },
    )


def remove_due_date_notification_beat(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="notify-approaching-due-dates").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("django_celery_beat", "0019_alter_periodictasks_options"),
        ("tracker", "0018_task_subtask_m2m"),
    ]

    operations = [
        migrations.RunPython(
            create_due_date_notification_beat,
            remove_due_date_notification_beat,
        ),
    ]
