from django.db import migrations


def reseed_templates(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0260_seed_submission_tracking_code_email_template"),
    ]

    operations = [
        migrations.RunPython(reseed_templates, migrations.RunPython.noop),
    ]
