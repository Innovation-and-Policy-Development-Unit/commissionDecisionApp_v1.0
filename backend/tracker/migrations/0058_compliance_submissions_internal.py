"""Mark existing compliance submissions as OPSC-internal."""

from django.db import migrations

from tracker.compliance_forms import COMPLIANCE_FORM_CODES


def forwards(apps, schema_editor):
    from django.db.models import Q

    Submission = apps.get_model("tracker", "Submission")
    FormCategory = apps.get_model("tracker", "FormCategory")

    FormCategory.objects.filter(code="COMPLIANCE").update(
        name="Compliance Submissions (OPSC Internal)",
        psc_forms_summary=(
            "OPSC-internal submissions initiated by the Compliance unit "
            "(disciplinary, PSDB, Ombudsman, PSA amendments). Not ministry submissions."
        ),
    )

    category = FormCategory.objects.filter(code="COMPLIANCE").first()
    filt = Q(form_type_code__in=COMPLIANCE_FORM_CODES)
    if category:
        filt |= Q(form_category=category)
    Submission.objects.filter(filt).update(is_internal=True)


def backwards(apps, schema_editor):
    Submission = apps.get_model("tracker", "Submission")
    Submission.objects.filter(form_type_code__in=COMPLIANCE_FORM_CODES).update(is_internal=False)


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0057_compliance_senior_role_choice"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
