"""Add the Receptionist intake role (registry front desk)."""

from django.db import migrations, models

ROLE_CHOICES = [
    ("psc_admin", "PSC Administrator"),
    ("receptionist", "Receptionist"),
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

RECEPTIONIST_PERMS = [
    "view_dashboard",
    "view_submissions",
    "create_submission",
    "edit_submission",
    "transition_workflow",
    "view_audit_trail",
]

RECEPTIONIST_DESCRIPTION = (
    "Receptionist (registry front desk) — receives paper submissions, scans and uploads "
    "them as PDFs (auto OCR for searchable text), then routes each submission to the "
    "responsible unit Manager (e.g. ODU for restructure / establishment variation)."
)


def seed_receptionist(apps, schema_editor):
    RoleDefinition = apps.get_model("tracker", "RoleDefinition")
    SystemPermission = apps.get_model("tracker", "SystemPermission")
    perms = list(SystemPermission.objects.filter(code__in=RECEPTIONIST_PERMS))
    rd, _ = RoleDefinition.objects.get_or_create(
        role="receptionist",
        defaults={"description": RECEPTIONIST_DESCRIPTION, "is_builtin": True},
    )
    if rd.description != RECEPTIONIST_DESCRIPTION:
        rd.description = RECEPTIONIST_DESCRIPTION
        rd.save(update_fields=["description"])
    rd.permissions.set(perms)


def unseed_receptionist(apps, schema_editor):
    Profile = apps.get_model("tracker", "Profile")
    RoleDefinition = apps.get_model("tracker", "RoleDefinition")
    if Profile.objects.filter(role="receptionist").exists():
        return
    RoleDefinition.objects.filter(role="receptionist").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0105_add_pending_dg_endorsement_stage"),
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
        migrations.RunPython(seed_receptionist, unseed_receptionist),
    ]
