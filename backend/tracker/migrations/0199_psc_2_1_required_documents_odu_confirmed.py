"""
Bring PSC 2-1 (Organisation Restructure / Establishment Variation) required
documents in line with ODU's confirmed list (2026-08-06):

  1. Official Letter request to restructure
  2. PSC Restructure Submission Template
  3. Current Organisation Structure (OPSC-stamped)
  4. Proposed Organisation Structure
  5. Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions,
     Downgraded Positions, Supervisor for new positions.) (Affected Positions)
  6. Other Supporting Documents

Drops the duplicate "PSC Form 2-2 — Job Description" entry (order 0) and
"OPSC Excel Establishment Cost Spreadsheet" (not in ODU's confirmed list) —
deactivated rather than deleted since SubmissionChecklistItem.document is a
PROTECT FK and past submissions may already reference them.
"""
from django.db import migrations


def apply_odu_confirmed_list(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='PSC 2-1').first()
    if not form_type:
        return

    # Drop the obsolete/duplicate entries (deactivate, not delete).
    RequiredDocument.objects.filter(
        form_type=form_type,
        name__in=['PSC Form 2-2 — Job Description', 'OPSC Excel Establishment Cost Spreadsheet'],
    ).update(is_active=False)

    # Reword the JD entry to match ODU's confirmed scope.
    RequiredDocument.objects.filter(
        form_type=form_type, name='Job Descriptions — PSC Form 2-2 (New Positions Only)',
    ).update(
        name=(
            'Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions, '
            'Downgraded Positions, Supervisor for new positions.) (Affected Positions)'
        ),
        order=50,
    )

    # Re-order the docs ODU already had right.
    RequiredDocument.objects.filter(
        form_type=form_type, name='Current Organisation Structure (OPSC-stamped)',
    ).update(order=30)
    RequiredDocument.objects.filter(
        form_type=form_type, name='Proposed Organisation Structure',
    ).update(order=40)
    RequiredDocument.objects.filter(
        form_type=form_type, name='Other Supporting Documents',
    ).update(order=60, is_active=True)

    # Add the two new ODU-confirmed docs.
    RequiredDocument.objects.get_or_create(
        form_type=form_type, name='Official Letter request to restructure',
        defaults={
            'description': "The ministry's formal letter requesting the restructure/establishment variation.",
            'order': 10, 'is_active': True,
        },
    )
    RequiredDocument.objects.get_or_create(
        form_type=form_type, name='PSC Restructure Submission Template',
        defaults={
            'description': "The ministry's completed PSC Restructure Submission Template.",
            'order': 20, 'is_active': True,
        },
    )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='PSC 2-1').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type,
        name__in=['Official Letter request to restructure', 'PSC Restructure Submission Template'],
    ).delete()
    RequiredDocument.objects.filter(
        form_type=form_type,
        name__in=['PSC Form 2-2 — Job Description', 'OPSC Excel Establishment Cost Spreadsheet'],
    ).update(is_active=True)
    RequiredDocument.objects.filter(
        form_type=form_type,
        name__startswith='Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions',
    ).update(name='Job Descriptions — PSC Form 2-2 (New Positions Only)', order=30)
    RequiredDocument.objects.filter(
        form_type=form_type, name='Current Organisation Structure (OPSC-stamped)',
    ).update(order=10)
    RequiredDocument.objects.filter(
        form_type=form_type, name='Proposed Organisation Structure',
    ).update(order=20)
    RequiredDocument.objects.filter(
        form_type=form_type, name='Other Supporting Documents',
    ).update(order=50)


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0198_board_paper_approval_chain'),
    ]

    operations = [
        migrations.RunPython(apply_odu_confirmed_list, revert),
    ]
