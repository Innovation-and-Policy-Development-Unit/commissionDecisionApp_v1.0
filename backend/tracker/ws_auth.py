"""Django Channels auth middleware for the WebSocket endpoints.

The web app authenticates with an HttpOnly access cookie (see
tracker.auth.CookieJWTAuthentication); the browser sends it automatically on
the WebSocket handshake. Because a cookie is also sent when a *different* site
opens the socket, a cookie login is only accepted when the handshake's Origin
matches this site (guards against cross-site WebSocket hijacking).

A ``?token=<access>`` query parameter is still accepted for non-browser
clients and older sessions.
"""
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlparse

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http.request import validate_host
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .auth import ACCESS_COOKIE


@database_sync_to_async
def _get_user_from_token(token):
    from django.contrib.auth.models import User
    try:
        validated = AccessToken(token)
        return User.objects.get(pk=validated["user_id"], is_active=True)
    except (TokenError, KeyError, User.DoesNotExist):
        return AnonymousUser()


def _headers(scope):
    return {k.decode("latin1").lower(): v.decode("latin1") for k, v in scope.get("headers", [])}


def _cookie_token(scope):
    headers = _headers(scope)
    origin = headers.get("origin", "")
    host = urlparse(origin).hostname if origin else None
    if not host or not validate_host(host, settings.ALLOWED_HOSTS):
        return None
    jar = SimpleCookie()
    try:
        jar.load(headers.get("cookie", ""))
    except Exception:
        return None
    morsel = jar.get(ACCESS_COOKIE)
    return morsel.value if morsel else None


class JWTQueryAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        token = (parse_qs(query_string).get("token") or [None])[0] or _cookie_token(scope)
        scope["user"] = await _get_user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)
