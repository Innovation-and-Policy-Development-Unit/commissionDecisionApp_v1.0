"""
PSC 2-5 (Ministry Business Plan) required-documents checklist didn't match
the real checklist — it had 5 generic items invented at seed time (Signed
business plan document, NSDP alignment memo, Strategic objectives summary,
Budget allocation proposal, Staffing and capacity plan). The real checklist
is 3 items:
  - Signed Ministry Business Plan Document (due 28 February each year)
  - Copy of Signed Ministry Corporate Plan
  - Checklist as Per BP Guideline

"Copy of Signed Ministry Corporate Plan" is wired via RequiredDocument.required_form
to CORPORATE-PLAN (PSC 2-6) — same mechanism as PSC 2-2's attach-to-PSC-2-1
(0176_seed_psc_2_2_attachment_pilot.py): satisfied by attaching a Corporate
Plan submission (is_attachment=True + parent_submission) rather than a plain
upload, so it's a real link to an actual Corporate Plan submission instead of
an unverifiable file.
"""
from django.db import migrations

OLD_ITEM_NAMES = [
    "Signed business plan document",
    "NSDP alignment memo",
    "Strategic objectives summary",
    "Budget allocation proposal",
    "Staffing and capacity plan",
]


def apply_checklist(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='BUSINESS-PLAN').first()
    if not form_type:
        return
    corporate_plan = PSCFormType.objects.filter(code='CORPORATE-PLAN').first()

    RequiredDocument.objects.filter(
        form_type=form_type, name__in=OLD_ITEM_NAMES,
    ).update(is_active=False)

    RequiredDocument.objects.get_or_create(
        form_type=form_type, name="Signed Ministry Business Plan Document",
        defaults={
            'description': (
                "The ministry's signed Business Plan document, due 28 February each "
                "year (reminder notifications go out in January and February)."
            ),
            'order': 10,
            'is_active': True,
            'item_type': 'document',
        },
    )
    RequiredDocument.objects.get_or_create(
        form_type=form_type, name="Copy of Signed Ministry Corporate Plan",
        defaults={
            'description': (
                "Confirms this year's Business Plan aligns with the ministry's Corporate "
                "Plan — attach the Corporate Plan submission on file."
            ),
            'order': 20,
            'is_active': True,
            'item_type': 'document',
            'required_form': corporate_plan,
        },
    )
    RequiredDocument.objects.get_or_create(
        form_type=form_type, name="Checklist as Per BP Guideline",
        defaults={
            'description': "Completed Business Plan checklist, per the ODU Business Plan Guideline.",
            'order': 30,
            'is_active': True,
            'item_type': 'document',
        },
    )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='BUSINESS-PLAN').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name__in=OLD_ITEM_NAMES,
    ).update(is_active=True)
    RequiredDocument.objects.filter(
        form_type=form_type,
        name__in=[
            "Signed Ministry Business Plan Document",
            "Copy of Signed Ministry Corporate Plan",
            "Checklist as Per BP Guideline",
        ],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0211_business_plan_routing_and_agenda'),
    ]

    operations = [
        migrations.RunPython(apply_checklist, revert),
    ]
