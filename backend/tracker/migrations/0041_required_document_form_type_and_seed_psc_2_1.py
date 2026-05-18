from django.db import migrations, models
import django.db.models.deletion


PSC_2_1_DOCS = [
    {
        'order': 10,
        'name': 'Current Organisation Structure (OPSC-stamped)',
        'description': (
            'The current approved organisation structure chart bearing the OPSC approval stamp. '
            'Required for all Organisation Restructure and New Post proposals.'
        ),
    },
    {
        'order': 20,
        'name': 'Proposed Organisation Structure',
        'description': (
            'A chart showing the proposed new structure. Required for Restructure proposals; '
            'strongly recommended for New Post proposals to show where the position fits.'
        ),
    },
    {
        'order': 30,
        'name': 'Job Descriptions — PSC Form 2-2 (New Positions Only)',
        'description': (
            'A completed PSC Form 2-2 Job Description for each new position being created. '
            'Required for New Post proposals and any Restructure that creates new positions. '
            'Not required for deletion-only or regrading-only proposals.'
        ),
    },
    {
        'order': 40,
        'name': 'OPSC Excel Establishment Cost Spreadsheet',
        'description': (
            'The OPSC-formatted Excel spreadsheet showing full establishment costs including '
            'VNPF contributions and allowances for all new or upgraded positions. '
            'Contact OPSC to obtain the template. Required for New Post, Regrading, and '
            'Restructure proposals; not required for deletion-only proposals.'
        ),
    },
    {
        'order': 50,
        'name': 'Other Supporting Documents',
        'description': (
            'Any additional documents that support the proposal — e.g. Cabinet decisions, '
            'legal opinions, corporate plan extracts, previous PSC correspondence. '
            'Upload each document separately via the Documents panel and describe it in the '
            'submission form.'
        ),
    },
]


def seed_psc_2_1_required_docs(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code='PSC 2-1').first()
    if not form_type:
        return  # Form type not seeded yet — skip silently

    for doc in PSC_2_1_DOCS:
        RequiredDocument.objects.get_or_create(
            form_type=form_type,
            name=doc['name'],
            defaults={
                'description': doc['description'],
                'order': doc['order'],
                'is_active': True,
            },
        )


def unseed_psc_2_1_required_docs(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code='PSC 2-1').first()
    if form_type:
        RequiredDocument.objects.filter(form_type=form_type).delete()


class Migration(migrations.Migration):

    # atomic=False so PostgreSQL can commit the AddField+index before RunPython
    # seeds data into the same table. Without this the index creation fails with
    # "cannot CREATE INDEX because it has pending trigger events".
    atomic = False

    dependencies = [
        ('tracker', '0040_add_unit_principals_and_submission_assignment'),
    ]

    operations = [
        # ── Add form_type FK to RequiredDocument ─────────────────────────────
        migrations.AddField(
            model_name='requireddocument',
            name='form_type',
            field=models.ForeignKey(
                blank=True,
                help_text='When set, applies only to submissions of this specific form type (overrides form_category).',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='required_documents',
                to='tracker.pscformtype',
            ),
        ),

        # ── Seed PSC Form 2-1 required documents ─────────────────────────────
        migrations.RunPython(
            seed_psc_2_1_required_docs,
            reverse_code=unseed_psc_2_1_required_docs,
        ),
    ]
