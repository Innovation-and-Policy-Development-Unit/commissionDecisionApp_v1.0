"""Phase 3 — direct case creation, manager approval, complaint lodgement & triage."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from ..compliance_models import CaseFamily, ComplaintStatus, ComplianceCase
from ..models import Ministry, Profile, Role, WorkflowStage


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class CompliancePhase3Test(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.opsc, _ = Ministry.objects.get_or_create(code="OPSC", defaults={"name": "Office of the PSC"})
        cls.line_ministry, _ = Ministry.objects.get_or_create(code="MOH", defaults={"name": "Ministry of Health"})

        cls.manager = User.objects.create_user(username="m.cmpl", password="x")
        Profile.objects.update_or_create(user=cls.manager, defaults={"role": Role.COMPLIANCE_MANAGER})
        cls.senior = User.objects.create_user(username="s.cmpl", password="x")
        Profile.objects.update_or_create(user=cls.senior, defaults={"role": Role.COMPLIANCE_SENIOR})

        cls.hr = User.objects.create_user(username="hr1", password="x")
        Profile.objects.update_or_create(
            user=cls.hr, defaults={"role": Role.MINISTRY_HR, "ministry": cls.line_ministry}
        )
        cls.hr2 = User.objects.create_user(username="hr2", password="x")
        Profile.objects.update_or_create(
            user=cls.hr2, defaults={"role": Role.MINISTRY_HR, "ministry": cls.line_ministry}
        )

    def _client(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    # ── Direct case creation + approval flow ──────────────────────────────────
    def test_senior_creates_case_then_manager_approves(self):
        c = self._client(self.senior)
        resp = c.post("/api/compliance/cases/", {
            "case_family": CaseFamily.EMPLOYEE_DISCIPLINARY,
            "subject_name": "John Tasso",
            "subject_ministry": "Ministry of Health",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        case_id = resp.json()["id"]
        case = ComplianceCase.objects.get(pk=case_id)
        self.assertEqual(case.submission.current_stage, WorkflowStage.DRAFT)
        self.assertTrue(case.stages.exists())  # statutory stages materialised

        # Senior submits → pending manager approval
        resp = c.post(f"/api/compliance/cases/{case_id}/submit/")
        self.assertEqual(resp.status_code, 200)
        case.submission.refresh_from_db()
        self.assertEqual(case.submission.current_stage, WorkflowStage.PENDING_MANAGER_APPROVAL)

        # Senior cannot approve
        self.assertEqual(c.post(f"/api/compliance/cases/{case_id}/approve/").status_code, 403)

        # Manager approves → Secretary review
        mc = self._client(self.manager)
        resp = mc.post(f"/api/compliance/cases/{case_id}/approve/")
        self.assertEqual(resp.status_code, 200)
        case.submission.refresh_from_db()
        self.assertEqual(case.submission.current_stage, WorkflowStage.SECRETARY_REVIEW)

    def test_manager_created_case_goes_straight_to_secretary(self):
        c = self._client(self.manager)
        case_id = c.post("/api/compliance/cases/", {
            "case_family": CaseFamily.GRIEVANCE, "subject_name": "Mary Vira",
        }, format="json").json()["id"]
        c.post(f"/api/compliance/cases/{case_id}/submit/")
        case = ComplianceCase.objects.get(pk=case_id)
        self.assertEqual(case.submission.current_stage, WorkflowStage.SECRETARY_REVIEW)

    # ── Complaint lodgement + triage ──────────────────────────────────────────
    def test_ministry_lodges_complaint_and_sees_only_own(self):
        c = self._client(self.hr)
        resp = c.post("/api/compliance/complaints/", {
            "title": "Unexplained absence",
            "description": "Absent 3 weeks without leave.",
            "subject_name": "Sam Iauma",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertTrue(resp.json()["reference_number"].startswith("CMP-"))

        # hr2 (same ministry, different user) sees none of hr's complaints
        resp2 = self._client(self.hr2).get("/api/compliance/complaints/")
        results = resp2.json().get("results", resp2.json())
        self.assertEqual(len(results), 0)

    def test_compliance_accepts_complaint_into_case(self):
        lodge = self._client(self.hr).post("/api/compliance/complaints/", {
            "title": "Misconduct report", "subject_name": "Peter L",
        }, format="json").json()
        complaint_id = lodge["id"]

        mc = self._client(self.manager)
        resp = mc.post(f"/api/compliance/complaints/{complaint_id}/accept/", {
            "case_family": CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        from ..compliance_models import Complaint
        complaint = Complaint.objects.get(pk=complaint_id)
        self.assertEqual(complaint.status, ComplaintStatus.CONVERTED)
        self.assertIsNotNone(complaint.compliance_case_id)

    def test_compliance_rejects_complaint_with_reason(self):
        lodge = self._client(self.hr).post("/api/compliance/complaints/", {
            "title": "Vague report", "subject_name": "X",
        }, format="json").json()
        cid = lodge["id"]
        mc = self._client(self.manager)
        resp = mc.post(f"/api/compliance/complaints/{cid}/reject/", {"reason": "Insufficient detail."}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], ComplaintStatus.REJECTED)
        self.assertEqual(resp.json()["closed_reason"], "Insufficient detail.")

    def test_ministry_cannot_triage(self):
        lodge = self._client(self.hr).post("/api/compliance/complaints/", {
            "title": "T", "subject_name": "Y",
        }, format="json").json()
        resp = self._client(self.hr).post(f"/api/compliance/complaints/{lodge['id']}/reject/", {"reason": "x"}, format="json")
        self.assertIn(resp.status_code, (403, 404))
