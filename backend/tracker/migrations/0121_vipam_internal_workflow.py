from django.db import migrations


class Migration(migrations.Migration):
    """
    Set up VIPAM as an internal-submission workflow:
    1. Create an INTERNAL FormCategory (if not already present).
    2. Assign VIPAM-Submission form type to that category.
    3. Mark the 'training' agenda section as is_special=True so it is hidden
       from the ministry HR lodge form (VIPAM staff submit this directly).
    """

    dependencies = [
        ('tracker', '0120_workflow_dg_approved_stage'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                -- 1. Ensure the INTERNAL form category exists
                INSERT INTO tracker_formcategory (code, name, psc_forms_summary, display_order)
                VALUES ('INTERNAL', 'Internal Submissions', 'Submissions created internally by OPSC units (VIPAM, CSU, ODU).', 999)
                ON CONFLICT (code) DO NOTHING;

                -- 2. Assign VIPAM-Submission to the INTERNAL category
                UPDATE tracker_pscformtype
                SET form_category_id = (SELECT id FROM tracker_formcategory WHERE code = 'INTERNAL')
                WHERE code = 'VIPAM-Submission';

                -- 3. Hide training section from ministry HR lodge form (VIPAM handles this)
                UPDATE tracker_agendasection
                SET is_special = true
                WHERE code = 'training';
            """,
            reverse_sql="""
                UPDATE tracker_agendasection SET is_special = false WHERE code = 'training';
                UPDATE tracker_pscformtype SET form_category_id = NULL WHERE code = 'VIPAM-Submission';
                DELETE FROM tracker_formcategory WHERE code = 'INTERNAL';
            """,
        ),
    ]
