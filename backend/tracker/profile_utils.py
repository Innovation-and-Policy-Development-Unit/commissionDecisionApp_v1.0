"""Resolve PSC Profile rows for authenticated API users."""
from rest_framework.exceptions import PermissionDenied

from .models import Profile, Role

PROFILE_MISSING_MSG = (
    "User profile is not configured for Commission Decision App. "
    "Ask a PSC administrator to link your account to a role in Django Admin → PSC profiles."
)


def ensure_psc_profile(user):
    """
    Return the user's Profile.

    Django staff/superuser accounts created without a PSC profile row get an
    auto-created PSC Admin profile so list/detail APIs and RBAC stay consistent.
    """
    try:
        return user.psc_profile
    except Profile.DoesNotExist:
        if user.is_superuser or user.is_staff:
            profile, _ = Profile.objects.get_or_create(
                user=user,
                defaults={"role": Role.PSC_ADMIN},
            )
            return profile
        raise PermissionDenied(PROFILE_MISSING_MSG)


def user_has_psc_profile(user) -> bool:
    """True when the user may call profile-gated APIs."""
    if not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    try:
        user.psc_profile
        return True
    except Profile.DoesNotExist:
        return False
