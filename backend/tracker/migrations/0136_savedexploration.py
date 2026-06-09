import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0135_agenda_status_secretary_review"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedExploration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("dataset", models.CharField(max_length=64)),
                ("spec", models.JSONField(blank=True, default=dict)),
                (
                    "is_shared",
                    models.BooleanField(
                        default=False,
                        help_text="Visible to everyone who can use SCDMS Intelligence.",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="saved_explorations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
        migrations.AddIndex(
            model_name="savedexploration",
            index=models.Index(fields=["owner", "-updated_at"], name="intel_saved_owner_upd_idx"),
        ),
    ]
