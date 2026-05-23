from django.db import migrations, models


def seed_email_templates(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0056_submission_ai_brief"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailTemplate",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("slug", models.SlugField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=128)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("authentication", "Authentication"),
                            ("submission_workflow", "Submission workflow"),
                            ("tasks", "Tasks & deadlines"),
                            ("system", "System"),
                        ],
                        default="system",
                        max_length=32,
                    ),
                ),
                ("description", models.TextField(blank=True)),
                (
                    "placeholders",
                    models.TextField(
                        blank=True,
                        help_text="Comma-separated placeholder names available in subject/body.",
                    ),
                ),
                ("subject_template", models.CharField(max_length=255)),
                ("body_text_template", models.TextField()),
                ("body_html_template", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "is_system",
                    models.BooleanField(
                        default=False,
                        help_text="System templates can be reset to defaults but not deleted.",
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["category", "name"],
            },
        ),
        migrations.RunPython(seed_email_templates, migrations.RunPython.noop),
    ]
