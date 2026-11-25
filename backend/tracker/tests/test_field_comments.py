"""Field-level review comments: a reviewer comments on one field of the digitized form."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    Comment, Ministry, Profile, PSCFormField, PSCFormType, Role, Submission,
)


class FieldCommentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_FC_A", name="Field Comment Ministry")
        self.officer = User.objects.create_user(username="fc_officer", password="pass")
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)
        self.other_officer = User.objects.create_user(username="fc_officer2", password="pass")
        Profile.objects.create(user=self.other_officer, role=Role.PSC_OFFICER)
        self.hr = User.objects.create_user(username="fc_hr", password="pass")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)

        self.form_type = PSCFormType.objects.create(code="ZZ-FC-1", name="Field comment form")
        PSCFormField.objects.create(
            form_type=self.form_type, label="Analysis", field_key="analysis",
            field_type="textarea", display_order=1,
        )
        PSCFormField.objects.create(
            form_type=self.form_type, label="Part A", field_key="part_a",
            field_type="section_header", display_order=2,
        )
        self.submission = Submission.objects.create(
            title="Form matter", received_at=timezone.now(), created_by=self.hr,
            ministry=self.ministry, is_internal=False, form_type_code="ZZ-FC-1",
        )
        self.target = f"submission:{self.submission.id}"
        self.client.force_authenticate(user=self.officer)

    def _post(self, **extra):
        data = {"target": self.target, "body": "Please revise.", **extra}
        return self.client.post("/api/comments/", data)

    def _rows(self, **params):
        res = self.client.get("/api/comments/", {"target": self.target, **params})
        self.assertEqual(res.status_code, 200)
        return res.data.get("results", res.data)

    def test_field_comment_saved_with_field_key(self):
        res = self._post(field_key="analysis")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["field_key"], "analysis")
        self.assertIsNone(res.data["resolved_at"])

    def test_whole_paper_comment_has_blank_field_key(self):
        res = self._post()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["field_key"], "")

    def test_unknown_field_rejected(self):
        self.assertEqual(self._post(field_key="no_such_field").status_code, 400)

    def test_section_header_cannot_be_commented(self):
        self.assertEqual(self._post(field_key="part_a").status_code, 400)

    def test_filters(self):
        self._post()
        self._post(field_key="analysis")
        self.assertEqual(len(self._rows()), 2)
        self.assertEqual(len(self._rows(field_only="1")), 1)
        self.assertEqual(len(self._rows(field_key="analysis")), 1)
        self.assertEqual(len(self._rows(field_key="other")), 0)

    def test_reply_inherits_field_key(self):
        parent = self._post(field_key="analysis").data
        reply = self._post(parent=parent["id"], body="Fixed.", field_key="ignored")
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.data["field_key"], "analysis")

    def test_author_can_resolve_and_reopen(self):
        cid = self._post(field_key="analysis").data["id"]
        res = self.client.post(f"/api/comments/{cid}/resolve/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.data["resolved_at"])
        self.assertEqual(res.data["resolved_by_name"], "fc_officer")
        res = self.client.post(f"/api/comments/{cid}/reopen/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data["resolved_at"])

    def test_non_author_cannot_resolve(self):
        cid = self._post(field_key="analysis").data["id"]
        self.client.force_authenticate(user=self.other_officer)
        self.assertEqual(self.client.post(f"/api/comments/{cid}/resolve/").status_code, 403)

    def test_whole_paper_comment_cannot_be_resolved(self):
        cid = self._post().data["id"]
        self.assertEqual(self.client.post(f"/api/comments/{cid}/resolve/").status_code, 400)

    def test_reply_cannot_be_resolved(self):
        parent = self._post(field_key="analysis").data
        reply = self._post(parent=parent["id"], body="ok").data
        self.assertEqual(self.client.post(f"/api/comments/{reply['id']}/resolve/").status_code, 400)

    def test_ministry_cannot_see_internal_field_comment(self):
        self._post(field_key="analysis", is_internal=True)
        self.client.force_authenticate(user=self.hr)
        self.assertEqual(len(self._rows(field_only="1")), 0)

    def test_resolve_hidden_from_ministry_for_internal_comment(self):
        cid = self._post(field_key="analysis", is_internal=True).data["id"]
        self.client.force_authenticate(user=self.hr)
        self.assertEqual(self.client.post(f"/api/comments/{cid}/resolve/").status_code, 404)

    def test_field_comment_on_unrelated_form_type_rejected(self):
        PSCFormType.objects.create(code="ZZ-FC-2", name="Other")
        self.submission.form_type_code = "ZZ-FC-2"
        self.submission.save(update_fields=["form_type_code"])
        self.assertEqual(self._post(field_key="analysis").status_code, 400)
