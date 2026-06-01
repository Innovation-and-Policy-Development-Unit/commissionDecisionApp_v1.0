from django.db import migrations


def seed_dg_workflow_templates(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0106_receptionist_role"),
    ]

    operations = [
        migrations.RunPython(seed_dg_workflow_templates, migrations.RunPython.noop),
    ]
