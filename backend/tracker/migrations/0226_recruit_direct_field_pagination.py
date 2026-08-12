"""
RECRUIT-DIRECT (Direct Appointment)'s 28 digitized fields have no
start_new_page breaks at all, so MultiPageFormRenderer collapses the whole
form — Meeting/Reference through Recommendation — into one long unpaged
screen instead of a step-by-step wizard. Same root cause as
0214_business_plan_field_pagination.py: the seed data just never set the
flag on the section headers. Marks the existing top-level section headers
as page breaks so it renders as a proper 5-step wizard.

Steps after this: Meeting/Reference, Position Details, Background (incl.
the PSC 3-6 / Performance Appraisal / Financial Visa attachment checks),
Discussion, Recommendation.
"""
from django.db import migrations

FORM_TYPE_CODE = 'RECRUIT-DIRECT'
NEW_PAGE_BREAK_KEYS = [
    'sec_position',
    'sec_background',
    'sec_discussion',
    'sec_recommendation',
]


def apply_pagination(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()
    if not form_type:
        return

    PSCFormField.objects.filter(
        form_type=form_type, field_key__in=NEW_PAGE_BREAK_KEYS,
    ).update(start_new_page=True)


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()
    if not form_type:
        return

    PSCFormField.objects.filter(
        form_type=form_type, field_key__in=NEW_PAGE_BREAK_KEYS,
    ).update(start_new_page=False)


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0225_seed_extra_responsibility_allowance'),
    ]

    operations = [
        migrations.RunPython(apply_pagination, revert),
    ]
