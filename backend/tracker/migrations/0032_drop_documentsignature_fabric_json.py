from django.db import migrations


def _existing_columns(schema_editor, table):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        return {
            col.name
            for col in connection.introspection.get_table_description(cursor, table)
        }


def drop_fabric_json(apps, schema_editor):
    table = apps.get_model("tracker", "DocumentSignature")._meta.db_table
    if "fabric_json" not in _existing_columns(schema_editor, table):
        return
    qtable = schema_editor.quote_name(table)
    qcol = schema_editor.quote_name("fabric_json")
    schema_editor.execute(f"ALTER TABLE {qtable} DROP COLUMN {qcol}")


def add_fabric_json(apps, schema_editor):
    table = apps.get_model("tracker", "DocumentSignature")._meta.db_table
    if "fabric_json" in _existing_columns(schema_editor, table):
        return
    qn = schema_editor.quote_name
    schema_editor.execute(
        f"ALTER TABLE {qn(table)} ADD COLUMN {qn('fabric_json')} text NOT NULL DEFAULT ''"
    )


class Migration(migrations.Migration):
    """
    The original DocumentSignature table was created with a fabric_json NOT NULL
    column that was later removed from the model. Drop it so inserts can succeed.
  """

    dependencies = [
        ("tracker", "0031_add_signature_position_fields"),
    ]

    operations = [
        migrations.RunPython(drop_fabric_json, add_fabric_json),
    ]
