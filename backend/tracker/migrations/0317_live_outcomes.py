import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0316_cloud_backup_mega'),
    ]

    operations = [
        migrations.AddField(
            model_name='meeting',
            name='show_live_outcomes',
            field=models.BooleanField(default=False, help_text="When on, the minute taker can record each item's outcome in the room and Commissioners see it in the Sitting Pack as it happens. Off for real sittings unless the Secretariat turns it on; on for the training sitting."),
        ),
        migrations.AddField(
            model_name='agendaitem',
            name='live_outcome',
            field=models.CharField(blank=True, choices=[('approved', 'Approved'), ('not_approved', 'Not approved'), ('deferred', 'Deferred'), ('noted', 'Noted')], default='', help_text='Outcome announced in the room, recorded live by the minute taker. Subject to the signed minutes.', max_length=16),
        ),
        migrations.AddField(
            model_name='agendaitem',
            name='live_outcome_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='agendaitem',
            name='live_outcome_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
