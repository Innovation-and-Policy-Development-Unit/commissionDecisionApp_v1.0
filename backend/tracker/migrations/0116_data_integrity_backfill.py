"""
Data integrity migration:

1. Backfill form_type_code on submissions where it is blank, using the
   agenda section's configured digitized_form.

2. Fix assessment_deadline_at on submissions currently in UNDER_ASSESSMENT
   that somehow ended up with a null deadline.
"""

from django.db import migrations
from django.utils import timezone
from datetime import timedelta


def backfill_form_type_code(apps, schema_editor):
    Submission    = apps.get_model("tracker", "Submission")
    AgendaSection = apps.get_model("tracker", "AgendaSection")
    PSCFormType   = apps.get_model("tracker", "PSCFormType")

    # Build agenda_code -> form_type_code mapping from AgendaSection.digitized_form
    section_to_form = {}
    for section in AgendaSection.objects.select_related("digitized_form").filter(
        digitized_form__isnull=False
    ):
        section_to_form[section.code] = section.digitized_form.code

    blank_subs = Submission.objects.filter(form_type_code="").exclude(
        current_stage="draft"
    )
    updated = 0
    for sub in blank_subs:
        code = section_to_form.get(sub.agenda_category)
        if code:
            sub.form_type_code = code
            sub.save(update_fields=["form_type_code"])
            updated += 1

    print(f"\n  Backfilled form_type_code on {updated} submission(s).")


def fix_null_assessment_deadlines(apps, schema_editor):
    """
    Submissions in UNDER_ASSESSMENT with a null assessment_deadline_at are
    untracked by the overdue-assessment escalation task. Fix them by computing
    the deadline from assessment_started_at, falling back to 21 calendar days
    from now if that's also missing.
    """
    Submission  = apps.get_model("tracker", "Submission")
    PSCFormType = apps.get_model("tracker", "PSCFormType")

    def _working_days_deadline(start_date, days):
        """Simple working-day adder (Mon-Fri) for use during migration."""
        from datetime import timedelta as td
        d = start_date
        added = 0
        while added < days:
            d += td(days=1)
            if d.weekday() < 5:  # Mon-Fri
                added += 1
        return d

    null_deadline = Submission.objects.filter(
        current_stage="under_assessment",
        assessment_deadline_at__isnull=True,
    )
    now = timezone.now()
    fixed = 0
    for sub in null_deadline:
        deadline_days = 21
        # Try to read per-form deadline if form type is known
        if sub.form_type_code:
            try:
                ft = PSCFormType.objects.get(code=sub.form_type_code)
                deadline_days = ft.assessment_deadline_days
            except PSCFormType.DoesNotExist:
                pass

        if sub.assessment_started_at:
            start = timezone.localtime(sub.assessment_started_at).date()
        else:
            # Fallback: assume started now
            start = now.date()
            sub.assessment_started_at = now

        deadline_date = _working_days_deadline(start, deadline_days)
        from datetime import datetime, time as _time
        tz = timezone.get_current_timezone()
        sub.assessment_deadline_at = timezone.make_aware(
            datetime.combine(deadline_date, _time(23, 59, 59)), tz
        )
        sub.save(update_fields=["assessment_started_at", "assessment_deadline_at"])
        fixed += 1

    print(f"\n  Fixed assessment_deadline_at on {fixed} submission(s).")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0115_celery_beat_missing_notifications"),
    ]

    operations = [
        migrations.RunPython(backfill_form_type_code, noop),
        migrations.RunPython(fix_null_assessment_deadlines, noop),
    ]
