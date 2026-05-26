"""Validate dynamic form response payloads against PSCFormField definitions."""

from __future__ import annotations

from .models import PSCFormField, PSCFormType

_SECTION_ONLY = {"section_header"}


def validate_dynamic_form_data(form_type: PSCFormType, data) -> list[str]:
    """
    Return human-readable error messages. Empty list means valid.
    Keys must match field_key values defined for form_type; required fields must be present.
    """
    if data is None:
        data = {}
    if not isinstance(data, dict):
        return ["data must be a JSON object mapping field_key to value."]

    fields = list(
        PSCFormField.objects.filter(form_type=form_type).exclude(
            field_type__in=_SECTION_ONLY
        )
    )
    if not fields:
        if data:
            return [
                f"No input fields are configured for Form {form_type.code}; "
                "remove unexpected keys or configure form fields in the Form Builder."
            ]
        return []

    allowed = {f.field_key: f for f in fields}
    errors: list[str] = []

    for key in data:
        if key not in allowed:
            errors.append(f"Field '{key}' does not exist for Form {form_type.code}.")

    for field in fields:
        if not field.is_required:
            continue
        if field.field_key not in data:
            errors.append(f"Field '{field.field_key}' is required for Form {form_type.code}.")
            continue
        value = data[field.field_key]
        if field.field_type == "checkbox":
            if not isinstance(value, bool):
                errors.append(
                    f"Field '{field.field_key}' must be a boolean for Form {form_type.code}."
                )
        elif value is None or value == "":
            errors.append(f"Field '{field.field_key}' is required for Form {form_type.code}.")

    return errors
