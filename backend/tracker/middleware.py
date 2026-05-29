from __future__ import annotations

from django.http import JsonResponse

from .audit import log_action
from .models import AuditLog


class ForcePasswordChangeMiddleware:
    """
    Hard API guard: when a user is flagged for forced password change,
    block non-password endpoints until they update their password.
    """

    # Endpoints required to complete password rotation/session cleanup.
    ALLOWED_PATHS = {
        "/api/me/",
        "/api/me/change-password/",
        "/api/auth/password-policy/",
        "/api/auth/password-reset/request/",
        "/api/auth/password-reset/confirm/",
        "/api/auth/logout/",
        "/api/auth/token/refresh/",
        "/api/auth/session-pin/verify/",
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path or ""
        if not path.startswith("/api/"):
            return self.get_response(request)

        user = getattr(request, "user", None)
        if (not user or not user.is_authenticated) and request.META.get("HTTP_AUTHORIZATION", "").startswith("Bearer "):
            try:
                from rest_framework_simplejwt.authentication import JWTAuthentication

                auth_result = JWTAuthentication().authenticate(request)
                if auth_result:
                    user, _ = auth_result
                    request.user = user
            except Exception:
                user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return self.get_response(request)

        try:
            profile = user.psc_profile
        except Exception:
            return self.get_response(request)

        if not getattr(profile, "force_password_change", False):
            return self.get_response(request)

        if path in self.ALLOWED_PATHS:
            # Keep /api/me/ read-only while forced change is active.
            if path == "/api/me/" and request.method.upper() != "GET":
                return JsonResponse(
                    {
                        "detail": "Password change required before updating profile.",
                        "password_change_required": True,
                    },
                    status=403,
                )
            return self.get_response(request)

        log_action(
            request,
            AuditLog.Action.PASSWORD_CHANGE,
            resource_type="User",
            resource_id=user.id,
            resource_label=user.username,
            description=f"Blocked API access until password change: {path}",
            extra_data={"path": path, "method": request.method, "reason": "force_password_change"},
        )
        return JsonResponse(
            {
                "detail": "Password change required before accessing this endpoint.",
                "password_change_required": True,
            },
            status=403,
        )

