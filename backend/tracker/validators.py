"""
Custom password validators for the PSC SCDMS.

PscPasswordComplexityValidator  — reads runtime policy from SystemSetting.
PscPasswordHistoryValidator     — checks PasswordHistory for recent reuse.

Both are called explicitly from change_password_view and SetPasswordSerializer
rather than being wired into AUTH_PASSWORD_VALIDATORS (which runs at import
time and cannot read DB settings).
"""
from django.core.exceptions import ValidationError
from django.contrib.auth.hashers import check_password

SPECIAL_CHARS = set(r'!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`\\')

PASSWORD_POLICY_KEYS = (
    "PASSWORD_MIN_LENGTH",
    "PASSWORD_REQUIRE_UPPERCASE",
    "PASSWORD_REQUIRE_LOWERCASE",
    "PASSWORD_REQUIRE_DIGITS",
    "PASSWORD_REQUIRE_SPECIAL",
    "PASSWORD_HISTORY_COUNT",
)


def get_policy():
    """Return the current password policy as a plain dict (safe to serialise)."""
    from .models import SystemSetting
    return {
        "min_length":        SystemSetting.get_int("PASSWORD_MIN_LENGTH", 8),
        "require_uppercase": SystemSetting.get_bool("PASSWORD_REQUIRE_UPPERCASE", False),
        "require_lowercase": SystemSetting.get_bool("PASSWORD_REQUIRE_LOWERCASE", False),
        "require_digits":    SystemSetting.get_bool("PASSWORD_REQUIRE_DIGITS", False),
        "require_special":   SystemSetting.get_bool("PASSWORD_REQUIRE_SPECIAL", False),
        "history_count":     SystemSetting.get_int("PASSWORD_HISTORY_COUNT", 5),
    }


def validate_complexity(password):
    """
    Run the complexity rules in get_policy() against *password*.
    Raises ValidationError with a list of all failing rules.
    """
    from .models import SystemSetting
    errors = []

    min_len = SystemSetting.get_int("PASSWORD_MIN_LENGTH", 8)
    if len(password) < min_len:
        errors.append(f"Password must be at least {min_len} characters long.")

    if SystemSetting.get_bool("PASSWORD_REQUIRE_UPPERCASE"):
        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter (A–Z).")

    if SystemSetting.get_bool("PASSWORD_REQUIRE_LOWERCASE"):
        if not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter (a–z).")

    if SystemSetting.get_bool("PASSWORD_REQUIRE_DIGITS"):
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit (0–9).")

    if SystemSetting.get_bool("PASSWORD_REQUIRE_SPECIAL"):
        if not any(c in SPECIAL_CHARS for c in password):
            errors.append(
                "Password must contain at least one special character (!@#$%^&* …)."
            )

    if errors:
        raise ValidationError(errors)


def validate_history(password, user):
    """
    Check that *password* has not been used in the last PASSWORD_HISTORY_COUNT
    passwords for *user*.  No-op if user is None or history_count is 0.
    """
    if user is None or not getattr(user, "pk", None):
        return
    from .models import SystemSetting, PasswordHistory
    history_count = SystemSetting.get_int("PASSWORD_HISTORY_COUNT", 5)
    if history_count <= 0:
        return
    recent = PasswordHistory.objects.filter(user=user).order_by("-created_at")[:history_count]
    for entry in recent:
        if check_password(password, entry.password_hash):
            n = history_count
            raise ValidationError(
                f"You cannot reuse any of your last {n} password{'s' if n != 1 else ''}."
            )


def record_password(user):
    """
    Save the user's *current* password hash to PasswordHistory, then trim
    the table to at most max(history_count, 20) entries for this user.
    Called *before* set_password() so the hash being stored is the old one.
    """
    from .models import SystemSetting, PasswordHistory
    PasswordHistory.objects.create(user=user, password_hash=user.password)
    keep = max(SystemSetting.get_int("PASSWORD_HISTORY_COUNT", 5), 20)
    old_ids = (
        PasswordHistory.objects.filter(user=user)
        .order_by("-created_at")
        .values_list("id", flat=True)[keep:]
    )
    if old_ids:
        PasswordHistory.objects.filter(id__in=list(old_ids)).delete()
