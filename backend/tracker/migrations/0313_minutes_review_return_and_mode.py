"""Minutes: send a draft back during review, and Secretary-then-Chairman order.

The Secretary and the Chairman can now return a draft to the minute takers with
a note. Their review runs one after the other by default; the order is a
setting so the Commission can put them back side by side without a deploy.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

# Mirrors tracker.minutes_review — keep the default in step.
REVIEW_MODE = (
    "MINUTES_REVIEW_MODE", "sequential",
    "How the Secretary and Chairman review draft minutes: 'sequential' (the "
    "Secretary approves first, then the Chairman) or 'parallel' (both at once).",
)


def seed_setting(apps, schema_editor):
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    key, value, description = REVIEW_MODE
    fields = {f.name for f in SystemSetting._meta.get_fields()}
    defaults = {"value": value}
    if "description" in fields:
        defaults["description"] = description
    SystemSetting.objects.get_or_create(key=key, defaults=defaults)


def unseed_setting(apps, schema_editor):
    apps.get_model("tracker", "SystemSetting").objects.filter(key=REVIEW_MODE[0]).delete()


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0312_minuteagendaintake_decision_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="minutes",
            name="review_return_note",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="minutes",
            name="review_returned_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="minutes",
            name="review_returned_by",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="minutes_returned_in_review", to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(seed_setting, unseed_setting),
    ]
