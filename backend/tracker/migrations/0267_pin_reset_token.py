import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def seed_pin_reset_template(apps, schema_editor):
    from tracker.email_templates import seed_default_email_templates

    seed_default_email_templates()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0266_rename_chairperson_label_to_chairman'),
    ]

    operations = [
        migrations.CreateModel(
            name='PinResetToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('used', models.BooleanField(default=False)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='pin_reset_tokens',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.RunPython(seed_pin_reset_template, migrations.RunPython.noop),
    ]
