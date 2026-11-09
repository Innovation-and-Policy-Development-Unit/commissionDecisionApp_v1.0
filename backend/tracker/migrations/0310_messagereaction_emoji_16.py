from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tracker", "0309_reportaireview_plan_digest")]

    operations = [
        migrations.AlterField(
            model_name="messagereaction",
            name="emoji",
            field=models.CharField(max_length=16),
        ),
    ]
