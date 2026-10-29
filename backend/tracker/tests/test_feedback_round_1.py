"""Ministry feedback, round 1: With label, editable returns, required digitized form,
24-hour recall window, DG letter instead of DG email, combined-scan splitting, receipt."""
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    Department, Ministry, Notification, Profile, PSCFormField, PSCFormResponse, PSCFormType, Role,
    Submission, WorkflowEvent, WorkflowStage,
)
from tracker.dynamic_form_validation import digitized_form_gap
from tracker.pack_split import _normalise, _segments_by_keywords
from tracker.subway_map import ministry_with_label
from tracker.transitions import can_edit_submission

SUBMIT = {"dg_approval_name": "Mr. John Kalo", "dg_approval_date": "2026-10-01"}


class _Base(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_FB1", name="Feedback Ministry")
        self.hr = User.objects.create_user("fb_hr", password="x", email="hr@example.org")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.form_type = PSCFormType.objects.create(
            code="FB-TEST", name="Feedback Test Form", routed_unit="hr", is_active=True,
        )
        self.sub = Submission.objects.create(
            title="Paper", ministry=self.ministry, form_type_code="FB-TEST",
            current_stage=WorkflowStage.DRAFT, received_at=timezone.now(), created_by=self.hr,
        )

    def api(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def submit(self, user=None):
        with mock.patch("tracker.tasks.queue_external_submission_confirmation_emails") as receipt, \
                mock.patch("tracker.tasks.queue_dg_paper_notice_emails"), \
                self.captureOnCommitCallbacks(execute=True):
            res = self.api(user or self.hr).post(
                f"/api/submissions/{self.sub.id}/transition/",
                {"new_stage": "submitted", **SUBMIT}, format="json",
            )
        return res, receipt


class WithLabelTests(_Base):
    def test_labels_never_name_an_officer(self):
        cases = {
            WorkflowStage.DRAFT: "Your ministry",
            WorkflowStage.RETURNED_FOR_CLARIFICATION: "Your ministry",
            WorkflowStage.PENDING_DG_ENDORSEMENT: "Ministry DG",
            WorkflowStage.SECRETARY_REVIEW: "OPSC Secretary",
            WorkflowStage.COMMISSION_SITTING: "Commission",
            WorkflowStage.SUBMITTED: "OPSC",
        }
        for stage, label in cases.items():
            self.sub.current_stage = stage
            self.assertEqual(ministry_with_label(self.sub), label, stage)

    def test_unit_stage_names_the_unit(self):
        self.sub.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW
        self.sub.routed_unit = "hr"
        self.assertEqual(ministry_with_label(self.sub), "OPSC HR Unit")


class EditableAfterReturnTests(_Base):
    def test_hr_can_edit_when_returned_for_clarification(self):
        self.sub.current_stage = WorkflowStage.RETURNED_FOR_CLARIFICATION
        self.assertTrue(can_edit_submission(Role.MINISTRY_HR, self.sub))

    def test_hr_still_locked_while_with_psc(self):
        self.sub.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW
        self.assertFalse(can_edit_submission(Role.MINISTRY_HR, self.sub))


class DigitizedFormRequiredTests(_Base):
    def setUp(self):
        super().setUp()
        self.form_type.is_digitized = True
        self.form_type.save()
        PSCFormField.objects.create(
            form_type=self.form_type, field_key="officer_name", label="Officer", field_type="text",
            is_required=True,
        )

    def test_missing_form_blocks(self):
        self.assertIn("Complete and save", digitized_form_gap(self.sub))

    def test_incomplete_form_blocks(self):
        PSCFormResponse.objects.create(submission=self.sub, form_type=self.form_type, data={"officer_name": ""})
        self.assertIn("incomplete", digitized_form_gap(self.sub))

    def test_training_ministry_needs_no_form(self):
        self.ministry.code = "PRAC"
        self.ministry.save()
        self.assertIsNone(digitized_form_gap(self.sub))

    def test_complete_form_passes(self):
        PSCFormResponse.objects.create(submission=self.sub, form_type=self.form_type, data={"officer_name": "A"})
        self.assertIsNone(digitized_form_gap(self.sub))

    @override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
    def test_submit_is_refused_without_the_form(self):
        res, _ = self.submit()
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn("Digitized Form", res.json()["detail"])
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.DRAFT)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"], SUBMISSION_RECALL_WINDOW_HOURS=24)
class RecallWindowTests(_Base):
    def setUp(self):
        super().setUp()
        self.manager = User.objects.create_user("fb_mgr", password="x")
        Profile.objects.create(user=self.manager, role=Role.HR_UNIT_MANAGER)

    def test_submit_waits_at_submitted_and_opsc_is_not_told(self):
        res, receipt = self.submit()
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.SUBMITTED)
        self.assertFalse(self.sub.routed_unit)
        self.assertFalse(Notification.objects.filter(recipient=self.manager).exists())
        receipt.assert_called_once()  # the ministry still gets its receipt straight away

    def test_ministry_sees_a_deadline_and_opsc_does_not(self):
        self.submit()
        body = self.api(self.hr).get(f"/api/submissions/{self.sub.id}/").json()
        self.assertTrue(body["recall_deadline"])
        self.assertEqual(self.api(self.hr).get("/api/submissions/").json()["results"][0]["with_label"], "OPSC")

    def test_release_routes_and_tells_the_unit(self):
        from tracker.recall_window import release

        self.submit()
        self.sub.refresh_from_db()
        self.assertTrue(release(self.sub))
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)
        self.assertTrue(Notification.objects.filter(recipient=self.manager, submission=self.sub).exists())

    def test_sweep_only_releases_after_the_window(self):
        from datetime import timedelta

        from tracker.recall_window import release_due_submissions

        self.submit()
        self.assertEqual(release_due_submissions(), 0)
        WorkflowEvent.objects.filter(submission=self.sub, new_stage=WorkflowStage.SUBMITTED).update(
            created_at=timezone.now() - timedelta(hours=25),
        )
        self.assertEqual(release_due_submissions(), 1)

    def test_send_now_releases_early(self):
        self.submit()
        res = self.api(self.hr).post(f"/api/submissions/{self.sub.id}/send-now/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["current_stage"], WorkflowStage.MANAGER_CHECKLIST_REVIEW)

    def test_ministry_can_recall_then_reopen(self):
        self.submit()
        c = self.api(self.hr)
        res = c.post(f"/api/submissions/{self.sub.id}/transition/",
                     {"new_stage": "recalled", "remarks_html": "<p>Wrong officer</p>"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        res = c.post(f"/api/submissions/{self.sub.id}/transition/", {"new_stage": "draft"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)

    def test_training_ministry_papers_skip_the_window(self):
        self.ministry.code = "PRAC"
        self.ministry.save()
        res, _ = self.submit()
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)
        self.assertTrue(Notification.objects.filter(recipient=self.manager).exists())
        body = self.api(self.hr).get(f"/api/submissions/{self.sub.id}/").json()
        self.assertFalse(body["recall_deadline"])

    @override_settings(SUBMISSION_RECALL_WINDOW_HOURS=0)
    def test_window_can_be_switched_off(self):
        self.submit()
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ReceiptAndDgTests(_Base):
    def test_department_admin_who_submits_gets_the_receipt(self):
        admin = User.objects.create_user("fb_admin", password="x", email="admin@example.org")
        dept = Department.objects.create(ministry=self.ministry, code="D1", name="Dept One")
        Profile.objects.create(user=admin, role=Role.DEPT_ADMIN, ministry=self.ministry, department=dept)
        self.sub.department = dept
        self.sub.save()
        res, receipt = self.submit(admin)
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn(admin.id, receipt.call_args.args[1])

    def test_sending_to_the_dg_is_refused_while_the_switch_is_off(self):
        res = self.api(self.hr).post(
            f"/api/submissions/{self.sub.id}/transition/", {"new_stage": "pending_dg_endorsement"}, format="json",
        )
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn("not enabled", res.json()["detail"])


class PackSplitTests(TestCase):
    SLOTS = [{"id": 1, "name": "Medical certificate"}, {"id": 2, "name": "Position description"}]

    def test_normalise_fills_gaps_and_clamps(self):
        out = _normalise(
            [{"start_page": 2, "end_page": 3, "required_document_id": 1, "name": "Medical"},
             {"start_page": 5, "end_page": 99, "required_document_id": 77, "name": "X"}],
            6, self.SLOTS,
        )
        spans = [(s["start_page"], s["end_page"]) for s in out]
        self.assertEqual(spans, [(1, 1), (2, 3), (4, 4), (5, 6)])
        self.assertEqual(out[1]["required_document_id"], 1)
        self.assertIsNone(out[3]["required_document_id"])      # unknown id is dropped

    def test_keyword_fallback_groups_continuation_pages(self):
        texts = ["Medical certificate issued by Dr Tari", "continued findings", "Position description for the officer"]
        segs = _segments_by_keywords(texts, self.SLOTS)
        self.assertEqual([(s["start_page"], s["end_page"], s["required_document_id"]) for s in segs],
                         [(1, 2, 1), (3, 3, 2)])


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class PinVerifyMessageTests(TestCase):
    """The lock screen reads `detail`; every refusal used to look like "Invalid PIN"."""

    def setUp(self):
        from django.contrib.auth.hashers import make_password

        self.user = User.objects.create_user("pin_user", password="x")
        Profile.objects.create(user=self.user, role=Role.MINISTRY_HR, session_pin=make_password("1234"))

    def verify(self, pin):
        return APIClient().post("/api/auth/session-pin/verify/", {"username": "pin_user", "pin": pin}, format="json")

    def test_wrong_pin_says_so(self):
        res = self.verify("9999")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json(), {"detail": "Invalid PIN.", "code": "invalid_pin"})

    def test_right_pin_with_expired_sign_in_says_sign_in_again(self):
        res = self.verify("1234")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["code"], "trusted_session_expired")
        self.assertIn("sign in again", res.json()["detail"])


class SeedCleanupTests(TestCase):
    def test_cleanup_removes_exercise_4_cases_in_real_ministries_only(self):
        from django.core.management import call_command

        from tracker.models import DecisionService

        ministry = Ministry.objects.create(code="ZZ_E4", name="Real Ministry")
        secretary = User.objects.create_user("practice.secretary", password="x")
        owner = User.objects.create_user("zz_owner", password="x")
        mk = lambda ref, test: Submission.objects.create(  # noqa: E731
            reference_number=ref, title=ref, ministry=ministry, form_type_code="X",
            current_stage=WorkflowStage.MINUTES_DRAFTED_SIGNED, received_at=timezone.now(), is_test=test,
            created_by=owner,
        )
        practice = mk("TRAIN-OPSC-E4-SOMEONE", True)
        real_lookalike = mk("TRAIN-OPSC-E4-REAL", False)   # not a test case: must survive
        other = mk("PSC-2026-99999", False)
        DecisionService.objects.create(
            submission=practice, ministry=ministry, letter_body="x", served_by=secretary,
        )

        call_command("seed_opsc_training", "--cleanup", stdout=mock.MagicMock())

        left = set(Submission._base_manager.values_list("reference_number", flat=True))
        self.assertNotIn(practice.reference_number, left)
        self.assertIn(real_lookalike.reference_number, left)
        self.assertIn(other.reference_number, left)
        self.assertFalse(DecisionService.objects.exists())
        self.assertFalse(User.objects.filter(username="practice.secretary").exists())


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"], SUBMISSION_RECALL_WINDOW_HOURS=24)
class RecallWindowCutoffTests(_Base):
    def meeting(self, hours_from_now):
        from datetime import timedelta

        from tracker.models import Meeting, MeetingStatus

        when = timezone.now() + timedelta(hours=hours_from_now)
        return Meeting.objects.create(
            reference_number=f"ZZ-MTG-{hours_from_now}", title="Sitting", date=(when + timedelta(days=3)).date(),
            time="09:00", venue="Room", status=MeetingStatus.SCHEDULED, submission_cutoff=when,
        )

    def test_window_closes_at_the_due_date_when_that_comes_first(self):
        from datetime import timedelta

        cutoff = self.meeting(10).submission_cutoff
        self.submit()
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.SUBMITTED)
        deadline = self.api(self.hr).get(f"/api/submissions/{self.sub.id}/").json()["recall_deadline"]
        self.assertAlmostEqual(
            timezone.datetime.fromisoformat(deadline).timestamp(), cutoff.timestamp(), delta=1,
        )
        # ...and the sweep releases it then, not 24 hours after submitting.
        from tracker.recall_window import release_due_submissions

        self.assertEqual(release_due_submissions(), 0)
        self.meeting_obj = self.sub.scheduled_meeting
        self.meeting_obj.submission_cutoff = timezone.now() - timedelta(minutes=1)
        self.meeting_obj.save()
        self.assertEqual(release_due_submissions(), 1)

    def test_paper_submitted_right_at_the_due_date_is_routed_straight_away(self):
        self.meeting(0)   # cutoff is now, so it is already past by the time the paper is submitted
        self.submit()
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)

    def test_a_far_off_due_date_keeps_the_full_24_hours(self):
        self.meeting(24 * 10)
        self.submit()
        self.sub.refresh_from_db()
        from datetime import timedelta
        from tracker.recall_window import recall_deadline, submitted_at

        self.assertEqual(recall_deadline(self.sub), submitted_at(self.sub) + timedelta(hours=24))
