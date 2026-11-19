from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def register_sweep(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    daily_8am, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="8",
        day_of_month="*", month_of_year="*", day_of_week="*",
        timezone="Pacific/Efate",
    )
    PeriodicTask.objects.update_or_create(
        name="remind-commissioners-review-minutes",
        defaults={
            "crontab": daily_8am,
            "task": "tracker.tasks.remind_commissioners_to_review_minutes",
            "enabled": True,
        },
    )


def deregister_sweep(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="remind-commissioners-review-minutes").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0319_agenda_numbers_and_headings"),
        ("django_celery_beat", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="minutes",
            name="commissioner_overdue_notified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="MinutesCommissionerReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("opened_at", models.DateTimeField(blank=True, null=True)),
                ("confirmed_no_comments_at", models.DateTimeField(blank=True, null=True)),
                ("last_reminded_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("minutes", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="commissioner_reviews", to="tracker.minutes")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="minutes_reviews", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["user__username"]},
        ),
        migrations.AddConstraint(
            model_name="minutescommissionerreview",
            constraint=models.UniqueConstraint(fields=("minutes", "user"), name="uniq_minutes_commissioner_review"),
        ),
        migrations.RunPython(register_sweep, deregister_sweep),
    ]
