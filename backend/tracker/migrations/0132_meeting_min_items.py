"""
Migration 0132 — Add min_items to Meeting.

The `min_items` field is the floor that drives the Chairman's agenda-readiness
signal: a sitting is "ready to convene" once the number of agenda items reaches
this minimum. Complements `max_items` (the capacity ceiling, migration 0053).
Defaults to 5 for all existing meetings.
"""
from django.db import migrations, models

from tracker.migration_utils import add_fields_if_missing, drop_columns_if_present


def add_min_items(apps, schema_editor):
    add_fields_if_missing(
        apps,
        schema_editor,
        "tracker",
        "Meeting",
        [
            (
                "min_items",
                models.PositiveIntegerField(
                    default=5,
                    help_text=(
                        "Minimum number of agenda items needed before it is worth "
                        "convening the sitting. Drives the Chairman's agenda-readiness signal."
                    ),
                ),
            ),
        ],
    )


def remove_min_items(apps, schema_editor):
    table = apps.get_model("tracker", "Meeting")._meta.db_table
    drop_columns_if_present(schema_editor, table, ["min_items"])


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0131_seed_unit_report_templates'),
    ]

    operations = [
        migrations.RunPython(add_min_items, remove_min_items),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name='meeting',
                    name='min_items',
                    field=models.PositiveIntegerField(
                        default=5,
                        help_text=(
                            'Minimum number of agenda items needed before it is worth '
                            'convening the sitting. Drives the Chairman\'s agenda-readiness signal.'
                        ),
                    ),
                ),
            ],
        ),
    ]
