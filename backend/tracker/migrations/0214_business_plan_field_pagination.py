"""
PSC 2-5 (Ministry Business Plan)'s 38 digitized fields only had ONE
start_new_page break (at 'sec_issue', order 700) — so MultiPageFormRenderer
(frontend/src/components/shared/MultiPageFormRenderer.jsx, which pages a
digitized form at any section_header with start_new_page=True) collapsed
Organization Details through Procurement Plan (orders 100-640) into one
giant unpaged screen instead of the intended step-by-step wizard. The
renderer itself is fine — the seed data just never set the flag on most
section headers. Marks the remaining top-level section headers as page
breaks so it renders as a proper 7-step wizard, matching the quality of the
dedicated PSCForm21Fields/PSCForm22Fields wizards without building a new
one-off component.

Steps after this: Organization Details (+ Planning Period), Executive
Summary, M&E Framework, HR Operational Plan, Cash Flow Projection,
Procurement Plan, Issue/Discussion/Recommendation (already paged).
"""
from django.db import migrations

FORM_TYPE_CODE = 'BUSINESS-PLAN'
NEW_PAGE_BREAK_KEYS = [
    'sec_executive',
    'sec_me_framework',
    'sec_hr_plan',
    'sec_cashflow',
    'sec_procurement',
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
        ('tracker', '0213_business_plan_reminder_schedule'),
    ]

    operations = [
        migrations.RunPython(apply_pagination, revert),
    ]
