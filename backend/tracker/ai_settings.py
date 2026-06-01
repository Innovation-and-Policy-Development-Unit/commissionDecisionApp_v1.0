"""
Admin-configurable toggles for optional AI features.

These let an administrator switch AI-backed helpers on/off from System Settings
without a redeploy — useful when the AI provider quota (API tokens) is exhausted.
Defaults keep existing behaviour (enabled) until an admin turns one off.
"""

from __future__ import annotations

# Pre-submit package completeness check (Haiku). When disabled, the "Validate
# package" tool is hidden and submitting/endorsing no longer requires it.
SETTING_PACKAGE_VALIDATION_ENABLED = "AI_PACKAGE_VALIDATION_ENABLED"

# AI checklist autofill (Haiku) — suggests which checklist items are present
# based on uploaded document text. When disabled, the "AI autofill" button is
# hidden and officers fill the checklist manually.
SETTING_CHECKLIST_AUTOFILL_ENABLED = "AI_CHECKLIST_AUTOFILL_ENABLED"


def package_validation_enabled() -> bool:
    """True if the AI pre-submit package validation feature is active."""
    from .ai.claude_client import ai_enabled
    from .models import SystemSetting

    return ai_enabled() and SystemSetting.get_bool(SETTING_PACKAGE_VALIDATION_ENABLED, default=True)


def checklist_autofill_enabled() -> bool:
    """True if the AI checklist autofill feature is active."""
    from .ai.claude_client import ai_enabled
    from .models import SystemSetting

    return ai_enabled() and SystemSetting.get_bool(SETTING_CHECKLIST_AUTOFILL_ENABLED, default=True)
