"""
Add CMS integration fields to Submission and make WorkflowEvent.actor nullable.

The COMPLIANCE_UNDER_REVIEW stage is a new value in the WorkflowStage TextChoices;
TextChoices values are stored as VARCHAR so no schema change is required for the
enum itself — only the Submission.current_stage and WorkflowEvent column widths
already support the new string (max_length=48, well within the 30-char value).
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0054_commissiontask_decision_register_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Submission: CMS linkage fields ──────────────────────────────────
        migrations.AddField(
            model_name="submission",
            name="cms_case_id",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Primary key of the corresponding Case in the CMS (set after dispatch).",
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="cms_case_reference",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Human-readable CMS reference, e.g. CCMS-SM-2026-0001.",
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="cms_dispatched_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="When the submission was successfully dispatched to the CMS.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="cms_signoff_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="When the CMS compliance manager signed off and returned the submission.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="cms_signoff_outcome",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Outcome note from the CMS sign-off callback.",
                max_length=255,
            ),
        ),
        # ── WorkflowEvent: make actor nullable for system-generated events ──
        migrations.AlterField(
            model_name="workflowevent",
            name="actor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                help_text="Null for system-generated events (e.g. CMS callback).",
                on_delete=django.db.models.deletion.SET_NULL,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="workflowevent",
            name="actor_label",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Denormalised label used when actor is a system (not a user).",
                max_length=150,
            ),
            preserve_default=False,
        ),
    ]
