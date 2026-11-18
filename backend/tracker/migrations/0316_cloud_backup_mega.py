from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0315_minutes_signature_check'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cloudbackupconnection',
            name='provider',
            field=models.CharField(choices=[('google_drive', 'Google Drive'), ('mega', 'MEGA')], help_text="One connection per provider — connecting again replaces the previous admin's connection for that provider.", max_length=20, unique=True),
        ),
    ]
