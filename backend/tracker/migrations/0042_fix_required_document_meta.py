from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0041_required_document_form_type_and_seed_psc_2_1'),
    ]

    operations = [
        # ── Fix Meta.ordering on RequiredDocument ─────────────────────────────
        migrations.AlterModelOptions(
            name='requireddocument',
            options={
                'ordering': ['form_category', 'form_type', 'order', 'name'],
                'verbose_name': 'Required Document',
                'verbose_name_plural': 'Required Documents',
            },
        ),

        # ── start_new_page already exists in the DB (added earlier via RunSQL).
        #    Use SeparateDatabaseAndState so Django updates its migration state
        #    without issuing an ALTER TABLE that would fail with DuplicateColumn.
        migrations.SeparateDatabaseAndState(
            database_operations=[],   # column already in DB — do nothing
            state_operations=[
                migrations.AddField(
                    model_name='pscformfield',
                    name='start_new_page',
                    field=models.BooleanField(
                        default=False,
                        help_text='Only applies to section_header fields. When true, this section starts a new page in the multi-page form renderer.',
                    ),
                ),
            ],
        ),
    ]
