from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0064_ocr_deadline_action_items"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffchatsession",
            name="purpose",
            field=models.CharField(
                choices=[("staff", "Staff Assistant"), ("status", "Status Assistant")],
                db_index=True,
                default="staff",
                max_length=16,
            ),
        ),
    ]
