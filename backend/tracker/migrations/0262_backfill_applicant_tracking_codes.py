from django.db import migrations, models


def backfill_applicant_tracking_codes(apps, schema_editor):
    """Every submission created before this feature existed has no
    applicant_tracking_code yet. Generate one for each via the model's own
    save() hook (Submission.save() already lazily populates the field when
    blank — see generate_applicant_tracking_code() in tracker/models.py),
    so every submission — not just ones created going forward — has a code
    visible on its detail page."""
    from tracker.models import Submission

    qs = Submission.objects.filter(
        models.Q(applicant_tracking_code__isnull=True) | models.Q(applicant_tracking_code=""),
    )
    for submission in qs.iterator():
        submission.save(update_fields=["applicant_tracking_code"])


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0261_reseed_submission_confirmation_tracking_code"),
    ]

    operations = [
        migrations.RunPython(backfill_applicant_tracking_codes, migrations.RunPython.noop),
    ]
