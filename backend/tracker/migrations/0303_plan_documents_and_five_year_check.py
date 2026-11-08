"""Business Plan and Corporate Plan: the same two required documents as the Annual Report.

HR sends the Director General's signed cover letter and a copy of the plan. The old extras
(the Business Plan's linked Corporate Plan and its guideline checklist) are switched off, and
the Corporate Plan review checklist gains an item the system fills in from the plan's own
period: a Corporate Plan must cover five years.
"""
from django.db import migrations

COVER = "Signed Cover Letter by Director General"

PLANS = {
    "BUSINESS-PLAN": {
        "old": "Signed Ministry Business Plan Document",
        "new": "Business Plan (copy)",
        "drop": ["Copy of Signed Ministry Corporate Plan", "Checklist as Per BP Guideline"],
        "plan_text": "The Department Business Plan, due 28 February each year. OPSC reviews it against the Business Plan Guideline.",
        "cover_text": "Cover letter signed by the Director General, sending the Business Plan to the Commission.",
    },
    "CORPORATE-PLAN": {
        "old": "Signed Ministry Corporate Plan Document",
        "new": "Corporate Plan (copy)",
        "drop": [],
        "plan_text": "The Ministry Corporate Plan, covering five years. OPSC reviews it against the Corporate Plan Guideline.",
        "cover_text": "Cover letter signed by the Director General, sending the Corporate Plan to the Commission.",
    },
}


def apply(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    PSCFormField = apps.get_model("tracker", "PSCFormField")

    for code, cfg in PLANS.items():
        ft = PSCFormType.objects.filter(code=code).first()
        if not ft:
            continue
        if cfg["drop"]:
            RequiredDocument.objects.filter(form_type=ft, name__in=cfg["drop"]).update(is_active=False)
        plan = RequiredDocument.objects.filter(form_type=ft, name=cfg["old"]).first()
        if plan:
            plan.name, plan.description, plan.order, plan.is_active = cfg["new"], cfg["plan_text"], 20, True
            plan.save()
        else:
            RequiredDocument.objects.get_or_create(
                form_type=ft, name=cfg["new"],
                defaults={"description": cfg["plan_text"], "order": 20, "is_active": True, "item_type": "document"},
            )
        RequiredDocument.objects.get_or_create(
            form_type=ft, name=COVER,
            defaults={"description": cfg["cover_text"], "order": 10, "is_active": True, "item_type": "document"},
        )

    cl = PSCFormType.objects.filter(code="CORPORATE-PLAN-CHECKLIST").first()
    if cl:
        anchor = PSCFormField.objects.filter(form_type=cl, field_key="plan_duration_check").first()
        PSCFormField.objects.get_or_create(
            form_type=cl, field_key="plan_five_year_check",
            defaults={
                "label": "Plan covers five years", "field_type": "checkbox",
                "display_order": (anchor.display_order if anchor else 0),
                "help_text": "Set by the system from the plan period found in the document. Check it yourself.",
            },
        )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    PSCFormField = apps.get_model("tracker", "PSCFormField")
    for code, cfg in PLANS.items():
        ft = PSCFormType.objects.filter(code=code).first()
        if not ft:
            continue
        if cfg["drop"]:
            RequiredDocument.objects.filter(form_type=ft, name__in=cfg["drop"]).update(is_active=True)
        RequiredDocument.objects.filter(form_type=ft, name=COVER).update(is_active=False)
        RequiredDocument.objects.filter(form_type=ft, name=cfg["new"]).update(name=cfg["old"])
    PSCFormField.objects.filter(
        form_type__code="CORPORATE-PLAN-CHECKLIST", field_key="plan_five_year_check",
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("tracker", "0302_submission_chat_and_review_questions")]
    operations = [migrations.RunPython(apply, revert)]
