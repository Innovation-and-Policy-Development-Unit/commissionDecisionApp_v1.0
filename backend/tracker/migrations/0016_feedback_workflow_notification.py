"""Create FeedbackReport/Comment, workflow redesign, meeting cutoff, notifications."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0015_profile_totp_secret_delete_otptoken"),
    ]

    operations = [
        # ── 1. Create FeedbackReport (was never migrated) ─────────────────────
        migrations.CreateModel(
            name="FeedbackReport",
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
                ("description", models.TextField()),
                (
                    "feedback_type",
                    models.CharField(
                        choices=[
                            ("bug", "Bug / Error"),
                            ("ui_issue", "UI / Layout Issue"),
                            ("workflow_problem", "Workflow Problem"),
                            ("suggestion", "Suggestion / Enhancement"),
                            ("performance", "Performance Issue"),
                            ("security", "Security Concern"),
                            ("other", "Other"),
                        ],
                        default="bug",
                        max_length=30,
                    ),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[
                            ("low", "Low"),
                            ("medium", "Medium"),
                            ("high", "High"),
                            ("critical", "Critical"),
                        ],
                        default="medium",
                        max_length=15,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("under_review", "Under Review"),
                            ("in_progress", "In Progress"),
                            ("resolved", "Resolved"),
                            ("closed", "Closed"),
                            ("rejected", "Rejected"),
                        ],
                        default="open",
                        max_length=20,
                    ),
                ),
                (
                    "screenshot",
                    models.ImageField(
                        blank=True, null=True, upload_to="feedback/screenshots/"
                    ),
                ),
                (
                    "annotated_screenshot",
                    models.ImageField(
                        blank=True, null=True, upload_to="feedback/annotated/"
                    ),
                ),
                ("page_url", models.URLField(blank=True, max_length=1000)),
                ("module_name", models.CharField(blank=True, max_length=255)),
                ("browser_info", models.TextField(blank=True)),
                ("viewport_size", models.CharField(blank=True, max_length=50)),
                ("system_version", models.CharField(blank=True, max_length=50)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feedback_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "assigned_to",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assigned_feedback",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "User Feedback",
                "verbose_name_plural": "User Feedback Reports",
                "ordering": ["-created_at"],
            },
        ),
        # ── 2. Create FeedbackComment with AI fields baked in ───────────────
        migrations.CreateModel(
            name="FeedbackComment",
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
                ("body", models.TextField()),
                (
                    "is_internal",
                    models.BooleanField(
                        default=False,
                        help_text="Internal notes only visible to staff with manage permissions.",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "ai_summary",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="AI-generated 1-sentence summary of the feedback.",
                    ),
                ),
                (
                    "ai_severity",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="AI-assigned severity: Low, Medium, High, or Critical.",
                        max_length=15,
                    ),
                ),
                (
                    "ai_category",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="AI-assigned category: Bug, Feature Request, Legal/Compliance, or General Inquiry.",
                        max_length=30,
                    ),
                ),
                (
                    "ai_translated_text",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="AI-translated English version of the original feedback.",
                    ),
                ),
                (
                    "ai_processed",
                    models.BooleanField(
                        default=False,
                        help_text="True once the AI has finished analysing this comment.",
                    ),
                ),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "report",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="tracker.feedbackreport",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
        # ── 3. Add submission_cutoff to Meeting ──────────────────────────────
        migrations.AddField(
            model_name="meeting",
            name="submission_cutoff",
            field=models.DateTimeField(
                blank=True,
                help_text="Submissions after this datetime are queued for the next meeting.",
                null=True,
            ),
        ),
        # ── 4. Add scheduled_meeting to Submission ────────────────────────────
        migrations.AddField(
            model_name="submission",
            name="scheduled_meeting",
            field=models.ForeignKey(
                blank=True,
                help_text="Which commission meeting this submission is queued for.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="submissions",
                to="tracker.meeting",
            ),
        ),
        # ── 5. Update current_stage choices and default on Submission ─────────
        migrations.AlterField(
            model_name="submission",
            name="current_stage",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("submitted", "Submitted to PSC"),
                    ("received_by_psc", "Received by PSC"),
                    ("returned_for_clarification", "Returned for Clarification"),
                    ("registered_routed", "Registered and Routed"),
                    ("manager_checklist_review", "Manager Checklist Review"),
                    ("under_assessment", "Under Assessment"),
                    ("deferred", "Deferred"),
                    ("tabled", "Tabled"),
                    ("awaiting_legal_advice", "Awaiting Legal Advice"),
                    ("awaiting_cabinet_decision", "Awaiting Cabinet Decision"),
                    ("resubmitted", "Resubmitted"),
                    ("forwarded_to_commission", "Forwarded to Commission"),
                    ("commission_sitting", "Commission Sitting"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("returned", "Returned"),
                    ("deferred_back_to_hr", "Deferred Back to HR"),
                    ("minutes_drafted_signed", "Minutes Drafted and Signed"),
                    ("decision_entered_assigned", "Decision Entered and Assigned"),
                    ("under_implementation", "Under Implementation"),
                    ("implementation_report", "Implementation Report"),
                ],
                default="draft",
                max_length=48,
            ),
        ),
        # ── 6. Update WorkflowEvent stage choices ─────────────────────────────
        migrations.AlterField(
            model_name="workflowevent",
            name="previous_stage",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("submitted", "Submitted to PSC"),
                    ("received_by_psc", "Received by PSC"),
                    ("returned_for_clarification", "Returned for Clarification"),
                    ("registered_routed", "Registered and Routed"),
                    ("manager_checklist_review", "Manager Checklist Review"),
                    ("under_assessment", "Under Assessment"),
                    ("deferred", "Deferred"),
                    ("tabled", "Tabled"),
                    ("awaiting_legal_advice", "Awaiting Legal Advice"),
                    ("awaiting_cabinet_decision", "Awaiting Cabinet Decision"),
                    ("resubmitted", "Resubmitted"),
                    ("forwarded_to_commission", "Forwarded to Commission"),
                    ("commission_sitting", "Commission Sitting"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("returned", "Returned"),
                    ("deferred_back_to_hr", "Deferred Back to HR"),
                    ("minutes_drafted_signed", "Minutes Drafted and Signed"),
                    ("decision_entered_assigned", "Decision Entered and Assigned"),
                    ("under_implementation", "Under Implementation"),
                    ("implementation_report", "Implementation Report"),
                ],
                max_length=48,
            ),
        ),
        migrations.AlterField(
            model_name="workflowevent",
            name="new_stage",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("submitted", "Submitted to PSC"),
                    ("received_by_psc", "Received by PSC"),
                    ("returned_for_clarification", "Returned for Clarification"),
                    ("registered_routed", "Registered and Routed"),
                    ("manager_checklist_review", "Manager Checklist Review"),
                    ("under_assessment", "Under Assessment"),
                    ("deferred", "Deferred"),
                    ("tabled", "Tabled"),
                    ("awaiting_legal_advice", "Awaiting Legal Advice"),
                    ("awaiting_cabinet_decision", "Awaiting Cabinet Decision"),
                    ("resubmitted", "Resubmitted"),
                    ("forwarded_to_commission", "Forwarded to Commission"),
                    ("commission_sitting", "Commission Sitting"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("returned", "Returned"),
                    ("deferred_back_to_hr", "Deferred Back to HR"),
                    ("minutes_drafted_signed", "Minutes Drafted and Signed"),
                    ("decision_entered_assigned", "Decision Entered and Assigned"),
                    ("under_implementation", "Under Implementation"),
                    ("implementation_report", "Implementation Report"),
                ],
                max_length=48,
            ),
        ),
        # ── 7. Create Notification model ──────────────────────────────────────
        migrations.CreateModel(
            name="Notification",
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
                (
                    "channel",
                    models.CharField(
                        choices=[
                            ("in_app", "In-App"),
                            ("email", "Email"),
                            ("both", "Both"),
                        ],
                        default="both",
                        max_length=10,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("body", models.TextField(blank=True)),
                ("is_read", models.BooleanField(default=False)),
                ("emailed", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "recipient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "submission",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="tracker.submission",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
