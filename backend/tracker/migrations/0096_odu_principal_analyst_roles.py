"""Add Principal Organization Development Analyst and Principal Job Analyst roles."""

from django.db import migrations, models

ROLE_CHOICES = [
    ("psc_admin", "PSC Administrator"),
    ("psc_officer", "PSC Officer"),
    ("psc_secretary", "PSC Secretary"),
    ("senior_admin_officer", "Senior Administration Officer"),
    ("psc_commissioner", "PSC Commissioner"),
    ("chairperson", "Chairperson, PSC"),
    ("psc_manager", "OPSC Manager"),
    ("principal_officer", "Principal Officer"),
    ("senior_officer", "Senior Officer"),
    ("head_of_agency", "Head of Agency (DG/Director)"),
    ("ministry_hr", "Ministry HR Officer"),
    ("dept_admin", "Department Admin Officer"),
    ("traveller", "Public Servant (Travel)"),
    ("vipam_manager", "VIPAM Manager"),
    ("hr_unit_manager", "HR Unit Manager"),
    ("odu_manager", "ODU Manager"),
    ("compliance_manager", "Compliance Manager"),
    ("compliance_senior", "Compliance Senior Officer"),
    ("csu_manager", "CSU Manager"),
    ("vipam_principal", "VIPAM Principal"),
    ("hr_unit_principal", "HR Unit Principal"),
    ("odu_principal", "ODU Principal"),
    ("principal_org_dev_analyst", "Principal Organization Development Analyst"),
    ("principal_job_analyst", "Principal Job Analyst"),
    ("compliance_principal", "Compliance Principal"),
]

ODU_ANALYST_PERMS = [
    "view_dashboard",
    "view_submissions",
    "transition_workflow",
    "update_implementation",
    "view_commission_minutes",
    "view_commission_tasks",
    "view_audit_trail",
]

ROLE_DEFINITIONS = [
    (
        "principal_org_dev_analyst",
        (
            "Principal Organization Development Analyst (ODU) — completes the ODU restructure "
            "checklist and assessment on submissions assigned by the ODU Manager (ORG-3.1 / PSC 2-1)."
        ),
    ),
    (
        "principal_job_analyst",
        (
            "Principal Job Analyst (ODU) — job analysis and establishment variation work on "
            "submissions assigned by the ODU Manager; same ODU workflow access as org development analyst."
        ),
    ),
]


def seed_role_definitions(apps, schema_editor):
    RoleDefinition = apps.get_model("tracker", "RoleDefinition")
    SystemPermission = apps.get_model("tracker", "SystemPermission")
    perms = list(SystemPermission.objects.filter(code__in=ODU_ANALYST_PERMS))
    for role, description in ROLE_DEFINITIONS:
        rd, _ = RoleDefinition.objects.get_or_create(
            role=role,
            defaults={"description": description, "is_builtin": True},
        )
        if rd.description != description:
            rd.description = description
            rd.save(update_fields=["description"])
        rd.permissions.set(perms)


def unseed_role_definitions(apps, schema_editor):
    Profile = apps.get_model("tracker", "Profile")
    RoleDefinition = apps.get_model("tracker", "RoleDefinition")
    codes = [role for role, _ in ROLE_DEFINITIONS]
    if Profile.objects.filter(role__in=codes).exists():
        return
    RoleDefinition.objects.filter(role__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0095_profile_force_password_change"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="role",
            field=models.CharField(choices=ROLE_CHOICES, max_length=32),
        ),
        migrations.AlterField(
            model_name="roledefinition",
            name="role",
            field=models.CharField(choices=ROLE_CHOICES, max_length=50, unique=True),
        ),
        migrations.RunPython(seed_role_definitions, unseed_role_definitions),
    ]
