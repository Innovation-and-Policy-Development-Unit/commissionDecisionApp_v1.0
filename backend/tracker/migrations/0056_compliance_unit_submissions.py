"""Compliance unit submission types, digitized forms, and compliance_senior role."""

from django.db import migrations


def seed_forward(apps, schema_editor):
    from tracker.compliance_forms import seed_compliance_form_types

    seed_compliance_form_types(apps)

    RoleDefinition = apps.get_model("tracker", "RoleDefinition")
    RoleDefinition.objects.get_or_create(
        role="compliance_senior",
        defaults={
            "label": "Compliance Senior Officer",
            "description": "Compliance unit senior officer — may create compliance submissions except PSA amendments.",
        },
    )


def seed_reverse(apps, schema_editor):
    from tracker.compliance_forms import COMPLIANCE_FORM_CODES, COMPLIANCE_CATEGORY_CODE

    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormField = apps.get_model("tracker", "PSCFormField")
    FormCategory = apps.get_model("tracker", "FormCategory")
    Submission = apps.get_model("tracker", "Submission")

    codes = list(COMPLIANCE_FORM_CODES)
    if Submission.objects.filter(form_type_code__in=codes).exists():
        return

    for ft in PSCFormType.objects.filter(code__in=codes):
        PSCFormField.objects.filter(form_type=ft).delete()
    PSCFormType.objects.filter(code__in=codes).delete()
    FormCategory.objects.filter(code=COMPLIANCE_CATEGORY_CODE).delete()
    apps.get_model("tracker", "RoleDefinition").objects.filter(role="compliance_senior").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0055_cms_integration"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_reverse),
    ]
