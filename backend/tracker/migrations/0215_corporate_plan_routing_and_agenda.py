"""
PSC 2-6 (Ministry Corporate Plan) has the same reachability gap Business Plan
had before 0211: no routed_unit and no agenda_category, so it's completely
unreachable from the ministry's "Submission type" dropdown and would never
auto-route to ODU. Corporate Plan is meant to be independently submittable
in its own right (not merely something referenced by a Business Plan) — see
0212_business_plan_required_documents.py's required_form cross-reference,
which depends on Corporate Plan actually being a real, lodgeable submission.

Same fix pattern as 0211/0209/0207: dedicated AgendaSection + routed_unit.
"""
from django.db import migrations

AGENDA_SECTION_CODE = 'corporate_plan'
AGENDA_SECTION_LABEL = 'Ministry Corporate Plan Submission'
FORM_TYPE_CODE = 'CORPORATE-PLAN'


def apply(apps, schema_editor):
    AgendaSection = apps.get_model('tracker', 'AgendaSection')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()

    AgendaSection.objects.update_or_create(
        code=AGENDA_SECTION_CODE,
        defaults={
            'label': AGENDA_SECTION_LABEL,
            'display_order': 64,
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
        ('tracker', '0214_business_plan_field_pagination'),
    ]

    operations = [
        migrations.RunPython(apply, revert),
    ]
