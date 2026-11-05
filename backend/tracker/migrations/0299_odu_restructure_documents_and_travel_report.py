"""ODU feedback: restructure documents, ODU's three analyses, and the overseas travel report.

1. Ministry's restructure request (ORG-3.1 and the legacy PSC 2-1) is asked for exactly:
   the official letter, the signed current structure, the current Job Description, the
   Finance confirmation letter (budget), and the proposed structure. "Other Supporting
   Documents" is retired (deactivated, so history is kept).
2. ODU's own paper for the Commission carries three attached analyses - DSSPAC, GRT and
   Finance. They are required documents that belong to OPSC (``opsc_supplied``): never on
   the ministry's checklist, never visible to it.
3. ODU reports to the Commission on overseas travel (total trips, total cost, ...) as an
   ordinary OPSC-internal submission, with the travel report attached as its required
   document.
"""
from django.db import migrations

RESTRUCTURE_CODES = ["ORG-3.1", "PSC 2-1"]

RENAMES = [
    (
        "Current Organisation Structure (OPSC-stamped)",
        "Current Organisation Structure (signed)",
        "The ministry's current organisation structure, signed.",
    ),
    (
        "Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions, "
        "Downgraded Positions, Supervisor for new positions.) (Affected Positions)",
        "Current Job Description",
        "The current Job Description for the positions concerned.",
    ),
]
FINANCE_LETTER = "Confirmation Letter from Finance (budget)"
FINANCE_LETTER_DESC = "Letter from the ministry's Finance confirming the budget for the restructure."
RETIRED = "Other Supporting Documents"

ANALYSES = [
    ("DSSPAC Analysis", "ODU's DSSPAC analysis of the restructure.", 70),
    ("GRT Analysis", "ODU's GRT analysis of the restructure.", 80),
    ("Finance Analysis", "ODU's Finance analysis of the restructure.", 90),
]

TRAVEL_CODE = "ODU-TRAVEL-REPORT"
TRAVEL_DOC = "Overseas Travel Report"


def forwards(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    FormCategory = apps.get_model("tracker", "FormCategory")

    for code in RESTRUCTURE_CODES:
        ft = PSCFormType.objects.filter(code=code).first()
        if not ft:
            continue
        for old, new, desc in RENAMES:
            RequiredDocument.objects.filter(form_type=ft, name=old).update(name=new, description=desc)
        RequiredDocument.objects.filter(form_type=ft, name=RETIRED).update(is_active=False)
        RequiredDocument.objects.get_or_create(
            form_type=ft, name=FINANCE_LETTER,
            defaults={"description": FINANCE_LETTER_DESC, "order": 55, "is_active": True},
        )

    # One set of ODU analysis slots, on the live restructure form.
    live = PSCFormType.objects.filter(code="ORG-3.1").first()
    if live:
        for name, desc, order in ANALYSES:
            RequiredDocument.objects.get_or_create(
                form_type=live, name=name,
                defaults={"description": desc, "order": order, "is_active": True, "opsc_supplied": True},
            )

    category = FormCategory.objects.filter(code="other").first()
    travel, _ = PSCFormType.objects.get_or_create(
        code=TRAVEL_CODE,
        defaults={
            "name": "Overseas Travel Report",
            "description": "ODU's report to the Commission on overseas travel: total trips, total cost and related totals.",
            "form_category": category,
            "is_active": True,
            "routed_unit": "odu",
            "agenda_category": "other",
            "display_order": 36,
        },
    )
    RequiredDocument.objects.get_or_create(
        form_type=travel, name=TRAVEL_DOC,
        defaults={
            "description": "The overseas travel report this submission presents to the Commission.",
            "item_type": "document", "order": 10, "is_active": True,
        },
    )


def backwards(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")

    RequiredDocument.objects.filter(
        name__in=[a[0] for a in ANALYSES], opsc_supplied=True,
    ).delete()
    for code in RESTRUCTURE_CODES:
        ft = PSCFormType.objects.filter(code=code).first()
        if not ft:
            continue
        for old, new, _desc in RENAMES:
            RequiredDocument.objects.filter(form_type=ft, name=new).update(name=old)
        RequiredDocument.objects.filter(form_type=ft, name=RETIRED).update(is_active=True)
        RequiredDocument.objects.filter(form_type=ft, name=FINANCE_LETTER, checklist_items__isnull=True).delete()
    # The travel report type is left in place on rollback: submissions may already use it.


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0298_odu_paper_analyses_fields"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
