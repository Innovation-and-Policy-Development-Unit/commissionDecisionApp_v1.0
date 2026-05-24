# Generated manually for E1 OCR, F2 deadline drafts

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def create_deadline_reminder_beat(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    cron, _ = CrontabSchedule.objects.get_or_create(
        minute="30",
        hour="7",
        day_of_month="*",
        month_of_year="*",
        day_of_week="*",
        timezone="Pacific/Efate",
    )

    PeriodicTask.objects.update_or_create(
        name="draft-submission-deadline-reminders",
        defaults={
            "crontab": cron,
            "task": "tracker.tasks.draft_submission_deadline_reminders",
            "enabled": True,
        },
    )


def remove_deadline_reminder_beat(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="draft-submission-deadline-reminders").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("django_celery_beat", "0019_alter_periodictasks_options"),
        ("tracker", "0063_staff_chat"),
    ]

    operations = [
        migrations.AddField(
            model_name="submissiondocument",
            name="extracted_facts",
            field=models.JSONField(blank=True, default=dict, help_text="Structured key facts: names, dates, positions, references, statements."),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="extracted_text",
            field=models.TextField(blank=True, help_text="Full OCR / text extraction for search and AI context."),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="ocr_error",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="ocr_processed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="ocr_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("processing", "Processing"),
                    ("completed", "Completed"),
                    ("failed", "Failed"),
                    ("skipped", "Skipped"),
                ],
                default="pending",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="DeadlineReminderDraft",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("recipient_email", models.EmailField(max_length=254)),
                ("recipient_name", models.CharField(max_length=255)),
                ("recipient_role", models.CharField(blank=True, max_length=64)),
                ("stage", models.CharField(max_length=64)),
                ("deadline_at", models.DateTimeField()),
                ("outstanding_summary", models.TextField(blank=True)),
                ("consequence_note", models.TextField(blank=True)),
                ("subject", models.CharField(max_length=500)),
                ("body", models.TextField()),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Draft"), ("sent", "Sent"), ("cancelled", "Cancelled")],
                        default="draft",
                        max_length=16,
                    ),
                ),
                ("drafted_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                (
                    "ministry",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="deadline_reminder_drafts",
                        to="tracker.ministry",
                    ),
                ),
                (
                    "recipient_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="deadline_reminder_drafts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "submission",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="deadline_reminder_drafts",
                        to="tracker.submission",
                    ),
                ),
            ],
            options={
                "ordering": ["-drafted_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="deadlinereminderdraft",
            constraint=models.UniqueConstraint(
                fields=("submission", "recipient_email", "stage", "deadline_at"),
                name="uniq_deadline_reminder_draft",
            ),
        ),
        migrations.RunPython(create_deadline_reminder_beat, remove_deadline_reminder_beat),
    ]
