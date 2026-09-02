from django.db import migrations


def reseed_templates(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0262_backfill_applicant_tracking_codes"),
    ]

    operations = [
        migrations.RunPython(reseed_templates, migrations.RunPython.noop),
    ]
