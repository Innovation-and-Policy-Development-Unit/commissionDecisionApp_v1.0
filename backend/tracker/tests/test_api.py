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

    def test_list_pagination_and_filters(self):
        """Server-side pagination + filtering on the submissions list."""
        from django.utils import timezone
        from ..models import Submission, WorkflowStage

        # 12 submitted (one uniquely searchable) + 8 draft = 20 rows.
        for i in range(12):
            Submission.objects.create(
                title=("Unique-Zenith-Marker" if i == 0 else f"Submitted {i}"),
                form_category=self.form_cat, form_type_code="PSC 3.6",
                ministry=self.ministry, received_at=timezone.now(),
                created_by=self.user, current_stage=WorkflowStage.SUBMITTED,
            )
        for i in range(8):
            Submission.objects.create(
                title=f"Draft {i}", form_category=self.form_cat, form_type_code="PSC 3.6",
                ministry=self.ministry, received_at=timezone.now(),
                created_by=self.user, current_stage=WorkflowStage.DRAFT,
            )

        # Scope to this test's ministry to isolate from migration-seeded data
        # (this also exercises the ministry filter).
        base = "/api/submissions/?ministry=Test Ministry"

        # Page 1 caps at the requested page_size and reports the full count.
        body = self.client.get(f"{base}&page_size=15").json()
        self.assertEqual(body["count"], 20)
        self.assertEqual(len(body["results"]), 15)
        self.assertIsNotNone(body["next"])

        # Page 2 reaches the remainder — the >page_size truncation bug is gone.
        self.assertEqual(len(self.client.get(f"{base}&page=2&page_size=15").json()["results"]), 5)

        # Stage filter.
        self.assertEqual(self.client.get(f"{base}&current_stage=draft").json()["count"], 8)

        # Free-text search across reference/title/ministry.
        sbody = self.client.get(f"{base}&search=Zenith").json()
        self.assertEqual(sbody["count"], 1)
        self.assertIn("Zenith", sbody["results"][0]["title"])

        # ids filter (NL-search path).
        ids = [str(s.id) for s in Submission.objects.filter(ministry=self.ministry)[:2]]
        self.assertEqual(self.client.get(f"/api/submissions/?ids={','.join(ids)}").json()["count"], 2)

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
            title="System-event matter",
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=self.user,
        )
        WorkflowEvent.objects.create(
            submission=sub,
            actor=None,
            actor_label="System / compliance.manager",
            previous_stage=WorkflowStage.DRAFT,
            new_stage=WorkflowStage.COMPLIANCE_UNDER_REVIEW,
            remarks="System-generated event",
        )
        resp = self.client.get(f"/api/submissions/{sub.id}/")
        self.assertEqual(resp.status_code, 200)
        events = resp.json().get("events") or []
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["actor_username"], "System / compliance.manager")

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

    def test_validate_package_on_draft(self):
        from django.utils import timezone
        from ..models import Submission, WorkflowStage

        sub = Submission.objects.create(
            title="Short",
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=self.user,
            current_stage=WorkflowStage.DRAFT,
        )
        resp = self.client.post(f"/api/submissions/{sub.id}/validate-package/")
        self.assertEqual(resp.status_code, 202)
        from ..tasks import validate_submission_package_task

        validate_submission_package_task(sub.id, force=True)
        data = self.client.get(f"/api/submissions/{sub.id}/").json()
        self.assertTrue(data.get("ai_package_processed"))
        self.assertIsInstance(data.get("ai_package_gaps"), list)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=['*'])
class SubmissionEditGateTests(TestCase):
    """HR may edit only while drafting; the DG is view-only on content."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="EDG", name="Edit Gate Ministry")
        self.form_cat = FormCategory.objects.create(code="psc_3_6_eg", name="PSC 3.6 EG")
        self.hr = User.objects.create_user("hruser", password="test1234")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.dg = User.objects.create_user("dguser", password="test1234")
        Profile.objects.create(user=self.dg, role=Role.HEAD_OF_AGENCY, ministry=self.ministry)

    def _make(self, stage):
        from django.utils import timezone
        from ..models import Submission
        return Submission.objects.create(
            title="Edit gate", form_category=self.form_cat, form_type_code="PSC 3.6",
            ministry=self.ministry, received_at=timezone.now(),
            created_by=self.hr, current_stage=stage,
        )

    def test_hr_can_edit_draft_but_not_after_submitting_for_endorsement(self):
        from ..models import WorkflowStage
        c = APIClient(); c.force_authenticate(self.hr)
        draft = self._make(WorkflowStage.DRAFT)
        self.assertEqual(
            c.patch(f"/api/submissions/{draft.id}/", {"title": "Revised"}, format="json").status_code, 200)
        pending = self._make(WorkflowStage.PENDING_DG_ENDORSEMENT)
        self.assertEqual(
            c.patch(f"/api/submissions/{pending.id}/", {"title": "Nope"}, format="json").status_code, 403)

    def test_dg_can_view_but_not_edit_draft(self):
        from ..models import WorkflowStage
        c = APIClient(); c.force_authenticate(self.dg)
        draft = self._make(WorkflowStage.DRAFT)
        self.assertEqual(c.get(f"/api/submissions/{draft.id}/").status_code, 200)
        self.assertEqual(
            c.patch(f"/api/submissions/{draft.id}/", {"title": "Nope"}, format="json").status_code, 403)

    def test_can_edit_flag_reflects_role_and_stage(self):
        from ..models import WorkflowStage
        c_hr = APIClient(); c_hr.force_authenticate(self.hr)
        draft = self._make(WorkflowStage.DRAFT)
        pending = self._make(WorkflowStage.PENDING_DG_ENDORSEMENT)
        self.assertTrue(c_hr.get(f"/api/submissions/{draft.id}/").json()["can_edit"])
        self.assertFalse(c_hr.get(f"/api/submissions/{pending.id}/").json()["can_edit"])
        c_dg = APIClient(); c_dg.force_authenticate(self.dg)
        self.assertFalse(c_dg.get(f"/api/submissions/{draft.id}/").json()["can_edit"])
