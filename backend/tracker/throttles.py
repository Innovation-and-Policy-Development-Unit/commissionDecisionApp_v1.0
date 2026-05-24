"""
Custom DRF throttle classes for sensitive endpoints.
Rates are configured in settings.py → REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class OTPRequestThrottle(AnonRateThrottle):
    """Limit OTP generation attempts per IP — prevents username enumeration DoS."""
    scope = 'otp_request'


class OTPVerifyThrottle(AnonRateThrottle):
    """Limit OTP verification attempts per IP — prevents 6-digit brute force."""
    scope = 'otp_verify'


class PasswordResetThrottle(AnonRateThrottle):
    """Limit password-reset requests per IP — prevents email flooding."""
    scope = 'password_reset'


class PasswordChangeThrottle(UserRateThrottle):
    """Limit self-service password changes per authenticated user."""
    scope = 'password_change'


class SubmissionCreateThrottle(UserRateThrottle):
    """Limit submission creation per authenticated user — prevents spam."""
    scope = 'submission_create'


class FeedbackCreateThrottle(UserRateThrottle):
    """Limit feedback submission per authenticated user — prevents spam."""
    scope = 'feedback_create'


class SessionPinVerifyThrottle(AnonRateThrottle):
    """Limit PIN verification attempts per IP — prevents 5-digit brute force."""
    scope = 'session_pin_verify'


class StaffChatThrottle(UserRateThrottle):
    """Limit Staff Assistant messages per user — controls Claude API cost."""
    scope = 'staff_chat'
