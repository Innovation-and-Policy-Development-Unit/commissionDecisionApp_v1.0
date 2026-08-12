"""
Permanently removes the three HR recruitment "notification" form types —
Acting Appointment (RECRUIT-ACTING), Eligible Candidate Notification
(RECRUIT-ELIGIBLE), and Unsuccessful Candidate Notification
(RECRUIT-UNSUCCESSFUL) — decided out of pilot scope. None had any
submissions on record.

Deletes the PSCFormType rows (cascades to their RequiredDocument and
PSCFormField rows) and the matching system LetterTemplate rows. The
built-in defaults these were seeded from have already been removed from
letter_template_defaults.py, so re-running seed_default_letter_templates()
won't recreate them.
"""
from django.db import migrations

FORM_TYPE_CODES = ['RECRUIT-ACTING', 'RECRUIT-ELIGIBLE', 'RECRUIT-UNSUCCESSFUL']


def remove_form_types(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    LetterTemplate = apps.get_model('tracker', 'LetterTemplate')
    Submission = apps.get_model('tracker', 'Submission')

    # Safety check: don't delete if a submission of this type exists somehow.
    live = Submission.objects.filter(form_type_code__in=FORM_TYPE_CODES)
    if live.exists():
        raise RuntimeError(
            f"Refusing to delete: {live.count()} submission(s) still reference "
            f"{FORM_TYPE_CODES}."
        )

    LetterTemplate.objects.filter(form_type_code__in=FORM_TYPE_CODES).delete()
    PSCFormType.objects.filter(code__in=FORM_TYPE_CODES).delete()


def noop_reverse(apps, schema_editor):
    # Not reversible — the deleted rows' full content lived in Python source
    # (letter_template_defaults.py, form-field seed migrations) that this
    # migration doesn't restore. Roll back by re-seeding from a backup if
    # ever needed.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0230_hr_misc_field_pagination'),
    ]

    operations = [
        migrations.RunPython(remove_form_types, noop_reverse),
    ]
