from django.test import TestCase, RequestFactory
from django.contrib.auth.models import User
from ..audit import log_action
from ..models import AuditLog


class AuditLogTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("tester", password="test1234")
        self.factory = RequestFactory()

    def test_log_action_creates_entry(self):
        req = self.factory.get("/")
        req.user = self.user
        log_action(req, "TEST_ACTION", resource_type="Test", resource_id="1",
                    resource_label="Test Resource", description="A test entry")
        entry = AuditLog.objects.filter(action="TEST_ACTION").first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.actor_username, "tester")
        self.assertEqual(entry.resource_type, "Test")
        self.assertEqual(entry.resource_id, "1")
        self.assertEqual(entry.resource_label, "Test Resource")

    def test_log_action_without_request(self):
        log_action(None, "NO_REQUEST")
        entry = AuditLog.objects.filter(action="NO_REQUEST").first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.actor_username, "")
        self.assertIsNone(entry.actor)

    def test_log_action_anonymous(self):
        from django.contrib.auth.models import AnonymousUser
        req = self.factory.get("/")
        req.user = AnonymousUser()
        log_action(req, "ANON_ACTION")
        entry = AuditLog.objects.filter(action="ANON_ACTION").first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.actor_username, "")
        self.assertIsNone(entry.actor)

    def test_log_action_never_raises(self):
        log_action(None, "EXPLODE_TEST", resource_id=object())
        self.assertTrue(True)
