import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0207_psc_2_2_routed_unit_odu'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='odurestructureboardpaper',
            name='returned_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='odurestructureboardpaper',
            name='returned_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Manager ODU who last sent this back to the Principal for changes.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='odu_board_papers_returned',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='odurestructureboardpaper',
            name='return_note',
            field=models.TextField(blank=True, help_text="Manager's note on what needs changing, from the last return."),
        ),
    ]
