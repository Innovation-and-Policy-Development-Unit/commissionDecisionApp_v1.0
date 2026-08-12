"""
PSC 2-7 (Ministry Annual Report) has the same reachability gap Business Plan
and Corporate Plan had: no routed_unit and no agenda_category, so it's
unreachable from the ministry's "Submission type" dropdown and would never
auto-route to ODU. Same fix pattern as 0211/0215.
"""
from django.db import migrations

AGENDA_SECTION_CODE = 'annual_report'
AGENDA_SECTION_LABEL = 'Ministry Annual Report Submission'
FORM_TYPE_CODE = 'ANNUAL-REPORT'


def apply(apps, schema_editor):
    AgendaSection = apps.get_model('tracker', 'AgendaSection')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()

    AgendaSection.objects.update_or_create(
        code=AGENDA_SECTION_CODE,
        defaults={
            'label': AGENDA_SECTION_LABEL,
            'display_order': 66,
            'is_special': False,
            'is_active': True,
            'receiver_roles': ['odu_manager'],
            'digitized_form': form_type,
        },
    )

    if form_type:
        form_type.agenda_category = AGENDA_SECTION_CODE
        form_type.routed_unit = 'odu'
        form_type.save(update_fields=['agenda_category', 'routed_unit'])


def revert(apps, schema_editor):
    AgendaSection = apps.get_model('tracker', 'AgendaSection')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    AgendaSection.objects.filter(code=AGENDA_SECTION_CODE).delete()

    PSCFormType.objects.filter(code=FORM_TYPE_CODE).update(
        agenda_category='', routed_unit='',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0218_business_plan_ministry_wide_label'),
    ]

    operations = [
        migrations.RunPython(apply, revert),
    ]
