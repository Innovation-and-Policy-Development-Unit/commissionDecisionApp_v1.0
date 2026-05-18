from rest_framework import authentication, exceptions
from django.utils import timezone
from .models import APIKey

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
