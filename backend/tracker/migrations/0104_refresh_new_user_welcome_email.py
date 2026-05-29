"""Refresh new-user welcome email template (deliverability + firewall guidance)."""

from django.db import migrations


def forwards(apps, schema_editor):
    from tracker.email_template_defaults import DEFAULT_EMAIL_TEMPLATES

    EmailTemplate = apps.get_model("tracker", "EmailTemplate")
    data = next(d for d in DEFAULT_EMAIL_TEMPLATES if d["slug"] == "new_user_welcome")
    EmailTemplate.objects.filter(slug="new_user_welcome").update(
        name=data["name"],
        description=data["description"],
        placeholders=data["placeholders"],
        subject_template=data["subject_template"],
        body_text_template=data["body_text_template"],
        body_html_template=data["body_html_template"],
        is_active=True,
    )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0103_merge_opm_into_mpm"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
