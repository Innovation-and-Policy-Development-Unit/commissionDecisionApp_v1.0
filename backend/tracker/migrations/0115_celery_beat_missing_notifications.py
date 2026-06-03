from django.db import migrations


def register_tasks(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask    = apps.get_model("django_celery_beat", "PeriodicTask")

    daily_8am, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="8",
        day_of_month="*", month_of_year="*", day_of_week="*",
        timezone="Pacific/Efate",
    )

    for name, task in [
        ("remind-overdue-dg-endorsements",        "tracker.tasks.remind_overdue_dg_endorsements"),
        ("notify-overdue-implementation-reports",  "tracker.tasks.notify_overdue_implementation_reports"),
    ]:
        PeriodicTask.objects.update_or_create(
            name=name,
            defaults={"crontab": daily_8am, "task": task, "enabled": True},
        )


def deregister_tasks(apps, schema_editor):
    apps.get_model("django_celery_beat", "PeriodicTask").objects.filter(
        name__in=[
            "remind-overdue-dg-endorsements",
            "notify-overdue-implementation-reports",
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0114_role_permission_coassignment"),
        ("django_celery_beat", "0018_improve_crontab_helptext"),
    ]

    operations = [
        migrations.RunPython(register_tasks, deregister_tasks),
    ]
