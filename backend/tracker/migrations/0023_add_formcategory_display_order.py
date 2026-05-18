from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0022_add_profile_signature'),
    ]

    operations = [
        migrations.AddField(
            model_name='formcategory',
            name='display_order',
            field=models.IntegerField(default=0, help_text='Default agenda sequence: lower numbers appear first.'),
        ),
        migrations.AlterModelOptions(
            name='formcategory',
            options={'ordering': ['display_order', 'name'], 'verbose_name_plural': 'Form categories'},
        ),
    ]
