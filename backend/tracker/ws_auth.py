"""Django Channels auth middleware for the chat WebSocket.

The frontend only ever holds auth as a JWT Bearer header read from
localStorage (see api/client.js) — there is no session cookie for Channels'
stock cookie-based AuthMiddlewareStack to pick up. A browser WebSocket
handshake can't set custom headers either, so the access token is passed as
a query param instead (?token=<access>) and validated here the same way
DRF's JWTAuthentication would.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _get_user_from_token(token):
    from django.contrib.auth.models import User
    try:
        validated = AccessToken(token)
        return User.objects.get(pk=validated["user_id"], is_active=True)
    except (TokenError, KeyError, User.DoesNotExist):
        return AnonymousUser()


class JWTQueryAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        token = (parse_qs(query_string).get("token") or [None])[0]
        scope["user"] = await _get_user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)
