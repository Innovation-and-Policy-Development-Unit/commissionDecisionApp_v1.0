"""
Pilot: CSU staff / Receptionist scan and upload an Acting-Secretary-signed paper
package for a non-pilot ministry. It lands at Forwarded to Commission and on the
same agenda as online submissions, marked as lodged from paper.
"""
from datetime import timedelta
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    AgendaItem, AgendaSection, Meeting, MeetingStatus, Ministry, Profile,
    Role, RoleDefinition, Submission, SystemPermission, WorkflowEvent, WorkflowStage,
)

PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
URL = "/api/submissions/lodge-signed-paper/"


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class LodgeSignedPaperTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_LSP", name="Paper Ministry")
        # "appointment" is already seeded by migrations; make sure it is usable.
        self.section, _ = AgendaSection.objects.update_or_create(
            code="appointment",
            defaults={"label": "Appointment", "display_order": 5, "is_active": True, "is_special": False},
        )
        self.meeting = Meeting.objects.create(
            title="Sitting", date=timezone.now().date() + timedelta(days=30),
            time="09:00", venue="Boardroom", status=MeetingStatus.SCHEDULED,
            min_items=2, max_items=30,
        )
        perm, _ = SystemPermission.objects.get_or_create(
            code="lodge_signed_paper",
            defaults={"label": "Lodge Signed Paper Submission", "category": "secretariat"},
        )
        for role in (Role.CSU_MANAGER, Role.RECEPTIONIST):
            rd, _ = RoleDefinition.objects.get_or_create(role=role)
            rd.permissions.add(perm)

        self.csu = self._user("lsp_csu", Role.CSU_MANAGER)
        self.officer = self._user("lsp_officer", Role.PSC_OFFICER)

    def _user(self, name, role):
        user = User.objects.create_user(username=name, password="pass")
        Profile.objects.create(user=user, role=role)
        return user

    def _payload(self, **over):
        data = {
            "ministry": self.ministry.id,
            "title": "Appointment of A. Person",
            "agenda_category": "appointment",
            "paper_signed_on": (timezone.localdate() - timedelta(days=1)).isoformat(),
            "files": [SimpleUploadedFile("package.pdf", PDF, content_type="application/pdf")],
        }
        data.update(over)
        return data

    def test_csu_lodges_and_item_lands_on_agenda(self):
        self.client.force_authenticate(user=self.csu)
        res = self.client.post(URL, self._payload(), format="multipart")
        self.assertEqual(res.status_code, 201, res.content)

        sub = Submission.objects.get(pk=res.data["id"])
        self.assertTrue(sub.lodged_from_paper)
        self.assertEqual(sub.paper_lodged_by, self.csu)
        self.assertEqual(sub.current_stage, WorkflowStage.FORWARDED_TO_COMMISSION)
        self.assertEqual(sub.documents.count(), 1)
        self.assertTrue(WorkflowEvent.objects.filter(
            submission=sub, new_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        ).exists())

        item = AgendaItem.objects.get(submission=sub)
        self.assertEqual(item.meeting_id, self.meeting.id)
        self.assertEqual(item.category, "appointment")
        self.assertTrue(res.data["placed_on_agenda"])

    def test_user_without_permission_is_refused(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.post(URL, self._payload(), format="multipart")
        self.assertEqual(res.status_code, 403)
        self.assertFalse(Submission.objects.filter(lodged_from_paper=True).exists())

    def test_requires_file(self):
        self.client.force_authenticate(user=self.csu)
        res = self.client.post(URL, self._payload(files=[]), format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_rejects_future_signing_date(self):
        self.client.force_authenticate(user=self.csu)
        future = (timezone.localdate() + timedelta(days=2)).isoformat()
        res = self.client.post(URL, self._payload(paper_signed_on=future), format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_rejects_unknown_agenda_section(self):
        self.client.force_authenticate(user=self.csu)
        res = self.client.post(URL, self._payload(agenda_category="nope"), format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_test_flag_keeps_submission_off_the_agenda(self):
        self.client.force_authenticate(user=self.csu)
        res = self.client.post(URL, self._payload(is_test="true"), format="multipart")
        self.assertEqual(res.status_code, 201, res.content)
        sub = Submission.objects.get(pk=res.data["id"])
        self.assertTrue(sub.is_test)
        self.assertTrue(sub.lodged_from_paper)
        self.assertFalse(AgendaItem.objects.filter(submission=sub).exists())
        self.assertFalse(res.data["placed_on_agenda"])

    def test_lodge_queues_ai_brief(self):
        self.client.force_authenticate(user=self.csu)
        with mock.patch("tracker.tasks.queue_submission_brief") as brief:
            res = self.client.post(URL, self._payload(), format="multipart")
        self.assertEqual(res.status_code, 201, res.content)
        brief.assert_called_once_with(res.data["id"])

    def test_test_flag_skips_ai_brief(self):
        self.client.force_authenticate(user=self.csu)
        with mock.patch("tracker.tasks.queue_submission_brief") as brief:
            res = self.client.post(URL, self._payload(is_test="true"), format="multipart")
        self.assertEqual(res.status_code, 201, res.content)
        brief.assert_not_called()

    def test_csu_manager_sees_paper_lodgement_in_submission_list(self):
        self.client.force_authenticate(user=self.csu)
        res = self.client.post(URL, self._payload(), format="multipart")
        self.assertEqual(res.status_code, 201, res.content)
        listing = self.client.get("/api/submissions/")
        self.assertEqual(listing.status_code, 200)
        rows = listing.data["results"] if isinstance(listing.data, dict) else listing.data
        self.assertIn(res.data["id"], [r["id"] for r in rows])
