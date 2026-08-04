from rest_framework import authentication, exceptions
from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from .models import APIKey


class LenientJWTAuthentication(JWTAuthentication):
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
        except (InvalidToken, TokenError):
            return None


class APIKeyAuthentication(authentication.BaseAuthentication):
    """
    Custom authentication for API Keys.
    Expects header: X-API-Key: psc_...
    """
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

        return (api_key.user, None)
