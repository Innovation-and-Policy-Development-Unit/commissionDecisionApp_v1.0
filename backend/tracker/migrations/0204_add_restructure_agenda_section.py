"""
Migration 0117_split_restructure_anomalies.py tried to rename an assumed
pre-existing AgendaSection row (code='structure_amendment') to
code='restructure', but that row was never seeded by 0089 in the first
place — the UPDATE silently matched zero rows. Only the sibling INSERT for
'anomalies' in that same migration actually took effect, which is why
"Anomalies" appears in the ministry's Submission Type dropdown but nothing
restructure-related does.

Net effect: there has never been a way for a ministry to select
"Organisation Restructure" when creating a submission — ORG-3.1 has been
completely uncreatable via the UI, even though its digitized form
(PSCForm21Fields, wired up separately) has been ready to use.

Fixes this by actually creating the 'restructure' AgendaSection and linking
it to PSCFormType(code='ORG-3.1') via digitized_form, so:
  - it appears in GET /agenda-sections/?active_only=1 (frontend dropdown,
    useAgendaSections() in frontend/src/hooks/useAgendaSections.js)
  - apply_agenda_section_defaults() (backend/tracker/agenda_sections.py)
    can resolve form_type_code from it if the submission is lodged with
    only an agenda_category
Also points PSCFormType(code='ORG-3.1').agenda_category at 'restructure'
(it was 'other' since 0050_restructure_submission_data.py) so the
frontend's own GET /form-types/?agenda_category=restructure lookup
(PSCFormTypeViewSet.get_queryset in views.py) auto-selects it too.
"""
from django.db import migrations

AGENDA_SECTION_CODE = 'restructure'
AGENDA_SECTION_LABEL = 'Organisation Restructure / Establishment Variation'
FORM_TYPE_CODE = 'ORG-3.1'
OLD_FORM_TYPE_AGENDA_CATEGORY = 'other'


def add_restructure_agenda_section(apps, schema_editor):
    AgendaSection = apps.get_model('tracker', 'AgendaSection')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()

    AgendaSection.objects.update_or_create(
        code=AGENDA_SECTION_CODE,
        defaults={
            'label': AGENDA_SECTION_LABEL,
            'display_order': 61,
            'is_special': False,
            'is_active': True,
            'receiver_roles': ['odu_manager'],
            'digitized_form': form_type,
        },
    )

    if form_type:
        form_type.agenda_category = AGENDA_SECTION_CODE
        form_type.save(update_fields=['agenda_category'])


def revert(apps, schema_editor):
    AgendaSection = apps.get_model('tracker', 'AgendaSection')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    AgendaSection.objects.filter(code=AGENDA_SECTION_CODE).delete()

    PSCFormType.objects.filter(code=FORM_TYPE_CODE).update(
        agenda_category=OLD_FORM_TYPE_AGENDA_CATEGORY,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0203_org_3_1_conditional_dg_letter'),
    ]

    operations = [
        migrations.RunPython(add_restructure_agenda_section, revert),
    ]
