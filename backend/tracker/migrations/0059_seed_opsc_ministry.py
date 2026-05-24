"""Ensure OPSC ministry exists and link internal unit staff profiles."""

from django.db import migrations

OPSC_NAME = "Office of the Public Service Commission"
OPSC_CODE = "OPSC"

INTERNAL_ROLES = (
    "compliance_senior",
    "compliance_principal",
    "compliance_manager",
    "odu_manager",
    "vipam_manager",
    "hr_unit_manager",
    "csu_manager",
)


def forwards(apps, schema_editor):
    Ministry = apps.get_model("tracker", "Ministry")
    Department = apps.get_model("tracker", "Department")
    Profile = apps.get_model("tracker", "Profile")

    ministry, _ = Ministry.objects.update_or_create(
        code=OPSC_CODE,
        defaults={"name": OPSC_NAME},
    )

    Department.objects.update_or_create(
        ministry=ministry,
        code="COMPLIANCE",
        defaults={"name": "Compliance Unit"},
    )

    for role in INTERNAL_ROLES:
        Profile.objects.filter(role=role, ministry__isnull=True).update(ministry=ministry)


def backwards(apps, schema_editor):
    # Keep OPSC ministry; only clear ministry on internal roles if it was OPSC
    Ministry = apps.get_model("tracker", "Ministry")
    Profile = apps.get_model("tracker", "Profile")
    opsc = Ministry.objects.filter(code=OPSC_CODE).first()
    if not opsc:
        return
    Profile.objects.filter(role__in=INTERNAL_ROLES, ministry=opsc).update(ministry=None)


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0058_compliance_submissions_internal"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
