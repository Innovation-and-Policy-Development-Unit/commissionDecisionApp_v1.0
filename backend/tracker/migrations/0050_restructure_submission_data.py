"""
Migration 0050

1. Creates the RestructureSubmissionData table (structured data for the
   Section 3.1 Organisation Restructure / Establishment Variation template).

2. Seeds the 'ORG-3.1' PSCFormType ("Organisation Restructure Submission")
   under the existing 'INTERNAL' FormCategory, and assigns its
   agenda_category to 'other' so it sorts correctly in the agenda.
"""
from django.db import migrations, models
import django.db.models.deletion


def seed_restructure_form_type(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    # Reuse the INTERNAL category that was seeded in 0046
    category, _ = FormCategory.objects.get_or_create(
        code='INTERNAL',
        defaults={
            'name': 'Internal Submissions',
            'psc_forms_summary': 'OPSC internal submissions routed directly to the Secretary.',
            'display_order': 99,
        },
    )

    PSCFormType.objects.get_or_create(
        code='ORG-3.1',
        defaults={
            'name': 'Organisation Restructure / Establishment Variation',
            'form_category': category,
            'is_digitized': True,
            'digitized_form_key': 'org_restructure',
            'agenda_category': 'other',
        },
    )


def unseed_restructure_form_type(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code='ORG-3.1').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0049_odu_restructure_checklist'),
    ]

    operations = [
        migrations.CreateModel(
            name='RestructureSubmissionData',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                # Cover
                ('subject_title', models.CharField(
                    blank=True, max_length=512,
                    help_text="Full subject/title of the proposal",
                )),
                # Section 1
                ('background', models.TextField(blank=True)),
                # Section 2
                ('proposal', models.TextField(blank=True)),
                # Section 3
                ('costing_rows', models.JSONField(
                    blank=True, default=list,
                    help_text="Array of position rows for the costing table.",
                )),
                ('costing_notes', models.TextField(blank=True)),
                # Section 4
                ('implementation_plan', models.TextField(blank=True)),
                # Section 5
                ('recommendation', models.TextField(blank=True)),
                # Director
                ('director_name', models.CharField(blank=True, max_length=255)),
                ('director_date', models.DateField(blank=True, null=True)),
                # Attachments
                ('attach_current_org_chart',  models.BooleanField(default=False)),
                ('attach_proposed_org_chart', models.BooleanField(default=False)),
                ('attach_job_descriptions',   models.BooleanField(default=False)),
                ('attach_other',              models.BooleanField(default=False)),
                ('attach_other_description',  models.CharField(blank=True, max_length=512)),
                # DG endorsement
                ('dg_endorses', models.BooleanField(blank=True, null=True)),
                ('dg_name',     models.CharField(blank=True, max_length=255)),
                ('dg_date',     models.DateField(blank=True, null=True)),
                # Meta
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                # FK
                ('submission', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='restructure_data',
                    to='tracker.submission',
                )),
            ],
            options={
                'verbose_name': 'Restructure Submission Data',
                'verbose_name_plural': 'Restructure Submission Data',
            },
        ),
        migrations.RunPython(seed_restructure_form_type, reverse_code=unseed_restructure_form_type),
    ]
