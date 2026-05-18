from django.db import migrations, models


INITIAL_FORM_TYPES = [
    {
        'code': 'PSC 3-7',
        'name': 'Request to Employ Temporary / Daily / Contract Employee',
        'description': 'Used to request employment of a temporary salaried employee, daily rated worker, or contract employee.',
        'is_digitized': True,
        'digitized_form_key': 'psc_3_7',
        'is_active': True,
        'display_order': 10,
    },
    {
        'code': 'PSC 3-6',
        'name': 'PSC Form 3-6',
        'description': '',
        'is_digitized': False,
        'digitized_form_key': '',
        'is_active': True,
        'display_order': 20,
    },
    {
        'code': 'PSC 3-2',
        'name': 'Job Application',
        'description': 'Standard PSC job application form.',
        'is_digitized': False,
        'digitized_form_key': '',
        'is_active': True,
        'display_order': 30,
    },
]


def seed_form_types(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    for ft in INITIAL_FORM_TYPES:
        PSCFormType.objects.get_or_create(code=ft['code'], defaults=ft)


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0033_psc_form37_data'),
    ]

    operations = [
        migrations.CreateModel(
            name='PSCFormType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=64, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('is_digitized', models.BooleanField(default=False, help_text='True when a structured digital form is available in the system.')),
                ('digitized_form_key', models.CharField(blank=True, help_text="Internal key linking to the frontend component, e.g. 'psc_3_7'.", max_length=64)),
                ('is_active', models.BooleanField(default=True, help_text='Only active forms appear in the submission dropdown.')),
                ('display_order', models.IntegerField(default=0)),
            ],
            options={
                'verbose_name': 'PSC Form Type',
                'verbose_name_plural': 'PSC Form Types',
                'ordering': ['display_order', 'code'],
            },
        ),
        migrations.RunPython(seed_form_types, migrations.RunPython.noop),
    ]
