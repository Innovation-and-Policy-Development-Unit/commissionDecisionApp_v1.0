"""Use full OPSC department name and uppercase code under the Prime Minister ministry."""

from django.db import migrations

OPSC_DEPARTMENT_NAME = "Office of the Public Service Commission"


def forwards(apps, schema_editor):
    Ministry = apps.get_model("tracker", "Ministry")
    Department = apps.get_model("tracker", "Department")

    pm = (
        Ministry.objects.filter(code__in=["OPM", "MPM"]).first()
        or Ministry.objects.filter(name__icontains="Prime Minister").first()
    )
    if not pm:
        return

    for dept in Department.objects.filter(ministry=pm, code__iexact="OPSC"):
        dept.code = "OPSC"
        if dept.name in ("OPSC", "", "Office of Public Service Commission"):
            dept.name = OPSC_DEPARTMENT_NAME
        dept.save(update_fields=["code", "name"])


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0101_seed_opsc_units_under_prime_minister"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
