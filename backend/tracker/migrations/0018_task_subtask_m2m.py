"""Add CommissionSubTask, M2M assigned_staff_m2m to CommissionTask."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0017_minutes_transcript"),
    ]

    operations = [
        migrations.AddField(
            model_name="commissiontask",
            name="assigned_staff_m2m",
            field=models.ManyToManyField(
                blank=True,
                help_text="One or more staff assigned to this task (supersedes single assigned_staff).",
                related_name="commission_tasks_assigned",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="commissiontask",
            name="due_date_notified",
            field=models.BooleanField(
                default=False,
                help_text="True once the due-date reminder notification has been sent.",
            ),
        ),
        migrations.CreateModel(
            name="CommissionSubTask",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("open", "Open"), ("in_progress", "In Progress"), ("completed", "Completed"), ("cancelled", "Cancelled")],
                        default="open",
                        max_length=20,
                    ),
                ),
                ("due_date", models.DateField(blank=True, null=True)),
                (
                    "due_date_notified",
                    models.BooleanField(
                        default=False,
                        help_text="True once the due-date reminder notification has been sent.",
                    ),
                ),
                (
                    "assigned_staff",
                    models.ManyToManyField(
                        blank=True,
                        related_name="subtasks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_subtasks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "task",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="subtasks",
                        to="tracker.commissiontask",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
