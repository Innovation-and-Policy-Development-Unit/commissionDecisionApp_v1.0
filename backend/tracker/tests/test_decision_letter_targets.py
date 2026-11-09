"""Decision letters addressed to a particular ministry and department.

An OPSC-internal paper that covers every ministry (ODU's Organisation Performance Assessment
Feedback Report) has no ministry of its own, and the Commission's decisions on it are aimed at
particular ministries and departments. The OPSC unit prepares one letter per target and hands it
to that ministry's HR, as for any Commission decision.
"""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    CommissionTask, Department, DecisionLetter, Ministry, Notification, Profile, Role,
    RoutedUnit, Submission, WorkflowStage,
)


def _user(name, role, **kw):
    u = User.objects.create_user(name, password="x")
    Profile.objects.create(user=u, role=role, **kw)
    return u


def _ids(user):
    data = _client(user).get("/api/decision-letters/").data
    rows = data.get("results", []) if isinstance(data, dict) else data
    return [r["id"] for r in rows]


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DecisionLetterTargetTests(TestCase):
    def setUp(self):
        self.opm = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        self.mq = Ministry.objects.create(code="MQ", name="Ministry Q")
        self.mr = Ministry.objects.create(code="MR", name="Ministry R")
        self.q1 = Department.objects.create(ministry=self.mq, code="Q1", name="Q Department One")
        self.q2 = Department.objects.create(ministry=self.mq, code="Q2", name="Q Department Two")
        self.manager = _user("dl_mgr", Role.ODU_MANAGER)
        self.principal = _user("dl_prin", Role.ODU_PRINCIPAL)
        self.stranger = _user("dl_other", Role.ODU_SENIOR)
        self.secretary = _user("dl_sec", Role.PSC_SECRETARY)
        self.hr_q = _user("dl_hr_q", Role.MINISTRY_HR, ministry=self.mq)
        self.hr_r = _user("dl_hr_r", Role.MINISTRY_HR, ministry=self.mr)
        self.dept_q1 = _user("dl_da_q1", Role.DEPT_ADMIN, ministry=self.mq, department=self.q1)
        self.dept_q2 = _user("dl_da_q2", Role.DEPT_ADMIN, ministry=self.mq, department=self.q2)

        # ODU's performance report: OPSC-internal, so it has no ministry of its own.
        self.paper = Submission.objects.create(
            reference_number="SUB-DL-OPA", title="Organisation Performance Assessment Feedback Report 2026",
            form_type_code="ODU-OPA-FEEDBACK-REPORT", ministry=self.opm, is_internal=True,
            routed_unit=RoutedUnit.ODU, current_stage=WorkflowStage.DECISION_ENTERED_ASSIGNED,
            received_at=timezone.now(), created_by=self.manager,
        )
        self.task = CommissionTask.objects.create(
            title="Ministry Q: performance improvement plan", submission=self.paper,
            assigned_manager=self.manager, assigned_staff=self.principal, created_by=self.manager,
        )

    def _prepare(self, user=None, **extra):
        body = {"commission_task": self.task.id, "subject": "Performance improvement plan", "body_text": "Dear Director General..."}
        body.update(extra)
        return _client(user or self.principal).post("/api/decision-letters/", body, format="json")

    def _make_ready(self, **extra):
        res = self._prepare(**extra)
        self.assertEqual(res.status_code, 201, res.content)
        letter = DecisionLetter.objects.get(pk=res.data["id"])
        self.assertEqual(_client(self.secretary).post(f"/api/decision-letters/{letter.id}/mark-signed/").status_code, 200)
        return letter

    # ── preparing ──
    def test_a_letter_from_an_internal_paper_must_say_which_ministry_it_is_for(self):
        res = self._prepare()
        self.assertEqual(res.status_code, 400)
        self.assertIn("ministry", res.data)

    def test_the_letter_records_its_ministry_and_department(self):
        res = self._prepare(ministry=self.mq.id, department=self.q1.id)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual((res.data["ministry_name"], res.data["department_name"]), ("Ministry Q", "Q Department One"))

    def test_a_department_must_belong_to_the_chosen_ministry(self):
        res = self._prepare(ministry=self.mr.id, department=self.q1.id)
        self.assertEqual(res.status_code, 400)
        self.assertIn("department", res.data)

    def test_a_department_alone_is_not_enough(self):
        self.assertEqual(self._prepare(department=self.q1.id).status_code, 400)

    def test_only_the_action_officer_or_manager_can_prepare_it(self):
        self.assertEqual(self._prepare(user=self.stranger, ministry=self.mq.id).status_code, 403)

    def test_a_ministry_lodged_paper_still_writes_to_its_own_ministry(self):
        own = Submission.objects.create(
            reference_number="SUB-DL-OWN", title="Appointment", form_type_code="PSC 3-7", ministry=self.mq,
            current_stage=WorkflowStage.DECISION_ENTERED_ASSIGNED, received_at=timezone.now(), created_by=self.hr_q,
        )
        task = CommissionTask.objects.create(
            title="Appoint", submission=own, assigned_manager=self.manager,
            assigned_staff=self.principal, created_by=self.manager,
        )
        res = _client(self.principal).post("/api/decision-letters/", {
            "commission_task": task.id, "subject": "Appointment letter"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data["ministry_name"], "Ministry Q")  # taken from the paper

    # ── handing it over ──
    def test_only_the_target_ministrys_hr_is_told(self):
        letter = self._make_ready(ministry=self.mq.id)
        res = _client(self.principal).post(f"/api/decision-letters/{letter.id}/notify-pickup/")
        self.assertEqual(res.status_code, 200, res.content)
        told = set(Notification.objects.filter(title__startswith="Decision letter ready").values_list("recipient__username", flat=True))
        self.assertEqual(told, {"dl_hr_q", "dl_da_q1", "dl_da_q2"})
        self.assertNotIn("dl_hr_r", told)

    def test_a_department_letter_skips_other_departments_administrators(self):
        letter = self._make_ready(ministry=self.mq.id, department=self.q1.id)
        _client(self.principal).post(f"/api/decision-letters/{letter.id}/notify-pickup/")
        told = set(Notification.objects.filter(title__startswith="Decision letter ready").values_list("recipient__username", flat=True))
        self.assertEqual(told, {"dl_hr_q", "dl_da_q1"})

    def test_the_notice_never_links_to_the_internal_paper(self):
        letter = self._make_ready(ministry=self.mq.id)
        _client(self.principal).post(f"/api/decision-letters/{letter.id}/notify-pickup/")
        note = Notification.objects.get(recipient=self.hr_q, title__startswith="Decision letter ready")
        self.assertIsNone(note.submission_id)
        self.assertIn("Performance improvement plan", note.title)
        self.assertNotIn("SUB-DL-OPA", note.title + note.body)
        self.assertIn("Ministry Q", note.body)

    def test_the_unit_that_hands_the_letter_over_can_record_the_collection(self):
        letter = self._make_ready(ministry=self.mq.id)
        _client(self.principal).post(f"/api/decision-letters/{letter.id}/notify-pickup/")
        res = _client(self.principal).post(f"/api/decision-letters/{letter.id}/mark-picked-up/", {"note": "Collected by Q HR"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        letter.refresh_from_db()
        self.assertEqual(letter.status, "picked_up")

    def test_an_unrelated_odu_officer_cannot_record_a_collection(self):
        letter = self._make_ready(ministry=self.mq.id)
        _client(self.principal).post(f"/api/decision-letters/{letter.id}/notify-pickup/")
        self.assertEqual(_client(self.stranger).post(f"/api/decision-letters/{letter.id}/mark-picked-up/").status_code, 403)

    # ── who sees it ──
    def test_a_ministry_sees_only_letters_addressed_to_it_and_only_once_ready(self):
        letter = self._make_ready(ministry=self.mq.id)
        self.assertEqual(_ids(self.hr_q), [])  # signed, not yet ready for pickup
        _client(self.principal).post(f"/api/decision-letters/{letter.id}/notify-pickup/")
        self.assertEqual(_ids(self.hr_q), [letter.id])
        self.assertEqual(_ids(self.hr_r), [])

    def test_a_department_letter_is_hidden_from_another_departments_administrator(self):
        letter = self._make_ready(ministry=self.mq.id, department=self.q1.id)
        _client(self.principal).post(f"/api/decision-letters/{letter.id}/notify-pickup/")
        self.assertEqual(_ids(self.dept_q1), [letter.id])
        self.assertEqual(_ids(self.dept_q2), [])
        self.assertEqual(_ids(self.hr_q), [letter.id])  # the ministry's HR still sees it

    def test_the_task_tells_the_screen_the_paper_is_internal(self):
        res = _client(self.manager).get(f"/api/commission-tasks/{self.task.id}/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(res.data["submission_is_internal"])

    def test_the_secretary_can_sign_a_letter_for_a_task_they_are_not_allocated(self):
        res = self._prepare(ministry=self.mq.id)
        self.assertEqual(res.status_code, 201, res.content)
        signed = _client(self.secretary).post(f"/api/decision-letters/{res.data['id']}/mark-signed/")
        self.assertEqual(signed.status_code, 200, signed.content)
        self.assertEqual(signed.data["status"], "signed")

    def test_an_unrelated_odu_officer_can_see_the_register_but_cannot_sign_or_edit(self):
        res = self._prepare(ministry=self.mq.id)
        letter_id = res.data["id"]
        self.assertEqual(_client(self.stranger).post(f"/api/decision-letters/{letter_id}/mark-signed/").status_code, 403)
        self.assertEqual(
            _client(self.stranger).patch(f"/api/decision-letters/{letter_id}/", {"subject": "Changed"}, format="json").status_code, 403,
        )
