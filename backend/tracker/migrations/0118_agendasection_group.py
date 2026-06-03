from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0117_split_restructure_anomalies'),
    ]

    operations = [
        migrations.AddField(
            model_name='agendasection',
            name='group',
            field=models.CharField(
                blank=True,
                default='',
                max_length=100,
                help_text=(
                    "Dropdown group label shown to users when lodging a submission "
                    "(e.g. 'Appointments', 'Structure'). Sections with the same group "
                    "are listed together. Leave blank to appear ungrouped."
                ),
            ),
        ),
        # Seed existing sections with sensible default groups
        migrations.RunSQL(
            sql="""
                UPDATE tracker_agendasection SET "group" = 'Appointments'       WHERE code IN ('appointment', 'direct_appointment');
                UPDATE tracker_agendasection SET "group" = 'Structure'          WHERE code IN ('restructure', 'anomalies');
                UPDATE tracker_agendasection SET "group" = 'Allowances & Pay'   WHERE code IN ('extra_responsibility', 'salary_adjustment');
                UPDATE tracker_agendasection SET "group" = 'Contract & Temporary' WHERE code IN ('contract', 'temporary_salaried');
                UPDATE tracker_agendasection SET "group" = 'Training'           WHERE code IN ('training');
                UPDATE tracker_agendasection SET "group" = 'Discipline & Health' WHERE code IN ('discipline_compliance', 'health_commission');
                UPDATE tracker_agendasection SET "group" = 'Claims & Severance' WHERE code IN ('medical_claim', 'partial_severance', 'resignation');
                UPDATE tracker_agendasection SET "group" = 'Other'              WHERE code IN ('other');
            """,
            reverse_sql="""
                UPDATE tracker_agendasection SET "group" = '';
            """,
        ),
    ]
