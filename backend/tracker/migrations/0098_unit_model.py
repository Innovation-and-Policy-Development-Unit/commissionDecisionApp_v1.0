"""Add Unit (ministry → department → unit) and seed OPSC internal units."""

from django.db import migrations, models
import django.db.models.deletion


def seed_opsc_units(apps, schema_editor):
    Ministry = apps.get_model("tracker", "Ministry")
    Department = apps.get_model("tracker", "Department")
    Unit = apps.get_model("tracker", "Unit")

    opsc = Ministry.objects.filter(code__iexact="OPSC").first()
    if not opsc:
        return

    corp, _ = Department.objects.get_or_create(
        ministry=opsc,
        code="OPSC_CORP",
        defaults={"name": "Corporate and Secretariat"},
    )

    units = [
        ("IPDU", "Innovation and Policy Development Unit", ""),
        ("ODU", "Organisation Development Unit", "odu"),
        ("VIPAM", "VIPAM Unit", "vipam"),
        ("HR", "HR Unit", "hr"),
        ("COMPLIANCE", "Compliance Unit", "compliance"),
        ("CSU", "Corporate Services Unit", "csu"),
    ]
    for code, name, routed in units:
        Unit.objects.update_or_create(
            department=corp,
            code=code,
            defaults={"name": name, "routed_unit": routed},
        )


def unseed_opsc_units(apps, schema_editor):
    Unit = apps.get_model("tracker", "Unit")
    Department = apps.get_model("tracker", "Department")
    dept = Department.objects.filter(code="OPSC_CORP").first()
    if dept:
        Unit.objects.filter(department=dept).delete()
        if not dept.profiles.exists() and not dept.submissions.exists():
            dept.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0097_agendasection_receiver_roles"),
    ]

    operations = [
        migrations.CreateModel(
            name="Unit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=32)),
                ("name", models.CharField(max_length=255)),
                (
                    "routed_unit",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("odu", "ODU"),
                            ("hr", "Manager HR"),
                            ("vipam", "VIPAM"),
                            ("compliance", "Compliance"),
                            ("csu", "Corporate Services Unit"),
                        ],
                        help_text="OPSC workflow routing key when submissions are routed to this unit.",
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "department",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="units",
                        to="tracker.department",
                    ),
                ),
            ],
            options={
                "verbose_name": "Unit",
                "verbose_name_plural": "Units",
                "ordering": ["department__ministry__name", "department__name", "name"],
            },
        ),
        migrations.AddConstraint(
            model_name="unit",
            constraint=models.UniqueConstraint(
                fields=("department", "code"),
                name="uniq_unit_code_per_department",
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="unit",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="profiles",
                to="tracker.unit",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="unit",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="submissions",
                to="tracker.unit",
            ),
        ),
        migrations.RunPython(seed_opsc_units, unseed_opsc_units),
    ]
