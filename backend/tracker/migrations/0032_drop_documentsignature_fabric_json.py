from django.db import migrations


class Migration(migrations.Migration):
    """
    The original DocumentSignature table was created with a fabric_json NOT NULL
    column that was later removed from the model. Drop it so inserts can succeed.
    Uses IF EXISTS so the migration is safe to run even if the column is already gone.
    """

    dependencies = [
        ("tracker", "0031_add_signature_position_fields"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE tracker_documentsignature DROP COLUMN IF EXISTS fabric_json;",
            reverse_sql="ALTER TABLE tracker_documentsignature ADD COLUMN fabric_json text NOT NULL DEFAULT '';",
        ),
    ]
