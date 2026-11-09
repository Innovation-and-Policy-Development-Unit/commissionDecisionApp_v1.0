"""ODU's Organisation Performance Assessment Feedback Report.

An OPSC-internal paper authored by ODU (Senior, Principal or Manager), walked up the ladder to
the Secretary and then the Commission. One paper covers all ministries and is put to the
Commission to note. ODU uses its general submission template (subject, issue, discussion,
recommendation); the report itself is the paper's one required document.

It sits on the "Other Matters" agenda section for now, like the overseas travel report. A
section of its own can be made in Administration and the form type pointed at it.
"""
from django.db import migrations

CODE = "ODU-OPA-FEEDBACK-REPORT"
DOC = "Organisation Performance Assessment Feedback Report"

FIELDS = [
    ("sec_paper", "Submission Paper", "section_header", "", False, 10),
    ("subject", "Subject", "text",
     "e.g. Organisation Performance Assessment Feedback Report, 2026", True, 20),
    ("issue", "Issue", "textarea",
     "What the Commission is asked to note, and why it matters", True, 30),
    ("discussion", "Discussion", "textarea",
     "How the assessment was done, the overall results and the ministries or departments of concern", True, 40),
    ("recommendation", "Recommendation", "textarea",
     "It is recommended that the Public Service Commission note the report and ...", True, 50),
]


def forwards(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormField = apps.get_model("tracker", "PSCFormField")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    FormCategory = apps.get_model("tracker", "FormCategory")

    category = (
        FormCategory.objects.filter(code="other").first()
        or FormCategory.objects.filter(code="organisational_development").first()
    )
    ft, _ = PSCFormType.objects.get_or_create(
        code=CODE,
        defaults={
            "name": "Organisation Performance Assessment Feedback Report",
            "description": "ODU's report to the Commission on the performance assessment of all ministries, "
                           "for the Commission to note.",
            "form_category": category,
            "is_active": True,
            "is_digitized": True,
            "routed_unit": "odu",
            "agenda_category": "other",
            "display_order": 38,
        },
    )
    RequiredDocument.objects.get_or_create(
        form_type=ft, name=DOC,
        defaults={
            "description": "The Organisation Performance Assessment Feedback Report this submission presents.",
            "item_type": "document", "order": 10, "is_active": True,
        },
    )
    for key, label, ftype, placeholder, required, order in FIELDS:
        PSCFormField.objects.get_or_create(
            form_type=ft, field_key=key,
            defaults={"label": label, "field_type": ftype, "placeholder": placeholder,
                      "is_required": required, "display_order": order},
        )


def backwards(apps, schema_editor):
    # Left in place on rollback: submissions may already use it. Hide it from the dropdown.
    apps.get_model("tracker", "PSCFormType").objects.filter(code=CODE).update(is_active=False)


class Migration(migrations.Migration):
    dependencies = [("tracker", "0304_odu_anomalies")]
    operations = [migrations.RunPython(forwards, backwards)]
