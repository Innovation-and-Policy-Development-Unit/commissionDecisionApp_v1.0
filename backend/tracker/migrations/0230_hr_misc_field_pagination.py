"""
SECONDMENT, LEAVE-PAYOUT, and MEDICAL-CLAIM's digitized fields have no
start_new_page breaks, same root cause as 0226-0229. Marks the existing
top-level section headers as page breaks so each renders as a proper
multi-step wizard instead of one long scrolling page.
"""
from django.db import migrations

# form_type_code -> section_header field_keys to mark as page breaks
# (everything after the first section, which stays page 1)
NEW_PAGE_BREAKS = {
    'SECONDMENT': [
        'sec_officer', 'sec_employment_history', 'sec_secondment_details',
        'sec_issue', 'sec_discussion', 'sec_recommendation',
    ],
    'LEAVE-PAYOUT': [
        'sec_officer', 'sec_leave_details',
    ],
    'MEDICAL-CLAIM': [
        'sec_claim',
    ],
}


def apply_pagination(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    for code, keys in NEW_PAGE_BREAKS.items():
        form_type = PSCFormType.objects.filter(code=code).first()
        if not form_type:
            continue
        PSCFormField.objects.filter(
            form_type=form_type, field_key__in=keys,
        ).update(start_new_page=True)


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    for code, keys in NEW_PAGE_BREAKS.items():
        form_type = PSCFormType.objects.filter(code=code).first()
        if not form_type:
            continue
        PSCFormField.objects.filter(
            form_type=form_type, field_key__in=keys,
        ).update(start_new_page=False)


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0229_cessation_field_pagination'),
    ]

    operations = [
        migrations.RunPython(apply_pagination, revert),
    ]
