"""PSC 2-2 (Job Description) fixes: dedicated agenda section (discoverability),
DG-signed letter for standalone submissions, and the attach-to-parent-restructure
flow (search + create)."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    AgendaSection,
    Ministry,
    PSCFormType,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    WorkflowStage,
)
from ..submission_checklist import resolve_required_documents


class JobDescriptionAgendaSectionTests(TestCase):
    def test_dedicated_agenda_section_exists(self):
        section = AgendaSection.objects.get(code='job_description')
        self.assertTrue(section.is_active)
        self.assertEqual(section.digitized_form.code, 'PSC 2-2')

    def test_psc_2_2_points_at_new_section(self):
        ft = PSCFormType.objects.get(code='PSC 2-2')
        self.assertEqual(ft.agenda_category, 'job_description')


class JobDescriptionDgLetterTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-JD", name="Test Ministry JD")
        self.hr = User.objects.create_user("hruser_jd", password="x")

    def _submission(self, *, is_attachment=False, parent=None):
        return Submission.objects.create(
            reference_number=f"SUB-JD-{Submission.objects.count()}",
            title="Job description action",
            form_type_code="PSC 2-2",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            is_attachment=is_attachment,
            parent_submission=parent,
            received_at=timezone.now(),
            created_by=self.hr,
        )

    def test_standalone_requires_dg_letter(self):
        submission = self._submission()
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertIn("DG-Signed Endorsement Letter", names)
        self.assertIn("Request Letter", names)
        self.assertIn("Justifications", names)
        self.assertIn("Copy of Signed Structure", names)

    def test_attached_has_no_required_documents(self):
        parent = Submission.objects.create(
            reference_number="SUB-JD-PARENT-0",
            title="Parent restructure",
            form_type_code="PSC 2-1",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        submission = self._submission(is_attachment=True, parent=parent)
        self.assertEqual(list(resolve_required_documents(submission)), [])


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AttachJobDescriptionApiTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-JDA", name="Test Ministry JDA")
        self.hr = User.objects.create_user("hruser_jda", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.parent = Submission.objects.create(
            reference_number="SUB-JDA-PARENT",
            title="Restructure of the Corporate Services Unit",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            routed_unit=RoutedUnit.ODU,
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        Submission.objects.create(
            reference_number="SUB-JDA-OTHER",
            title="Unrelated leave payout",
            form_type_code="LEAVE-PAYOUT",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.hr)

    def test_search_scopes_to_restructure_form_types(self):
        resp = self.client.get("/api/submissions/", {
            "search": "Corporate", "form_type_code": "PSC 2-1,ORG-3.1",
        })
        self.assertEqual(resp.status_code, 200)
        refs = {r["reference_number"] for r in resp.data["results"]}
        self.assertIn("SUB-JDA-PARENT", refs)
        self.assertNotIn("SUB-JDA-OTHER", refs)

    def test_form_type_filter_excludes_other_types_even_without_search(self):
        resp = self.client.get("/api/submissions/", {
            "form_type_code": "PSC 2-1,ORG-3.1",
        })
        self.assertEqual(resp.status_code, 200)
        refs = {r["reference_number"] for r in resp.data["results"]}
        self.assertIn("SUB-JDA-PARENT", refs)
        self.assertNotIn("SUB-JDA-OTHER", refs)

    def test_create_attached_job_description(self):
        resp = self.client.post("/api/submissions/", {
            "title": "JD upgrade for Finance Officer",
            "form_type_code": "PSC 2-2",
            "agenda_category": "job_description",
            "is_attachment": True,
            "parent_submission": self.parent.id,
            "received_at": timezone.now().isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        child = Submission.objects.get(pk=resp.data["id"])
        self.assertTrue(child.is_attachment)
        self.assertEqual(child.parent_submission_id, self.parent.id)
        self.assertEqual(child.ministry_id, self.parent.ministry_id)
        self.assertEqual(child.routed_unit, self.parent.routed_unit)
        self.assertEqual(list(resolve_required_documents(child)), [])

    def test_cannot_attach_to_a_submission_from_another_ministry(self):
        other_ministry = Ministry.objects.create(code="TST-JDB", name="Other Ministry JDB")
        other_parent = Submission.objects.create(
            reference_number="SUB-JDB-PARENT",
            title="Someone else's restructure",
            form_type_code="ORG-3.1",
            ministry=other_ministry,
            routed_unit=RoutedUnit.ODU,
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        resp = self.client.post("/api/submissions/", {
            "title": "JD upgrade for Finance Officer",
            "form_type_code": "PSC 2-2",
            "is_attachment": True,
            "parent_submission": other_parent.id,
            "received_at": timezone.now().isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("parent_submission", resp.data)
