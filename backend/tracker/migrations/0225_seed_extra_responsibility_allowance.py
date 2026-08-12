"""
Extra Responsibility Allowance (PSC ERA Form) didn't exist as a submission
type at all — unlike Special Skills Allowance (which existed but was
misrouted/mis-checklisted), this is a genuinely new form type. Creates it
following the same pattern as the other ODU allowance/submission types:
own PSCFormType, dedicated AgendaSection (kept separate from the generic
"extra_responsibility" bucket shared with PSC 4-1 Overtime Claim, for the
same reason Special Skills Allowance got its own section in
0223_special_skills_routing_and_agenda.py), routed to ODU, and a
required-documents checklist with no digitized form — confirmed 2026-08-10
that these allowance-request submissions are attachment-only, no wizard.
"""
from django.db import migrations

FORM_TYPE_CODE = 'EXTRA-RESPONSIBILITY'
AGENDA_SECTION_CODE = 'extra_responsibility_allowance'
AGENDA_SECTION_LABEL = 'Extra Responsibility Allowance'

REQUIRED_DOCUMENTS = [
    {"name": "Letter from Director or DG request to undertake the Task", "order": 10},
    {"name": "JD for Substantive Position and/or JD for other Position", "order": 20},
    {"name": "List of Tasks", "order": 30},
    {"name": "Impact Report of Task undertaken", "order": 40},
    {"name": "PSC ERA Form", "order": 50},
]


def apply(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    AgendaSection = apps.get_model('tracker', 'AgendaSection')

    od_category, _ = FormCategory.objects.get_or_create(
        code='organisational_development',
        defaults={'name': 'Organisational Development (ODU)'},
    )

    form_type, _ = PSCFormType.objects.get_or_create(
        code=FORM_TYPE_CODE,
        defaults={
            'name': 'Extra Responsibility Allowance',
            'description': 'PSC ERA: Request for Approval of Extra Responsibility Allowance',
            'form_category': od_category,
            'is_digitized': False,
            'is_active': True,
            'is_checklist': False,
        },
    )
    form_type.routed_unit = 'odu'
    form_type.agenda_category = AGENDA_SECTION_CODE
    form_type.save(update_fields=['routed_unit', 'agenda_category'])

    for item in REQUIRED_DOCUMENTS:
        RequiredDocument.objects.get_or_create(
            form_type=form_type, name=item["name"],
            defaults={"order": item["order"], "is_active": True, "item_type": "document"},
        )

    AgendaSection.objects.update_or_create(
        code=AGENDA_SECTION_CODE,
        defaults={
            'label': AGENDA_SECTION_LABEL,
            'display_order': 68,
            'is_special': False,
            'is_active': True,
            'receiver_roles': ['odu_manager'],
        },
    )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    AgendaSection = apps.get_model('tracker', 'AgendaSection')

    AgendaSection.objects.filter(code=AGENDA_SECTION_CODE).delete()
    PSCFormType.objects.filter(code=FORM_TYPE_CODE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0224_special_skills_required_documents'),
    ]

    operations = [
        migrations.RunPython(apply, revert),
    ]
