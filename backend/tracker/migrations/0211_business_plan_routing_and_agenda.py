"""
PSC 2-5 (Ministry Business Plan) had no routed_unit and no agenda_category —
0159_seed_odu_submissions_business_corporate_annual.py created the form type
but never set either. Same failure mode fixed for PSC 2-2 in
0207_psc_2_2_routed_unit_odu.py and 0209_add_job_description_agenda_section.py:
without routed_unit, a submitted Business Plan would never auto-route to ODU
for checklist review; without agenda_category, it's completely unreachable
from the ministry's "Submission type" dropdown (a blank agenda_category
matches no AgendaSection, unlike PSC 2-2's old problem of merely being
buried under "Other Matters").

Creates a dedicated AgendaSection so it's discoverable, and sets both fields
on the PSCFormType.
"""
from django.db import migrations

AGENDA_SECTION_CODE = 'business_plan'
AGENDA_SECTION_LABEL = 'Ministry Business Plan Submission'
FORM_TYPE_CODE = 'BUSINESS-PLAN'


def apply(apps, schema_editor):
    AgendaSection = apps.get_model('tracker', 'AgendaSection')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()

    AgendaSection.objects.update_or_create(
        code=AGENDA_SECTION_CODE,
        defaults={
            'label': AGENDA_SECTION_LABEL,
            'display_order': 63,
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
        ('tracker', '0210_psc_2_2_dg_signed_letter'),
    ]

    operations = [
        migrations.RunPython(apply, revert),
    ]
