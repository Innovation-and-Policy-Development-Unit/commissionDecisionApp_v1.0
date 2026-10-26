"""
The "lodge signed paper" feature is removed: its page, endpoint and the
``lodge_signed_paper`` permission. This deletes the permission row (and, with it,
every role's grant of it) so it stops appearing in Role Definitions.

The ``lodged_from_paper`` / ``paper_*`` columns on Submission are deliberately kept:
they describe papers already lodged this way, which must stay readable.
"""
from django.db import migrations

PERM_CODE = "lodge_signed_paper"


def remove_permission(apps, schema_editor):
    apps.get_model("tracker", "SystemPermission").objects.filter(code=PERM_CODE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0285_seed_dg_link_expired_template_and_beat"),
    ]

    operations = [
        # Not reversible on purpose: the feature itself is gone, so there is nothing to
        # grant the permission to if the migration were rolled back.
        migrations.RunPython(remove_permission, migrations.RunPython.noop),
    ]
