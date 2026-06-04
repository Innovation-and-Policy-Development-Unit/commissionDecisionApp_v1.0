"""Phase 2 (interleaved) — compliance read API access control."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    CaseFamily,
    ComplianceCase,
    Ministry,
    Profile,
    Role,
    Submission,
    WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ComplianceApiAccessTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.ministry = Ministry.objects.create(code="OPSC", name="Office of the PSC")

        cls.compliance_user = User.objects.create_user(username="cmgr", password="x")
        Profile.objects.update_or_create(
            user=cls.compliance_user, defaults={"role": Role.COMPLIANCE_MANAGER}
        )

        cls.ministry_user = User.objects.create_user(username="mhr", password="x")
        Profile.objects.update_or_create(
            user=cls.ministry_user, defaults={"role": Role.MINISTRY_HR}
        )

        sub = Submission.objects.create(
            title="Disciplinary matter", form_type_code="COMP-SMDR",
            ministry=cls.ministry, received_at=timezone.now(),
            created_by=cls.compliance_user, is_internal=True,
            current_stage=WorkflowStage.DRAFT,
        )
        cls.case = ComplianceCase.objects.create(
            submission=sub, case_family=CaseFamily.EMPLOYEE_DISCIPLINARY,
            subject_name="John Doe",
        )

    def test_compliance_staff_can_list_cases(self):
        client = APIClient()
        client.force_authenticate(self.compliance_user)
        resp = client.get("/api/compliance/cases/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        results = body["results"] if isinstance(body, dict) and "results" in body else body
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["subject_name"], "John Doe")
        # SLA summary present (stages auto-materialised)
        self.assertIn("sla_summary", results[0])

    def test_superuser_can_list_cases(self):
        admin = get_user_model().objects.create_superuser(username="root", password="x")
        client = APIClient()
        client.force_authenticate(admin)
        resp = client.get("/api/compliance/cases/")
        self.assertEqual(resp.status_code, 200)

    def test_ministry_user_is_forbidden(self):
        client = APIClient()
        client.force_authenticate(self.ministry_user)
        resp = client.get("/api/compliance/cases/")
        self.assertEqual(resp.status_code, 403)

    def test_anonymous_is_unauthorized(self):
        resp = APIClient().get("/api/compliance/cases/")
        self.assertIn(resp.status_code, (401, 403))
