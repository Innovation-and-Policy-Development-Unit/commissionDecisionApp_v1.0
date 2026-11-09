"""Commissioner AI: per-paper chat and the "Review and recommend" card."""

from unittest.mock import patch

from django.utils import timezone

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from ..ai import case_chat
from ..models import (
    Ministry, Profile, Role, Submission, SubmissionChatMessage, SubmissionDocument, WorkflowStage,
)


def _user(name, role, **kw):
    u = User.objects.create_user(name, password="x")
    Profile.objects.create(user=u, role=role, **kw)
    return u


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class CaseAssistantTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="MA", name="Ministry A")
        self.hr = _user("hr_ca", Role.MINISTRY_HR, ministry=self.ministry)
        self.comm = _user("comm_ca", Role.PSC_COMMISSIONER)
        self.comm2 = _user("comm2_ca", Role.PSC_COMMISSIONER)
        self.sub = Submission.objects.create(
            reference_number="SUB-CA-1", title="Appointment of Director", form_type_code="3-7",
            ministry=self.ministry, current_stage=WorkflowStage.UNDER_ASSESSMENT, created_by=self.hr,
            received_at=timezone.now(), ai_outcome_processed=True, ai_outcome_recommendation="approve_with_conditions",
            ai_outcome_confidence=70, ai_outcome_rationale="Meets the criteria.",
        )
        SubmissionDocument.objects.create(
            submission=self.sub, original_name="cv.pdf", extracted_text="Jane Doe, 12 years' service.",
            uploaded_by=self.hr,
        )
        self.url = f"/api/submissions/{self.sub.pk}/case-chat/"

    def _ask(self, user, message="Who is the candidate?", reply="Jane Doe [cv.pdf]"):
        with patch.object(case_chat, "ai_enabled", lambda: True), \
             patch("tracker.ai.case_chat.complete_chat_with_error", return_value=(reply, None)):
            return _client(user).post(self.url, {"message": message}, format="json")

    # ── chat ──
    def test_commissioner_question_and_answer_are_stored(self):
        r = self._ask(self.comm)
        self.assertEqual(r.status_code, 201)
        self.assertEqual([m["role"] for m in r.data["messages"]], ["user", "assistant"])
        self.assertEqual(SubmissionChatMessage.objects.filter(submission=self.sub, user=self.comm).count(), 2)
        self.assertIn("verify", r.data["disclaimer"])

    def test_ministry_hr_cannot_use_the_assistant(self):
        r = _client(self.hr).get(self.url)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(_client(self.hr).get(f"/api/submissions/{self.sub.pk}/review-card/").status_code, 403)

    def test_threads_are_private_to_each_user(self):
        self._ask(self.comm)
        r = _client(self.comm2).get(self.url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["messages"], [])

    def test_a_failed_answer_stores_nothing(self):
        with patch.object(case_chat, "ai_enabled", lambda: True), \
             patch("tracker.ai.case_chat.complete_chat_with_error", return_value=(None, "quota")):
            r = _client(self.comm).post(self.url, {"message": "Hello?"}, format="json")
        self.assertEqual(r.status_code, 502)
        self.assertEqual(SubmissionChatMessage.objects.count(), 0)

    def test_empty_and_oversized_questions_are_rejected(self):
        self.assertEqual(_client(self.comm).post(self.url, {"message": "  "}, format="json").status_code, 400)
        self.assertEqual(_client(self.comm).post(self.url, {"message": "x" * 2001}, format="json").status_code, 400)

    def test_delete_clears_only_the_callers_thread(self):
        self._ask(self.comm)
        self._ask(self.comm2)
        self.assertEqual(_client(self.comm).delete(self.url).status_code, 204)
        self.assertEqual(_client(self.comm).get(self.url).data["messages"], [])
        self.assertEqual(len(_client(self.comm2).get(self.url).data["messages"]), 2)

    def test_prompt_carries_the_paper_and_its_documents(self):
        prompt = case_chat.build_case_chat_system_prompt(self.sub, "who is the candidate")
        self.assertIn("SUB-CA-1", prompt)
        self.assertIn("cv.pdf", prompt)
        self.assertIn("Jane Doe", prompt)
        self.assertIn("approve_with_conditions", prompt)

    def test_earlier_turns_are_sent_back_as_history(self):
        self._ask(self.comm, message="First?", reply="One.")
        with patch.object(case_chat, "ai_enabled", lambda: True), \
             patch("tracker.ai.case_chat.complete_chat_with_error", return_value=("Two.", None)) as m:
            _client(self.comm).post(self.url, {"message": "Second?"}, format="json")
        sent = [x["content"] for x in m.call_args.kwargs["messages"]]
        self.assertEqual(sent, ["First?", "One.", "Second?"])

    # ── review card ──
    def test_card_reads_stored_results_without_calling_the_model(self):
        with patch("tracker.ai.case_chat.complete_chat_with_error") as chat, \
             patch("tracker.ai.case_chat.complete_json_with_error") as js:
            r = _client(self.comm).get(f"/api/submissions/{self.sub.pk}/review-card/")
        self.assertEqual(r.status_code, 200)
        chat.assert_not_called()
        js.assert_not_called()
        self.assertEqual(r.data["recommendation"]["action"], "approve_with_conditions")
        self.assertIsNone(r.data["risk"])
        self.assertFalse(r.data["questions"]["processed"])

    def test_refresh_queues_recommendation_risk_and_questions(self):
        with patch("tracker.tasks.queue_recommended_outcome") as o, \
             patch("tracker.tasks.queue_risk_assessment") as k, \
             patch("tracker.tasks.queue_review_questions") as q:
            r = _client(self.comm).post(f"/api/submissions/{self.sub.pk}/review-card/refresh/")
        self.assertEqual(r.status_code, 202)
        o.assert_called_once()
        k.assert_called_once()
        q.assert_called_once_with(self.sub.id)

    def test_questions_are_stored_by_the_task(self):
        from ..tasks import generate_review_questions_task

        fake = [{"question": "Is the post budgeted?", "why": "Form is silent.", "source": "form"}]
        with patch("tracker.ai.case_chat.generate_review_questions", return_value=(fake, None)):
            generate_review_questions_task.apply(args=[self.sub.id])
        self.sub.refresh_from_db()
        self.assertTrue(self.sub.ai_review_questions_processed)
        self.assertEqual(self.sub.ai_review_questions, fake)

    def test_question_parser_drops_junk_and_caps_the_list(self):
        raw = {"questions": [{"question": f"Q{i}", "why": "w"} for i in range(12)] + [{"question": " "}, 5]}
        out = case_chat._sanitize_questions(raw)
        self.assertEqual(len(out), 7)
        self.assertEqual(case_chat._sanitize_questions("nonsense"), [])

    def test_stored_recommendation_uses_the_key_the_model_module_returns(self):
        from ..tasks import generate_recommended_outcome

        result = {"recommended_outcome": "defer", "confidence": 55, "rationale": "r",
                  "conditions": [], "precedents": [], "legal_basis": "s"}
        with patch("tracker.ai.claude_client.ai_enabled", return_value=True), \
             patch("tracker.ai.B3_recommended_outcome.recommend_outcome", return_value=(result, None)):
            generate_recommended_outcome.apply(args=[self.sub.id], kwargs={"force": True})
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.ai_outcome_recommendation, "defer")

    # ── secretariat log ──
    def test_secretariat_sees_every_thread_but_commissioners_do_not(self):
        self._ask(self.comm, message="A?")
        self._ask(self.comm2, message="B?")
        sec = _user("sec_ca", Role.PSC_SECRETARY)
        url = f"/api/submissions/{self.sub.pk}/case-chat/log/"
        r = _client(sec).get(url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual({t["name"] for t in r.data["threads"]}, {"comm_ca", "comm2_ca"})
        self.assertEqual(_client(self.comm).get(url).status_code, 403)
        self.assertEqual(_client(self.hr).get(url).status_code, 403)

    def test_clearing_hides_it_from_the_asker_but_not_the_secretariat(self):
        self._ask(self.comm)
        _client(self.comm).delete(self.url)
        sec = _user("sec2_ca", Role.PSC_SECRETARY)
        r = _client(sec).get(f"/api/submissions/{self.sub.pk}/case-chat/log/")
        self.assertEqual(len(r.data["threads"][0]["messages"]), 2)
        # and a fresh question after clearing does not resurrect the old turns as history
        self._ask(self.comm, message="Again?")
        self.assertEqual(len(_client(self.comm).get(self.url).data["messages"]), 2)

    def test_a_failed_outcome_run_does_not_leak_the_provider_error(self):
        self.sub.ai_outcome_recommendation = ""
        self.sub.ai_outcome_confidence = None
        self.sub.ai_outcome_rationale = "AI error: Gemini API HTTP 404: models/x is not found"
        self.sub.save()
        r = _client(self.comm).get(f"/api/submissions/{self.sub.pk}/review-card/")
        rec = r.data["recommendation"]
        self.assertTrue(rec["failed"])
        self.assertEqual(rec["rationale"], "")
        self.assertNotIn("404", str(r.data))

    def test_a_real_recommendation_is_not_marked_failed(self):
        r = _client(self.comm).get(f"/api/submissions/{self.sub.pk}/review-card/")
        self.assertFalse(r.data["recommendation"]["failed"])
        self.assertEqual(r.data["recommendation"]["rationale"], "Meets the criteria.")
