from rest_framework_simplejwt.views import TokenRefreshView

from .auth import REFRESH_COOKIE


class CookieTokenRefreshView(TokenRefreshView):
    """Token refresh that falls back to the HttpOnly refresh cookie when the
    request body carries no refresh token."""

    def get_serializer(self, *args, **kwargs):
        data = kwargs.get("data")
        if data is not None and not data.get("refresh"):
            cookie = self.request.COOKIES.get(REFRESH_COOKIE)
            if cookie:
                kwargs["data"] = {"refresh": cookie}
        return super().get_serializer(*args, **kwargs)
