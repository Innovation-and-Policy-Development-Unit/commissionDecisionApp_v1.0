"""
All 6 CESSATION-* digitized forms (Age Retirement, Notice of Age
Retirement, Medical Retirement, Death in Service, Redundancy, Voluntary
Resignation) have no start_new_page breaks, same root cause as
0226-0228 (recruitment types). Marks the existing top-level section headers
as page breaks so each renders as a proper multi-step wizard instead of one
long scrolling page.
"""
from django.db import migrations

# form_type_code -> section_header field_keys to mark as page breaks
# (everything after the first section, "Meeting / Reference", which stays page 1)
NEW_PAGE_BREAKS = {
    'CESSATION-AGE': [
        'sec_officer', 'sec_employment_history', 'sec_issue',
        'sec_discussion', 'sec_recommendation', 'sec_attachments',
    ],
    'CESSATION-NOTICE-AGE': [
        'sec_background', 'sec_officers_list', 'sec_issue',
        'sec_discussion', 'sec_recommendation',
    ],
    'CESSATION-MEDICAL': [
        'sec_officer', 'sec_employment_history', 'sec_issue',
        'sec_discussion', 'sec_recommendation', 'sec_entitlements',
    ],
    'CESSATION-DEATH': [
        'sec_officer', 'sec_background', 'sec_issue', 'sec_entitlements',
        'sec_discussion', 'sec_recommendation',
    ],
    'CESSATION-REDUNDANCY': [
        'sec_background', 'sec_officers_list', 'sec_issue',
        'sec_discussion', 'sec_recommendation',
    ],
    'CESSATION-RESIGNATION': [
        'sec_officer', 'sec_employment_history', 'sec_issue',
        'sec_discussion', 'sec_recommendation',
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
        ('tracker', '0228_recruit_contract_field_pagination'),
    ]

    operations = [
        migrations.RunPython(apply_pagination, revert),
    ]
