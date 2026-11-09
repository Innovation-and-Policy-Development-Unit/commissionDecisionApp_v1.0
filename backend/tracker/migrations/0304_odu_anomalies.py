"""ODU Anomalies: a salary / establishment anomaly the ministry asks the Commission to correct.

Works like a restructure. The ministry fills a short Submission Paper and attaches its
documents; ODU then writes its own paper for the Commission (the ODU board paper, with the
salary costing table, but no DSSPAC / GRT / Finance analyses). The required documents stay
the ministry's: the Commission paper replaces only the submission paper.

Required documents: the Director General's signed cover letter, the structure or Job
Description of the position, and a Smartstream screenshot (Smartstream is the Ministry of
Finance system that holds salaries). Anything else HR wants to add is uploaded as an
ordinary extra file; there is no optional slot for it.
"""
from django.db import migrations

CODE = "ANOMALIES"

DOCS = [
    ("Signed Cover Letter by Director General",
     "Cover letter signed by the Director General, sending the Anomalies submission to the Commission.", 10),
    ("Structure / Job Description of the Position",
     "The approved structure, or the Job Description, for the position the anomaly concerns.", 20),
    ("Smartstream Screenshot",
     "A screenshot from Smartstream (the Ministry of Finance salary system) showing the officer's "
     "salary details for the anomaly.", 30),
]

FIELDS = [
    ("sec_paper", "Submission Paper", "section_header", "", False, 10),
    ("subject", "Subject", "text", "A short title for the anomaly, e.g. \"Salary step anomaly - Senior Finance Officer\"", True, 20),
    ("officers_positions", "Officer(s) and position(s) affected", "textarea",
     "Names, position titles and current salary scale of everyone concerned", True, 30),
    ("anomaly_description", "What is the anomaly?", "textarea",
     "Describe what is wrong: the salary or structure as it stands against what it should be", True, 40),
    ("issue", "Issue", "textarea", "Statement of the issue for Commission consideration", True, 50),
    ("discussion", "Discussion", "textarea",
     "Background, how the anomaly arose, the cost of correcting it and any other options", True, 60),
    ("recommendation", "Recommendation", "textarea",
     "It is recommended that the Public Service Commission note/approve ...", True, 70),
]


def forwards(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormField = apps.get_model("tracker", "PSCFormField")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    FormCategory = apps.get_model("tracker", "FormCategory")

    # Same category as the other ODU papers; fall back to ODU's, then "other".
    sibling = PSCFormType.objects.filter(code="BUSINESS-PLAN").first()
    category = (
        (sibling.form_category if sibling else None)
        or FormCategory.objects.filter(code="organisational_development").first()
        or FormCategory.objects.filter(code="other").first()
    )
    ft, _ = PSCFormType.objects.get_or_create(
        code=CODE,
        defaults={
            "name": "Anomalies",
            "description": "A salary or establishment anomaly the ministry asks the Commission to correct. "
                           "ODU writes the paper the Commission reads.",
            "form_category": category,
            "is_active": True,
            "is_digitized": True,
            "routed_unit": "odu",
            "agenda_category": "anomalies",
            "display_order": 37,
        },
    )
    for name, desc, order in DOCS:
        RequiredDocument.objects.get_or_create(
            form_type=ft, name=name,
            defaults={"description": desc, "order": order, "is_active": True, "item_type": "document"},
        )
    for key, label, ftype, placeholder, required, order in FIELDS:
        PSCFormField.objects.get_or_create(
            form_type=ft, field_key=key,
            defaults={"label": label, "field_type": ftype, "placeholder": placeholder,
                      "is_required": required, "display_order": order},
        )


def backwards(apps, schema_editor):
    # Left in place on rollback: submissions may already use it. Hide it from the dropdown.
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormType.objects.filter(code=CODE).update(is_active=False)


class Migration(migrations.Migration):
    dependencies = [("tracker", "0303_plan_documents_and_five_year_check")]
    operations = [migrations.RunPython(forwards, backwards)]
