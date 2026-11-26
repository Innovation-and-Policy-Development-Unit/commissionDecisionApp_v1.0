from django.test import SimpleTestCase
from django.urls import resolve


class RouterShadowingTests(SimpleTestCase):
    """Fixed-name endpoints must not be swallowed by a router's <pk> detail route."""

    def test_audit_log_search_resolves_to_search_view(self):
        self.assertEqual(resolve("/api/audit-logs/search/").view_name, "audit-log-search")

    def test_submission_bulk_action_resolves_to_bulk_view(self):
        self.assertEqual(resolve("/api/submissions/bulk-action/").view_name, "submission-bulk-action")

    def test_detail_routes_still_resolve(self):
        self.assertEqual(resolve("/api/audit-logs/12/").view_name, "audit-log-detail")
        self.assertEqual(resolve("/api/submissions/12/").view_name, "submission-detail")
