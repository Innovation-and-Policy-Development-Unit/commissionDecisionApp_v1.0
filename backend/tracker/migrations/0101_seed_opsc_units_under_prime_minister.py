"""Ensure OPSC units exist under the Prime Minister ministry (OPM or MPM)."""

from django.db import migrations

OPSC_DEPARTMENT_NAME = "Office of the Public Service Commission"

OPSC_UNIT_SEED = (
    ("IPDU", "Innovation and Policy Development Unit", ""),
    ("ODU", "Organisation Development Unit", "odu"),
    ("VIPAM", "VIPAM Unit", "vipam"),
    ("HR", "HR Unit", "hr"),
    ("COMPLIANCE", "Compliance Unit", "compliance"),
    ("CSU", "Corporate Services Unit", "csu"),
)


def forwards(apps, schema_editor):
    Ministry = apps.get_model("tracker", "Ministry")
    Department = apps.get_model("tracker", "Department")
    Unit = apps.get_model("tracker", "Unit")

    pm = (
        Ministry.objects.filter(code__in=["OPM", "MPM"]).first()
        or Ministry.objects.filter(name__icontains="Prime Minister").first()
    )
    if not pm:
        return

    opsc = (
        Department.objects.filter(ministry=pm, code__iexact="OPSC").first()
        or Department.objects.filter(ministry=pm, code__iexact="OPM_OPSC").first()
    )
    if not opsc:
        return

    if opsc.code.upper() != "OPSC":
        opsc.code = "OPSC"
        opsc.name = OPSC_DEPARTMENT_NAME
        opsc.save(update_fields=["code", "name"])

    for code, name, routed in OPSC_UNIT_SEED:
        Unit.objects.update_or_create(
            department=opsc,
            code=code,
            defaults={"name": name, "routed_unit": routed},
        )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0100_opsc_under_opm_ministry"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
