"""
PSC 2-8 (Request for Approval of Special Skills Allowance) has the same
reachability gap as the other ODU submission types: no routed_unit and no
agenda_category. It also currently shares its agenda bucket
("7. Extra Responsibility / Overtime Allowance / Special Skills Allowance")
with a sibling form, PSC 4-1 (Overtime and Unsocial Hours Claim), which is
NOT confirmed to route to ODU. Rather than route the whole shared bucket to
ODU (which would misroute PSC 4-1), gives Special Skills Allowance its own
dedicated AgendaSection, same pattern as restructure/JD/BP/CP/AR — the
shared "extra_responsibility" bucket and PSC 4-1 are untouched.

No digitized_form link: SPECIAL-SKILLS has zero PSCFormField rows (it's
checklist-only today), so linking it would show a "linked digitized form
will open" hint on the lodge page for a form that renders nothing.
"""
from django.db import migrations

AGENDA_SECTION_CODE = 'special_skills_allowance'
AGENDA_SECTION_LABEL = 'Request for Approval of Special Skills Allowance'
FORM_TYPE_CODE = 'SPECIAL-SKILLS'


def apply(apps, schema_editor):
    AgendaSection = apps.get_model('tracker', 'AgendaSection')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    AgendaSection.objects.update_or_create(
        code=AGENDA_SECTION_CODE,
        defaults={
            'label': AGENDA_SECTION_LABEL,
            'display_order': 67,
            'is_special': False,
            'is_active': True,
            'receiver_roles': ['odu_manager'],
        },
    )

    PSCFormType.objects.filter(code=FORM_TYPE_CODE).update(
        agenda_category=AGENDA_SECTION_CODE, routed_unit='odu',
    )


def revert(apps, schema_editor):
    AgendaSection = apps.get_model('tracker', 'AgendaSection')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    AgendaSection.objects.filter(code=AGENDA_SECTION_CODE).delete()

    PSCFormType.objects.filter(code=FORM_TYPE_CODE).update(
        agenda_category='', routed_unit='',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0222_annual_report_field_pagination'),
    ]

    operations = [
        migrations.RunPython(apply, revert),
    ]
