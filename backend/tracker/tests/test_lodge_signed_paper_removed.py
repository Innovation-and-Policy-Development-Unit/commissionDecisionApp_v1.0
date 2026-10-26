"""The 'lodge signed paper' feature is gone; papers lodged that way before stay readable."""
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import Ministry, Profile, Role, Submission, SystemPermission, WorkflowStage


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class LodgeSignedPaperRemovedTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_LSP", name="Lodge Removed Ministry")
        self.user = User.objects.create_user("lsp_csu", password="x", email="csu@example.org")
        Profile.objects.create(user=self.user, role=Role.CSU_MANAGER)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_the_endpoint_no_longer_exists(self):
        res = self.client.post("/api/submissions/lodge-signed-paper/", {"title": "x"})
        self.assertIn(res.status_code, (404, 405))
        self.assertFalse(Submission.objects.filter(title="x").exists())

    def test_the_permission_is_gone_from_the_database(self):
        self.assertFalse(SystemPermission.objects.filter(code="lodge_signed_paper").exists())

    def test_the_users_profile_no_longer_advertises_the_capability(self):
        res = self.client.get("/api/me/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertNotIn("can_lodge_signed_paper", res.data)

    def test_a_paper_lodged_before_the_removal_is_still_readable(self):
        old = Submission.objects.create(
            title="Lodged earlier", ministry=self.ministry, form_type_code="X",
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION, received_at=timezone.now(),
            created_by=self.user, lodged_from_paper=True, paper_lodged_by=self.user,
            paper_lodged_at=timezone.now(), paper_signed_on=timezone.localdate(),
        )
        res = self.client.get(f"/api/submissions/{old.id}/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(res.data["lodged_from_paper"])
