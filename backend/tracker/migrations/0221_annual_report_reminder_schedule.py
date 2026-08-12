"""
Schedules tracker.tasks.send_annual_report_deadline_reminders — PSC 2-7
Ministry Annual Report is due 31 March each year; this reminds Ministry HR
in February and March if that year's Annual Report hasn't been lodged yet.
Same registration pattern as 0213_business_plan_reminder_schedule.py.

Distinct from the unrelated generate_annual_report_statistics task
(0151_annual_report.py) — that one is SCDMS's own internal statistics
report, not a reminder for ministries to submit PSC 2-7.
"""
from django.db import migrations

BEAT_NAME_FEB = "annual-report-reminder-february"
BEAT_NAME_MAR = "annual-report-reminder-march"
TASK_PATH = "tracker.tasks.send_annual_report_deadline_reminders"


def register_beat(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    feb15, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="6",
        day_of_month="15", month_of_year="2", day_of_week="*",
        timezone="Pacific/Efate",
    )
    mar15, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="6",
        day_of_month="15", month_of_year="3", day_of_week="*",
        timezone="Pacific/Efate",
    )
    PeriodicTask.objects.update_or_create(
        name=BEAT_NAME_FEB,
        defaults={"crontab": feb15, "task": TASK_PATH, "enabled": True},
    )
    PeriodicTask.objects.update_or_create(
        name=BEAT_NAME_MAR,
        defaults={"crontab": mar15, "task": TASK_PATH, "enabled": True},
    )


def deregister_beat(apps, schema_editor):
    apps.get_model("django_celery_beat", "PeriodicTask").objects.filter(
        name__in=[BEAT_NAME_FEB, BEAT_NAME_MAR],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0220_annual_report_required_documents"),
        ("django_celery_beat", "0018_improve_crontab_helptext"),
    ]

    operations = [
        migrations.RunPython(register_beat, deregister_beat),
    ]
