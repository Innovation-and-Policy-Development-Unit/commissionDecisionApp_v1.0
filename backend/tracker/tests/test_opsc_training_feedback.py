"""OPSC staff training feedback: the submissions list defaults to every status,
unit Principals see their Seniors' work, a duplicate title is blocked while the
first submission is still open, and a Direct Appointment belongs to the HR Unit
however it was raised."""

from importlib import import_module

from django.apps import apps as global_apps
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    Department,
    FormCategory,
    Ministry,
    Profile,
    PSCFormType,
    Role,
    RoutedUnit,
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


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DirectAppointmentRoutingTests(TestCase):
    """A Direct Appointment is an HR Unit submission type. VIPAM raised them and
    they stayed in VIPAM's queue, because the create path stamped its own unit on
    the submission and the auto-routing only fills that field when it is blank."""

    def setUp(self):
        # resolve_opsc_submission_org needs the OPM ministry and OPSC department.
        self.opm = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        Department.objects.create(
            ministry=self.opm, code="OPSC", name="Office of the Public Service Commission",
        )
        self.form_cat = FormCategory.objects.create(code="psc_da", name="PSC DA")
        # RECRUIT-DIRECT is seeded by migrations 0157/0183/0186 — routed to the
        # HR Unit, in the Direct Appointment section. Assert that, don't recreate it.
        self.direct = PSCFormType.objects.get(code="RECRUIT-DIRECT")
        self.assertEqual(self.direct.routed_unit, "hr")
        self.assertEqual(self.direct.agenda_category, "direct_appointment")
        self.vipam_own = PSCFormType.objects.create(
            code="VIPAM-OWN", name="A VIPAM matter", routed_unit="",
            agenda_category="other", is_active=True,
        )
        self.principal = User.objects.create_user("da_vipam_principal", password="x")
        Profile.objects.create(user=self.principal, role=Role.VIPAM_PRINCIPAL, ministry=self.opm)

    def _create(self, form_code, title):
        client = APIClient()
        client.force_authenticate(user=self.principal)
        return client.post("/api/submissions/", {
            "title": title,
            "form_category": self.form_cat.id,
            "form_type_code": form_code,
            "received_at": timezone.now().isoformat(),
        }, format="json")

    def test_vipam_raising_a_direct_appointment_routes_it_to_hr(self):
        res = self._create("RECRUIT-DIRECT", "Direct appointment, Harbour Master")
        self.assertEqual(res.status_code, 201, res.data)
        sub = Submission.objects.get(pk=res.data["id"])
        self.assertEqual(sub.routed_unit, RoutedUnit.HR)

    def test_a_form_type_with_no_routing_of_its_own_stays_with_vipam(self):
        res = self._create("VIPAM-OWN", "Something VIPAM owns")
        self.assertEqual(res.status_code, 201, res.data)
        sub = Submission.objects.get(pk=res.data["id"])
        self.assertEqual(sub.routed_unit, RoutedUnit.VIPAM)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DirectAppointmentMigrationTests(TestCase):
    """The data half: form types configured as VIPAM move to HR, and the
    submissions the old create path stranded follow them — but only the ones
    nobody has started on."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_DA", name="Direct Appointment Ministry")
        self.hr = User.objects.create_user("da_hr", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.officer = User.objects.create_user("da_officer", password="x")
        Profile.objects.create(user=self.officer, role=Role.VIPAM_PRINCIPAL, ministry=self.ministry)
        self.migration = import_module(
            "tracker.migrations.0290_direct_appointment_to_hr_unit",
        )

    def _run(self):
        self.migration.direct_appointment_to_hr(global_apps, None)

    def _sub(self, title, form_code, stage, **kwargs):
        return Submission.objects.create(
            title=title, ministry=self.ministry, form_type_code=form_code,
            current_stage=stage, routed_unit="vipam",
            received_at=timezone.now(), created_by=self.hr, **kwargs,
        )

    def test_a_vipam_configured_direct_appointment_type_moves_to_hr(self):
        ft = PSCFormType.objects.create(
            code="VIPAM-DIRECT", name="Direct Appointment (VIPAM)", routed_unit="vipam",
            agenda_category="direct_appointment", is_active=True,
        )
        self._run()
        ft.refresh_from_db()
        self.assertEqual(ft.routed_unit, "hr")

    def test_vipams_other_work_is_left_alone(self):
        ft = PSCFormType.objects.create(
            code="VIPAM-ACTING", name="Acting Appointment", routed_unit="vipam",
            agenda_category="appointment", is_active=True,
        )
        self._run()
        ft.refresh_from_db()
        self.assertEqual(ft.routed_unit, "vipam", "only the Direct Appointment section moves")

    def test_untouched_submissions_follow_the_type(self):
        waiting = self._sub("Not started", "RECRUIT-DIRECT", WorkflowStage.MANAGER_CHECKLIST_REVIEW)
        self._run()
        waiting.refresh_from_db()
        self.assertEqual(waiting.routed_unit, "hr")

    def test_work_already_under_way_stays_with_vipam(self):
        assigned = self._sub(
            "Being assessed", "RECRUIT-DIRECT", WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            assigned_to=self.officer,
        )
        in_assessment = self._sub("Under assessment", "RECRUIT-DIRECT", WorkflowStage.UNDER_ASSESSMENT)
        self._run()
        for sub in (assigned, in_assessment):
            sub.refresh_from_db()
            self.assertEqual(sub.routed_unit, "vipam", sub.title)

    def test_running_it_twice_changes_nothing_further(self):
        waiting = self._sub("Not started", "RECRUIT-DIRECT", WorkflowStage.DRAFT)
        self._run()
        self._run()
        waiting.refresh_from_db()
        self.assertEqual(waiting.routed_unit, "hr")

    def test_it_is_a_no_op_with_nothing_to_move(self):
        before = dict(PSCFormType.objects.values_list("code", "routed_unit"))
        self._run()
        self.assertEqual(dict(PSCFormType.objects.values_list("code", "routed_unit")), before)

