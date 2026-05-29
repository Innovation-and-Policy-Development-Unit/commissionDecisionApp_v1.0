"""
Restructure org chart: OPSC is a department under Ministry of the Prime Minister (OPM);
IPDU, ODU, VIPAM, HR, Compliance, and CSU are units under that department.
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

LEGACY_DEPT_TO_UNIT = {
    "OPSC_ODU": "ODU",
    "OPSC_VIPAM": "VIPAM",
    "OPSC_HR": "HR",
    "OPSC_COMPLIANCE": "COMPLIANCE",
    "OPSC_CSU": "CSU",
}


def forwards(apps, schema_editor):
    Ministry = apps.get_model("tracker", "Ministry")
    Department = apps.get_model("tracker", "Department")
    Unit = apps.get_model("tracker", "Unit")
    Profile = apps.get_model("tracker", "Profile")
    Submission = apps.get_model("tracker", "Submission")

    opm = Ministry.objects.filter(code__iexact="OPM").first()
    if not opm:
        opm = Ministry.objects.create(
            code="OPM",
            name="Ministry of Prime Minister",
        )

    opsc_dept = (
        Department.objects.filter(ministry=opm, code__iexact="OPM_OPSC").first()
        or Department.objects.filter(ministry=opm, code__iexact="OPSC").first()
    )
    if not opsc_dept:
        opsc_dept = Department.objects.create(
            ministry=opm,
            code="OPSC",
            name=OPSC_DEPARTMENT_NAME,
        )
    else:
        opsc_dept.code = "OPSC"
        opsc_dept.name = OPSC_DEPARTMENT_NAME
        opsc_dept.save(update_fields=["code", "name"])

    for code, name, routed in OPSC_UNIT_SEED:
        Unit.objects.update_or_create(
            department=opsc_dept,
            code=code,
            defaults={"name": name, "routed_unit": routed},
        )

    units_by_code = {u.code.upper(): u for u in Unit.objects.filter(department=opsc_dept)}

    # Move units that were under the old OPSC ministry / OPSC_CORP department
    opsc_ministry = Ministry.objects.filter(code__iexact="OPSC").first()
    if opsc_ministry:
        for old_dept in Department.objects.filter(ministry=opsc_ministry):
            for unit in Unit.objects.filter(department=old_dept):
                if unit.code.upper() not in units_by_code:
                    unit.department = opsc_dept
                    unit.save(update_fields=["department"])
                    units_by_code[unit.code.upper()] = unit
                else:
                    unit.delete()

        for legacy_code, unit_code in LEGACY_DEPT_TO_UNIT.items():
            legacy = Department.objects.filter(
                ministry=opsc_ministry, code=legacy_code,
            ).first()
            if not legacy:
                continue
            target = units_by_code.get(unit_code.upper())
            if not target:
                continue
            Profile.objects.filter(department=legacy).update(
                ministry=opm,
                department=opsc_dept,
                unit=target,
            )
            Submission.objects.filter(department=legacy).update(
                ministry=opm,
                department=opsc_dept,
                unit=target,
            )

        Profile.objects.filter(ministry=opsc_ministry).update(
            ministry=opm,
            department=opsc_dept,
        )
        Submission.objects.filter(ministry=opsc_ministry).update(
            ministry=opm,
            department=opsc_dept,
        )

        Department.objects.filter(ministry=opsc_ministry).exclude(pk=opsc_dept.pk).delete()
        if not Profile.objects.filter(ministry=opsc_ministry).exists() and not Submission.objects.filter(
            ministry=opsc_ministry
        ).exists():
            opsc_ministry.delete()

    Profile.objects.filter(
        ministry=opm,
        department__isnull=True,
        role__in=[
            "odu_manager",
            "vipam_manager",
            "hr_unit_manager",
            "compliance_manager",
            "csu_manager",
            "compliance_senior",
            "compliance_principal",
            "odu_principal",
            "principal_org_dev_analyst",
            "principal_job_analyst",
            "psc_officer",
            "psc_admin",
            "psc_secretary",
            "senior_admin_officer",
            "psc_commissioner",
            "chairperson",
            "psc_manager",
            "principal_officer",
            "senior_officer",
        ],
    ).update(department=opsc_dept)


def backwards(apps, schema_editor):
    # Non-destructive reverse: leave OPM/OPSC structure in place
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0099_seed_opsc_ipdu_unit"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
