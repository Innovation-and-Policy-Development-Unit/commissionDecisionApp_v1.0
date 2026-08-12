"""
PSC 2-7 (Ministry Annual Report) required-documents checklist didn't match
the real checklist — 8 generic items invented at seed time (executive
summary, performance-against-objectives summary, key achievements list,
challenges summary, budget utilization report, staffing summary, outlook).
The real checklist is 3 items:
  - Ministry Annual Report Document (due 31 March each year)
  - Checklist as Per AR Guideline
  - Copy of Signed Business Plan for the Report Year

"Copy of Signed Business Plan for the Report Year" is wired via
RequiredDocument.required_form to BUSINESS-PLAN — same real-submission
cross-reference mechanism as Business Plan's own link to Corporate Plan
(0212_business_plan_required_documents.py), using the generic
link-as-attachment flow (views.py `link_as_attachment` action,
ChecklistPanel.jsx `AttachRequiredFormButton`) built for that case.
"""
from django.db import migrations

OLD_ITEM_NAMES = [
    "Annual report document",
    "Executive summary",
    "Performance against objectives summary",
    "Key achievements list",
    "Challenges and constraints summary",
    "Budget utilization report",
    "Staffing summary",
    "Outlook and next year focus",
]


def apply_checklist(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='ANNUAL-REPORT').first()
    if not form_type:
        return
    business_plan = PSCFormType.objects.filter(code='BUSINESS-PLAN').first()

    RequiredDocument.objects.filter(
        form_type=form_type, name__in=OLD_ITEM_NAMES,
    ).update(is_active=False)

    RequiredDocument.objects.get_or_create(
        form_type=form_type, name="Ministry Annual Report Document",
        defaults={
            'description': (
                "The ministry's signed Annual Report document, due 31 March each year "
                "(reminder notifications go out in February and March)."
            ),
            'order': 10,
            'is_active': True,
            'item_type': 'document',
        },
    )
    RequiredDocument.objects.get_or_create(
        form_type=form_type, name="Checklist as Per AR Guideline",
        defaults={
            'description': "Completed Annual Report checklist, per the ODU Annual Report Guideline.",
            'order': 20,
            'is_active': True,
            'item_type': 'document',
        },
    )
    RequiredDocument.objects.get_or_create(
        form_type=form_type, name="Copy of Signed Business Plan for the Report Year",
        defaults={
            'description': (
                "Confirms this Annual Report aligns with the ministry's Business Plan for "
                "the same year — attach the Business Plan submission on file."
            ),
            'order': 30,
            'is_active': True,
            'item_type': 'document',
            'required_form': business_plan,
        },
    )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='ANNUAL-REPORT').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name__in=OLD_ITEM_NAMES,
    ).update(is_active=True)
    RequiredDocument.objects.filter(
        form_type=form_type,
        name__in=[
            "Ministry Annual Report Document",
            "Checklist as Per AR Guideline",
            "Copy of Signed Business Plan for the Report Year",
        ],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0219_annual_report_routing_and_agenda'),
    ]

    operations = [
        migrations.RunPython(apply_checklist, revert),
    ]
