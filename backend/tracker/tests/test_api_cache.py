from django.core.cache import cache
from django.test import RequestFactory, TestCase, override_settings

from config.cache_urls import redis_cache_url_from_broker
from tracker.api_cache import (
    bump_cache_namespace,
    invalidate_submission,
    ref_cache_key,
    submission_bootstrap_cache_key,
)


class RedisCacheUrlTests(TestCase):
    def test_broker_db0_maps_to_db1(self):
        self.assertEqual(
            redis_cache_url_from_broker("redis://:secret@redis:6379/0"),
            "redis://:secret@redis:6379/1",
        )


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-api-cache",
        }
    },
    CACHE_ENABLED=True,
    CACHE_REF_LIST_TTL=120,
)
class ApiCacheKeyTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_namespace_bump_changes_list_key(self):
        factory = RequestFactory()
        request = factory.get("/api/form-types/?active_only=1")
        request.user = type("U", (), {"is_authenticated": False})()

        key_v1 = ref_cache_key("form-types", request, action="list")
        bump_cache_namespace("form-types")
        key_v2 = ref_cache_key("form-types", request, action="list")
        self.assertNotEqual(key_v1, key_v2)

    def test_submission_invalidation_changes_bootstrap_key(self):
        factory = RequestFactory()
        request = factory.get("/api/submissions/9/bootstrap/")
        request.user = type("U", (), {"is_authenticated": False})()

        key_before = submission_bootstrap_cache_key(9, request)
        invalidate_submission(9)
        key_after = submission_bootstrap_cache_key(9, request)
        self.assertNotEqual(key_before, key_after)
