from django.db import migrations

# Pilot: PSC Form 2-2 (Job Description) as a proposed, digitally-tracked
# attachment to PSC Form 2-1 (Organization Restructure / Establishment
# Variation). PSC 2-2 requires its own ODU Manager -> Director approval
# chain before it counts as "present" on the PSC 2-1 checklist.
APPROVAL_CHAIN = [
    {"stage": "pending_manager_approval", "roles": ["odu_manager"], "label": "ODU Manager Approval"},
    {"stage": "pending_second_approval", "roles": ["head_of_agency"], "label": "Director Approval"},
]


def seed_forward(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")

    parent = PSCFormType.objects.filter(code="PSC 2-1").first()
    child = PSCFormType.objects.filter(code="PSC 2-2").first()
    if not parent or not child:
        return

    child.approval_chain = APPROVAL_CHAIN
    child.save(update_fields=["approval_chain"])

    RequiredDocument.objects.update_or_create(
        form_type=parent,
        required_form=child,
        defaults={
            "name": "PSC Form 2-2 — Job Description",
            "description": (
                "A completed and approved PSC Form 2-2 (Job Description) is required "
                "for the restructure/establishment variation before checklist review "
                "can be approved."
            ),
            "item_type": "document",
            "mandatory_for_stage": "manager_checklist_review",
            "order": 0,
            "is_active": True,
        },
    )


def seed_backward(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")

    parent = PSCFormType.objects.filter(code="PSC 2-1").first()
    child = PSCFormType.objects.filter(code="PSC 2-2").first()
    if child:
        child.approval_chain = []
        child.save(update_fields=["approval_chain"])
    if parent and child:
        RequiredDocument.objects.filter(form_type=parent, required_form=child).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0175_attachment_form_approval_chain"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_backward),
    ]
