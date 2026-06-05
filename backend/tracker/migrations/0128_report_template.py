from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0127_smartreport"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReportTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("description", models.TextField(blank=True)),
                ("domain", models.CharField(default="submissions", help_text="Resolver domain key.", max_length=24)),
                ("spec", models.JSONField(default=dict, help_text="Validated render spec: sections/kpis/charts/table/narrative.")),
                ("param_schema", models.JSONField(blank=True, default=list, help_text="Params exposed on the Generate form.")),
                ("default_params", models.JSONField(blank=True, default=dict)),
                ("visible_to_all", models.BooleanField(default=True)),
                ("visible_roles", models.JSONField(blank=True, default=list, help_text="Role codes when not visible to all.")),
                ("is_active", models.BooleanField(default=True)),
                ("version", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="report_templates_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="report_templates_updated",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="smartreport",
            name="template",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="generated_reports",
                to="tracker.reporttemplate",
            ),
        ),
    ]
