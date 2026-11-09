from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tracker", "0310_messagereaction_emoji_16")]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="ui_preferences",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
