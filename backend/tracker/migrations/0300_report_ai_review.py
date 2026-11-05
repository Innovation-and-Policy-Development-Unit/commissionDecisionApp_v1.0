import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0299_odu_restructure_documents_and_travel_report"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReportAIReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("state", models.CharField(blank=True, choices=[("running", "Running"), ("done", "Done"), ("failed", "Failed")], default="", max_length=10)),
                ("result", models.JSONField(blank=True, default=dict)),
                ("error", models.TextField(blank=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("submission", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="report_ai_review", to="tracker.submission")),
            ],
        ),
    ]
