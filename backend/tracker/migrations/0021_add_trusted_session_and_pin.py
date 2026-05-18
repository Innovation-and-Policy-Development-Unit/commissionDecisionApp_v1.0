# Generated manually — TrustedSession model + session_pin on Profile

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0020_add_matters_arising_stage'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='session_pin',
            field=models.CharField(blank=True, help_text='Hashed 4-6 digit PIN for trusted session re-authentication.', max_length=128, null=True),
        ),
        migrations.AddField(
            model_name='profile',
            name='session_pin_set_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='TrustedSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=512)),
                ('is_active', models.BooleanField(default=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='trusted_sessions', to='auth.user')),
            ],
            options={
                'verbose_name': 'Trusted Session',
                'verbose_name_plural': 'Trusted Sessions',
                'ordering': ['-started_at'],
                'indexes': [
                    models.Index(fields=['user', 'is_active', 'expires_at'], name='ts_user_active_expires_idx'),
                ],
            },
        ),
    ]
