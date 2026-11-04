"""Decision hold, AI-brief sign-off, and Commissioners' three-day minute review.

* Submission gains the hold fields (Secretary holds a decision's letter/implementation)
  and the AI-brief sign-off fields (responsible unit confirms the brief).
* The Commission settled the trial figure for Commissioner minute review at three
  working days. Migration 0291 seeded two; move it to three, but only where nobody has
  changed it from the seeded value, so an admin's own figure is left alone.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def commissioner_days_to_three(apps, schema_editor):
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    SystemSetting.objects.filter(
        key="MINUTES_COMMISSIONER_REVIEW_DAYS", value="2",
    ).update(value="3")


def commissioner_days_back(apps, schema_editor):
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    SystemSetting.objects.filter(
        key="MINUTES_COMMISSIONER_REVIEW_DAYS", value="3",
    ).update(value="2")


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0293_chase_unserved_decisions"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField("submission", "decision_hold_active",
            models.BooleanField(default=False, help_text="While true the decision letter cannot be served and the unserved-decision chase is paused. Only the Secretary sets it.")),
        migrations.AddField("submission", "decision_hold_reason",
            models.TextField(blank=True, default="")),
        migrations.AddField("submission", "decision_held_by",
            models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="decision_holds_placed", to=settings.AUTH_USER_MODEL)),
        migrations.AddField("submission", "decision_held_at",
            models.DateTimeField(blank=True, null=True)),
        migrations.AddField("submission", "decision_hold_released_at",
            models.DateTimeField(blank=True, null=True, help_text="When the last hold was lifted; the unserved-decision window restarts from here.")),
        migrations.AddField("submission", "ai_brief_reviewed_by",
            models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ai_briefs_reviewed", to=settings.AUTH_USER_MODEL)),
        migrations.AddField("submission", "ai_brief_reviewed_at",
            models.DateTimeField(blank=True, null=True)),
        migrations.AddField("submission", "ai_brief_edited",
            models.BooleanField(default=False, help_text="True when the reviewer changed the AI text before confirming it.")),
        migrations.RunPython(commissioner_days_to_three, commissioner_days_back),
    ]
