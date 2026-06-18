from django.db import migrations

NEW_SLUGS = ("account_locked_user", "account_locked_admin")


def seed_templates(apps, schema_editor):
    """Add only the two new lockout templates; never clobber existing/customized ones."""
    from tracker.email_template_defaults import DEFAULT_EMAIL_TEMPLATES

    EmailTemplate = apps.get_model("tracker", "EmailTemplate")
    by_slug = {d["slug"]: d for d in DEFAULT_EMAIL_TEMPLATES}
    for slug in NEW_SLUGS:
        data = by_slug.get(slug)
        if not data:
            continue
        EmailTemplate.objects.get_or_create(
            slug=slug,
            defaults={
                "name": data["name"],
                "category": data["category"],
                "description": data["description"],
                "placeholders": data["placeholders"],
                "subject_template": data["subject_template"],
                "body_text_template": data["body_text_template"],
                "body_html_template": data.get("body_html_template", ""),
                "is_active": True,
                "is_system": True,
            },
        )


def remove_templates(apps, schema_editor):
    EmailTemplate = apps.get_model("tracker", "EmailTemplate")
    EmailTemplate.objects.filter(slug__in=NEW_SLUGS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0169_profile_account_lockout_fields"),
    ]

    operations = [
        migrations.RunPython(seed_templates, remove_templates),
    ]
