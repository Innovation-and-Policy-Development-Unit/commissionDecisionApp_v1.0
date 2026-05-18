# Generated manually — Add signature ImageField to Profile

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0021_add_trusted_session_and_pin'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='signature',
            field=models.ImageField(blank=True, help_text='Upload an image of your signature (PNG with transparent background recommended).', null=True, upload_to='signatures/'),
        ),
    ]
