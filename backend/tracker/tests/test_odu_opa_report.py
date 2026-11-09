"""ODU's Organisation Performance Assessment Feedback Report: an internal ODU paper with ODU's
general submission template and the report itself as the required document."""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    Department, Ministry, PSCFormField, PSCFormType, Profile, RequiredDocument, Role, Submission,
    WorkflowStage,
)

CODE = "ODU-OPA-FEEDBACK-REPORT"
DOC = "Organisation Performance Assessment Feedback Report"
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _user(name, role, **kw):
    u = User.objects.create_user(name, password="x")
    Profile.objects.create(user=u, role=role, **kw)
    return u


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class OpaFeedbackReportTests(TestCase):
    def setUp(self):
        opm = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        Department.objects.create(ministry=opm, code="OPSC", name="Office of the Public Service Commission")
        self.senior = _user("opa_senior", Role.ODU_SENIOR)
        self.principal = _user("opa_principal", Role.ODU_PRINCIPAL)
        self.manager = _user("opa_manager", Role.ODU_MANAGER)
        self.ministry = Ministry.objects.create(code="MQ", name="Ministry Q")
        self.hr = _user("opa_hr", Role.MINISTRY_HR, ministry=self.ministry)

    def _create(self, user, code=CODE, title="Organisation Performance Assessment Feedback Report 2026"):
        return _client(user).post("/api/submissions/", {
            "title": title, "form_type_code": code, "received_at": timezone.now().isoformat(),
        }, format="json")

    def _make(self, user=None):
        res = self._create(user or self.senior)
        self.assertEqual(res.status_code, 201, res.content)
        return Submission.objects.get(pk=res.data["id"])

    def _move(self, user, sub, stage):
        return _client(user).post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": stage, "remarks": "Please see my comments."}, format="json")

    def _attach(self, user, sub):
        slot = RequiredDocument.objects.get(form_type__code=CODE, name=DOC)
        return _client(user).post(
            f"/api/submissions/{sub.id}/documents/",
            {"file": SimpleUploadedFile("report.pdf", PDF, "application/pdf"), "required_document": slot.id},
            format="multipart",
        )

    # ── the form type ──
    def test_it_is_an_odu_paper_on_the_other_matters_section_with_the_general_template(self):
        ft = PSCFormType.objects.get(code=CODE)
        self.assertEqual((ft.routed_unit, ft.agenda_category, ft.is_digitized), ("odu", "other", True))
        fields = {f.field_key: f.is_required for f in PSCFormField.objects.filter(form_type=ft)
                  if f.field_type != "section_header"}
        self.assertEqual(fields, {"subject": True, "issue": True, "discussion": True, "recommendation": True})

    def test_the_report_itself_is_the_one_required_document(self):
        sub = self._make()
        names = list(RequiredDocument.objects.filter(form_type__code=CODE, is_active=True).values_list("name", flat=True))
        self.assertEqual(names, [DOC])
        res = _client(self.senior).get(f"/api/submissions/{sub.id}/checklist/")
        self.assertEqual([i["document_name"] for i in res.data], [DOC])

    # ── who creates it ──
    def test_every_odu_tier_creates_an_internal_odu_paper(self):
        for i, user in enumerate((self.senior, self.principal, self.manager)):
            res = self._create(user, title=f"OPA report {i}")
            self.assertEqual(res.status_code, 201, res.content)
            sub = Submission.objects.get(pk=res.data["id"])
            self.assertTrue(sub.is_internal)
            self.assertFalse(sub.follows_normal_route)
            self.assertEqual((sub.routed_unit, sub.current_stage), ("odu", WorkflowStage.DRAFT))

    def test_ministry_staff_never_see_it(self):
        sub = self._make()
        self.assertEqual(_client(self.hr).get(f"/api/submissions/{sub.id}/").status_code, 404)

    def test_odu_still_cannot_create_ministry_lodged_types(self):
        self.assertEqual(self._create(self.senior, code="ORG-3.1", title="Restructure").status_code, 400)

    # ── the ladder ──
    def test_it_cannot_go_up_without_the_report(self):
        sub = self._make()
        blocked = self._move(self.senior, sub, WorkflowStage.PENDING_PRINCIPAL_REVIEW)
        self.assertEqual(blocked.status_code, 400)
        self.assertIn(DOC, blocked.data["detail"])

    def test_with_the_report_attached_it_climbs_to_the_secretary_gate(self):
        sub = self._make()
        self.assertEqual(self._attach(self.senior, sub).status_code, 201)
        self.assertEqual(self._move(self.senior, sub, WorkflowStage.PENDING_PRINCIPAL_REVIEW).status_code, 200)
        self.assertEqual(self._move(self.principal, sub, WorkflowStage.RETURNED_FOR_CLARIFICATION).status_code, 200)
        self.assertEqual(self._move(self.senior, sub, WorkflowStage.PENDING_MANAGER_APPROVAL).status_code, 200)
        self.assertEqual(self._move(self.manager, sub, WorkflowStage.PENDING_SECRETARY_APPROVAL).status_code, 200)

    def test_a_manager_can_author_it_and_send_it_straight_up(self):
        sub = self._make(self.manager)
        self.assertEqual(self._attach(self.manager, sub).status_code, 201)
        self.assertEqual(self._move(self.manager, sub, WorkflowStage.PENDING_SECRETARY_APPROVAL).status_code, 200)

    def test_the_travel_report_is_unaffected(self):
        res = self._create(self.senior, code="ODU-TRAVEL-REPORT", title="Overseas travel Q3")
        self.assertEqual(res.status_code, 201, res.content)
        sub = Submission.objects.get(pk=res.data["id"])
        self.assertEqual(
            [i["document_name"] for i in _client(self.senior).get(f"/api/submissions/{sub.id}/checklist/").data],
            ["Overseas Travel Report"],
        )
