"""Disable the Session PIN feature system-wide.

Clears any previously-set session_pin so the trusted-session PIN shortcut in
the login flow can never trigger again (backend/tracker/views.py's
SessionPinSetupView also rejects any future attempt to set one).
"""

from django.db import migrations


def clear_session_pins(apps, schema_editor):
    Profile = apps.get_model("tracker", "Profile")
    Profile.objects.exclude(session_pin="").update(
        session_pin="", session_pin_set_at=None
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0233_remove_compliance_case_management"),
    ]

    operations = [
        migrations.RunPython(clear_session_pins, noop),
    ]
