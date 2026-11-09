"""ODU's consolidated papers for ministry Business Plans, Corporate Plans and Annual Reports.

Ministries send their plan or report to ODU, ODU reviews it and notes it (the ministry's
submission ends there). ODU then writes ONE paper per type for the Commission, covering every
plan or report it has noted, using ODU's general submission template (subject, issue,
discussion, recommendation) and one open required attachment (ODU's assessment report or
any supporting document). The Commission notes it and may decide on particular ministries.

The three ministry types also move to document-upload mode: HR sends the Director General's
signed cover letter and the plan or report, with no digitized form to complete first.
"""
from django.db import migrations

CONSOLIDATED = [
    # (code, name, covers, agenda section, display order)
    ("ODU-BUSINESS-PLANS", "Business Plans: ODU Submission to the Commission", "business_plan", 39),
    ("ODU-CORPORATE-PLANS", "Corporate Plans: ODU Submission to the Commission", "corporate_plan", 40),
    ("ODU-ANNUAL-REPORTS", "Annual Reports: ODU Submission to the Commission", "annual_report", 41),
]
ATTACHMENT = "Attachment (ODU assessment report or other supporting document)"
ATTACHMENT_DESC = ("ODU's assessment report, or any other document that supports this submission. "
                   "At least one file is required.")
MINISTRY_TYPES = ["ANNUAL-REPORT", "BUSINESS-PLAN", "CORPORATE-PLAN"]

FIELDS = [
    ("sec_paper", "Submission Paper", "section_header", "", False, 10),
    ("subject", "Subject", "text", "e.g. Ministry Business Plans 2027: ODU assessment", True, 20),
    ("issue", "Issue", "textarea", "What the Commission is asked to note, and why it matters", True, 30),
    ("discussion", "Discussion", "textarea",
     "How the plans were assessed, the overall results, and the ministries or departments of concern", True, 40),
    ("recommendation", "Recommendation", "textarea",
     "It is recommended that the Public Service Commission note ...", True, 50),
]


def forwards(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormField = apps.get_model("tracker", "PSCFormField")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    FormCategory = apps.get_model("tracker", "FormCategory")

    sibling = PSCFormType.objects.filter(code="BUSINESS-PLAN").first()
    category = (sibling.form_category if sibling else None) or FormCategory.objects.filter(code="other").first()

    for code, name, agenda, order in CONSOLIDATED:
        ft, _ = PSCFormType.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "description": "ODU's one paper to the Commission covering every ministry submission it has noted.",
                "form_category": category,
                "is_active": True, "is_digitized": True, "routed_unit": "odu",
                "agenda_category": agenda, "display_order": order,
            },
        )
        RequiredDocument.objects.get_or_create(
            form_type=ft, name=ATTACHMENT,
            defaults={"description": ATTACHMENT_DESC, "item_type": "document", "order": 10, "is_active": True},
        )
        for key, label, ftype, placeholder, required, forder in FIELDS:
            PSCFormField.objects.get_or_create(
                form_type=ft, field_key=key,
                defaults={"label": label, "field_type": ftype, "placeholder": placeholder,
                          "is_required": required, "display_order": forder},
            )

    # Ministries send documents only: no digitized form to complete first.
    PSCFormType.objects.filter(code__in=MINISTRY_TYPES).update(is_digitized=False)


def backwards(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    # Consolidated types stay (papers may exist); hide them. Ministry types go back to digitized.
    PSCFormType.objects.filter(code__in=[c[0] for c in CONSOLIDATED]).update(is_active=False)
    PSCFormType.objects.filter(code__in=MINISTRY_TYPES).update(is_digitized=True)


class Migration(migrations.Migration):
    dependencies = [("tracker", "0307_submission_consolidated_into")]
    operations = [migrations.RunPython(forwards, backwards)]
