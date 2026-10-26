from django.db import migrations

NEW_SLUGS = ("submission_dg_link_expired",)
BEAT_NAME = "dg-approval-follow-ups"


def seed(apps, schema_editor):
    """Add the HR notice template (never clobbering a customized one) and the daily
    follow-up job that reminds the DG at day 3 and tells HR about dead links."""
    from tracker.email_template_defaults import DEFAULT_EMAIL_TEMPLATES

    EmailTemplate = apps.get_model("tracker", "EmailTemplate")
    by_slug = {d["slug"]: d for d in DEFAULT_EMAIL_TEMPLATES}
    for slug in NEW_SLUGS:
        data = by_slug.get(slug)
        if not data:
            continue
        EmailTemplate.objects.get_or_create(
            slug=slug,
            defaults={
                "name": data["name"],
                "category": data["category"],
                "description": data["description"],
                "placeholders": data["placeholders"],
                "subject_template": data["subject_template"],
                "body_text_template": data["body_text_template"],
                "body_html_template": data.get("body_html_template", ""),
                "is_active": True,
                "is_system": True,
            },
        )

    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    cron, _ = CrontabSchedule.objects.get_or_create(
        minute="30", hour="8", day_of_month="*", month_of_year="*", day_of_week="*",
        timezone="Pacific/Efate",
    )
    PeriodicTask.objects.update_or_create(
        name=BEAT_NAME,
        defaults={"crontab": cron, "task": "tracker.tasks.send_dg_approval_follow_ups", "enabled": True},
    )


def unseed(apps, schema_editor):
    apps.get_model("tracker", "EmailTemplate").objects.filter(slug__in=NEW_SLUGS).delete()
    apps.get_model("django_celery_beat", "PeriodicTask").objects.filter(name=BEAT_NAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("django_celery_beat", "0019_alter_periodictasks_options"),
        ("tracker", "0284_dgapprovaltoken_expiry_notified_at"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
