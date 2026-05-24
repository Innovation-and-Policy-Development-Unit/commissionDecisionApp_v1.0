"""Helpers for idempotent migrations on SQLite and PostgreSQL."""


def existing_columns(schema_editor, table):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        return {
            col.name
            for col in connection.introspection.get_table_description(cursor, table)
        }


def add_fields_if_missing(apps, schema_editor, app_label, model_name, field_defs):
    """
    field_defs: list of (field_name, models.Field instance)
    """
    model = apps.get_model(app_label, model_name)
    table = model._meta.db_table
    present = existing_columns(schema_editor, table)

    for name, field in field_defs:
        if name in present:
            continue
        field.set_attributes_from_name(name)
        schema_editor.add_field(model, field)


def drop_columns_if_present(schema_editor, table, column_names):
    present = existing_columns(schema_editor, table)
    qtable = schema_editor.quote_name(table)
    for name in column_names:
        if name not in present:
            continue
        qcol = schema_editor.quote_name(name)
        schema_editor.execute(f"ALTER TABLE {qtable} DROP COLUMN {qcol}")
