import django.db.models.deletion
from django.db import migrations, models

PERM_CODE = "manage_minute_access"


def remove_permission(apps, schema_editor):
    apps.get_model("tracker", "SystemPermission").objects.filter(code=PERM_CODE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0154_notification_link"),
    ]

    operations = [
        # Manual restrict/share/request flow replaced by automatic unit-scoped
        # visibility (Submission.routed_unit) — see tracker/minutes_access.py.
        migrations.RemoveField(model_name="agendaitemrestriction", name="visible_to"),
        migrations.DeleteModel(name="AgendaAccessRequest"),
        migrations.DeleteModel(name="AgendaAccessGrant"),
        migrations.DeleteModel(name="AgendaItemRestriction"),
        migrations.AddField(
            model_name="commissiontask",
            name="agenda_item",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Agenda item in the signed minutes that produced this task. "
                    "Used for idempotent auto-allocation and unit-scoped minutes visibility."
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="commission_tasks",
                to="tracker.agendaitem",
            ),
        ),
        migrations.RunPython(remove_permission, migrations.RunPython.noop),
    ]
