"""
PSC 2-6 (Ministry Corporate Plan)'s 46 digitized fields only had ONE
start_new_page break (at 'sec_issue', order 800) — same bug fixed for
Business Plan in 0214_business_plan_field_pagination.py. Marks the
remaining top-level section headers as page breaks so it renders as a
proper step-by-step wizard via MultiPageFormRenderer instead of one
giant page.

Steps after this: Ministry Details (+ Planning Period), Strategic
Framework, Program Structure & Strategic Priorities, Organizational
Structure & Capacity, Financial & Resource Planning, Capacity Building &
Development, Risk Management & Compliance, Issue/Discussion/Recommendation
(already paged).
"""
from django.db import migrations

FORM_TYPE_CODE = 'CORPORATE-PLAN'
NEW_PAGE_BREAK_KEYS = [
    'sec_strategic',
    'sec_programs',
    'sec_org',
    'sec_resources',
    'sec_capacity',
    'sec_risk',
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
        ('tracker', '0216_corporate_plan_required_documents'),
    ]

    operations = [
        migrations.RunPython(apply_pagination, revert),
    ]
