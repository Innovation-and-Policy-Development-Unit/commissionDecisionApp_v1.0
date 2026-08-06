import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tracker', '0201_deactivate_orphaned_recruitment_fallback_docs'),
    ]

    operations = [
        migrations.AddField(
            model_name='workflowevent',
            name='remarks_html',
            field=models.TextField(
                blank=True, default='',
                help_text=(
                    "Sanitized rich-text version of remarks, for display only. "
                    "Never used for the decision proof hash, emails, or AI context — "
                    "those all read the plain-text `remarks` field derived from this."
                ),
            ),
        ),
        migrations.CreateModel(
            name='RemarksImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.ImageField(upload_to='remarks_images/%Y/%m/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('submission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='remarks_images', to='tracker.submission')),
                ('workflow_event', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='images', to='tracker.workflowevent')),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
