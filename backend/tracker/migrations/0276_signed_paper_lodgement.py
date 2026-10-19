"""
Signed-paper lodgement for the pilot: non-pilot ministries stay on paper until
the Acting Secretary signs; CSU/registry staff then scan and upload the whole
signed package so it lands on the same agenda as online submissions.

Adds the lodgement fields on Submission and the ``lodge_signed_paper``
permission (CSU Manager, CSU Senior Officer, Receptionist, PSC Admin).
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

PERM_CODE = "lodge_signed_paper"
GRANTED_ROLES = ("csu_manager", "csu_senior", "receptionist", "psc_admin")


def seed_permission(apps, schema_editor):
    SystemPermission = apps.get_model("tracker", "SystemPermission")
    RoleDefinition = apps.get_model("tracker", "RoleDefinition")

    perm, _ = SystemPermission.objects.update_or_create(
        code=PERM_CODE,
        defaults={
            "label": "Lodge Signed Paper Submission",
            "category": "secretariat",
            "description": (
                "Scan and upload an Acting-Secretary-signed paper package for a "
                "ministry not on SCDMS; it goes straight to the agenda."
            ),
            "is_builtin": True,
        },
    )
    for role in GRANTED_ROLES:
        rd = RoleDefinition.objects.filter(role=role).first()
        if rd:
            rd.permissions.add(perm)


def unseed_permission(apps, schema_editor):
    apps.get_model("tracker", "SystemPermission").objects.filter(code=PERM_CODE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0275_move_agenda_adoption_to_minutes"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="lodged_from_paper",
            field=models.BooleanField(
                db_index=True, default=False,
                help_text="True when CSU/registry staff scanned and uploaded the complete Acting-Secretary-signed paper package on the ministry's behalf, instead of the ministry submitting it online.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="paper_lodged_by",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="paper_lodged_submissions", to=settings.AUTH_USER_MODEL,
                help_text="Staff member who scanned and uploaded the signed paper package.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="paper_lodged_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="paper_signed_on",
            field=models.DateField(
                blank=True, null=True,
                help_text="Date the Acting Secretary signed the paper package for the agenda.",
            ),
        ),
        migrations.RunPython(seed_permission, unseed_permission),
    ]
