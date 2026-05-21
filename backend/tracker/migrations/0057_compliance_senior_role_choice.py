"""Add compliance_senior and csu_manager to Profile/RoleDefinition role choices."""

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
    ("vipam_manager", "VIPAM Manager"),
    ("hr_unit_manager", "HR Unit Manager"),
    ("odu_manager", "ODU Manager"),
    ("compliance_manager", "Compliance Manager"),
    ("compliance_senior", "Compliance Senior Officer"),
    ("csu_manager", "CSU Manager"),
    ("vipam_principal", "VIPAM Principal"),
    ("hr_unit_principal", "HR Unit Principal"),
    ("odu_principal", "ODU Principal"),
    ("compliance_principal", "Compliance Principal"),
]


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0056_compliance_unit_submissions"),
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
    ]
