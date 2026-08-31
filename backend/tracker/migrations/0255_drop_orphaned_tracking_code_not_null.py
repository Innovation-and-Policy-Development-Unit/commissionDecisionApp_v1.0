"""
Migration 0255 — relax tracker_submission.tracking_code's NOT NULL constraint.

`tracking_code` is a DB column with no corresponding field anywhere in the
current Submission model. It was added by a migration from an abandoned
branch (a "second secret" for the public /track lookup, never merged into
main — main's /track endpoint only ever used reference_number) that was at
some point applied directly against the production database outside the
normal deploy pipeline. The column's NOT NULL constraint has been silently
breaking every submission creation (POST /api/submissions/ 500s with
`NotNullViolation: null value in column "tracking_code"`) ever since,
because current code never supplies a value for a column it doesn't know
exists.

This only drops the NOT NULL constraint — existing tracking_code values
(and the unique index) are left untouched in case anything external still
relies on a previously-issued code; new rows simply get NULL, which the
unique index/constraint permits without conflict.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0254_retry_pending_cloud_backups"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE tracker_submission ALTER COLUMN tracking_code DROP NOT NULL;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
