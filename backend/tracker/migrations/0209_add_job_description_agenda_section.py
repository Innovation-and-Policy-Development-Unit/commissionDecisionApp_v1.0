"""
PSC Form 2-2 (Job Description) had no dedicated agenda section — it sat
under agenda_category='other' ("15. Other Matters"), buried among ~30
unrelated form types (Leave Payout, Housing Allowance, NDA, etc.) with no
label resembling what a ministry actually wants to do ("Submit JD for
Upgrade, Downgrade or Removal of Positions").

Same fix as 0204_add_restructure_agenda_section.py did for ORG-3.1: create
a dedicated AgendaSection linked to PSCFormType(code='PSC 2-2') via
digitized_form, and point PSC 2-2's own agenda_category at it, so it shows
up as its own entry in the ministry's "Submission type" dropdown
(GET /agenda-sections/?active_only=1) instead of being lost in "Other
Matters".

display_order=62 places it right after 'restructure' (61) — the two are
closely related (a JD is often either standalone or attached to a
restructure) — and before 'anomalies' (65).
"""
from django.db import migrations

AGENDA_SECTION_CODE = 'job_description'
AGENDA_SECTION_LABEL = 'Job Description — Upgrade, Downgrade or Removal of Positions'
FORM_TYPE_CODE = 'PSC 2-2'
OLD_FORM_TYPE_AGENDA_CATEGORY = 'other'


def add_job_description_agenda_section(apps, schema_editor):
    AgendaSection = apps.get_model('tracker', 'AgendaSection')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()

    AgendaSection.objects.update_or_create(
        code=AGENDA_SECTION_CODE,
        defaults={
            'label': AGENDA_SECTION_LABEL,
            'display_order': 62,
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
        ('tracker', '0208_add_board_paper_return_to_principal'),
    ]

    operations = [
        migrations.RunPython(add_job_description_agenda_section, revert),
    ]
