import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# get_asgi_application() must run before importing anything that touches
# Django models (routing.py imports the chat consumer, which imports
# tracker.models) — it populates the app registry.
django_asgi_app = get_asgi_application()

from config.routing import websocket_urlpatterns  # noqa: E402
from tracker.ws_auth import JWTQueryAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTQueryAuthMiddleware(URLRouter(websocket_urlpatterns)),
})
