"""Add IPDU (Innovation and Policy Development Unit) under OPSC Corporate and Secretariat."""

from django.db import migrations


def seed_ipdu(apps, schema_editor):
    Ministry = apps.get_model("tracker", "Ministry")
    Department = apps.get_model("tracker", "Department")
    Unit = apps.get_model("tracker", "Unit")

    opsc = Ministry.objects.filter(code__iexact="OPSC").first()
    if not opsc:
        return

    corp = Department.objects.filter(ministry=opsc, code="OPSC_CORP").first()
    if not corp:
        corp, _ = Department.objects.get_or_create(
            ministry=opsc,
            code="OPSC_CORP",
            defaults={"name": "Corporate and Secretariat"},
        )

    Unit.objects.update_or_create(
        department=corp,
        code="IPDU",
        defaults={
            "name": "Innovation and Policy Development Unit",
            "routed_unit": "",
        },
    )


def unseed_ipdu(apps, schema_editor):
    Unit = apps.get_model("tracker", "Unit")
    Unit.objects.filter(code="IPDU", department__code="OPSC_CORP").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0098_unit_model"),
    ]

    operations = [
        migrations.RunPython(seed_ipdu, unseed_ipdu),
    ]
