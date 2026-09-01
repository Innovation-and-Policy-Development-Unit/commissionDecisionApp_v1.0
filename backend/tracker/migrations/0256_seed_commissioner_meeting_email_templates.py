from django.db import migrations


def seed_commissioner_meeting_templates(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0255_drop_orphaned_tracking_code_not_null"),
    ]

    operations = [
        migrations.RunPython(seed_commissioner_meeting_templates, migrations.RunPython.noop),
    ]
