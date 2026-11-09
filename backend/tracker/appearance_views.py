"""Appearance: each user's theme choices, and the organisation default ("Everyone").

A user's own choices live on their Profile and follow them between devices. The organisation
default is one SystemSetting that applies to anyone who has not chosen for themselves. Only a PSC
Administrator (or a superuser) may change the default.
"""

from __future__ import annotations

import json

from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Role, SystemSetting

ORG_KEY = "ui_appearance_default"

PRESETS = ("psc-blue", "ocean", "violet", "emerald", "teal", "amber", "rose", "graphite")
CHOICES = {
    "preset": PRESETS,
    "mode": ("light", "dark", "system"),
    "density": ("comfortable", "compact"),
    "corners": ("sharp", "default", "round"),
    "font": ("system", "humanist", "serif", "readable", "mono"),
    "fontSize": ("small", "default", "large", "xlarge"),
}
FACTORY_DEFAULT = {
    "preset": "psc-blue", "mode": "light", "density": "comfortable",
    "corners": "default", "font": "system", "fontSize": "default",
}


def clean(data) -> dict:
    """Keep only known settings with known values."""
    if not isinstance(data, dict):
        return {}
    return {k: data[k] for k, allowed in CHOICES.items() if data.get(k) in allowed}


def org_default() -> dict:
    try:
        stored = clean(json.loads(SystemSetting.get_val(ORG_KEY, "") or "{}"))
    except ValueError:
        stored = {}
    return {**FACTORY_DEFAULT, **stored}


def _can_set_org(user) -> bool:
    if user.is_superuser:
        return True
    profile = getattr(user, "psc_profile", None)
    return bool(profile and profile.role == Role.PSC_ADMIN)


def _payload(user) -> dict:
    profile = getattr(user, "psc_profile", None)
    return {
        "org": org_default(),
        "user": clean(getattr(profile, "ui_preferences", {})),
        "can_set_org": _can_set_org(user),
    }


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def appearance(request):
    return Response(_payload(request.user))


@api_view(["PUT"])
@permission_classes([permissions.IsAuthenticated])
def appearance_me(request):
    """Replace the user's own choices; an empty body goes back to the organisation default."""
    from .profile_utils import ensure_psc_profile

    profile = ensure_psc_profile(request.user)
    profile.ui_preferences = clean(request.data)
    profile.save(update_fields=["ui_preferences"])
    return Response(_payload(request.user))


@api_view(["PUT"])
@permission_classes([permissions.IsAuthenticated])
def appearance_org(request):
    """Set the organisation default (administrators only)."""
    if not _can_set_org(request.user):
        return Response({"detail": "Only an administrator can change the organisation default."},
                        status=status.HTTP_403_FORBIDDEN)
    SystemSetting.objects.update_or_create(
        key=ORG_KEY,
        defaults={"value": json.dumps(clean(request.data)),
                  "description": "Organisation-wide Appearance default (theme, mode, density, corners, font)."},
    )
    return Response(_payload(request.user))
