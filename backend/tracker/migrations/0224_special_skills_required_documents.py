"""
PSC 2-8 (Special Skills Allowance) required-documents checklist didn't
match the real checklist — 14 items grouped A-D at seed time. The real
checklist is 12 items, in a different order, with one new item
("Appointment Letter from Director or DG to undertake such tasks") not
previously captured, and four old items dropped (performance appraisal/HR
record, list of key tasks and responsibilities, organizational context
document, PSSM Chapter 4 compliance statement). "Job description or TOR for
special assignment" also splits into two separate items.
"""
from django.db import migrations

OLD_ITEM_NAMES = [
    "A. Original PSC decision approving the assignment",
    "A. Point Matrix assessment form",
    "A. Request letter from ministry/organization",
    "A. Supporting letter from Director General / Head of Organization",
    "B. Officer CV or resume",
    "B. Performance appraisal or HR record",
    "B. Substantive position details",
    "C. Consultant cost comparison",
    "C. Job description or TOR for special assignment",
    "C. List of key tasks and responsibilities",
    "C. Organizational context document",
    "D. Budget capacity letter",
    "D. Confirmation of cost recovery/funding source",
    "D. Financial impact statement",
    "D. PSSM Chapter 4 compliance statement",
]

NEW_ITEMS = [
    {"name": "Request letter from ministry/organization", "order": 10},
    {"name": "Supporting letter from DG/Head of Organization", "order": 20},
    {"name": "Appointment Letter from Director or DG to undertake such tasks", "order": 30},
    {"name": "Point Matrix assessment form", "order": 40},
    {
        "name": "Original PSC decision approving the assignment (Optional)",
        "order": 50,
        "description": "Optional — attach if a prior PSC decision approved this assignment.",
    },
    {"name": "Officer CV or resume", "order": 60},
    {"name": "Substantive position details", "order": 70},
    {"name": "Job description", "order": 80},
    {"name": "TOR for special assignment", "order": 90},
    {"name": "Consultant cost comparison", "order": 100},
    {"name": "Confirmation of cost recovery/funding source", "order": 110},
    {"name": "Financial Impact Statement / Budget Capacity Letter", "order": 120},
]


def apply_checklist(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='SPECIAL-SKILLS').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name__in=OLD_ITEM_NAMES,
    ).update(is_active=False)

    for item in NEW_ITEMS:
        RequiredDocument.objects.get_or_create(
            form_type=form_type, name=item["name"],
            defaults={
                "description": item.get("description", ""),
                "order": item["order"],
                "is_active": True,
                "item_type": "document",
            },
        )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    form_type = PSCFormType.objects.filter(code='SPECIAL-SKILLS').first()
    if not form_type:
        return

    RequiredDocument.objects.filter(
        form_type=form_type, name__in=OLD_ITEM_NAMES,
    ).update(is_active=True)
    RequiredDocument.objects.filter(
        form_type=form_type, name__in=[item["name"] for item in NEW_ITEMS],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0223_special_skills_routing_and_agenda'),
    ]

    operations = [
        migrations.RunPython(apply_checklist, revert),
    ]
