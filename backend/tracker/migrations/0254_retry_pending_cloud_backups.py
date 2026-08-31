from django.db import migrations


def register_task(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask    = apps.get_model("django_celery_beat", "PeriodicTask")

    # Noon local time — this network's outbound connectivity is unreliable
    # overnight (see scdms-cloudflare-tunnel-flakiness memory), but has
    # historically recovered well before midday.
    noon, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="12",
        day_of_month="*", month_of_year="*", day_of_week="*",
        timezone="Pacific/Efate",
    )

    PeriodicTask.objects.update_or_create(
        name="retry-pending-cloud-backup-pushes",
        defaults={"crontab": noon, "task": "tracker.tasks.retry_pending_cloud_backups", "enabled": True},
    )


def deregister_task(apps, schema_editor):
    apps.get_model("django_celery_beat", "PeriodicTask").objects.filter(
        name="retry-pending-cloud-backup-pushes"
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0253_submissioncollaborator"),
    ]

    operations = [
        migrations.RunPython(register_task, deregister_task),
    ]
