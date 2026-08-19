"""Seed IPDU-TASKFORCE / IPDU-ALLOWANCE PSCFormTypes and their required
document checklists.

Both form types use the same bespoke IPDUBoardPaper wizard (see
tracker.ipdu_rules.IPDU_BOARD_PAPER_FORM_CODES) rather than the PSCFormField
dynamic-form system, so is_digitized is left False here — same as how
ORG-3.1/PSC 2-1's Board Paper is a separate bespoke component, not driven by
digitized_form_key.
"""

from django.db import migrations

FORM_TYPES = [
    {
        "code": "IPDU-TASKFORCE",
        "name": "Task Force Submission",
        "description": (
            "IPDU Board Submission Paper establishing or revising a taskforce's "
            "Terms of Reference, governance structure, or membership."
        ),
        "display_order": 995,
        "routed_unit": "ipdu",
        "agenda_category": "other",
    },
    {
        "code": "IPDU-ALLOWANCE",
        "name": "Allowance Payment Submission",
        "description": (
            "IPDU Board Submission Paper requesting Commission approval to pay "
            "taskforce members an allowance per completed TOR deliverable."
        ),
        "display_order": 996,
        "routed_unit": "ipdu",
        "agenda_category": "other",
    },
]

TASKFORCE_DOCS = [
    {
        "order": 10,
        "name": "Draft/Revised Terms of Reference",
        "description": "The taskforce's Terms of Reference — draft (new taskforce) or the previous "
                       "version plus proposed changes (revision).",
    },
    {
        "order": 20,
        "name": "Proposed Taskforce Membership List",
        "description": "Names, positions, and representing agency/ministry for every proposed member.",
    },
    {
        "order": 30,
        "name": "Workplan",
        "description": "The taskforce's activity workplan against its TOR deliverables.",
    },
]

ALLOWANCE_DOCS = [
    {
        "order": 10,
        "name": "Approved Taskforce TOR / Meeting Minutes",
        "description": "Evidence the taskforce and its allowance structure were approved by the "
                       "Commission — the approved TOR or the Commission minute number/decision.",
    },
    {
        "order": 20,
        "name": "Evidence of Deliverable Completion",
        "description": "Documentation showing the deliverable(s) being claimed for were actually "
                       "completed (e.g. the deliverable output itself, a sign-off, a progress report).",
    },
]


def seed_forward(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    FormCategory = apps.get_model("tracker", "FormCategory")

    other_category = FormCategory.objects.filter(code="other").first()

    created = {}
    for data in FORM_TYPES:
        ft, _ = PSCFormType.objects.update_or_create(
            code=data["code"],
            defaults={
                "name": data["name"],
                "description": data["description"],
                "display_order": data["display_order"],
                "routed_unit": data["routed_unit"],
                "agenda_category": data["agenda_category"],
                "form_category": other_category,
                "is_active": True,
            },
        )
        created[data["code"]] = ft

    for doc in TASKFORCE_DOCS:
        RequiredDocument.objects.get_or_create(
            form_type=created["IPDU-TASKFORCE"],
            name=doc["name"],
            defaults={
                "description": doc["description"],
                "order": doc["order"],
                "is_active": True,
            },
        )
    for doc in ALLOWANCE_DOCS:
        RequiredDocument.objects.get_or_create(
            form_type=created["IPDU-ALLOWANCE"],
            name=doc["name"],
            defaults={
                "description": doc["description"],
                "order": doc["order"],
                "is_active": True,
            },
        )


def seed_backward(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")

    codes = [d["code"] for d in FORM_TYPES]
    RequiredDocument.objects.filter(form_type__code__in=codes).delete()
    PSCFormType.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0240_add_ipdu_manager_role_and_board_paper"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_backward),
    ]
