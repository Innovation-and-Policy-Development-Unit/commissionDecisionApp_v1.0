"""
Redis-backed API response caching for read-mostly reference endpoints.

Uses versioned key namespaces so invalidation does not require delete_pattern.
Celery should use Redis DB 0; Django cache uses DB 1 (see config.settings.CACHES).
"""

from __future__ import annotations

import hashlib
import json

from django.conf import settings
from django.core.cache import cache
from rest_framework.response import Response


def cache_enabled() -> bool:
    return getattr(settings, "CACHE_ENABLED", True)


def _query_fingerprint(request) -> str:
    qp = tuple(sorted((k, v) for k, v in request.query_params.items()))
    raw = json.dumps(qp, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _user_scope(request) -> str:
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return "anon"
    uid = request.user.pk
    try:
        profile = request.user.psc_profile
        return f"u{uid}:r{profile.role}:m{profile.ministry_id or 0}"
    except Exception:
        return f"u{uid}:norole"


def bump_cache_namespace(namespace: str) -> int:
    key = f"scdms:ver:{namespace}"
    try:
        return cache.incr(key)
    except ValueError:
        cache.set(key, 2, timeout=None)
        return 2


def invalidate_ref_groups(*namespaces: str) -> None:
    for ns in namespaces:
        bump_cache_namespace(ns)


# Reference data namespaces invalidated together on org-structure writes.
ORG_REF_NAMESPACES = ("ministries", "departments", "units")
FORM_REF_NAMESPACES = ("form-categories", "form-types", "form-fields", "required-documents")


def ref_cache_key(namespace: str, request, *, action: str, lookup: str | None = None) -> str:
    ver = cache.get(f"scdms:ver:{namespace}", 1)
    parts = [
        "scdms",
        namespace,
        f"v{ver}",
        action,
        _user_scope(request),
        _query_fingerprint(request),
    ]
    if lookup is not None:
        parts.append(str(lookup))
    return ":".join(parts)


def submission_bootstrap_cache_key(submission_id: int, request) -> str:
    ver = cache.get(f"scdms:ver:submission:{submission_id}", 1)
    return ":".join(
        [
            "scdms",
            "submission",
            str(submission_id),
            "bootstrap",
            f"v{ver}",
            _user_scope(request),
        ]
    )


def invalidate_submission(submission_id: int) -> None:
    bump_cache_namespace(f"submission:{submission_id}")


def password_policy_cache_key() -> str:
    ver = cache.get("scdms:ver:password-policy", 1)
    return f"scdms:password-policy:v{ver}"


def invalidate_password_policy_cache() -> None:
    bump_cache_namespace("password-policy")


def get_cached_response(key: str):
    if not cache_enabled():
        return None
    return cache.get(key)


def set_cached_response(key: str, data, ttl: int | None = None) -> None:
    if not cache_enabled():
        return
    seconds = ttl if ttl is not None else settings.CACHE_REF_LIST_TTL
    cache.set(key, data, timeout=seconds)


class CachedReferenceViewSetMixin:
    """
    Cache GET list/retrieve for reference viewsets. Bumps namespace on writes.
    """

    cache_namespace: str | None = None
    cache_list_ttl: int | None = None
    cache_retrieve_ttl: int | None = None
    cache_invalidate_groups: tuple[str, ...] = ()

    def _cache_namespace(self) -> str:
        if not self.cache_namespace:
            raise ValueError(f"{self.__class__.__name__} must set cache_namespace")
        return self.cache_namespace

    def _list_ttl(self) -> int:
        return self.cache_list_ttl or settings.CACHE_REF_LIST_TTL

    def _retrieve_ttl(self) -> int:
        return self.cache_retrieve_ttl or settings.CACHE_REF_RETRIEVE_TTL

    def _detail_lookup_value(self) -> str | None:
        if self.lookup_field in self.kwargs:
            return str(self.kwargs[self.lookup_field])
        if "pk" in self.kwargs:
            return str(self.kwargs["pk"])
        return None

    def _invalidate_reference_cache(self) -> None:
        groups = (self._cache_namespace(),) + tuple(self.cache_invalidate_groups)
        invalidate_ref_groups(*groups)

    def list(self, request, *args, **kwargs):
        if request.method != "GET" or not cache_enabled():
            return super().list(request, *args, **kwargs)
        key = ref_cache_key(self._cache_namespace(), request, action="list")
        hit = get_cached_response(key)
        if hit is not None:
            return Response(hit)
        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            set_cached_response(key, response.data, self._list_ttl())
        return response

    def retrieve(self, request, *args, **kwargs):
        if request.method != "GET" or not cache_enabled():
            return super().retrieve(request, *args, **kwargs)
        lookup = self._detail_lookup_value()
        key = ref_cache_key(
            self._cache_namespace(), request, action="retrieve", lookup=lookup
        )
        hit = get_cached_response(key)
        if hit is not None:
            return Response(hit)
        response = super().retrieve(request, *args, **kwargs)
        if response.status_code == 200:
            set_cached_response(key, response.data, self._retrieve_ttl())
        return response

    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._invalidate_reference_cache()

    def perform_update(self, serializer):
        super().perform_update(serializer)
        self._invalidate_reference_cache()

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        self._invalidate_reference_cache()


class CachedRoleDefinitionViewSetMixin(CachedReferenceViewSetMixin):
    """Role definitions: invalidate permissions-related reads on update/delete."""

    cache_namespace = "role-defs"

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        self._invalidate_reference_cache()
        return response

    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        self._invalidate_reference_cache()
        return response

    def destroy(self, request, *args, **kwargs):
        response = super().destroy(request, *args, **kwargs)
        self._invalidate_reference_cache()
        return response
