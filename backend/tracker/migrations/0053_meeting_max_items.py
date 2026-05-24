"""
Migration 0053 — Add max_items to Meeting.

The `max_items` field tracks the capacity of a commission sitting.
Agenda items beyond this limit should be deferred to the next meeting.
Defaults to 30 for all existing meetings.
"""
from django.db import migrations, models

from tracker.migration_utils import add_fields_if_missing, drop_columns_if_present


def add_max_items(apps, schema_editor):
    add_fields_if_missing(
        apps,
        schema_editor,
        "tracker",
        "Meeting",
        [
            (
                "max_items",
                models.PositiveIntegerField(
                    default=30,
                    help_text=(
                        "Maximum number of agenda items this meeting can accommodate. "
                        "Items beyond this limit should be deferred to the next meeting."
                    ),
                ),
            ),
        ],
    )


def remove_max_items(apps, schema_editor):
    table = apps.get_model("tracker", "Meeting")._meta.db_table
    drop_columns_if_present(schema_editor, table, ["max_items"])


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0051_update_submission_categories'),
    ]

    operations = [
        migrations.RunPython(add_max_items, remove_max_items),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
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
