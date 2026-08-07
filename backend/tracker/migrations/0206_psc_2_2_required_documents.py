"""
PSC Form 2-2 (Job Description Form) required-documents checklist didn't match
the official checklist for this submission type — it only had a single
"Signed Letter from Director-General" item (added for a standalone-submission
edge case). The real checklist for a Job Description submission (used to
request Upgrade, Downgrade, or Removal of Positions) is:
  - Request Letter
  - Justifications
  - Copy of Signed Structure

"Request Letter" supersedes the old DG-letter item (same document — the
ministry's signed cover letter requesting the JD action), so the old item is
deactivated rather than kept alongside the new three.
"""
from django.db import migrations

OLD_ITEM_NAME = "Signed Letter from Director-General"

NEW_ITEMS = [
    {
        "name": "Request Letter",
        "description": (
            "The ministry's signed letter requesting the Job Description action "
            "(Upgrade, Downgrade, or Removal of Positions)."
        ),
        "order": 10,
    },
    {
        "name": "Justifications",
        "description": "Written justification for the requested Job Description action.",
        "order": 20,
    },
    {
        "name": "Copy of Signed Structure",
        "description": "A copy of the ministry/department's current signed organisation structure.",
        "order": 30,
    },
]


def apply_checklist(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='PSC 2-2').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name=OLD_ITEM_NAME,
    ).update(is_active=False)

    for item in NEW_ITEMS:
        RequiredDocument.objects.get_or_create(
            form_type=form_type, name=item["name"],
            defaults={
                "description": item["description"],
                "order": item["order"],
                "is_active": True,
                "item_type": "document",
            },
        )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='PSC 2-2').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name=OLD_ITEM_NAME,
    ).update(is_active=True)

    RequiredDocument.objects.filter(
        form_type=form_type, name__in=[item["name"] for item in NEW_ITEMS],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0205_psc_2_1_2_2_is_digitized'),
    ]

    operations = [
        migrations.RunPython(apply_checklist, revert),
    ]
