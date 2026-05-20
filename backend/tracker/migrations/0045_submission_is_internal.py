from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0044_submission_parent_and_attachment'),
    ]

    operations = [
        migrations.AddField(
            model_name='submission',
            name='is_internal',
            field=models.BooleanField(
                default=False,
                help_text='True when submitted by OPSC staff (CSU/ODU). Routes directly to Secretary, no checklist.',
            ),
        ),
    ]
