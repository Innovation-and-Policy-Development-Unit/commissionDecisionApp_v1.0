"""
Receptionist intake routing.

Maps a submission's form type to the OPSC unit (``routed_unit``) whose Manager
should receive it for checklist review. Used when the Receptionist routes a
freshly-lodged (scanned + OCR'd) submission to the responsible Manager.

This is intentionally a simple, code-level mapping so it is easy to audit and
extend. Keys are PSC form type codes (``Submission.form_type_code``); values are
``RoutedUnit`` codes. Form types not listed here have no automatic routing —
the Receptionist must set ``routed_unit`` manually at intake.
"""

from __future__ import annotations

from .models import RoutedUnit

# Form type code -> routed unit. Codes are matched case-insensitively.
FORM_TYPE_TO_ROUTED_UNIT: dict[str, str] = {
    # Organisation Restructure / Establishment Variation -> ODU
    "ORG-3.1": RoutedUnit.ODU,
    "PSC 2-1": RoutedUnit.ODU,
}


def routed_unit_for_form_type(form_type_code: str | None) -> str | None:
    """Return the routed unit for a form type code, or None if unmapped."""
    if not form_type_code:
        return None
    return FORM_TYPE_TO_ROUTED_UNIT.get(form_type_code.strip().upper()) or \
        FORM_TYPE_TO_ROUTED_UNIT.get(form_type_code.strip())


# ── Intake route toggles (admin-configurable) ───────────────────────────────
# Which submission intake routes are active. Both default to enabled so existing
# behaviour is unchanged until an admin turns one off in System Settings.
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
