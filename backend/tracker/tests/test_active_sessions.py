"""Admin 'Active Sessions' panel — is_online should reflect a real open
WebSocket connection (chat_consumers.is_user_online), not merely that
last_login is recent (see views.active_sessions_view)."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.chat_consumers import _mark_connect
from tracker.models import Profile, Role


class ActiveSessionsOnlineStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="admin_a", password="pass")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.admin.last_login = timezone.now()
        self.admin.save(update_fields=["last_login"])

        # Recently logged in (well within the old access-token-lifetime
        # window) but with no open WebSocket connection — this is exactly
        # the "closed every SCDMS tab a few minutes ago" case.
        self.idle_user = User.objects.create_user(username="idle_officer", password="pass")
        Profile.objects.create(user=self.idle_user, role=Role.PSC_OFFICER)
        self.idle_user.last_login = timezone.now()
        self.idle_user.save(update_fields=["last_login"])

        # Actually has a live WebSocket connection open (simulated the same
        # way ChatConsumer.connect marks one).
        self.connected_user = User.objects.create_user(username="connected_officer", password="pass")
        Profile.objects.create(user=self.connected_user, role=Role.PSC_OFFICER)
        self.connected_user.last_login = timezone.now()
        self.connected_user.save(update_fields=["last_login"])
        _mark_connect(self.connected_user.id)

    def _status_for(self, users, username):
        return next(u for u in users if u["username"] == username)

    def test_idle_user_with_recent_login_is_not_online(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/admin/active-sessions/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(self._status_for(res.data["users"], "idle_officer")["is_online"])

    def test_user_with_open_websocket_is_online(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/admin/active-sessions/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(self._status_for(res.data["users"], "connected_officer")["is_online"])
