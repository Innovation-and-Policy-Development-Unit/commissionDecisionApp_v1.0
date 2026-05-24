"""
Migration 0080: Add AI analysis fields to Submission, create WebPushSubscription
and DocumentVersion models.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0079_daily_brief"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── A4 Duplicate Detection fields ────────────────────────────────────
        migrations.AddField(
            model_name="submission",
            name="ai_duplicate_processed",
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_duplicate_is_duplicate",
            field=models.BooleanField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_duplicate_confidence",
            field=models.PositiveSmallIntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_duplicate_similar_cases",
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_duplicate_recommendation",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_duplicate_generated_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
        # ── B2 Risk Assessment fields ─────────────────────────────────────────
        migrations.AddField(
            model_name="submission",
            name="ai_risk_processed",
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_risk_score",
            field=models.PositiveSmallIntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_risk_level",
            field=models.CharField(max_length=20, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_risk_factors",
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_risk_mitigation",
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_risk_recommendation",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_risk_generated_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
        # ── B3 Recommended Outcome fields ─────────────────────────────────────
        migrations.AddField(
            model_name="submission",
            name="ai_outcome_processed",
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_outcome_recommendation",
            field=models.CharField(max_length=50, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_outcome_confidence",
            field=models.PositiveSmallIntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_outcome_rationale",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_outcome_conditions",
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_outcome_precedents",
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_outcome_legal_basis",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_outcome_generated_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
        # ── B5 Notice of Allegation fields ───────────────────────────────────
        migrations.AddField(
            model_name="submission",
            name="ai_noa_processed",
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_noa_content",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_noa_subject",
            field=models.CharField(max_length=255, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_noa_key_points",
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_noa_generated_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
        # ── F3 Outcome Letter fields ──────────────────────────────────────────
        migrations.AddField(
            model_name="submission",
            name="ai_letter_processed",
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_letter_content",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_letter_subject",
            field=models.CharField(max_length=255, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_letter_action_items",
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_letter_generated_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
        # ── WebPushSubscription model ─────────────────────────────────────────
        migrations.CreateModel(
            name="WebPushSubscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("endpoint", models.TextField(unique=True)),
                ("p256dh_key", models.TextField()),
                ("auth_key", models.TextField()),
                ("user_agent", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="push_subscriptions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        # ── DocumentVersion model ─────────────────────────────────────────────
        migrations.CreateModel(
            name="DocumentVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version_num", models.PositiveSmallIntegerField(default=1)),
                ("file", models.FileField(upload_to="documents/versions/")),
                ("filename", models.CharField(max_length=255)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("notes", models.TextField(blank=True)),
                ("is_current", models.BooleanField(default=True)),
                (
                    "document",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versions",
                        to="tracker.submissiondocument",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-version_num"],
                "unique_together": {("document", "version_num")},
            },
        ),
    ]
