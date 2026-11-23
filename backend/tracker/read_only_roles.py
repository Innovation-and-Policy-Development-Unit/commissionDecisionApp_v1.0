"""Roles that may look but not touch.

The Deputy Secretary sees what the Secretary sees but changes nothing, with one exception: they
may submit the draft agenda to the Chairman. Rather than trust every one of the many Secretary
checks in the views to exclude them, the API refuses any request that changes data for such a
role unless it is on the short list below. That makes "view only" hold even for an endpoint
that only checks "is logged in".

The check runs where the user is first identified (see ``tracker.auth``), so it covers every
DRF view, JWT cookie or API key.
"""

from __future__ import annotations

import re

from rest_framework import exceptions

from .models import Role

READ_ONLY_ROLES = frozenset({Role.DEPUTY_SECRETARY})

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

# Paths (after /api/) a read-only role may still send changes to: signing in and out and their
# own account, their notifications, and the one action they were given.
_ALLOWED_WRITES = (
    re.compile(r"^auth/"),                              # token, logout, MFA, session PIN, password reset
    re.compile(r"^me/"),                                # own profile and password
    re.compile(r"^appearance/me/"),                     # own display settings
    re.compile(r"^push-subscriptions/"),                # own browser notifications
    re.compile(r"^notifications/"),                     # mark own notifications read
    re.compile(r"^meetings/\d+/submit-to-chairman/$"),  # the Deputy Secretary's one action
)

MESSAGE = (
    "The Deputy Secretary role is view-only. Ask the Secretary to do this, "
    "or to submit the agenda to the Chairman yourself."
)


def _api_path(path: str) -> str:
    path = path or ""
    return path[len("/api/"):] if path.startswith("/api/") else path.lstrip("/")


def enforce_read_only(request, user) -> None:
    """Raise PermissionDenied if ``user`` has a read-only role and this request changes data."""
    if request.method in SAFE_METHODS or not getattr(user, "is_authenticated", False):
        return
    try:
        role = user.psc_profile.role
    except Exception:
        return
    if role not in READ_ONLY_ROLES:
        return
    path = _api_path(request.path)
    if any(rule.match(path) for rule in _ALLOWED_WRITES):
        return
    raise exceptions.PermissionDenied(MESSAGE)
