"""
Custom DRF throttle classes for sensitive endpoints.
Rates are configured in settings.py → REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from config.client_ip import axes_client_ip


class _ClientIPThrottle(AnonRateThrottle):
    """Anonymous throttle keyed by the real client IP (rightmost non-proxy entry of
    X-Forwarded-For — the same resolver the lockout uses), not the raw header."""

    def get_ident(self, request):
        return axes_client_ip(request) or super().get_ident(request)


class _AccountScopedThrottle(_ClientIPThrottle):
    """Anonymous throttle with one bucket per (client IP, account named in the request).

    Ministry offices share one public IP, so a per-IP limit on sign-in steps made a
    morning rush lock colleagues out of each other's logins. Guesses against one account
    are still capped; a separate, much higher per-IP limit stops one address spraying
    many accounts.
    """

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return None
        ident = self.get_ident(request)
        try:
            who = str(request.data.get("username") or "").strip().lower()[:150]
        except Exception:  # noqa: BLE001 — unparseable body: fall back to the IP bucket
            who = ""
        return self.cache_format % {"scope": self.scope, "ident": f"{ident}|{who}" if who else ident}


class OTPRequestThrottle(AnonRateThrottle):
    """Limit OTP generation attempts per IP — prevents username enumeration DoS."""
    scope = 'otp_request'


class OTPVerifyThrottle(_AccountScopedThrottle):
    """Limit emailed-code verification per (IP, account) — prevents 6-digit brute force
    without one ministry's shared office IP locking colleagues out."""
    scope = 'otp_verify'


class OTPVerifyIPThrottle(_ClientIPThrottle):
    """Looser per-IP ceiling on code verification — stops one address spraying accounts."""
    scope = 'otp_verify_ip'


class PasswordResetThrottle(AnonRateThrottle):
    """Limit password-reset requests per IP — prevents email flooding."""
    scope = 'password_reset'


class PinResetThrottle(AnonRateThrottle):
    """Limit PIN-reset requests per IP — prevents email flooding."""
    scope = 'pin_reset'


class PasswordChangeThrottle(UserRateThrottle):
    """Limit self-service password changes per authenticated user."""
    scope = 'password_change'


class SubmissionCreateThrottle(UserRateThrottle):
    """Limit submission creation per authenticated user — prevents spam."""
    scope = 'submission_create'


class FeedbackCreateThrottle(UserRateThrottle):
    """Limit feedback submission per authenticated user — prevents spam."""
    scope = 'feedback_create'


class SessionPinVerifyThrottle(_AccountScopedThrottle):
    """Limit PIN verification attempts per IP — prevents 5-digit brute force."""
    scope = 'session_pin_verify'


class SessionPinVerifyIPThrottle(_ClientIPThrottle):
    """Looser per-IP ceiling on PIN / password confirmation attempts."""
    scope = 'session_pin_verify_ip'


class StaffChatThrottle(UserRateThrottle):
    """Limit Staff Assistant messages per user — controls Claude API cost."""
    scope = 'staff_chat'


class AiAnalysisTriggerThrottle(UserRateThrottle):
    """Limit AI analysis triggers (duplicate/risk/outcome/NOA/letter) per user —
    each call re-runs the Gemini API even on an already-processed submission,
    so this controls both abuse and cost."""
    scope = 'ai_analysis_trigger'


class SubmissionTrackThrottle(AnonRateThrottle):
    """Limit public submission-tracking lookups per IP — prevents reference-number
    enumeration on the unauthenticated track-my-submission portal."""
    scope = 'submission_track'


class DGApprovalThrottle(AnonRateThrottle):
    """Limit the Director-General's public approval-link requests per IP — slows token
    guessing on the unauthenticated approval pages (the tokens are also 256-bit)."""
    scope = 'dg_approval'


class BackupRestoreThrottle(UserRateThrottle):
    """Limit database-restore attempts per admin user — a destructive,
    whole-database-overwriting action that should never be high-frequency."""
    scope = 'backup_restore'
