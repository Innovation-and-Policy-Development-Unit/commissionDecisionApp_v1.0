from django.db import migrations


def seed_submission_tracking_code_template(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0258_submission_applicant_tracking_code"),
    ]

    operations = [
        migrations.RunPython(seed_submission_tracking_code_template, migrations.RunPython.noop),
    ]
