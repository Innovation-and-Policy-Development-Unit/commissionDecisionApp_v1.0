from __future__ import annotations

import os

from django.http import JsonResponse

from .audit import log_action
from .models import AuditLog


# Default Content-Security-Policy. Strict by default (self-only scripts), but
# allows inline styles which the Django admin and DRF browsable API rely on.
# Override wholesale with the CONTENT_SECURITY_POLICY env var if needed.
_DEFAULT_CSP = (
    "default-src 'self'; "
    "base-uri 'self'; "
    "object-src 'none'; "
    "frame-ancestors 'none'; "
    "img-src 'self' data: blob:; "
    "font-src 'self' data:; "
    "style-src 'self' 'unsafe-inline'; "
    "script-src 'self'; "
    "connect-src 'self'; "
    "form-action 'self'"
)


class ContentSecurityPolicyMiddleware:
    """
    Emit a Content-Security-Policy header on every response (NCSS 2030 / OWASP
    XSS defence-in-depth). Dependency-free.

    Env controls:
      CSP_ENABLED               "false" to disable entirely (default on)
      CONTENT_SECURITY_POLICY   full policy string override
      CSP_REPORT_ONLY           "true" to send Report-Only (observe, don't block)
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = os.getenv("CSP_ENABLED", "true").lower() in ("1", "true", "yes")
        self.policy = (os.getenv("CONTENT_SECURITY_POLICY", "") or _DEFAULT_CSP).strip()
        self.report_only = os.getenv("CSP_REPORT_ONLY", "false").lower() in ("1", "true", "yes")
        self.header = (
            "Content-Security-Policy-Report-Only"
            if self.report_only
            else "Content-Security-Policy"
        )

    def __call__(self, request):
        response = self.get_response(request)
        if self.enabled and self.header not in response:
            response[self.header] = self.policy
        return response


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
        if (not user or not user.is_authenticated) and (
            request.META.get("HTTP_AUTHORIZATION", "").startswith("Bearer ")
            or request.COOKIES.get("scdms_access")
        ):
            try:
                from .auth import CookieJWTAuthentication

                # CSRF is enforced later by DRF; this lookup only decides whether
                # the forced-password-change gate applies.
                auth_result = CookieJWTAuthentication().authenticate(request, enforce_csrf=False)
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



class AuthCookieMiddleware:
    """Keeps login tokens out of page JavaScript.

    For browser requests that send ``X-Auth-Mode: cookie``, any ``access`` /
    ``refresh`` tokens in a successful JSON response are moved into HttpOnly
    cookies and removed from the body; logout (and a rejected refresh) clears
    them. Other clients, and requests without the header, are untouched.
    Must sit after CsrfViewMiddleware so the CSRF cookie is issued with them.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path or ""
        if request.META.get("HTTP_X_AUTH_MODE") != "cookie" or not path.startswith("/api/"):
            return response
        if getattr(response, "streaming", False):
            return response

        if path.rstrip("/").endswith("/auth/logout"):
            self._clear(response)
            return response
        if path.rstrip("/").endswith("/auth/token/refresh") and response.status_code in (400, 401):
            self._clear(response)
            return response

        if not (200 <= response.status_code < 300) or "application/json" not in response.get("Content-Type", ""):
            return response
        import json

        try:
            data = json.loads(response.content)
        except ValueError:
            return response
        if not isinstance(data, dict) or "access" not in data:
            return response

        from django.middleware.csrf import get_token

        self._set(response, data.pop("access"), data.pop("refresh", None))
        data["session_started"] = True
        # Django's own csrftoken cookie is HttpOnly, so also hand the page a
        # readable copy of the (non-secret) CSRF token to send as X-CSRFToken.
        # Calling get_token also makes CsrfViewMiddleware issue the real cookie.
        self._set_csrf(response, get_token(request))
        response.content = json.dumps(data).encode()
        response["Content-Length"] = str(len(response.content))
        return response

    @staticmethod
    def _cookie_args():
        from django.conf import settings

        return {
            "secure": settings.AUTH_COOKIE_SECURE,
            "httponly": True,
            "samesite": settings.AUTH_COOKIE_SAMESITE,
        }

    def _set(self, response, access, refresh):
        from django.conf import settings

        from .auth import ACCESS_COOKIE, REFRESH_COOKIE

        sj = settings.SIMPLE_JWT
        response.set_cookie(
            ACCESS_COOKIE, access, max_age=int(sj["ACCESS_TOKEN_LIFETIME"].total_seconds()),
            path="/", **self._cookie_args(),
        )
        if refresh:
            response.set_cookie(
                REFRESH_COOKIE, refresh, max_age=int(sj["REFRESH_TOKEN_LIFETIME"].total_seconds()),
                path="/api/auth/", **self._cookie_args(),
            )

    def _set_csrf(self, response, token):
        from django.conf import settings

        from .auth import CSRF_READABLE_COOKIE

        response.set_cookie(
            CSRF_READABLE_COOKIE, token,
            max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
            path="/", secure=settings.AUTH_COOKIE_SECURE, httponly=False,
            samesite=settings.AUTH_COOKIE_SAMESITE,
        )

    @staticmethod
    def _clear(response):
        from django.conf import settings

        from .auth import ACCESS_COOKIE, CSRF_READABLE_COOKIE, REFRESH_COOKIE

        response.delete_cookie(CSRF_READABLE_COOKIE, path="/", samesite=settings.AUTH_COOKIE_SAMESITE)
        response.delete_cookie(ACCESS_COOKIE, path="/", samesite=settings.AUTH_COOKIE_SAMESITE)
        response.delete_cookie(REFRESH_COOKIE, path="/api/auth/", samesite=settings.AUTH_COOKIE_SAMESITE)
