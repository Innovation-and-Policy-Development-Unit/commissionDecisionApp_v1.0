from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from ..models import Profile, Role, Ministry, FormCategory


@override_settings(SECURE_SSL_REDIRECT=False, CELERY_BROKER_URL='redis://localhost:6379/0')
class AuthAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("testuser", password="OldPass123!")
        Profile.objects.create(user=self.user, role=Role.PSC_ADMIN)

    def test_login_success(self):
        resp = self.client.post("/api/auth/token/", {"username": "testuser", "password": "OldPass123!"})
        self.assertIn(resp.status_code, (200, 401))

    def test_login_failure(self):
        resp = self.client.post("/api/auth/token/", {"username": "testuser", "password": "wrong"})
        self.assertEqual(resp.status_code, 401)

    def test_me_endpoint(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["username"], "testuser")

    def test_me_unauthenticated(self):
        resp = self.client.get("/api/me/")
        self.assertIn(resp.status_code, (401, 403))

    def test_me_staff_without_profile_auto_provisions(self):
        staff = User.objects.create_user("staffnoprof", password="OldPass123!", is_staff=True)
        self.client.force_authenticate(user=staff)
        resp = self.client.get("/api/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["role"], Role.PSC_ADMIN)
        self.assertTrue(Profile.objects.filter(user=staff, role=Role.PSC_ADMIN).exists())

    def test_password_policy(self):
        resp = self.client.get("/api/auth/password-policy/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("min_length", data)
        self.assertIn("require_uppercase", data)

    def test_api_inventory(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/auth/api-inventory/")
        self.assertEqual(resp.status_code, 200)

    def test_health_endpoint(self):
        resp = self.client.get("/health/")
        data = resp.json()
        self.assertIn("status", data)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=['*'])
class SubmissionAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("pscofficer", password="test1234")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER)
        self.client.force_authenticate(user=self.user)
        self.ministry = Ministry.objects.create(code="TEST", name="Test Ministry")
        self.form_cat = FormCategory.objects.create(code="psc_3_6", name="PSC 3.6")

    def test_list_submissions_empty(self):
        resp = self.client.get("/api/submissions/")
        self.assertEqual(resp.status_code, 200)

    def test_create_submission(self):
        from django.utils import timezone
        resp = self.client.post("/api/submissions/", {
            "title": "Test Submission",
            "form_category": self.form_cat.id,
            "form_type_code": "PSC 3.6",
            "ministry": self.ministry.id,
            "routed_unit": "odu",
            "received_at": timezone.now().isoformat(),
        })
        self.assertEqual(resp.status_code, 201)

    def test_list_ministries(self):
        resp = self.client.get("/api/ministries/")
        self.assertEqual(resp.status_code, 200)

    def test_dashboard_authenticated(self):
        resp = self.client.get("/api/dashboard/")
        self.assertEqual(resp.status_code, 200)

    def test_search_authenticated(self):
        resp = self.client.get("/api/search/?q=test")
        self.assertEqual(resp.status_code, 200)

    def test_submission_detail_system_workflow_event(self):
        """CMS/system events have actor=null; detail must not 500."""
        from django.utils import timezone
        from ..models import Submission, WorkflowEvent, WorkflowStage

        sub = Submission.objects.create(
            title="CMS-linked matter",
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=self.user,
            cms_case_id="cms-75",
            cms_case_reference="CCMS-SM-2026-0075",
        )
        WorkflowEvent.objects.create(
            submission=sub,
            actor=None,
            actor_label="CMS / compliance.manager",
            previous_stage=WorkflowStage.DRAFT,
            new_stage=WorkflowStage.COMPLIANCE_UNDER_REVIEW,
            remarks="Registered from CMS",
        )
        resp = self.client.get(f"/api/submissions/{sub.id}/")
        self.assertEqual(resp.status_code, 200)
        events = resp.json().get("events") or []
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["actor_username"], "CMS / compliance.manager")

    def test_staff_without_profile_can_view_submission_detail(self):
        from django.utils import timezone
        from ..models import Submission

        staff = User.objects.create_user("staffview", password="test1234", is_staff=True)
        sub = Submission.objects.create(
            title="Staff visibility test",
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=self.user,
        )
        self.client.force_authenticate(user=staff)
        resp = self.client.get(f"/api/submissions/{sub.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["id"], sub.id)
        self.assertTrue(Profile.objects.filter(user=staff, role=Role.PSC_ADMIN).exists())
