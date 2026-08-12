"""
PSC 2-6 (Ministry Corporate Plan) required-documents checklist didn't match
the real checklist — 7 generic items invented at seed time (vision/mission
statements, NSDP alignment statement, strategic priorities outline, org
structure overview, budget and resource allocation, capacity building plan).
The real checklist is a single item: Signed Ministry Corporate Plan Document.
"""
from django.db import migrations

OLD_ITEM_NAMES = [
    "Signed corporate plan document",
    "Ministry vision and mission statements",
    "NSDP alignment statement",
    "Strategic priorities outline",
    "Organizational structure overview",
    "Budget and resource allocation",
    "Capacity building plan",
]

NEW_ITEM_NAME = "Signed Ministry Corporate Plan Document"


def apply_checklist(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='CORPORATE-PLAN').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name__in=OLD_ITEM_NAMES,
    ).update(is_active=False)

    RequiredDocument.objects.get_or_create(
        form_type=form_type, name=NEW_ITEM_NAME,
        defaults={
            'description': "The ministry's signed Corporate Plan document.",
            'order': 10,
            'is_active': True,
            'item_type': 'document',
        },
    )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='CORPORATE-PLAN').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name__in=OLD_ITEM_NAMES,
    ).update(is_active=True)
    RequiredDocument.objects.filter(
        form_type=form_type, name=NEW_ITEM_NAME,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0215_corporate_plan_routing_and_agenda'),
    ]

    operations = [
        migrations.RunPython(apply_checklist, revert),
    ]
