"""
Runtime-configurable django-axes thresholds.

``settings.AXES_FAILURE_LIMIT`` and ``settings.AXES_COOLOFF_TIME`` point at the
callables below (by dotted path) so the lockout policy can be changed from the
Admin → System configuration UI (stored in ``SystemSetting``) without a server
restart.  Environment variables provide the boot-time fallback.

NCSS 2030 access-control: 3 failed attempts → temporary lock; the cool-off here
is the *temporary* lock window.  Escalation to a permanent ("hard") lock is
handled in the login view (see ``TokenObtainPairView``).
"""
from __future__ import annotations

import os
from datetime import timedelta

# Boot-time fallbacks (used when the DB is unavailable, e.g. during migrate).
DEFAULT_FAILURE_LIMIT = int(os.getenv("AXES_FAILURE_LIMIT", "3"))
DEFAULT_COOLOFF_MINUTES = int(os.getenv("AXES_COOLOFF_MINUTES", "15"))


def _setting_int(key: str, default: int) -> int:
    """Read an int SystemSetting, swallowing any DB/availability error."""
    try:
        from .models import SystemSetting

        return SystemSetting.get_int(key, default)
    except Exception:
        return default


def current_failure_limit() -> int:
    """The active number of failed attempts before a (temporary) lock."""
    limit = _setting_int("AXES_FAILURE_LIMIT", DEFAULT_FAILURE_LIMIT)
    return limit if limit and limit > 0 else DEFAULT_FAILURE_LIMIT


def current_cooloff() -> timedelta:
    """The active temporary-lock cool-off window."""
    # Prefer an explicit minutes setting; fall back to a legacy hours setting.
    minutes = _setting_int("AXES_COOLOFF_MINUTES", 0)
    if minutes and minutes > 0:
        return timedelta(minutes=minutes)
    hours = _setting_int("AXES_COOLOFF_HOURS", 0)
    if hours and hours > 0:
        return timedelta(hours=hours)
    return timedelta(minutes=DEFAULT_COOLOFF_MINUTES)


# ── django-axes hooks ────────────────────────────────────────────────────────
# axes calls AXES_FAILURE_LIMIT as get_failure_limit(request, credentials) and
# AXES_COOLOFF_TIME as get_cool_off() — accept any args for forward-compat.
def failure_limit(*args, **kwargs) -> int:  # noqa: D401 - axes callable
    return current_failure_limit()


def cool_off(*args, **kwargs) -> timedelta:  # noqa: D401 - axes callable
    return current_cooloff()
