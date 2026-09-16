import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0274_agenda_circulation_localized_templates'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveField(
            model_name='meeting',
            name='agenda_adopted_by',
        ),
        migrations.RemoveField(
            model_name='meeting',
            name='agenda_adopted_at',
        ),
        migrations.AddField(
            model_name='minutes',
            name='agenda_adopted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='minutes',
            name='agenda_adopted_by',
            field=models.ForeignKey(blank=True, help_text='Who recorded that the agenda was adopted at the start of the sitting.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='minutes_agenda_adopted', to=settings.AUTH_USER_MODEL),
        ),
    ]
