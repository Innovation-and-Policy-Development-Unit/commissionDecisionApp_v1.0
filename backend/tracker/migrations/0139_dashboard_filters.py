from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0138_intelligencereport"),
    ]

    operations = [
        migrations.AddField(
            model_name="dashboard",
            name="filters",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
