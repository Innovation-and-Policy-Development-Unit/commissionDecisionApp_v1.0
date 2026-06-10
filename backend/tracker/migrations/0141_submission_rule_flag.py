import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0140_dashboard_tabs_tags_favorite"),
    ]

    operations = [
        migrations.CreateModel(
            name="SubmissionRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("description", models.CharField(blank=True, max_length=300)),
                ("level", models.CharField(choices=[("critical", "Critical"), ("at_risk", "At risk"), ("monitoring", "Monitoring")], default="at_risk", max_length=16)),
                ("conditions", models.JSONField(blank=True, default=list)),
                ("match", models.CharField(choices=[("all", "Match all (AND)"), ("any", "Match any (OR)")], default="all", max_length=4)),
                ("is_active", models.BooleanField(default=True)),
                ("is_builtin", models.BooleanField(default=False, help_text="Seeded rule migrated from SLA/escalation logic.")),
                ("test_mode", models.BooleanField(default=False, help_text="Evaluate and flag, but send no alert emails.")),
                ("cooldown_minutes", models.PositiveIntegerField(default=60)),
                ("notify_assignee", models.BooleanField(default=True)),
                ("notify_roles", models.JSONField(blank=True, default=list, help_text="Profile role keys to alert.")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="submission_rules", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="SubmissionFlag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("open", "Open"), ("acknowledged", "Acknowledged"), ("cleared", "Cleared")], default="open", max_length=16)),
                ("opened_at", models.DateTimeField(auto_now_add=True)),
                ("acknowledged_at", models.DateTimeField(blank=True, null=True)),
                ("cleared_at", models.DateTimeField(blank=True, null=True)),
                ("last_alerted_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("acknowledged_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="acknowledged_flags", to=settings.AUTH_USER_MODEL)),
                ("rule", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="flags", to="tracker.submissionrule")),
                ("submission", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="flags", to="tracker.submission")),
            ],
            options={"ordering": ["-opened_at"]},
        ),
        migrations.AddIndex(
            model_name="submissionflag",
            index=models.Index(fields=["status"], name="subflag_status_idx"),
        ),
        migrations.AddIndex(
            model_name="submissionflag",
            index=models.Index(fields=["rule", "status"], name="subflag_rule_status_idx"),
        ),
        migrations.AlterUniqueTogether(
            name="submissionflag",
            unique_together={("rule", "submission")},
        ),
    ]
