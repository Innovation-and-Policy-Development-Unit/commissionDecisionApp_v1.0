"""Annual Report (ministry HR submits, ODU reviews).

Required documents become the two the ministry actually sends: the DG's signed cover
letter and the Annual Report. The guideline checklist is no longer something HR attaches
(the AI review and ODU's own checklist replace it) and the signed Business Plan is no
longer required. The ODU review checklist gains the guideline items it was missing: the
four PFEM financial statements and the leave accrual analysis.
"""
from django.db import migrations

COVER = "Signed Cover Letter by Director General"
REPORT_OLD = "Ministry Annual Report Document"
REPORT = "Annual Report (copy)"
DROPPED = ["Checklist as Per AR Guideline", "Copy of Signed Business Plan for the Report Year"]

NEW_FIELDS = [
    ("fin_representation_check", "Statement of Representation included"),
    ("fin_appropriation_check", "Statement of Appropriation included"),
    ("fin_expense_summary_check", "Expense Summary Report included"),
    ("fin_commitments_check", "Statement of Commitments & Contingencies included"),
    ("leave_accrual_check", "Leave accrual analysis included"),
]


def apply(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    PSCFormField = apps.get_model("tracker", "PSCFormField")

    ft = PSCFormType.objects.filter(code="ANNUAL-REPORT").first()
    if ft:
        RequiredDocument.objects.filter(form_type=ft, name__in=DROPPED).update(is_active=False)
        report = RequiredDocument.objects.filter(form_type=ft, name=REPORT_OLD).first()
        if report:
            report.name = REPORT
            report.description = (
                "The ministry's Annual Report, due 31 March each year (reminders go out in "
                "February and March). OPSC reviews it against the Annual Report Guideline."
            )
            report.order = 20
            report.is_active = True
            report.save()
        else:
            RequiredDocument.objects.get_or_create(
                form_type=ft, name=REPORT,
                defaults={"description": "The ministry's Annual Report, due 31 March each year.",
                          "order": 20, "is_active": True, "item_type": "document"},
            )
        RequiredDocument.objects.get_or_create(
            form_type=ft, name=COVER,
            defaults={
                "description": "Cover letter signed by the Director General, sending the Annual Report to the Commission.",
                "order": 10, "is_active": True, "item_type": "document",
            },
        )

    cl = PSCFormType.objects.filter(code="ANNUAL-REPORT-CHECKLIST").first()
    if cl:
        anchor = PSCFormField.objects.filter(form_type=cl, field_key="financial_note_check").first()
        base = anchor.display_order if anchor else 0
        for key, label in NEW_FIELDS:
            PSCFormField.objects.get_or_create(
                form_type=cl, field_key=key,
                defaults={"label": label, "field_type": "checkbox", "display_order": base,
                          "help_text": "Not captured by a digitized-form field — manual/AI review only."},
            )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    PSCFormField = apps.get_model("tracker", "PSCFormField")
    ft = PSCFormType.objects.filter(code="ANNUAL-REPORT").first()
    if ft:
        RequiredDocument.objects.filter(form_type=ft, name__in=DROPPED).update(is_active=True)
        RequiredDocument.objects.filter(form_type=ft, name=COVER).update(is_active=False)
        RequiredDocument.objects.filter(form_type=ft, name=REPORT).update(name=REPORT_OLD)
    PSCFormField.objects.filter(
        form_type__code="ANNUAL-REPORT-CHECKLIST", field_key__in=[k for k, _ in NEW_FIELDS],
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("tracker", "0300_report_ai_review")]
    operations = [migrations.RunPython(apply, revert)]
