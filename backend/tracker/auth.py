from rest_framework import authentication, exceptions
from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from .models import APIKey
from .read_only_roles import enforce_read_only

ACCESS_COOKIE = "scdms_access"
REFRESH_COOKIE = "scdms_refresh"
CSRF_READABLE_COOKIE = "scdms_csrf"  # page-readable copy of the CSRF token


class CookieJWTAuthentication(JWTAuthentication):
    """JWT auth that accepts the token from an ``Authorization: Bearer`` header
    (API clients) or, failing that, from the HttpOnly access cookie set at login
    (the web app). Cookie-based requests get the same CSRF check Django's session
    auth uses, so a cross-site page cannot ride the cookie."""

    def authenticate(self, request, enforce_csrf=True):
        header = self.get_header(request)
        from_cookie = False
        if header is not None:
            raw = self.get_raw_token(header)
        else:
            raw = request.COOKIES.get(ACCESS_COOKIE)
            from_cookie = True
        if not raw:
            return None
        validated = self.get_validated_token(raw)
        user = self.get_user(validated)
        if from_cookie and enforce_csrf:
            authentication.SessionAuthentication().enforce_csrf(request)
        enforce_read_only(request, user)  # view-only roles (Deputy Secretary)
        return user, validated


class LenientJWTAuthentication(CookieJWTAuthentication):
    """JWTAuthentication that treats an invalid/expired/blacklisted Bearer
    token the same as no token at all (returns None) instead of raising.

    For pre-auth / re-auth entry points (login, TOTP setup, session-PIN
    unlock, password reset) — the client's browser may still have a stale
    access token in localStorage from a previous session (e.g. one just
    force-logged-out by the session cap). These endpoints don't need it and
    shouldn't be broken by it: without this, DRF's default JWTAuthentication
    raises before the view's own AllowAny/username+password logic ever runs,
    surfacing a raw "Given token not valid for any token type" error instead
    of the endpoint's actual (often more graceful) behavior.
    """
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError, exceptions.PermissionDenied):
            # PermissionDenied = failed CSRF check on cookie credentials: treat
            # the request as anonymous rather than failing the login step.
            return None


class APIKeyAuthentication(authentication.BaseAuthentication):
    """
    Custom authentication for API Keys.
    Expects header: X-API-Key: psc_...
    """
    def authenticate_header(self, request):
        # Without this, DRF's exception handler has no WWW-Authenticate header
        # to fall back on when JWTAuthentication (listed after this class in
        # DEFAULT_AUTHENTICATION_CLASSES) rejects an expired/invalid Bearer
        # token, and downgrades what should be a 401 to a 403 — which the
        # frontend's refresh-and-retry logic only ever triggers on 401.
        return 'Bearer'

    def authenticate(self, request):
        key_header = request.META.get("HTTP_X_API_KEY")
        if not key_header:
            return None

        try:
            api_key = APIKey.objects.select_related("user").get(key=key_header, is_active=True)
        except APIKey.DoesNotExist:
            raise exceptions.AuthenticationFailed("Invalid or inactive API key.")

        # Update last used timestamp
        api_key.last_used_at = timezone.now()
        api_key.save(update_fields=["last_used_at"])

        enforce_read_only(request, api_key.user)
        return (api_key.user, None)
