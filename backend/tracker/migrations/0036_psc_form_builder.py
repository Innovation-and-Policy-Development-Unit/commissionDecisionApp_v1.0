from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0035_pscformtype_form_category'),
    ]

    operations = [
        migrations.CreateModel(
            name='PSCFormField',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=255)),
                ('field_key', models.CharField(max_length=64, help_text='Unique snake_case key within this form; used as the JSON key when storing responses.')),
                ('field_type', models.CharField(
                    choices=[
                        ('section_header', 'Section Header'),
                        ('text', 'Short Text'),
                        ('textarea', 'Long Text / Paragraph'),
                        ('number', 'Number'),
                        ('date', 'Date'),
                        ('datetime', 'Date & Time'),
                        ('select', 'Dropdown (Select One)'),
                        ('radio', 'Radio Buttons (Select One)'),
                        ('checkbox', 'Checkbox (Yes / No)'),
                    ],
                    default='text',
                    max_length=32,
                )),
                ('placeholder', models.CharField(blank=True, max_length=255)),
                ('help_text', models.CharField(blank=True, max_length=500)),
                ('choices', models.TextField(blank=True, help_text='One option per line — used for select and radio field types.')),
                ('is_required', models.BooleanField(default=False)),
                ('display_order', models.IntegerField(default=0)),
                ('form_type', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fields', to='tracker.pscformtype')),
            ],
            options={
                'verbose_name': 'PSC Form Field',
                'ordering': ['display_order', 'id'],
                'unique_together': {('form_type', 'field_key')},
            },
        ),
        migrations.CreateModel(
            name='PSCFormResponse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('form_type', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='tracker.pscformtype')),
                ('submission', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='dynamic_form_response', to='tracker.submission')),
            ],
            options={
                'verbose_name': 'PSC Form Response',
            },
        ),
    ]
