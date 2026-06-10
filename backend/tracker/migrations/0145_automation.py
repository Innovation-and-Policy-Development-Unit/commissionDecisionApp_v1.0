import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0144_seed_task_meeting_rules"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="tags",
            field=models.JSONField(blank=True, default=list, help_text="Free-text tags (set manually or by automations)."),
        ),
        migrations.AddField(
            model_name="commissiontask",
            name="tags",
            field=models.JSONField(blank=True, default=list, help_text="Free-text tags (set manually or by automations)."),
        ),
        migrations.CreateModel(
            name="Automation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("description", models.CharField(blank=True, max_length=300)),
                ("entity", models.CharField(choices=[("submission", "Submission"), ("commission_task", "Commission task"), ("meeting", "Meeting / minutes")], default="submission", max_length=20)),
                ("trigger", models.CharField(choices=[("created", "On create"), ("updated", "On update"), ("schedule", "On schedule (periodic)")], default="updated", max_length=16)),
                ("conditions", models.JSONField(blank=True, default=list)),
                ("match", models.CharField(choices=[("all", "Match all (AND)"), ("any", "Match any (OR)")], default="all", max_length=4)),
                ("actions", models.JSONField(blank=True, default=list, help_text="Ordered [{type, params}] actions.")),
                ("is_active", models.BooleanField(default=True)),
                ("test_mode", models.BooleanField(default=False, help_text="Simulate — log actions but make no changes.")),
                ("cooldown_minutes", models.PositiveIntegerField(default=60)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="automations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="AutomationRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("trigger", models.CharField(blank=True, max_length=16)),
                ("status", models.CharField(choices=[("ran", "Ran"), ("simulated", "Simulated"), ("failed", "Failed")], default="ran", max_length=12)),
                ("detail", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("automation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="runs", to="tracker.automation")),
                ("commission_task", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="automation_runs", to="tracker.commissiontask")),
                ("meeting", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="automation_runs", to="tracker.meeting")),
                ("submission", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="automation_runs", to="tracker.submission")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="automation",
            index=models.Index(fields=["is_active", "entity", "trigger"], name="automation_active_idx"),
        ),
        migrations.AddIndex(
            model_name="automationrun",
            index=models.Index(fields=["automation", "-created_at"], name="automationrun_idx"),
        ),
    ]
