# Compliance feedback: remove open peer-invited "collaboration" on a draft
# (SubmissionCollaborator, comment-only) in favor of a Manager/Principal-
# granted edit delegation, so a colleague can be authorized to edit and
# submit someone else's draft while they're absent.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0263_reseed_tracking_by_code_only_templates'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SubmissionDraftDelegate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('granted_at', models.DateTimeField(auto_now_add=True)),
                ('reason', models.CharField(blank=True, help_text="Why access was delegated, e.g. 'original drafter on leave'.", max_length=255)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('delegate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='draft_delegate_records', to=settings.AUTH_USER_MODEL)),
                ('granted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('revoked_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('submission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='draft_delegations', to='tracker.submission')),
            ],
            options={
                'verbose_name': 'Submission Draft Delegate',
                'verbose_name_plural': 'Submission Draft Delegates',
                'ordering': ['-granted_at'],
            },
        ),
        migrations.DeleteModel(
            name='SubmissionCollaborator',
        ),
    ]
