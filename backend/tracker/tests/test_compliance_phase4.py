"""Phase 4 — visibility scoping & RBAC firewall (safety-critical).

Proves ministry / non-compliance users can never reach compliance case data, and the
asymmetric complaint rule (ministry sees only its own complaint + coarse status,
never the linked case).
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from ..compliance_actions import create_compliance_case
from ..compliance_models import CaseFamily, ComplianceCase
from ..models import Ministry, Profile, Role, WorkflowStage


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class CompliancePhase4FirewallTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.opsc, _ = Ministry.objects.get_or_create(code="OPSC", defaults={"name": "Office of the PSC"})
        cls.line, _ = Ministry.objects.get_or_create(code="MOX", defaults={"name": "Ministry X"})

        def mk(username, role, ministry=None):
            u = User.objects.create_user(username=username, password="x")
            Profile.objects.update_or_create(
                user=u, defaults={"role": role, "ministry": ministry}
            )
            return u

        cls.manager = mk("p4_mgr", Role.COMPLIANCE_MANAGER)
        cls.senior = mk("p4_snr", Role.COMPLIANCE_SENIOR)
        cls.principal = mk("p4_prn", Role.COMPLIANCE_PRINCIPAL)
        cls.officer = mk("p4_off", Role.PSC_OFFICER)          # non-compliance PSC
        cls.hr = mk("p4_hr", Role.MINISTRY_HR, cls.line)
        cls.hr2 = mk("p4_hr2", Role.MINISTRY_HR, cls.line)
        cls.dg = mk("p4_dg", Role.HEAD_OF_AGENCY, cls.line)
        cls.admin = User.objects.create_superuser(username="p4_root", password="x")

        # A compliance case (with linked internal submission).
        cls.case = create_compliance_case(
            creator=cls.manager,
            case_family=CaseFamily.EMPLOYEE_DISCIPLINARY,
            subject_name="Subject P4",
        )

    def _c(self, user):
        c = APIClient(); c.force_authenticate(user); return c

    # ── Case endpoint access matrix ───────────────────────────────────────────
    def test_case_list_access_matrix(self):
        allowed = [self.manager, self.senior, self.principal, self.admin]
        denied = [self.officer, self.hr, self.dg]
        for u in allowed:
            self.assertEqual(self._c(u).get("/api/compliance/cases/").status_code, 200, u.username)
        for u in denied:
            self.assertEqual(self._c(u).get("/api/compliance/cases/").status_code, 403, u.username)

    def test_case_detail_denied_to_ministry(self):
        url = f"/api/compliance/cases/{self.case.id}/"
        self.assertEqual(self._c(self.manager).get(url).status_code, 200)
        self.assertEqual(self._c(self.hr).get(url).status_code, 403)
        self.assertEqual(self._c(self.dg).get(url).status_code, 403)
        self.assertEqual(self._c(self.officer).get(url).status_code, 403)

    # ── Submission firewall (compliance submissions are is_internal) ──────────
    def test_compliance_submission_hidden_from_ministry_visible_to_compliance(self):
        ref = self.case.submission.reference_number

        body = self._c(self.hr).get("/api/submissions/").json()
        results = body.get("results", body)
        refs = {r.get("reference_number") for r in results}
        self.assertNotIn(ref, refs)  # ministry never sees the internal compliance submission

        body = self._c(self.manager).get("/api/submissions/").json()
        results = body.get("results", body)
        refs = {r.get("reference_number") for r in results}
        self.assertIn(ref, refs)  # compliance staff do see it

    # ── Complaint asymmetric scoping ──────────────────────────────────────────
    def test_complaint_own_only_and_case_reference_hidden(self):
        # hr lodges a complaint
        lodged = self._c(self.hr).post("/api/compliance/complaints/", {
            "title": "Concern", "subject_name": "Z",
        }, format="json").json()
        cid = lodged["id"]

        # hr2 (same ministry) cannot see hr's complaint
        body = self._c(self.hr2).get("/api/compliance/complaints/").json()
        self.assertEqual(len(body.get("results", body)), 0)

        # compliance accepts → case created and linked
        acc = self._c(self.manager).post(f"/api/compliance/complaints/{cid}/accept/", {
            "case_family": CaseFamily.GRIEVANCE,
        }, format="json")
        self.assertEqual(acc.status_code, 201)

        # hr sees their own complaint, status converted, but NO case reference
        own = self._c(self.hr).get(f"/api/compliance/complaints/{cid}/").json()
        self.assertEqual(own["status"], "converted")
        self.assertIsNone(own["case_reference"])  # firewall: case hidden from ministry

        # compliance staff DO see the case reference
        comp = self._c(self.manager).get(f"/api/compliance/complaints/{cid}/").json()
        self.assertIsNotNone(comp["case_reference"])

    def test_ministry_cannot_open_case_via_complaint_accept(self):
        lodged = self._c(self.hr).post("/api/compliance/complaints/", {
            "title": "X", "subject_name": "Y",
        }, format="json").json()
        resp = self._c(self.hr).post(f"/api/compliance/complaints/{lodged['id']}/accept/", {
            "case_family": CaseFamily.GRIEVANCE,
        }, format="json")
        self.assertIn(resp.status_code, (403, 404))
        # no case created
        self.assertFalse(ComplianceCase.objects.filter(source_complaints__id=lodged["id"]).exists())
