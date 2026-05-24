import tracker.models
from django.db import migrations, models


def _existing_columns(schema_editor, table):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        return {
            col.name
            for col in connection.introspection.get_table_description(cursor, table)
        }


def add_signature_position_fields(apps, schema_editor):
    """Idempotent: only add columns missing from an older 0029 deploy."""
    model = apps.get_model("tracker", "DocumentSignature")
    table = model._meta.db_table
    existing = _existing_columns(schema_editor, table)

    fields = [
        (
            "position_x",
            models.FloatField(
                default=0.1,
                help_text="Left edge as fraction of canvas width.",
            ),
        ),
        (
            "position_y",
            models.FloatField(
                default=0.7,
                help_text="Top edge as fraction of canvas height.",
            ),
        ),
        (
            "sig_scale",
            models.FloatField(
                default=1.0,
                help_text="Scale applied to the signature image.",
            ),
        ),
        (
            "snapshot",
            models.ImageField(
                blank=True,
                null=True,
                help_text="Combined PDF-page + signature PNG export.",
                upload_to=tracker.models._signature_snapshot_path,
            ),
        ),
    ]

    for name, field in fields:
        if name in existing:
            continue
        field.set_attributes_from_name(name)
        schema_editor.add_field(model, field)


def remove_signature_position_fields(apps, schema_editor):
    model = apps.get_model("tracker", "DocumentSignature")
    table = model._meta.db_table
    existing = _existing_columns(schema_editor, table)

    for name in ("snapshot", "sig_scale", "position_y", "position_x"):
        if name not in existing:
            continue
        field = model._meta.get_field(name)
        schema_editor.remove_field(model, field)


class Migration(migrations.Migration):
    """
    Migration 0029 was applied before position_x/position_y/sig_scale/snapshot
    were added to DocumentSignature. This migration adds those columns safely
    when missing (idempotent on Postgres and SQLite).
    """

    dependencies = [
        ("tracker", "0030_user_signature"),
    ]

    operations = [
        migrations.RunPython(
            add_signature_position_fields,
            remove_signature_position_fields,
        ),
    ]
