"""
Data migration: create the 'Internal Submissions' FormCategory and its 8 PSCFormType records.
These are used exclusively by OPSC CSU Manager submissions that route directly to the Secretary.
"""
from django.db import migrations


INTERNAL_TYPES = [
    ("INT-1", "Recruitment + Other Benefits"),
    ("INT-2", "Voluntary Resignation"),
    ("INT-3", "Leave Payout"),
    ("INT-4", "Bonus"),
    ("INT-5", "Office Closure"),
    ("INT-6", "Contract"),
    ("INT-7", "Temporary"),
    ("INT-8", "Special Skills"),
]


def seed_internal_types(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    category, _ = FormCategory.objects.get_or_create(
        code='INTERNAL',
        defaults={
            'name': 'Internal Submissions',
            'psc_forms_summary': 'OPSC internal submissions routed directly to the Secretary.',
            'display_order': 99,
        },
    )

    for code, name in INTERNAL_TYPES:
        PSCFormType.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'form_category': category,
                'is_digitized': False,
            },
        )


def unseed_internal_types(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    codes = [c for c, _ in INTERNAL_TYPES]
    PSCFormType.objects.filter(code__in=codes).delete()
    FormCategory.objects.filter(name='Internal Submissions').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0045_submission_is_internal'),
    ]

    operations = [
        migrations.RunPython(seed_internal_types, reverse_code=unseed_internal_types),
    ]
