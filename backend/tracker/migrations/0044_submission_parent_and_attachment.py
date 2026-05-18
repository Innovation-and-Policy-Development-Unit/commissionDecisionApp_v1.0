from django.db import migrations, models
import django.db.models.deletion


DG_LETTER_DOC = {
    'name': 'Signed Letter from Director-General',
    'description': (
        'A letter signed by the Ministry Director-General or Head of Agency '
        'supporting this standalone Job Description submission. '
        'Required when PSC Form 2-2 is submitted independently (not as an attachment to a PSC Form 2-1).'
    ),
    'order': 10,
}


def seed_form_2_2_dg_letter(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code='PSC 2-2').first()
    if not form_type:
        return
    RequiredDocument.objects.get_or_create(
        form_type=form_type,
        name=DG_LETTER_DOC['name'],
        defaults={
            'description': DG_LETTER_DOC['description'],
            'order': DG_LETTER_DOC['order'],
            'is_active': True,
        },
    )


def unseed_form_2_2_dg_letter(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code='PSC 2-2').first()
    if form_type:
        RequiredDocument.objects.filter(
            form_type=form_type,
            name=DG_LETTER_DOC['name'],
        ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0043_remove_global_required_documents'),
    ]

    operations = [
        migrations.AddField(
            model_name='submission',
            name='parent_submission',
            field=models.ForeignKey(
                blank=True,
                help_text='Set when this submission is attached to a parent (e.g. Form 2-2 attached to Form 2-1).',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='attached_submissions',
                to='tracker.submission',
            ),
        ),
        migrations.AddField(
            model_name='submission',
            name='is_attachment',
            field=models.BooleanField(
                default=False,
                help_text='True when this submission is a lightweight attachment reviewed alongside a parent submission.',
            ),
        ),
        migrations.RunPython(seed_form_2_2_dg_letter, reverse_code=unseed_form_2_2_dg_letter),
    ]
