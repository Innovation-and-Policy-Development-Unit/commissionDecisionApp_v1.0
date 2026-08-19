"""Tests for a draft submission's own creator editing its title/type.

Mirrors the "own draft" pattern in test_trash_bin.py: the creator of a draft
may act on it even without one of the roles SubmissionViewSet.perform_update
normally requires — but here the allowance is narrower (title/form_type_code/
form_category only), matching the exact ask that motivated it.
"""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    FormCategory,
    Ministry,
    PSCFormType,
    Profile,
    Role,
    Submission,
    WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class OwnDraftEditTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-E", name="Test Ministry E")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]
        self.other_form_cat = FormCategory.objects.get_or_create(
            code="psc_3_7", defaults={"name": "PSC 3.7"}
        )[0]
        PSCFormType.objects.get_or_create(
            code="PSC 3.6", defaults={"name": "PSC 3.6", "form_category": self.form_cat},
        )
        PSCFormType.objects.get_or_create(
            code="PSC 3.7", defaults={"name": "PSC 3.7", "form_category": self.other_form_cat},
        )

        self.hr = User.objects.create_user("hruser2", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        # IPDU_MANAGER is in SubmissionViewSet.perform_update's editor-role
        # set (matching transitions.py's _DRAFT_ONLY_EDIT_ROLES, which has
        # always grouped it with MINISTRY_HR/DEPT_ADMIN/CSU_MANAGER) — so it
        # gets full draft-content edit rights via assert_can_edit_submission,
        # same as those roles.
        self.ipdu = User.objects.create_user("ipduuser", password="x")
        Profile.objects.create(user=self.ipdu, role=Role.IPDU_MANAGER, ministry=self.ministry)
        self.officer = User.objects.create_user("officer2", password="x")
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)
        # PRINCIPAL_OFFICER isn't in _EDITOR_ROLES and isn't one of
        # transitions.py's special-cased roles either — a plain "not a
        # recognised editor" role, used to exercise the own-draft-only
        # title/type allow-list path.
        self.principal = User.objects.create_user("principaluser", password="x")
        Profile.objects.create(user=self.principal, role=Role.PRINCIPAL_OFFICER)

    def _submission(self, stage=WorkflowStage.DRAFT, **kw):
        return Submission.objects.create(
            title=kw.pop("title", "Paper"),
            form_category=self.form_cat,
            form_type_code=kw.pop("form_type_code", "PSC 3.6"),
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=kw.pop("created_by", self.hr),
            current_stage=stage,
            **kw,
        )

    def test_creator_can_edit_title_and_type_on_own_draft(self):
        # IPDU_MANAGER's own-draft queryset scope (_submission_queryset_for)
        # only includes their own unrouted drafts when is_internal=True —
        # matches how real IPDU board papers are created.
        draft = self._submission(stage=WorkflowStage.DRAFT, created_by=self.ipdu, is_internal=True)
        self.client.force_authenticate(user=self.ipdu)
        resp = self.client.patch(
            f"/api/submissions/{draft.id}/",
            {"title": "Updated title", "form_type_code": "PSC 3.7", "form_category": self.other_form_cat.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        draft.refresh_from_db()
        self.assertEqual(draft.title, "Updated title")
        self.assertEqual(draft.form_type_code, "PSC 3.7")
        self.assertEqual(draft.form_category_id, self.other_form_cat.id)

    def test_creator_cannot_edit_other_fields_on_own_draft(self):
        draft = self._submission(stage=WorkflowStage.DRAFT, created_by=self.principal)
        self.client.force_authenticate(user=self.principal)
        resp = self.client.patch(
            f"/api/submissions/{draft.id}/", {"title": "New title", "notes": "sneaking this in"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)
        draft.refresh_from_db()
        self.assertEqual(draft.title, "Paper")

    def test_ipdu_manager_has_full_edit_rights_on_own_draft(self):
        # Regression check for the role-gate fix: IPDU_MANAGER now goes
        # through the same assert_can_edit_submission path as MINISTRY_HR/
        # DEPT_ADMIN/CSU_MANAGER, not the title/type-only allow-list.
        draft = self._submission(stage=WorkflowStage.DRAFT, created_by=self.ipdu, is_internal=True)
        self.client.force_authenticate(user=self.ipdu)
        resp = self.client.patch(
            f"/api/submissions/{draft.id}/", {"title": "New title", "notes": "internal note"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        draft.refresh_from_db()
        self.assertEqual(draft.notes, "internal note")

    def test_creator_cannot_edit_once_past_draft(self):
        submitted = self._submission(stage=WorkflowStage.SUBMITTED, created_by=self.officer)
        self.client.force_authenticate(user=self.officer)
        resp = self.client.patch(
            f"/api/submissions/{submitted.id}/", {"title": "New title"}, format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_non_creator_without_role_cannot_edit_someone_elses_draft(self):
        others_draft = self._submission(stage=WorkflowStage.DRAFT, created_by=self.hr)
        self.client.force_authenticate(user=self.officer)
        resp = self.client.patch(
            f"/api/submissions/{others_draft.id}/", {"title": "New title"}, format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_form_type_change_blocked_once_past_draft_even_for_editor_role(self):
        submitted = self._submission(stage=WorkflowStage.SUBMITTED, created_by=self.hr)
        self.client.force_authenticate(user=self.hr)
        resp = self.client.patch(
            f"/api/submissions/{submitted.id}/", {"form_type_code": "PSC 3.7"}, format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_ministry_hr_still_has_full_edit_rights_on_own_draft(self):
        # Regression check: existing editor roles keep unrestricted field
        # access on their own draft — the new allow-list only applies to
        # roles outside _EDITOR_ROLES.
        draft = self._submission(stage=WorkflowStage.DRAFT, created_by=self.hr)
        self.client.force_authenticate(user=self.hr)
        resp = self.client.patch(
            f"/api/submissions/{draft.id}/", {"title": "New title", "notes": "internal note"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        draft.refresh_from_db()
        self.assertEqual(draft.notes, "internal note")
