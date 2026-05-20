"""
Migration 0053 — Add max_items to Meeting.

The `max_items` field tracks the capacity of a commission sitting.
Agenda items beyond this limit should be deferred to the next meeting.
Defaults to 30 for all existing meetings.

NOTE: Uses SeparateDatabaseAndState because the column may already exist
in the database from a prior manual migration or earlier session.
The state operation keeps Django's migration graph consistent; the
database operation is a no-op (column is created only if absent).
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0051_update_submission_categories'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # Only touch the DB if the column isn't already there.
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE tracker_meeting
                        ADD COLUMN IF NOT EXISTS max_items integer NOT NULL DEFAULT 30;
                    """,
                    reverse_sql="""
                        ALTER TABLE tracker_meeting
                        DROP COLUMN IF EXISTS max_items;
                    """,
                ),
            ],
            # Always update Django's internal state so the ORM knows about
            # the field regardless of whether the SQL ran.
            state_operations=[
                migrations.AddField(
                    model_name='meeting',
                    name='max_items',
                    field=models.PositiveIntegerField(
                        default=30,
                        help_text=(
                            'Maximum number of agenda items this meeting can accommodate. '
                            'Items beyond this limit should be deferred to the next meeting.'
                        ),
                    ),
                ),
            ],
        ),
    ]
