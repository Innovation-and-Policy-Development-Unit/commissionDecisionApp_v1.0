"""Tests for the trash bin: soft delete, manager hiding, and restore."""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    FormCategory,
    Ministry,
    Profile,
    Role,
    Submission,
    SubmissionDocument,
    WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class TrashBinTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-T", name="Test Ministry T")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]
        self.admin = User.objects.create_user("pscadmin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.hr = User.objects.create_user("hruser", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.officer = User.objects.create_user("officer", password="x")
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)

    def _submission(self, stage=WorkflowStage.DRAFT, **kw):
        return Submission.objects.create(
            title=kw.pop("title", "Paper"),
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=self.hr,
            current_stage=stage,
            **kw,
        )

    # ── Soft delete semantics ────────────────────────────────────────────────

    def test_delete_is_soft_and_hidden_everywhere(self):
        sub = self._submission(stage=WorkflowStage.UNDER_ASSESSMENT)
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(
            f"/api/submissions/{sub.id}/", {"reason": "Duplicate lodgement"}, format="json",
        )
        self.assertEqual(resp.status_code, 204)

        # Hidden from the default manager (lists, analytics, AI context)…
        self.assertFalse(Submission.objects.filter(pk=sub.pk).exists())
        # …but the row still exists with full audit fields.
        trashed = Submission.all_objects.get(pk=sub.pk)
        self.assertIsNotNone(trashed.deleted_at)
        self.assertEqual(trashed.deleted_by, self.admin)
        self.assertEqual(trashed.delete_reason, "Duplicate lodgement")

        # Detail endpoint 404s; list excludes it.
        self.assertEqual(self.client.get(f"/api/submissions/{sub.id}/").status_code, 404)

    def test_attachments_trashed_and_restored_with_parent(self):
        parent = self._submission(title="Parent")
        child = self._submission(title="Child", is_attachment=True, parent_submission=parent)

        self.client.force_authenticate(user=self.admin)
        self.client.delete(f"/api/submissions/{parent.id}/")
        self.assertEqual(
            Submission.all_objects.filter(deleted_at__isnull=False).count(), 2,
        )

        resp = self.client.post(
            "/api/admin/trash/restore/", {"type": "submission", "id": parent.id}, format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(set(resp.json()["restored_ids"]), {parent.id, child.id})
        self.assertTrue(Submission.objects.filter(pk=child.pk).exists())

    def test_ministry_hr_can_trash_own_draft_only(self):
        draft = self._submission(stage=WorkflowStage.DRAFT)
        submitted = self._submission(stage=WorkflowStage.SUBMITTED)

        self.client.force_authenticate(user=self.hr)
        self.assertEqual(self.client.delete(f"/api/submissions/{draft.id}/").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/submissions/{submitted.id}/").status_code, 403)
        # The submitted paper is untouched.
        self.assertTrue(Submission.objects.filter(pk=submitted.pk).exists())

    def test_other_roles_cannot_trash(self):
        sub = self._submission(stage=WorkflowStage.UNDER_ASSESSMENT)
        self.client.force_authenticate(user=self.officer)
        self.assertEqual(self.client.delete(f"/api/submissions/{sub.id}/").status_code, 403)

    # ── Trash list + restore ─────────────────────────────────────────────────

    def test_trash_list_and_restore_rbac(self):
        sub = self._submission()
        self.client.force_authenticate(user=self.admin)
        self.client.delete(f"/api/submissions/{sub.id}/")

        # Non-admin denied.
        self.client.force_authenticate(user=self.officer)
        self.assertEqual(self.client.get("/api/admin/trash/").status_code, 403)
        self.assertEqual(
            self.client.post(
                "/api/admin/trash/restore/", {"type": "submission", "id": sub.id}, format="json",
            ).status_code,
            403,
        )

        # Admin sees and restores.
        self.client.force_authenticate(user=self.admin)
        listing = self.client.get("/api/admin/trash/")
        self.assertEqual(listing.status_code, 200)
        refs = [s["reference_number"] for s in listing.json()["submissions"]]
        self.assertIn(sub.reference_number, refs)

        resp = self.client.post(
            "/api/admin/trash/restore/", {"type": "submission", "id": sub.id}, format="json",
        )
        self.assertEqual(resp.status_code, 200)
        restored = Submission.objects.get(pk=sub.pk)
        self.assertIsNone(restored.deleted_at)
        self.assertEqual(restored.delete_reason, "")

    def test_archived_document_listed_and_restorable(self):
        sub = self._submission()
        doc = SubmissionDocument.objects.create(
            submission=sub,
            file=SimpleUploadedFile("letter.pdf", b"%PDF-1.4"),
            original_name="letter.pdf",
            uploaded_by=self.hr,
        )
        SubmissionDocument.all_objects.filter(pk=doc.pk).update(
            archived_at=timezone.now(), archived_by=self.hr,
        )

        self.client.force_authenticate(user=self.admin)
        listing = self.client.get("/api/admin/trash/")
        names = [d["original_name"] for d in listing.json()["documents"]]
        self.assertIn("letter.pdf", names)

        resp = self.client.post(
            "/api/admin/trash/restore/", {"type": "document", "id": doc.id}, format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(SubmissionDocument.objects.filter(pk=doc.pk).exists())

    def test_restore_rejects_unknown_type(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/admin/trash/restore/", {"type": "meeting", "id": 1}, format="json",
        )
        self.assertEqual(resp.status_code, 400)

    # ── Analytics integration ────────────────────────────────────────────────

    def test_trashed_submission_excluded_from_rollups(self):
        from ..reports.implementation_rollup import build_implementation_rollup

        sub = self._submission(stage=WorkflowStage.APPROVED)
        sub.refresh_from_db()  # signal stamped commission_approved_at
        self.assertIsNotNone(sub.commission_approved_at)
        before = build_implementation_rollup()["overall"]["total"]

        self.client.force_authenticate(user=self.admin)
        self.client.delete(f"/api/submissions/{sub.id}/")
        after = build_implementation_rollup()["overall"]["total"]
        self.assertEqual(after, before - 1)
