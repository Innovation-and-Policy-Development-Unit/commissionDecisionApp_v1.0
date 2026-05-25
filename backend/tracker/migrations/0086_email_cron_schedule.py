from django.db import migrations

DEFAULT_CRON = "0 8 * * *"


def seed_email_cron_settings(apps, schema_editor):
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    for key, value in [
        ("EMAIL_CRON_ENABLED", "true"),
        ("EMAIL_CRON_SCHEDULE", DEFAULT_CRON),
    ]:
        SystemSetting.objects.update_or_create(key=key, defaults={"value": value})

    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    minute, hour, day, month, day_of_week = DEFAULT_CRON.split()
    cron, _ = CrontabSchedule.objects.get_or_create(
        minute=minute,
        hour=hour,
        day_of_month=day,
        month_of_year=month,
        day_of_week=day_of_week,
        timezone="Pacific/Efate",
    )
    PeriodicTask.objects.update_or_create(
        name="scheduled-email-dispatch",
        defaults={
            "crontab": cron,
            "task": "tracker.tasks.send_scheduled_emails",
            "enabled": True,
        },
    )


def remove_email_cron_settings(apps, schema_editor):
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    SystemSetting.objects.filter(
        key__in=["EMAIL_CRON_ENABLED", "EMAIL_CRON_SCHEDULE"]
    ).delete()
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="scheduled-email-dispatch").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("django_celery_beat", "0019_alter_periodictasks_options"),
        ("tracker", "0085_required_document_item_type"),
    ]

    operations = [
        migrations.RunPython(seed_email_cron_settings, remove_email_cron_settings),
    ]
