import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0183_set_hr_routed_unit_and_direct_intake'),
    ]

    operations = [
        migrations.AddField(
            model_name='submissiondocument',
            name='required_document',
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Set when this file was uploaded against a specific required-document "
                    "checklist slot (e.g. on the ministry submission form), rather than as a "
                    "free-form attachment."
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='uploaded_documents',
                to='tracker.requireddocument',
            ),
        ),
    ]
