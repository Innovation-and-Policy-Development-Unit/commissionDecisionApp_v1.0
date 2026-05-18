from django.db import migrations

GLOBAL_DOC_NAMES = [
    'Cover Letter from Ministry/Department',
    'Bio-data / Personal Details Form',
    'Certified Copy of Qualifications',
    'Recommendation Letter from Supervisor',
    'Position Description',
    'Police Clearance Certificate',
    'Medical Certificate',
]


def remove_global_docs(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    SubmissionChecklistItem = apps.get_model('tracker', 'SubmissionChecklistItem')

    docs = RequiredDocument.objects.filter(
        form_category__isnull=True,
        form_type__isnull=True,
        name__in=GLOBAL_DOC_NAMES,
    )
    # Delete dependent checklist items first to avoid ProtectedError
    SubmissionChecklistItem.objects.filter(document__in=docs).delete()
    docs.delete()


def restore_global_docs(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    docs = [
        ('Cover Letter from Ministry/Department',    'Official letter from the ministry or department head',                              1),
        ('Bio-data / Personal Details Form',         'Completed personal details form for the candidate',                                 2),
        ('Certified Copy of Qualifications',         'Certified copies of all relevant academic and professional qualifications',         3),
        ('Recommendation Letter from Supervisor',    'Signed recommendation from the direct supervisor',                                  4),
        ('Position Description',                     'Current position description for the role under consideration',                     5),
        ('Police Clearance Certificate',             'Valid police clearance certificate (not older than 6 months)',                      6),
        ('Medical Certificate',                      'Medical fitness certificate from a registered practitioner',                        7),
    ]
    for name, description, order in docs:
        RequiredDocument.objects.get_or_create(
            name=name,
            form_category=None,
            form_type=None,
            defaults={'description': description, 'order': order, 'is_active': True},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0042_fix_required_document_meta'),
    ]

    operations = [
        migrations.RunPython(remove_global_docs, reverse_code=restore_global_docs),
    ]
