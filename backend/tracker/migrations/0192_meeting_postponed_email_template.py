from django.db import migrations


def seed_meeting_postponed_template(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0191_remove_internal_int_form_types"),
    ]

    operations = [
        migrations.RunPython(seed_meeting_postponed_template, migrations.RunPython.noop),
    ]
