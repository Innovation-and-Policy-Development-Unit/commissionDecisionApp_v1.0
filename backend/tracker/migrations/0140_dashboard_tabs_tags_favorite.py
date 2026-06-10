import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0139_dashboard_filters"),
    ]

    operations = [
        migrations.AddField(
            model_name="dashboard",
            name="tabs",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="dashboard",
            name="tags",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.CreateModel(
            name="IntelligenceFavorite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("dashboard", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorited_by", to="tracker.dashboard")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="intelligence_favorites", to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("user", "dashboard")}},
        ),
        migrations.AddIndex(
            model_name="intelligencefavorite",
            index=models.Index(fields=["user"], name="intel_fav_user_idx"),
        ),
    ]
