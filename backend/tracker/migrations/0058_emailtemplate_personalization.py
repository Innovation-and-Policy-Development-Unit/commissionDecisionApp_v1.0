from django.db import migrations


def refresh_email_templates(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0057_emailtemplate"),
    ]

    operations = [
        migrations.RunPython(refresh_email_templates, migrations.RunPython.noop),
    ]
