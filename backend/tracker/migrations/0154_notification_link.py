from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0153_agenda_item_restriction"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="link",
            field=models.CharField(blank=True, default="", help_text="In-app path opened when the notification is clicked (falls back to the submission page).", max_length=512),
        ),
    ]
