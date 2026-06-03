from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0116_data_integrity_backfill'),
    ]

    operations = [
        # Rename structure_amendment → restructure, update label
        migrations.RunSQL(
            sql="""
                UPDATE tracker_agendasection
                SET code = 'restructure',
                    label = 'Restructure / Structure Amendment',
                    display_order = 60
                WHERE code = 'structure_amendment';
            """,
            reverse_sql="""
                UPDATE tracker_agendasection
                SET code = 'structure_amendment',
                    label = 'Structure / Amendment / Anomalies',
                    display_order = 60
                WHERE code = 'restructure';
            """,
        ),
        # Add anomalies as a separate section (no digitized form linked yet)
        migrations.RunSQL(
            sql="""
                INSERT INTO tracker_agendasection
                    (code, label, display_order, is_special, is_active, receiver_roles, digitized_form_id, created_at, updated_at)
                VALUES
                    ('anomalies', 'Anomalies', 65, false, true, '["odu_manager"]', NULL, NOW(), NOW())
                ON CONFLICT (code) DO NOTHING;
            """,
            reverse_sql="""
                DELETE FROM tracker_agendasection WHERE code = 'anomalies';
            """,
        ),
    ]
