# Generated manually for UI translation management

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0072_submission_ai_context_keys"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UiTranslation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(db_index=True, max_length=255, unique=True)),
                ("namespace", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("text_en", models.TextField(blank=True)),
                ("text_fr", models.TextField(blank=True)),
                ("text_bi", models.TextField(blank=True)),
                ("is_customized", models.BooleanField(default=False, help_text="True when an administrator edited values in the UI.")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ui_translation_updates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "UI translation",
                "verbose_name_plural": "UI translations",
                "ordering": ["namespace", "key"],
            },
        ),
    ]
