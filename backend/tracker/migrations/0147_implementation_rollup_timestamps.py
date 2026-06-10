from django.db import migrations, models


def backfill_timestamps(apps, schema_editor):
    """Derive the new milestone timestamps from the WorkflowEvent history.

    - commission_approved_at: first transition into the 'approved' stage.
    - implementation_completed_at: first transition into 'implementation_report',
      but only for submissions already marked implementation_status='implemented'
      (the stage alone does not mean implemented — see
      notify_overdue_implementation_reports).
    """
    Submission = apps.get_model("tracker", "Submission")
    WorkflowEvent = apps.get_model("tracker", "WorkflowEvent")

    def first_event_times(stage):
        first = {}
        events = (
            WorkflowEvent.objects.filter(new_stage=stage)
            .order_by("created_at")
            .values_list("submission_id", "created_at")
        )
        for submission_id, created_at in events.iterator():
            first.setdefault(submission_id, created_at)
        return first

    approved_at = first_event_times("approved")
    report_at = first_event_times("implementation_report")

    implemented_ids = set(
        Submission.objects.filter(implementation_status="implemented")
        .values_list("id", flat=True)
    )

    to_update = []
    for sub in Submission.objects.filter(
        id__in=set(approved_at) | (set(report_at) & implemented_ids)
    ).iterator():
        changed = False
        if sub.id in approved_at and sub.commission_approved_at is None:
            sub.commission_approved_at = approved_at[sub.id]
            changed = True
        if (
            sub.id in report_at
            and sub.id in implemented_ids
            and sub.implementation_completed_at is None
        ):
            sub.implementation_completed_at = report_at[sub.id]
            changed = True
        if changed:
            to_update.append(sub)
        if len(to_update) >= 500:
            Submission.objects.bulk_update(
                to_update, ["commission_approved_at", "implementation_completed_at"]
            )
            to_update = []
    if to_update:
        Submission.objects.bulk_update(
            to_update, ["commission_approved_at", "implementation_completed_at"]
        )


def seed_target_setting(apps, schema_editor):
    """Default implementation SLA used when a submission has no explicit
    implementation_due_date: N calendar days from Commission approval."""
    SystemSetting = apps.get_model("tracker", "SystemSetting")
    SystemSetting.objects.get_or_create(
        key="IMPLEMENTATION_TARGET_DAYS",
        defaults={
            "value": "30",
            "description": (
                "Default implementation target in calendar days from Commission "
                "approval, used for the implementation dashboard when a submission "
                "has no explicit implementation due date."
            ),
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0146_rule_realert"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="commission_approved_at",
            field=models.DateTimeField(
                blank=True,
                help_text=(
                    "First time the Commission approved this submission "
                    "(starts the implementation clock)."
                ),
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="implementation_completed_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When implementation_status was first marked Implemented.",
                null=True,
            ),
        ),
        migrations.RunPython(backfill_timestamps, migrations.RunPython.noop),
        migrations.RunPython(seed_target_setting, migrations.RunPython.noop),
    ]
