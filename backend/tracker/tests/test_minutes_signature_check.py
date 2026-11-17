"""Advisory check of who signed the uploaded scan, and the on-screen print layout."""

from unittest import mock

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.ai import minutes_signature_check as sig
from tracker.models import Meeting, Minutes, MinutesStatus, Profile, Role


def make_pdf(pages=6) -> bytes:
    import fitz

    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i + 1}")
    data = doc.tobytes()
    doc.close()
    return data


ATTENDANCE = {
    "start_time": "09:36", "end_time": "11:54", "opening_prayer_by": "", "closing_prayer_by": "",
    "members": [
        {"name": "Meto Kaltuepunu Nganga", "role": "Chairman", "status": "present"},
        {"name": "Edward Jimmy", "role": "Commissioner", "status": "present"},
        {"name": "Martin Raoul Mahe", "role": "Commissioner", "status": "present"},
        {"name": "Madeleine Tom", "role": "Commissioner", "status": "apology"},
    ],
    "in_attendance": [{"name": "Stephane Bong", "role": "Acting Secretary - PSC"}],
}


def model_answer(**overrides):
    answer = {
        "header": {"meeting_number": "23", "meeting_date": "2026-10-02"},
        "footer": {"last_page_label": "6 of 6"},
        "rows": [
            {"section": "checked_by", "position": "Acting Secretary - PSC", "name": "Stephane Bong", "signature": "seen", "date": "05/11/26"},
            {"section": "verified_by", "position": "Chairman", "name": "Meto Kaltuepunu Nganga", "signature": "seen", "date": "05/11/2026"},
            {"section": "verified_by", "position": "Member", "name": "Jimmy Edward", "signature": "seen", "date": "5/11/26"},
            {"section": "verified_by", "position": "Member", "name": "Martin Mahe", "signature": "not_seen", "date": None},
        ],
        "stamp_seen": True, "note": "",
    }
    answer.update(overrides)
    return answer


