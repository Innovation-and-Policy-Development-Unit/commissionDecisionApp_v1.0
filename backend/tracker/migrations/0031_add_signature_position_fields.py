from django.db import migrations


class Migration(migrations.Migration):
    """
    Migration 0029 was applied before position_x/position_y/sig_scale/snapshot
    were added to DocumentSignature. This migration adds those columns safely
    using IF NOT EXISTS so it is idempotent regardless of partial prior runs.
    """

    dependencies = [
        ("tracker", "0030_user_signature"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE tracker_documentsignature
                    ADD COLUMN IF NOT EXISTS position_x  double precision NOT NULL DEFAULT 0.1,
                    ADD COLUMN IF NOT EXISTS position_y  double precision NOT NULL DEFAULT 0.7,
                    ADD COLUMN IF NOT EXISTS sig_scale   double precision NOT NULL DEFAULT 1.0,
                    ADD COLUMN IF NOT EXISTS snapshot    varchar(100)     NULL;
            """,
            reverse_sql="""
                ALTER TABLE tracker_documentsignature
                    DROP COLUMN IF EXISTS position_x,
                    DROP COLUMN IF EXISTS position_y,
                    DROP COLUMN IF EXISTS sig_scale,
                    DROP COLUMN IF EXISTS snapshot;
            """,
        ),
    ]
