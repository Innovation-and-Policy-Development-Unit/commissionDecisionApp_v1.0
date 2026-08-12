"""
RECRUIT-TEMPORARY (Temporary Appointment)'s 28 digitized fields have no
start_new_page breaks, same root cause as
0226_recruit_direct_field_pagination.py. Marks the existing top-level
section headers as page breaks so it renders as a proper 5-step wizard.

Steps after this: Meeting/Reference, Candidate & Position Details,
Appointment Terms (incl. the Merit Process / Financial Visa / PSC Form 3-7
attachment checks), Discussion, Recommendation.
"""
from django.db import migrations

FORM_TYPE_CODE = 'RECRUIT-TEMPORARY'
NEW_PAGE_BREAK_KEYS = [
    'sec_candidate',
    'sec_appointment',
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
        ('tracker', '0226_recruit_direct_field_pagination'),
    ]

    operations = [
        migrations.RunPython(apply_pagination, revert),
    ]
