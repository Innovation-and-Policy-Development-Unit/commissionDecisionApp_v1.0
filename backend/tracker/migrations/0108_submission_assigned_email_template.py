from django.db import migrations


def seed_assignment_template(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0107_dg_workflow_email_templates"),
    ]

    operations = [
        migrations.RunPython(seed_assignment_template, migrations.RunPython.noop),
    ]
