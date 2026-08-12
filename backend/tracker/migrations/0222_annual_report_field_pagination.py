"""
PSC 2-7 (Ministry Annual Report)'s 53 digitized fields had NO start_new_page
breaks at all — worse than Business Plan/Corporate Plan's bug (they at
least had one). The whole 20-section form rendered as a single giant page.
Marks each of the 20 numbered section headers as a page break so it renders
as a proper step-by-step wizard via MultiPageFormRenderer, one step per
numbered section (Minister's Statement is the implicit first page; the
other 19 get explicit breaks here).
"""
from django.db import migrations

FORM_TYPE_CODE = 'ANNUAL-REPORT'
NEW_PAGE_BREAK_KEYS = [
    'sec_dg_statement',
    'sec_structure',
    'sec_overview',
    'sec_corporate_plan_perf',
    'sec_adr_targets',
    'sec_budget_narrative',
    'sec_policy',
    'sec_legislation',
    'sec_conventions',
    'sec_hr',
    'sec_risks',
    'sec_dev_projects',
    'sec_authorities',
    'sec_auditor_general',
    'sec_ombudsman',
    'sec_rti',
    'sec_court_decisions',
    'sec_complaints',
    'sec_financial',
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
        ('tracker', '0221_annual_report_reminder_schedule'),
    ]

    operations = [
        migrations.RunPython(apply_pagination, revert),
    ]
