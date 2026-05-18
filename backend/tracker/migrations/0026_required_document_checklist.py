from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0025_sop_updates_and_flying_minutes'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='RequiredDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('form_category', models.ForeignKey(
                    blank=True, null=True,
                    help_text='Leave blank to apply to all form categories.',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='required_documents',
                    to='tracker.formcategory',
                )),
            ],
            options={
                'verbose_name': 'Required Document',
                'verbose_name_plural': 'Required Documents',
                'ordering': ['form_category', 'order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='SubmissionChecklistItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_present', models.BooleanField(default=False)),
                ('checked_at', models.DateTimeField(blank=True, null=True)),
                ('submission', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='checklist_items',
                    to='tracker.submission',
                )),
                ('document', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='checklist_items',
                    to='tracker.requireddocument',
                )),
                ('checked_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['document__order', 'document__name'],
                'unique_together': {('submission', 'document')},
            },
        ),
        migrations.RunSQL(
            sql="""
            INSERT INTO tracker_requireddocument (name, description, "order", is_active, form_category_id)
            VALUES
              ('Cover Letter from Ministry/Department', 'Official letter from the ministry or department head', 1, true, NULL),
              ('Bio-data / Personal Details Form', 'Completed personal details form for the candidate', 2, true, NULL),
              ('Certified Copy of Qualifications', 'Certified copies of all relevant academic and professional qualifications', 3, true, NULL),
              ('Recommendation Letter from Supervisor', 'Signed recommendation from the direct supervisor', 4, true, NULL),
              ('Position Description', 'Current position description for the role under consideration', 5, true, NULL),
              ('Police Clearance Certificate', 'Valid police clearance certificate (not older than 6 months)', 6, true, NULL),
              ('Medical Certificate', 'Medical fitness certificate from a registered practitioner', 7, true, NULL);
            """,
            reverse_sql="DELETE FROM tracker_requireddocument WHERE form_category_id IS NULL;",
        ),
    ]
