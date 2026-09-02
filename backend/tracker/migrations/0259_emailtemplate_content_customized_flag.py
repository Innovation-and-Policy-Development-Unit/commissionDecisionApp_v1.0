from django.db import migrations, models


def backfill_customized_flag(apps, schema_editor):
    """For every EmailTemplate row that matches a built-in default slug,
    infer whether an admin already customized it by comparing current
    content against the current code default — protects pre-existing
    customizations from being silently overwritten by the new safe
    seed_default_email_templates() behavior going forward."""
    from tracker.email_template_defaults import DEFAULT_EMAIL_TEMPLATES

    EmailTemplate = apps.get_model("tracker", "EmailTemplate")
    defaults_by_slug = {d["slug"]: d for d in DEFAULT_EMAIL_TEMPLATES}

    for tpl in EmailTemplate.objects.all():
        data = defaults_by_slug.get(tpl.slug)
        if not data:
            continue
        matches_default = (
            tpl.subject_template == data["subject_template"]
            and tpl.body_text_template == data["body_text_template"]
            and tpl.body_html_template == data.get("body_html_template", "")
        )
        tpl.is_content_customized = not matches_default
        tpl.save(update_fields=["is_content_customized"])


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0258_submission_applicant_tracking_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="emailtemplate",
            name="is_content_customized",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Set when an admin edits subject/body directly (not via reset-to-default "
                    "or a forced defaults sync). Protects that wording from being silently "
                    "overwritten the next time a migration or the routine 'sync defaults' "
                    "action seeds this template's built-in content."
                ),
            ),
        ),
        migrations.RunPython(backfill_customized_flag, migrations.RunPython.noop),
    ]
