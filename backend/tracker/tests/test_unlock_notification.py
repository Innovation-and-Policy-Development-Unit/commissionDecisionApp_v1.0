"""A super admin unlocking an account emails the affected user, one by one or in bulk."""
from axes.models import AccessAttempt
from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.axes_config import current_failure_limit
from tracker.models import EmailTemplate, Profile, Role


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class UnlockNotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser("unl_root", "root@example.gov.vu", "pass")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.locked = self._user("unl_locked", "locked@example.gov.vu")
        self.typo = self._user("unl_typo", "typo@example.gov.vu")
        self.client.force_authenticate(user=self.admin)

    def _user(self, name, email):
        user = User.objects.create_user(username=name, email=email, password="pass", first_name=name)
        Profile.objects.create(user=user, role=Role.PSC_OFFICER)
        return user

    def _attempt(self, username, failures):
        AccessAttempt.objects.create(
            username=username, ip_address="10.0.0.1", user_agent="t",
            failures_since_start=failures,
        )

    def test_template_is_seeded(self):
        self.assertTrue(EmailTemplate.objects.filter(slug="account_unlocked_user", is_active=True).exists())

    def test_single_unlock_emails_user(self):
        self._attempt("unl_locked", current_failure_limit())
        res = self.client.post(f"/api/users/{self.locked.id}/unlock/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([m.to for m in mail.outbox], [["locked@example.gov.vu"]])
        self.assertIn("unlocked", mail.outbox[0].subject.lower())

    def test_bulk_unlock_emails_only_locked_users(self):
        self._attempt("unl_locked", current_failure_limit())
        self._attempt("unl_typo", 1)
        res = self.client.post("/api/users/reset-all-lockouts/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([m.to for m in mail.outbox], [["locked@example.gov.vu"]])
        self.assertEqual(res.data["users_notified"], 1)
        self.assertFalse(AccessAttempt.objects.exists())

    def test_bulk_unlock_emails_hard_locked_profile(self):
        Profile.objects.filter(user=self.typo).update(hard_locked=True)
        self.client.post("/api/users/reset-all-lockouts/")
        self.assertEqual([m.to for m in mail.outbox], [["typo@example.gov.vu"]])
