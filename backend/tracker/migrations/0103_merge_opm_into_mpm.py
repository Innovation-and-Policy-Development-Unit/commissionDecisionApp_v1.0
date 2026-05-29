"""
Merge duplicate Ministry of the Prime Minister records (OPM → MPM).

OPSC and its units live under MPM. OPM_* line departments move to MPM; the OPM ministry row is removed.
"""

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


def _repoint_department(apps, old_dept, new_dept):
    Unit = apps.get_model("tracker", "Unit")
    Profile = apps.get_model("tracker", "Profile")
    Submission = apps.get_model("tracker", "Submission")
    Unit.objects.filter(department=old_dept).update(department=new_dept)
    Profile.objects.filter(department=old_dept).update(department=new_dept)
    Submission.objects.filter(department=old_dept).update(department=new_dept)


def forwards(apps, schema_editor):
    Ministry = apps.get_model("tracker", "Ministry")
    Department = apps.get_model("tracker", "Department")
    Unit = apps.get_model("tracker", "Unit")
    Profile = apps.get_model("tracker", "Profile")
    Submission = apps.get_model("tracker", "Submission")

    mpm = (
        Ministry.objects.filter(code__iexact="MPM").first()
        or Ministry.objects.filter(name__icontains="Prime Minister").first()
    )
    if not mpm:
        return

    opm = Ministry.objects.filter(code__iexact="OPM").exclude(pk=mpm.pk).first()
    if opm:
        for dept in list(Department.objects.filter(ministry=opm)):
            conflict = Department.objects.filter(ministry=mpm, code=dept.code).first()
            if conflict:
                _repoint_department(apps, dept, conflict)
                dept.delete()
            else:
                dept.ministry = mpm
                dept.save(update_fields=["ministry"])

        Profile.objects.filter(ministry=opm).update(ministry=mpm)
        Submission.objects.filter(ministry=opm).update(ministry=mpm)
        if not Department.objects.filter(ministry=opm).exists():
            opm.delete()

    opsc, _ = Department.objects.update_or_create(
        ministry=mpm,
        code="OPSC",
        defaults={"name": OPSC_DEPARTMENT_NAME},
    )
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
        ("tracker", "0102_opsc_department_display_name"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
