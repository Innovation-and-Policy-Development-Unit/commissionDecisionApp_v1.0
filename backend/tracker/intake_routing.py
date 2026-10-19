"""
Receptionist intake routing.

Maps a submission's form type to the OPSC unit (``routed_unit``) whose Manager
should receive it for checklist review. Used when the Receptionist routes a
freshly-lodged (scanned + OCR'd) submission to the responsible Manager.

Routing is now driven by the ``routed_unit`` field on ``PSCFormType`` so new
form types can be configured in the admin without code changes.

The legacy ``FORM_TYPE_TO_ROUTED_UNIT`` dict is kept as a fallback for any
form types that existed before the ``routed_unit`` DB field was added.
"""

from __future__ import annotations

from .models import RoutedUnit

# Legacy fallback mapping (used if the DB field is blank on an existing form type).
# New form types should have ``PSCFormType.routed_unit`` set in the admin instead.
_LEGACY_FORM_TYPE_TO_ROUTED_UNIT: dict[str, str] = {
    "ORG-3.1": RoutedUnit.ODU,
    "PSC 2-1": RoutedUnit.ODU,
}


def routed_unit_for_form_type(form_type_code: str | None) -> str | None:
    """Return the routed unit for a form type code, or None if unmapped.

    Lookup order:
    1. ``PSCFormType.routed_unit`` DB field (admin-configurable).
    2. Legacy hardcoded fallback dict.
    """
    if not form_type_code:
        return None

    code = form_type_code.strip()

    # Primary: DB lookup
    try:
        from .models import PSCFormType
        ft = PSCFormType.objects.get(code=code)
        if ft.routed_unit:
            return ft.routed_unit
    except Exception:
        pass

    # Fallback: legacy mapping (case-insensitive then exact)
    return (
        _LEGACY_FORM_TYPE_TO_ROUTED_UNIT.get(code.upper())
        or _LEGACY_FORM_TYPE_TO_ROUTED_UNIT.get(code)
    )


# ── Intake route toggles (admin-configurable) ───────────────────────────────
SETTING_RECEPTIONIST_ENABLED = "INTAKE_RECEPTIONIST_ENABLED"
SETTING_HR_ENABLED = "INTAKE_HR_ENABLED"


def receptionist_intake_enabled() -> bool:
    """True if the Receptionist scan/upload/route intake is active."""
    from .models import SystemSetting
    return SystemSetting.get_bool(SETTING_RECEPTIONIST_ENABLED, default=True)


def hr_intake_enabled() -> bool:
    """True if direct ministry HR -> DG -> PSC submission is active."""
    from .models import SystemSetting
    return SystemSetting.get_bool(SETTING_HR_ENABLED, default=True)
