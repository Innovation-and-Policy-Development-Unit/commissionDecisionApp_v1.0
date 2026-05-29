from django.db import migrations


def refresh_email_templates(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0092_rename_tracker_dai_created_6e0f0d_idx_tracker_dai_created_788b6d_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(refresh_email_templates, migrations.RunPython.noop),
    ]

