"""OPSC staff training feedback: the submissions list defaults to every status,
unit Principals see their Seniors' work, and a duplicate title is blocked while
the first submission is still open."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    FormCategory,
    Ministry,
    Profile,
    PSCFormType,
    Role,
    Submission,
    WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class _Base(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_TF", name="Training Feedback Ministry")
        self.other_ministry = Ministry.objects.create(code="ZZ_TF2", name="Other Training Ministry")
        self.form_cat = FormCategory.objects.create(code="psc_tf", name="PSC TF")
        PSCFormType.objects.create(
            code="TF-TEST", name="Training Feedback Form", routed_unit="odu", is_active=True,
        )
        self.hr = self._user("tf_hr", Role.MINISTRY_HR, ministry=self.ministry)
        self.other_hr = self._user("tf_hr2", Role.MINISTRY_HR, ministry=self.other_ministry)
        self.manager = self._user("tf_odu_manager", Role.ODU_MANAGER)
        self.principal = self._user("tf_odu_principal", Role.ODU_PRINCIPAL)
        self.senior = self._user("tf_odu_senior", Role.ODU_SENIOR)
        self.other_senior = self._user("tf_odu_senior2", Role.ODU_SENIOR)

    def _user(self, username, role, **profile_kwargs):
        user = User.objects.create_user(username, password="x")
        Profile.objects.create(user=user, role=role, **profile_kwargs)
        return user

    def _sub(self, title, stage, **kwargs):
        kwargs.setdefault("ministry", self.ministry)
        kwargs.setdefault("created_by", self.hr)
        return Submission.objects.create(
            title=title, form_category=self.form_cat, form_type_code="TF-TEST",
            current_stage=stage, received_at=timezone.now(), **kwargs,
        )

    def _titles(self, user, query=""):
        client = APIClient()
        client.force_authenticate(user=user)
        res = client.get(f"/api/submissions/?page_size=100{query}")
        self.assertEqual(res.status_code, 200, res.data)
        return {row["title"] for row in res.json()["results"]}


class DefaultStatusFilterTests(_Base):
    """The list used to narrow unit staff to the four stages still in their
    court, which hid their own drafts — VIPAM saved a submission and could not
    find it afterwards."""

    def test_default_list_shows_every_stage(self):
        self._sub("Unit draft", WorkflowStage.DRAFT, routed_unit="odu")
        self._sub("Already forwarded on", WorkflowStage.FORWARDED_TO_COMMISSION, routed_unit="odu")
        self._sub("Still in assessment", WorkflowStage.UNDER_ASSESSMENT, routed_unit="odu")
        for user in (self.manager, self.principal):
            titles = self._titles(user)
            self.assertEqual(
                titles,
                {"Unit draft", "Already forwarded on", "Still in assessment"},
                f"{user.username} did not get every stage by default",
            )

    def test_an_explicit_stage_still_filters(self):
        self._sub("Unit draft", WorkflowStage.DRAFT, routed_unit="odu")
        self._sub("Still in assessment", WorkflowStage.UNDER_ASSESSMENT, routed_unit="odu")
        self.assertEqual(
            self._titles(self.manager, "&current_stage=draft"), {"Unit draft"},
        )

    def test_the_old_all_statuses_param_is_still_accepted(self):
        # Bookmarked links and the Stage filter used to send current_stage=__all__.
        self._sub("Unit draft", WorkflowStage.DRAFT, routed_unit="odu")
        self.assertEqual(
            self._titles(self.manager, "&current_stage=__all__"), {"Unit draft"},
        )


class UnitPrincipalVisibilityTests(_Base):
    def test_principal_sees_the_whole_units_queue(self):
        self._sub("Senior's assessment", WorkflowStage.UNDER_ASSESSMENT,
                  routed_unit="odu", assigned_to=self.senior)
        self._sub("Unassigned unit paper", WorkflowStage.MANAGER_CHECKLIST_REVIEW, routed_unit="odu")
        self.assertEqual(
            self._titles(self.principal),
            {"Senior's assessment", "Unassigned unit paper"},
        )

    def test_principal_does_not_see_another_units_queue(self):
        self._sub("HR unit paper", WorkflowStage.UNDER_ASSESSMENT, routed_unit="hr")
        self.assertEqual(self._titles(self.principal), set())

    def test_senior_still_only_sees_their_own_work(self):
        self._sub("Mine", WorkflowStage.UNDER_ASSESSMENT, routed_unit="odu", assigned_to=self.senior)
        self._sub("Theirs", WorkflowStage.UNDER_ASSESSMENT, routed_unit="odu",
                  assigned_to=self.other_senior)
        self.assertEqual(self._titles(self.senior), {"Mine"})

    def test_unit_internal_draft_reaches_the_manager_and_principal(self):
        # routed_unit is blank until it is derived on submit, so an internal
        # paper a Senior drafts is findable only through its author's unit.
        self._sub("Internal ODU paper", WorkflowStage.DRAFT,
                  is_internal=True, routed_unit="", created_by=self.senior)
        for user in (self.manager, self.principal, self.senior):
            self.assertIn("Internal ODU paper", self._titles(user), user.username)


class DuplicateTitleTests(_Base):
    def _create(self, title, user=None, ministry=None):
        client = APIClient()
        client.force_authenticate(user=user or self.hr)
        return client.post("/api/submissions/", {
            "title": title,
            "form_category": self.form_cat.id,
            "form_type_code": "TF-TEST",
            "ministry": (ministry or self.ministry).id,
            "received_at": timezone.now().isoformat(),
        }, format="json")

    def test_duplicate_title_blocked_while_the_first_is_open(self):
        self._sub("Appointment of Finance Officer", WorkflowStage.UNDER_ASSESSMENT)
        res = self._create("Appointment of Finance Officer")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("title", res.data)

    def test_the_block_ignores_case_and_surrounding_space(self):
        self._sub("Appointment of Finance Officer", WorkflowStage.UNDER_ASSESSMENT)
        res = self._create("  appointment of FINANCE officer ")
        self.assertEqual(res.status_code, 400, res.data)

    def test_title_is_free_again_once_the_first_is_settled(self):
        first = self._sub("Monthly report", WorkflowStage.UNDER_ASSESSMENT)
        first.current_stage = WorkflowStage.APPROVED
        first.save(update_fields=["current_stage"])
        res = self._create("Monthly report")
        self.assertEqual(res.status_code, 201, res.data)

    def test_another_ministry_may_use_the_same_title(self):
        self._sub("Monthly report", WorkflowStage.UNDER_ASSESSMENT)
        res = self._create("Monthly report", user=self.other_hr, ministry=self.other_ministry)
        self.assertEqual(res.status_code, 201, res.data)

    def test_a_first_submission_is_not_blocked_by_itself(self):
        res = self._create("Brand new matter")
        self.assertEqual(res.status_code, 201, res.data)
