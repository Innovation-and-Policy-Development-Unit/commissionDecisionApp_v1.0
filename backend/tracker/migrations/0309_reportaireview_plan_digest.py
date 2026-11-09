from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tracker", "0308_odu_consolidated_papers")]

    operations = [
        migrations.AddField(
            model_name="reportaireview",
            name="plan_digest",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
