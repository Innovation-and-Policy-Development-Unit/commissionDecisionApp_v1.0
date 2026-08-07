"""
ORG-3.1 restructure letter requirements depend on scope:
  - Department-level restructure: the official letter must be from the
    Director, AND a separate DG-signed endorsement letter is additionally
    required.
  - Ministry-level restructure: only the DG-signed letter is required.

Adds RequiredDocument.restructure_department_only (mirrors the existing
ministry_only field from 0195_required_document_ministry_only.py) and seeds
a new "DG Endorsement Letter" checklist item scoped to department-level
restructures only — see resolve_required_documents() in
submission_checklist.py for how it's excluded otherwise.

Also deactivates "PSC Restructure Submission Template" now that its content
is filled directly in the app (the PSC 2-1 wizard, reused for ORG-3.1 —
see SubmissionDetail.jsx's isDedicatedForm) instead of uploaded as a file.
"""
from django.db import migrations, models

DG_LETTER_NAME = "DG Endorsement Letter"
DG_LETTER_DESCRIPTION = (
    "Signed endorsement letter from the Director-General, in addition to the "
    "Director's official letter — required for department-level restructures."
)
OLD_TEMPLATE_ITEM_NAME = "PSC Restructure Submission Template"
OFFICIAL_LETTER_NAME = "Official Letter request to restructure"
NEW_OFFICIAL_LETTER_DESCRIPTION = (
    "The ministry's formal letter requesting the restructure/establishment "
    "variation — signed by the Director for department-level restructures, "
    "or the Director-General for ministry-level restructures."
)
OLD_OFFICIAL_LETTER_DESCRIPTION = (
    "The ministry's formal letter requesting the restructure/establishment variation."
)


def apply_conditional_dg_letter(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='ORG-3.1').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name=OLD_TEMPLATE_ITEM_NAME,
    ).update(is_active=False)

    RequiredDocument.objects.filter(
        form_type=form_type, name=OFFICIAL_LETTER_NAME,
    ).update(description=NEW_OFFICIAL_LETTER_DESCRIPTION)

    RequiredDocument.objects.get_or_create(
        form_type=form_type, name=DG_LETTER_NAME,
        defaults={
            'description': DG_LETTER_DESCRIPTION,
            'order': 15,
            'is_active': True,
            'restructure_department_only': True,
        },
    )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='ORG-3.1').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name=OLD_TEMPLATE_ITEM_NAME,
    ).update(is_active=True)

    RequiredDocument.objects.filter(
        form_type=form_type, name=OFFICIAL_LETTER_NAME,
    ).update(description=OLD_OFFICIAL_LETTER_DESCRIPTION)

    RequiredDocument.objects.filter(
        form_type=form_type, name=DG_LETTER_NAME,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0202_workflow_event_rich_remarks'),
    ]

    operations = [
        migrations.AddField(
            model_name='requireddocument',
            name='restructure_department_only',
            field=models.BooleanField(
                default=False,
                help_text="Only required when the submission's Organisation "
                          "Restructure form (ORG-3.1 / PSC 2-1) has restructure_scope "
                          "set to 'department' — see resolve_required_documents().",
            ),
        ),
        migrations.RunPython(apply_conditional_dg_letter, revert),
    ]
