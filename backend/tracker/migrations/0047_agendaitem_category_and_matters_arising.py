"""Add category, matters_arising_meeting_ref, matters_arising_agenda_no to AgendaItem."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0046_seed_internal_submission_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='agendaitem',
            name='category',
            field=models.CharField(
                max_length=32,
                choices=[
                    ('matters_arising',       'MATTERS ARISING'),
                    ('discipline_compliance', 'DISCIPLINE / COMPLIANCE'),
                    ('health_commission',     'HEALTH COMMISSION'),
                    ('appointment',           'APPOINTMENT / ACTING APPOINTMENT'),
                    ('direct_appointment',    'DIRECT APPOINTMENT / CONFIRMATION OF APPOINTMENT'),
                    ('extra_responsibility',  'EXTRA RESPONSIBILITY / OVERTIME ALLOWANCE / SPECIAL SKILLS ALLOWANCE'),
                    ('contract',              'CONTRACT / TEMPORARY SALARIED APPOINTMENT'),
                    ('temporary_salaried',    'TEMPORARY SALARIED APPOINTMENT'),
                    ('salary_adjustment',     'SALARY ADJUSTMENT'),
                    ('training',              'LONG TERM TRAINING / SCHOLARSHIP / INTERNSHIP / CADETSHIP / EXTENSION'),
                    ('medical_claim',         'MEDICAL CLAIM'),
                    ('partial_severance',     'PARTIAL SEVERANCE'),
                    ('resignation',           'RESIGNATION / RETIREMENT / DEATH'),
                    ('other',                 'OTHER MATTERS'),
                ],
                default='other',
                help_text='Agenda section this item belongs to.',
            ),
        ),
        migrations.AddField(
            model_name='agendaitem',
            name='matters_arising_meeting_ref',
            field=models.CharField(
                max_length=128, blank=True,
                help_text="e.g. 'PSC Meeting No. 10 of Monday 30th June 2025'",
            ),
        ),
        migrations.AddField(
            model_name='agendaitem',
            name='matters_arising_agenda_no',
            field=models.CharField(
                max_length=32, blank=True,
                help_text="e.g. 'Agenda 20'",
            ),
        ),
        migrations.AlterModelOptions(
            name='agendaitem',
            options={'ordering': ['category', 'sequence', 'added_at']},
        ),
    ]
