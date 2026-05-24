"""Daily brief settings, staff preferences, delivery logs, and Celery beat."""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_daily_brief_emails(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


def create_daily_brief_beat(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    cron, _ = CrontabSchedule.objects.get_or_create(
        minute="0",
        hour="*",
        day_of_month="*",
        month_of_year="*",
        day_of_week="*",
        timezone="Pacific/Efate",
    )
    PeriodicTask.objects.update_or_create(
        name="daily-brief",
        defaults={
            "crontab": cron,
            "task": "tracker.tasks.run_daily_briefs_task",
            "enabled": False,
        },
    )


def remove_daily_brief_beat(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="daily-brief").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("django_celery_beat", "0019_alter_periodictasks_options"),
        ("tracker", "0078_knowledge_base"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DailyBriefSettings",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("enabled", models.BooleanField(default=False)),
                (
                    "module_status",
                    models.CharField(
                        choices=[("active", "Active"), ("paused", "Paused")],
                        default="paused",
                        max_length=16,
                    ),
                ),
                ("delivery_hour", models.PositiveSmallIntegerField(default=7)),
                ("weekdays_only", models.BooleanField(default=True)),
                ("manager_recipient_ids", models.JSONField(blank=True, default=list)),
                ("test_mode", models.BooleanField(default=False)),
                ("test_recipient_email", models.EmailField(blank=True, max_length=254)),
                ("last_run_date", models.DateField(blank=True, null=True)),
                ("last_beat_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Daily brief settings",
                "verbose_name_plural": "Daily brief settings",
            },
        ),
        migrations.CreateModel(
            name="DailyBriefStaffPreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("enabled", models.BooleanField(default=True)),
                ("last_delivered_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="daily_brief_preference",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Daily brief staff preference",
                "verbose_name_plural": "Daily brief staff preferences",
            },
        ),
        migrations.CreateModel(
            name="DailyBriefDeliveryLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "brief_type",
                    models.CharField(choices=[("staff", "Staff"), ("manager", "Manager")], max_length=16),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("sent", "Sent"), ("failed", "Failed"), ("skipped", "Skipped")],
                        max_length=16,
                    ),
                ),
                ("recipient_email", models.EmailField(max_length=254)),
                ("subject", models.CharField(blank=True, max_length=500)),
                ("sections_count", models.PositiveSmallIntegerField(default=0)),
                ("items_total", models.PositiveSmallIntegerField(default=0)),
                ("generation_ms", models.PositiveIntegerField(default=0)),
                ("error_message", models.TextField(blank=True)),
                ("detail", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="daily_brief_delivery_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="dailybriefsettings",
            name="manager_recipients",
            field=models.ManyToManyField(
                blank=True,
                related_name="daily_brief_manager_recipient_for",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name="dailybriefdeliverylog",
            index=models.Index(fields=["-created_at"], name="tracker_dai_created_6e0f0d_idx"),
        ),
        migrations.AddIndex(
            model_name="dailybriefdeliverylog",
            index=models.Index(fields=["brief_type", "status"], name="tracker_dai_brief_t_8c8f2a_idx"),
        ),
        migrations.RunPython(seed_daily_brief_emails, migrations.RunPython.noop),
        migrations.RunPython(create_daily_brief_beat, remove_daily_brief_beat),
    ]
