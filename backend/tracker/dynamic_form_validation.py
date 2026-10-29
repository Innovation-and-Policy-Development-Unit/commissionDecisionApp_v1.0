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
        # No Form Builder schema for this form type. This is expected for
        # "dedicated" forms (PSC 2-1, PSC 2-2, ORG-3.1) — bespoke React
        # components (PSCForm21Fields.jsx etc.) with hardcoded field keys
        # instead of admin-configured PSCFormField rows — so there's
        # nothing to validate against; let the save through rather than
        # rejecting every key as "unexpected".
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


def digitized_form_gap(submission) -> str | None:
    """Why this submission's digitized form is not ready to go to PSC, or None.

    Only for form types flagged is_digitized. The legacy PSC 3-7 form is stored
    elsewhere, so it is not checked here. A dedicated form with no Form Builder
    schema just needs to have been saved at all.
    """
    from .models import PSCFormResponse
    from .recall_window import is_practice

    form_type = PSCFormType.objects.filter(code=submission.form_type_code).first()
    if not form_type or not form_type.is_digitized or form_type.digitized_form_key == "psc_3_7":
        return None
    if is_practice(submission):  # training ministry: role-players do not fill in forms
        return None
    try:
        response = submission.dynamic_form_response
    except PSCFormResponse.DoesNotExist:
        return f"Complete and save the {form_type.name} (Digitized Form tab) before you validate or submit."
    errors = validate_dynamic_form_data(form_type, response.data)
    if errors:
        shown = "; ".join(errors[:3]) + (f" (+{len(errors) - 3} more)" if len(errors) > 3 else "")
        return f"The {form_type.name} is incomplete: {shown}"
    return None
