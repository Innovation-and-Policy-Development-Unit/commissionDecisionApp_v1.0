"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView


def root(_request):
    return JsonResponse(
        {
            "service": "Commission Decision App API",
            "version": "1.0.0",
            "endpoints": {
                "api": "/api/",
                "admin": "/admin/",
                "obtain_token": "/api/auth/token/",
                "docs": "/api/docs/",
                "schema": "/api/schema/",
            },
            "note": "There is no HTML homepage at /. Use /api/ for the REST API or /admin/ for Django admin.",
            "ui": "With Docker Compose, the React app is served at http://localhost:8080 (same origin /api via nginx).",
        }
    )


def health(_request):
    from django.db import connection
    from django.db.utils import OperationalError
    db_ok = True
    try:
        connection.ensure_connection()
    except OperationalError:
        db_ok = False
    redis_ok = True
    redis_error = None
    try:
        import redis
        r = redis.Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=2)
        r.ping()
    except ImportError:
        redis_ok = False
        redis_error = "Redis module not found"
    except Exception as e:
        redis_ok = False
        redis_error = str(e)
    status = 200 if db_ok else 503
    return JsonResponse(
        {
            "status": "healthy" if status == 200 else "unhealthy",
            "database": db_ok,
            "redis": redis_ok,
            "redis_error": redis_error
        },
        status=status,
    )


urlpatterns = [
    path("", root),
    path("health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/", include("tracker.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