class MatchingTests(TestCase):
    def test_names_match_regardless_of_word_order_titles_and_middle_names(self):
        self.assertGreaterEqual(sig.name_similarity("Edward Jimmy", "Jimmy Edward"), 0.99)
        self.assertGreaterEqual(sig.name_similarity("Martin Raoul Mahe", "Martin Mahe"), 0.99)
        self.assertGreaterEqual(sig.name_similarity("Commissioner Jimmy Edward", "Edward Jimmy"), 0.99)
        self.assertLess(sig.name_similarity("Fred Vurobaravu", "Madeleine Tom"), 0.5)

    def test_combine_marks_unmatched_expected_not_seen_and_keeps_extra_scan_rows(self):
        expected = [{"role": "Member", "name": "Fred Vurobaravu"}, {"role": "Member", "name": "Madeleine Tom"}]
        scanned = [
            {"name": "Madeleine Tom", "position": "Member", "verdict": "seen", "date": "05/11/26"},
            {"name": "Somebody Else", "position": "Member", "verdict": "seen", "date": ""},
        ]
        rows = sig.combine(expected, scanned)
        by_name = {r["name"]: r for r in rows}
        self.assertEqual(by_name["Fred Vurobaravu"]["verdict"], "not_seen")
        self.assertIn("No row", by_name["Fred Vurobaravu"]["note"])
        self.assertEqual(by_name["Madeleine Tom"]["verdict"], "seen")
        self.assertFalse(by_name["Somebody Else"]["expected"])

    def test_confirmed_rows_count_as_signed_in_the_summary(self):
        rows = [
            {"id": "r1", "name": "A", "role": "Chairman", "expected": True, "verdict": "seen", "confirmed_by": ""},
            {"id": "r2", "name": "B", "role": "Member", "expected": True, "verdict": "unclear", "confirmed_by": ""},
            {"id": "r3", "name": "C", "role": "Member", "expected": True, "verdict": "not_seen", "confirmed_by": "sec"},
            {"id": "r4", "name": "Z", "role": "Member", "expected": False, "verdict": "seen", "confirmed_by": ""},
        ]
        self.assertEqual(sig.summarise(rows), {"expected": 3, "signed": 2, "missing": ["B"]})

    def test_expected_signers_are_secretary_chairman_and_present_members_only(self):
        names = [(p["role"], p["name"]) for p in sig.expected_signers({"attendance": ATTENDANCE})]
        self.assertEqual(names, [("Acting Secretary - PSC", "Stephane Bong"), ("Chairman", "Meto Kaltuepunu Nganga"),
                                 ("Member", "Edward Jimmy"), ("Member", "Martin Raoul Mahe")])


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class SignatureCheckTests(TestCase):
    def setUp(self):
        self.secretary = User.objects.create_user(username="sc_sec", password="pass")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.csu = User.objects.create_user(username="sc_csu", password="pass")
        Profile.objects.create(user=self.csu, role=Role.CSU_MANAGER)
        self.other = User.objects.create_user(username="sc_other", password="pass")
        Profile.objects.create(user=self.other, role=Role.ODU_MANAGER)
        self.meeting = Meeting.objects.create(
            title="Sitting", psc_meeting_number="23", date="2026-10-02", time="09:00", venue="Room")
        self.minutes = Minutes.objects.create(
            meeting=self.meeting, status=MinutesStatus.AWAITING_SIGNATURE, created_by=self.secretary,
            content={"agenda_items": [], "attendance": ATTENDANCE})
        self.client = APIClient()
        self.url = f"/api/minutes/{self.minutes.id}"

    def _attach_scan(self, pages=6):
        self.minutes.signed_document.save("scan.pdf", ContentFile(make_pdf(pages)), save=False)
        self.minutes.status = MinutesStatus.SIGNED
        self.minutes.save()

    def _run(self, answer=None, error=None):
        with mock.patch.object(sig, "ai_enabled", return_value=True), \
             mock.patch.object(sig, "complete_json_with_images", return_value=(answer if error is None else None, error)) as call:
            ok, err, retryable = sig.run_signature_check(self.minutes.id)
        self.minutes.refresh_from_db()
        return ok, err, retryable, call

    def test_reads_only_page_one_and_the_last_pages(self):
        self._attach_scan(pages=96)
        ok, *_ , call = self._run(model_answer(footer={"last_page_label": "96 of 96"}))
        self.assertTrue(ok)
        images = call.call_args.kwargs["images"]
        self.assertEqual(len(images), 4)  # page 1 + the last three
        self.assertEqual(self.minutes.signature_check["pages_read"], [1, 94, 95, 96])

    def test_result_compares_with_expected_signers_and_checks_header_and_footer(self):
        self._attach_scan(pages=6)
        ok, *_ = self._run(model_answer())
        check = self.minutes.signature_check
        self.assertTrue(ok)
        self.assertEqual(check["status"], "done")
        verdicts = {r["name"]: r["verdict"] for r in check["rows"]}
        self.assertEqual(verdicts["Edward Jimmy"], "seen")  # matched to "Jimmy Edward" on the scan
        self.assertEqual(verdicts["Martin Raoul Mahe"], "not_seen")
        self.assertEqual(check["summary"], {"expected": 4, "signed": 3, "missing": ["Martin Raoul Mahe"]})
        self.assertTrue(check["header"]["matches_sitting"])
        self.assertTrue(check["footer"]["complete"])
        self.assertTrue(check["stamp_seen"])

    def test_wrong_meeting_and_truncated_scan_are_flagged(self):
        self._attach_scan(pages=6)
        self._run(model_answer(header={"meeting_number": "22", "meeting_date": "2026-09-15"},
                               footer={"last_page_label": "5 of 6"}))
        check = self.minutes.signature_check
        self.assertFalse(check["header"]["matches_sitting"])
        self.assertFalse(check["footer"]["complete"])

    def test_ai_error_is_reported_and_transient_errors_are_retryable(self):
        self._attach_scan()
        ok, err, retryable, _ = self._run(error="HTTP 400 bad request")
        self.assertFalse(ok)
        self.assertEqual((self.minutes.signature_check["status"], retryable), ("failed", False))
        ok, err, retryable, _ = self._run(error="HTTP 503 overloaded")
        self.assertEqual(retryable, True)

    def test_no_ai_key_marks_the_check_unavailable(self):
        self._attach_scan()
        with mock.patch.object(sig, "ai_enabled", return_value=False):
            ok, err, _ = sig.run_signature_check(self.minutes.id)[0:3]
        self.minutes.refresh_from_db()
        self.assertEqual(self.minutes.signature_check["status"], "unavailable")

    def test_uploading_the_scan_queues_the_check_and_shows_pending(self):
        self.client.force_authenticate(user=self.csu)
        with mock.patch("tracker.ai.claude_client.ai_enabled", return_value=True), \
             mock.patch("tracker.tasks.check_minutes_signatures.delay") as delay, \
             self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"{self.url}/upload-signed/", {
                "signed_document": SimpleUploadedFile("s.pdf", make_pdf(), content_type="application/pdf")})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["signature_check"]["status"], "pending")
        delay.assert_called_once_with(self.minutes.id)

    def test_recheck_needs_a_scan_and_the_right_role(self):
        self.client.force_authenticate(user=self.secretary)
        self.assertEqual(self.client.post(f"{self.url}/recheck-signatures/").status_code, 400)
        self._attach_scan()
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.post(f"{self.url}/recheck-signatures/").status_code, 403)
        self.client.force_authenticate(user=self.secretary)
        with mock.patch("tracker.ai.claude_client.ai_enabled", return_value=True), \
             mock.patch("tracker.tasks.check_minutes_signatures.delay") as delay, \
             self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"{self.url}/recheck-signatures/")
        self.assertEqual(res.status_code, 200)
        delay.assert_called_once()

    def test_secretary_can_confirm_and_unconfirm_a_signer(self):
        self._attach_scan()
        self._run(model_answer())
        row = next(r for r in self.minutes.signature_check["rows"] if r["name"] == "Martin Raoul Mahe")
        self.client.force_authenticate(user=self.csu)
        self.assertEqual(self.client.post(f"{self.url}/confirm-signature/", {"row_id": row["id"]}, format="json").status_code, 403)
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(f"{self.url}/confirm-signature/", {"row_id": row["id"]}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["signature_check"]["summary"]["signed"], 4)
        res = self.client.post(f"{self.url}/confirm-signature/", {"row_id": row["id"], "confirmed": False}, format="json")
        self.assertEqual(res.data["signature_check"]["summary"]["signed"], 3)
        self.assertEqual(self.client.post(f"{self.url}/confirm-signature/", {"row_id": "nope"}, format="json").status_code, 400)

    def test_minutes_response_carries_the_print_layout(self):
        self.client.force_authenticate(user=self.secretary)
        data = self.client.get(f"{self.url}/").data
        layout = data["print_layout"]
        self.assertEqual(layout["meeting_name"], "Public Service Commission Meeting No. 23 of Friday 02nd October 2026")
        self.assertEqual(layout["time_text"], "09:36 am")
        self.assertEqual(layout["signers"]["chairman"]["name"], "Meto Kaltuepunu Nganga")
        self.assertEqual([m["name"] for m in layout["signers"]["members"]], ["Edward Jimmy", "Martin Raoul Mahe"])
