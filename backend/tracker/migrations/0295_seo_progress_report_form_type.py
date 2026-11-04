"""SEO Performance Agreement progress report — a submission type of the HR Unit.

HRM brings the quarterly Senior Executive Officer Performance Agreement progress
report to the Commission (sample: "SEOs Q3 2026 Performance Agreement Progress
Report", prepared by HRM, action officer Manager HRM). The catalogue only had the
PSC 10-2(a/b/c) agreement form itself, which is a form a ministry fills in, not a
paper HRM lodges, so there was nothing for HRM to choose.

Adds the type, routed to the HR Unit, in the Performance Management category. It is
created without a form; migration 0296 adds the digitised form. ``get_or_create`` so an admin-made type of the same code is not touched.
"""
from django.db import migrations

CODE = "SEO-PA-REPORT"


def add_type(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    FormCategory = apps.get_model("tracker", "FormCategory")
    category = FormCategory.objects.filter(code="PERFORMANCE").first()
    PSCFormType.objects.get_or_create(
        code=CODE,
        defaults={
            "name": "SEO Performance Agreement Progress Report",
            "description": (
                "Quarterly progress of Senior Executive Officer Performance "
                "Agreements across ministries, for the Commission's direction."
            ),
            "form_category": category,
            "is_active": True,
            "routed_unit": "hr",
            "agenda_category": "other",
            "display_order": 35,
        },
    )


def remove_type(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormType.objects.filter(code=CODE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0294_hold_brief_review_commissioner_days"),
    ]

    operations = [migrations.RunPython(add_type, remove_type)]
