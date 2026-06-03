from django.db import migrations


def register_periodic_tasks(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask    = apps.get_model("django_celery_beat", "PeriodicTask")

    # 08:00 Pacific/Efate daily — same schedule as existing notification task
    daily_8am, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="8",
        day_of_month="*", month_of_year="*", day_of_week="*",
        timezone="Pacific/Efate",
    )

    # 20:00 Pacific/Efate nightly — run auto-scheduling after business hours
    nightly_8pm, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="20",
        day_of_month="*", month_of_year="*", day_of_week="*",
        timezone="Pacific/Efate",
    )

    PeriodicTask.objects.update_or_create(
        name="escalate-overdue-assessments",
        defaults={
            "crontab": daily_8am,
            "task": "tracker.tasks.escalate_overdue_assessments",
            "enabled": True,
        },
    )

    PeriodicTask.objects.update_or_create(
        name="auto-schedule-to-meeting",
        defaults={
            "crontab": nightly_8pm,
            "task": "tracker.tasks.auto_schedule_to_meeting",
            "enabled": True,
        },
    )

    PeriodicTask.objects.update_or_create(
        name="auto-transition-submitted-to-received",
        defaults={
            "crontab": daily_8am,
            "task": "tracker.tasks.auto_transition_submitted_to_received",
            "enabled": True,
        },
    )


def deregister_periodic_tasks(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name__in=[
        "escalate-overdue-assessments",
        "auto-schedule-to-meeting",
        "auto-transition-submitted-to-received",
    ]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0112_automation_gaps_holiday_formtype_sla"),
        ("django_celery_beat", "0018_improve_crontab_helptext"),
    ]

    operations = [
        migrations.RunPython(register_periodic_tasks, deregister_periodic_tasks),
    ]
