"""Tests for document versioning + evidence preservation (archive over delete)."""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    DocumentVersion,
    FormCategory,
    Ministry,
    Profile,
    Role,
    Submission,
    SubmissionDocument,
    WorkflowEvent,
    WorkflowStage,
)


def _pdf(name="letter.pdf", content=b"%PDF-1.4 original"):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DocumentVersioningTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-V", name="Test Ministry V")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]

        self.hr = User.objects.create_user("hruser", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.admin = User.objects.create_user("pscadmin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)

        self.submission = Submission.objects.create(
            title="Test paper",
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=self.hr,
            current_stage=WorkflowStage.DRAFT,
        )

    def _upload(self, user, name="letter.pdf", content=b"%PDF-1.4 original"):
        self.client.force_authenticate(user=user)
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/documents/",
            {"file": _pdf(name, content)},
            format="multipart",
        )
        assert resp.status_code == 201, resp.content
        return SubmissionDocument.objects.get(pk=resp.json()["id"])

    # ── Replace ──────────────────────────────────────────────────────────────

    def test_replace_snapshots_previous_version(self):
        doc = self._upload(self.hr)
        old_path = doc.file.name

        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}/replace/",
            {"file": _pdf("letter_v2.pdf", b"%PDF-1.4 revised"), "notes": "Clarification round 1"},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.content)

        doc.refresh_from_db()
        self.assertEqual(doc.version_num, 2)
        self.assertEqual(doc.original_name, "letter_v2.pdf")
        self.assertNotEqual(doc.file.name, old_path)
        self.assertEqual(doc.file.read(), b"%PDF-1.4 revised")

        versions = DocumentVersion.objects.filter(document=doc)
        self.assertEqual(versions.count(), 1)
        snapshot = versions.first()
        self.assertEqual(snapshot.version_num, 1)
        self.assertEqual(snapshot.filename, "letter.pdf")
        self.assertEqual(snapshot.file.name, old_path)
        self.assertEqual(snapshot.file.read(), b"%PDF-1.4 original")
        self.assertEqual(snapshot.notes, "Clarification round 1")

    def test_replace_resets_extraction_state(self):
        doc = self._upload(self.hr)
        SubmissionDocument.objects.filter(pk=doc.pk).update(
            ocr_status="done", extracted_text="old text"
        )
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}/replace/",
            {"file": _pdf("letter_v2.pdf", b"new")},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201)
        doc.refresh_from_db()
        self.assertEqual(doc.ocr_status, "pending")
        self.assertEqual(doc.extracted_text, "")

    def test_versions_endpoint_returns_chain(self):
        doc = self._upload(self.hr)
        for i in (2, 3):
            self.client.post(
                f"/api/submissions/{self.submission.id}/documents/{doc.id}/replace/",
                {"file": _pdf(f"letter_v{i}.pdf", f"content {i}".encode())},
                format="multipart",
            )
        resp = self.client.get(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}/versions/"
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["current_version"], 3)
        self.assertEqual([v["version_num"] for v in data["versions"]], [2, 1])

        download = self.client.get(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}"
            f"/versions/{data['versions'][1]['id']}/download/"
        )
        self.assertEqual(download.status_code, 200)
        self.assertEqual(b"".join(download.streaming_content), b"%PDF-1.4 original")

    def test_replace_denied_for_unauthorised_role(self):
        doc = self._upload(self.hr)
        commissioner = User.objects.create_user("comm", password="x")
        Profile.objects.create(user=commissioner, role=Role.PSC_COMMISSIONER)
        self.client.force_authenticate(user=commissioner)
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}/replace/",
            {"file": _pdf()},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 403)

    # ── Delete vs archive ────────────────────────────────────────────────────

    def test_delete_in_private_draft_is_hard_delete(self):
        doc = self._upload(self.hr)
        resp = self.client.delete(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}/"
        )
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(SubmissionDocument.all_objects.filter(pk=doc.pk).exists())

    def test_delete_after_workflow_event_archives(self):
        doc = self._upload(self.hr)
        # Submission has entered the workflow (e.g. returned for clarification,
        # pulled back to draft) — evidence must be preserved.
        WorkflowEvent.objects.create(
            submission=self.submission,
            actor=self.hr,
            previous_stage=WorkflowStage.DRAFT,
            new_stage=WorkflowStage.PENDING_DG_ENDORSEMENT,
        )
        resp = self.client.delete(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}/"
        )
        self.assertEqual(resp.status_code, 204)

        # Hidden from the default manager (lists, AI context, fingerprints)…
        self.assertFalse(SubmissionDocument.objects.filter(pk=doc.pk).exists())
        # …but the row and file still exist.
        archived = SubmissionDocument.all_objects.get(pk=doc.pk)
        self.assertIsNotNone(archived.archived_at)
        self.assertEqual(archived.archived_by, self.hr)
        self.assertEqual(archived.file.read(), b"%PDF-1.4 original")

        # Excluded from the documents list endpoint.
        listing = self.client.get(f"/api/submissions/{self.submission.id}/documents/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json(), [])

        # Version history of an archived document stays inspectable.
        versions = self.client.get(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}/versions/"
        )
        self.assertEqual(versions.status_code, 200)
        self.assertIsNotNone(versions.json()["archived_at"])

    def test_archived_document_not_directly_downloadable(self):
        doc = self._upload(self.hr)
        SubmissionDocument.all_objects.filter(pk=doc.pk).update(
            archived_at=timezone.now()
        )
        resp = self.client.get(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}/"
        )
        self.assertEqual(resp.status_code, 404)

    def test_psc_admin_can_replace_after_submission(self):
        doc = self._upload(self.hr)
        Submission.objects.filter(pk=self.submission.pk).update(
            current_stage=WorkflowStage.UNDER_ASSESSMENT
        )
        self.submission.refresh_from_db()
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/documents/{doc.id}/replace/",
            {"file": _pdf("corrected.pdf", b"corrected")},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        doc.refresh_from_db()
        self.assertEqual(doc.version_num, 2)
        self.assertEqual(doc.uploaded_by, self.admin)
