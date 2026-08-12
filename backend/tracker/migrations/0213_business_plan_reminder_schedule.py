"""
Schedules tracker.tasks.send_business_plan_deadline_reminders — PSC 2-5
Ministry Business Plan is due 28 February each year; this reminds Ministry
HR in January and February if that year's Business Plan hasn't been lodged
yet. Same registration pattern as 0151_annual_report.py.
"""
from django.db import migrations

BEAT_NAME_JAN = "business-plan-reminder-january"
BEAT_NAME_FEB = "business-plan-reminder-february"
TASK_PATH = "tracker.tasks.send_business_plan_deadline_reminders"


def register_beat(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    jan15, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="6",
        day_of_month="15", month_of_year="1", day_of_week="*",
        timezone="Pacific/Efate",
    )
    feb15, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="6",
        day_of_month="15", month_of_year="2", day_of_week="*",
        timezone="Pacific/Efate",
    )
    PeriodicTask.objects.update_or_create(
        name=BEAT_NAME_JAN,
        defaults={"crontab": jan15, "task": TASK_PATH, "enabled": True},
    )
    PeriodicTask.objects.update_or_create(
        name=BEAT_NAME_FEB,
        defaults={"crontab": feb15, "task": TASK_PATH, "enabled": True},
    )


def deregister_beat(apps, schema_editor):
    apps.get_model("django_celery_beat", "PeriodicTask").objects.filter(
        name__in=[BEAT_NAME_JAN, BEAT_NAME_FEB],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0212_business_plan_required_documents"),
        ("django_celery_beat", "0018_improve_crontab_helptext"),
    ]

    operations = [
        migrations.RunPython(register_beat, deregister_beat),
    ]
