"""
Migration 0134 — Mention (A7 Collaboration, P2).

Staff @mentions inside a Comment, with a notified flag for the notification fan-out.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tracker', '0133_comment'),
    ]

    operations = [
        migrations.CreateModel(
            name='Mention',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notified', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('comment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mentions', to='tracker.comment')),
                ('mentioned_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mentions_received', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('comment', 'mentioned_user')},
            },
        ),
    ]
