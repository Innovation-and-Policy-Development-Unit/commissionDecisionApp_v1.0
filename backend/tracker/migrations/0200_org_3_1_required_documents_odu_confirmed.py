"""
ORG-3.1 (the live digitized Organisation Restructure form) had zero
RequiredDocument rows, so restructure submissions fell through to a stale
global fallback checklist ("Confirmation: ..."/"Direct Appointment: ..."
items meant for recruitment submissions, see migrations 0156/0157).

Seed ORG-3.1 with the same ODU-confirmed list migration 0199 gave PSC 2-1
(the legacy, non-digitized form type for the same real-world form):

  1. Official Letter request to restructure
  2. PSC Restructure Submission Template
  3. Current Organisation Structure (OPSC-stamped)
  4. Proposed Organisation Structure
  5. Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions,
     Downgraded Positions, Supervisor for new positions.) (Affected Positions)
  6. Other Supporting Documents
"""
from django.db import migrations


ODU_CONFIRMED_DOCS = [
    {
        'name': 'Official Letter request to restructure',
        'description': "The ministry's formal letter requesting the restructure/establishment variation.",
        'order': 10,
    },
    {
        'name': 'PSC Restructure Submission Template',
        'description': "The ministry's completed PSC Restructure Submission Template.",
        'order': 20,
    },
    {
        'name': 'Current Organisation Structure (OPSC-stamped)',
        'description': 'The current, OPSC-stamped organisation structure.',
        'order': 30,
    },
    {
        'name': 'Proposed Organisation Structure',
        'description': 'The proposed organisation structure.',
        'order': 40,
    },
    {
        'name': (
            'Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions, '
            'Downgraded Positions, Supervisor for new positions.) (Affected Positions)'
        ),
        'description': 'PSC Form 2-2 job descriptions for all affected positions.',
        'order': 50,
    },
    {
        'name': 'Other Supporting Documents',
        'description': 'Any other documents supporting the restructure request.',
        'order': 60,
    },
]


def apply_odu_confirmed_list(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='ORG-3.1').first()
    if not form_type:
        return

    for doc in ODU_CONFIRMED_DOCS:
        RequiredDocument.objects.get_or_create(
            form_type=form_type, name=doc['name'],
            defaults={
                'description': doc['description'],
                'order': doc['order'],
                'is_active': True,
            },
        )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='ORG-3.1').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type,
        name__in=[doc['name'] for doc in ODU_CONFIRMED_DOCS],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0199_psc_2_1_required_documents_odu_confirmed'),
    ]

    operations = [
        migrations.RunPython(apply_odu_confirmed_list, revert),
    ]
