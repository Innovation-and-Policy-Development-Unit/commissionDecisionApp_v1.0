"""
Standalone PSC Form 2-2 (Job Description) submissions require a
Director-General-signed letter, per the confirmed PSC intake workflow ("A
Form 2.2 submitted independently... follows its own full workflow,
including a Director-General signed letter requirement"). 0206 deactivated
the old "Signed Letter from Director-General" item, folding it into the
generic "Request Letter" — but that left no checklist item that specifically
calls for a DG signature, unlike ORG-3.1's distinct "DG Endorsement Letter"
(0203_org_3_1_conditional_dg_letter.py).

Re-adds it as its own active item. No conditional-scoping field is needed
here (unlike ORG-3.1's department/ministry scope): resolve_required_documents()
in submission_checklist.py already returns no required documents at all for
attached submissions (submission.is_attachment=True short-circuits at the
top of that function), so this item — like the rest of PSC 2-2's checklist —
naturally only applies to standalone Job Description submissions.
"""
from django.db import migrations

DG_LETTER_NAME = "DG-Signed Endorsement Letter"
DG_LETTER_DESCRIPTION = (
    "Signed endorsement letter from the Director-General, confirming approval "
    "of this Job Description action — required for standalone submissions "
    "(not needed when the JD is attached to a Form 2.1 restructure)."
)


def apply_dg_letter(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='PSC 2-2').first()
    if not form_type:
        return

    RequiredDocument.objects.get_or_create(
        form_type=form_type, name=DG_LETTER_NAME,
        defaults={
            'description': DG_LETTER_DESCRIPTION,
            'order': 15,
            'is_active': True,
            'item_type': 'document',
        },
    )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='PSC 2-2').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name=DG_LETTER_NAME,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0209_add_job_description_agenda_section'),
    ]

    operations = [
        migrations.RunPython(apply_dg_letter, revert),
    ]
