from django.db import migrations, models


def backfill_applicant_tracking_codes(apps, schema_editor):
    """Every submission created before this feature existed has no
    applicant_tracking_code yet. Generate one for each via the model's own
    save() hook (Submission.save() already lazily populates the field when
    blank — see generate_applicant_tracking_code() in tracker/models.py),
    so every submission — not just ones created going forward — has a code
    visible on its detail page.

    Uses the historical model (not tracker.models.Submission) so this still runs
    on a fresh database after later migrations add Submission columns; it only
    borrows the code generator function from the live module."""
    from tracker.models import generate_applicant_tracking_code

    Submission = apps.get_model("tracker", "Submission")
    qs = Submission.objects.filter(
        models.Q(applicant_tracking_code__isnull=True) | models.Q(applicant_tracking_code=""),
    ).only("id", "applicant_tracking_code")
    for submission in qs.iterator():
        submission.applicant_tracking_code = generate_applicant_tracking_code()
        submission.save(update_fields=["applicant_tracking_code"])


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0261_reseed_submission_confirmation_tracking_code"),
    ]

    operations = [
        migrations.RunPython(backfill_applicant_tracking_codes, migrations.RunPython.noop),
    ]
