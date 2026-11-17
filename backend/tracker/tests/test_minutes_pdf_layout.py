"""The minutes PDF follows the layout of the Commission's signed minutes."""

from datetime import date

from django.contrib.auth.models import User
from django.template.loader import render_to_string
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.minute_attendance import clean_attendance
from tracker.minutes_pdf import build_context, long_date, ordinal, time_ampm
from tracker.models import Meeting, Minutes, MinutesStatus, Profile, Role


class FormattingTests(TestCase):
    def test_ordinals_and_long_date_match_the_printed_style(self):
        self.assertEqual([ordinal(n) for n in (1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31)],
                         ["st", "nd", "rd", "th", "th", "th", "th", "st", "nd", "rd", "st"])
        self.assertEqual(long_date(date(2026, 10, 2)), "Friday 02nd October 2026")
        self.assertEqual(long_date("2026-10-23"), "Friday 23rd October 2026")

    def test_time_is_twelve_hour_lowercase(self):
        self.assertEqual(time_ampm("09:36"), "09:36 am")
        self.assertEqual(time_ampm("13:05"), "01:05 pm")
        self.assertEqual(time_ampm(""), "")

    def test_attendance_accepts_end_time_and_closing_prayer_and_rejects_bad_time(self):
        data = {"members": [], "in_attendance": [], "end_time": "11:54", "closing_prayer_by": "Christine Kapalu"}
        out = clean_attendance(data)
        self.assertEqual((out["end_time"], out["closing_prayer_by"]), ("11:54", "Christine Kapalu"))
        with self.assertRaises(ValueError):
            clean_attendance({**data, "end_time": "late"})


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class MinutesPdfLayoutTests(TestCase):
    def setUp(self):
        self.secretary = User.objects.create_user(username="pdf_sec", password="pass")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.meeting = Meeting.objects.create(
            title="Sitting", psc_meeting_number="23", date="2026-10-02", time="09:00", venue="VIPAM Conf Room")
        self.content = {
            "opening": "Opened with prayer.",
            "agenda_items": [
                {"agenda_item_id": 1, "sequence": 1, "submission_ref": "PSC/1/2026", "title": "Adoption of Agenda",
                 "discussion": "Welcomed.", "decision": "Adopted.", "decision_type": "approved",
                 "decision_number": "01-23-2026", "action_officer": "Manager CSU", "action_items": []},
                {"agenda_item_id": 2, "sequence": 2, "title": "Contract", "discussion": "", "decision_type": "approved",
                 "decision": "Approved. Action Officer: Manager HRM", "action_officer": "Manager HRM", "action_items": []},
                {"restricted": True, "title": "Other unit item"},
            ],
            "attendance": {
                "start_time": "09:36", "end_time": "11:54", "opening_prayer_by": "Commissioner Edward",
                "closing_prayer_by": "Christine Kapalu",
                "members": [
                    {"name": "Meto Nganga", "role": "Chairman", "status": "present"},
                    {"name": "Fred V", "role": "Commissioner", "status": "present"},
                    {"name": "Madeleine T", "role": "Commissioner", "status": "apology"},
                ],
                "in_attendance": [{"name": "Stephane Bong", "role": "Acting Secretary - PSC"}],
            },
            "next_meeting_date": "TBC",
        }
        self.minutes = Minutes.objects.create(
            meeting=self.meeting, status=MinutesStatus.AWAITING_SIGNATURE, content=self.content, created_by=self.secretary)

    def _ctx(self, content=None):
        return build_context(self.minutes, content or self.content, status_label="Awaiting Signature", signature_data_uri=None)

    def test_header_uses_the_psc_meeting_number_and_the_printed_date_style(self):
        ctx = self._ctx()
        self.assertEqual(ctx["meeting_name"], "Public Service Commission Meeting No. 23 of Friday 02nd October 2026")
        self.assertEqual(ctx["time_text"], "09:36 am")
        self.assertEqual(ctx["end_time_text"], "11:54 am")
        html = render_to_string("tracker/minutes_pdf.html", ctx)
        for needle in ("Meeting Minutes", "Meeting Name:", "Attendees:", "Absent:", "Apologies:", "Opening Prayer",
                       "Discussions &amp; Decisions", "Decision No:", "Discussion of Recommendation (s)",
                       "Closing Prayer", "Meeting end time:", "Minutes checked by:",
                       "Verified as true meeting minutes by:", "02<sup>nd</sup>"):
            self.assertIn(needle, html)

    def test_rows_number_items_and_end_the_decision_with_the_action_officer(self):
        rows = self._ctx()["rows"]
        labels = [r["agenda"] for r in rows]
        self.assertEqual(labels[:3], ["Opening", "01. Adoption of Agenda", "02. Contract"])
        self.assertEqual(rows[1]["decision_number"], "01-23-2026")
        self.assertEqual(rows[1]["officer"], "Manager CSU")
        self.assertEqual(rows[2]["officer"], "")  # decision text already carries "Action Officer:"
        self.assertIn("omitted from this copy", rows[3]["note"])

    def test_signature_table_lists_secretary_chairman_and_present_members_only(self):
        s = self._ctx()["signers"]
        self.assertEqual(s["secretary"], {"position": "Acting Secretary - PSC", "name": "Stephane Bong"})
        self.assertEqual(s["chairman"]["name"], "Meto Nganga")
        self.assertEqual([m["name"] for m in s["members"]], ["Fred V"])  # the apology does not sign

    def test_without_recorded_attendance_blank_signature_rows_are_printed(self):
        content = {k: v for k, v in self.content.items() if k != "attendance"}
        s = self._ctx(content)["signers"]
        self.assertEqual(len(s["members"]), 4)
        self.assertEqual(s["secretary"]["name"], "")

    def test_pdf_endpoint_returns_a_pdf_in_the_new_layout(self):
        client = APIClient()
        client.force_authenticate(user=self.secretary)
        res = client.get(f"/api/minutes/{self.minutes.id}/pdf/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertTrue(res.content.startswith(b"%PDF"))

    def test_page_one_is_portrait_and_the_decisions_and_signatures_are_landscape(self):
        from weasyprint import HTML
        html = render_to_string("tracker/minutes_pdf.html", self._ctx())
        pages = HTML(string=html).render().pages
        self.assertGreaterEqual(len(pages), 3)  # letterhead page, decisions, closing page
        self.assertLess(pages[0].width, pages[0].height)
        self.assertGreater(pages[1].width, pages[1].height)
        self.assertGreater(pages[-1].width, pages[-1].height)
