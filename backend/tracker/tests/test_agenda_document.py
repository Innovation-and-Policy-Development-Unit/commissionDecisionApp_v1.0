"""The agenda as one document: numbering, headings, Matters Arising, the PDF, and the combined PDF."""
import datetime
import tempfile
from io import BytesIO

import fitz
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.agenda_document import (
    FIRST_ITEM_NO, build_agenda_document, derive_matters_arising, meeting_label, render_agenda_html,
    render_agenda_pdf, renumber_agenda, title_lines,
)
from tracker.models import (
    AgendaItem, AgendaSection, AgendaStatus, Meeting, Ministry, Profile, Role, Submission, SubmissionDocument,
)


def _pdf_bytes(text):
    d = fitz.open(); p = d.new_page(); p.insert_text((72, 72), text); b = d.tobytes(); d.close(); return b


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(), SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AgendaDocumentTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("ad_admin", password="x", is_staff=True)
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.min = Ministry.objects.create(code="TMN", name="Test Ministry")
        for code, label, order, heading in [
            ("appointment", "Appointment", 1, "APPOINTMENT & ACTING"),
            ("contract", "Contract", 2, "CONTRACT / TEMPORARY"),
            ("temporary_salaried", "Temporary", 3, "CONTRACT / TEMPORARY"),
            ("other", "Other", 4, ""),
        ]:
            AgendaSection.objects.update_or_create(code=code, defaults={"label": label, "display_order": order, "agenda_heading": heading, "is_active": True})
        for code, order in (("preliminaries", 0), ("matters_arising", 0)):
            AgendaSection.objects.update_or_create(code=code, defaults={"label": code, "display_order": order, "is_special": True, "is_active": True})
        self.prev = Meeting.objects.create(reference_number="MTG-2026-020", title="Prev", date=datetime.date(2026, 8, 7),
                                           time="09:00", venue="Boardroom", psc_meeting_number="20", status="completed", agenda_status="circulated")
        self.m = Meeting.objects.create(reference_number="MTG-2026-021", title="Sitting", date=datetime.date(2026, 8, 25),
                                        time="09:00", venue="Department of Environment Conference Room", psc_meeting_number="21",
                                        status="scheduled", agenda_status="draft")

    def _sub(self, ref, title="A paper"):
        return Submission.objects.create(reference_number=ref, title=title, ministry=self.min, form_type_code="X", received_at=timezone.now(), created_by=self.admin)

    def _item(self, meeting, ref, category, seq=1, **kw):
        return AgendaItem.objects.create(meeting=meeting, submission=self._sub(ref, f"Title {ref}"), category=category, sequence=seq, **kw)

    def test_title_lines_match_the_commissions_agenda(self):
        self.assertEqual(title_lines(self.m), [
            "AGENDA OF PSC MEETING No. 21 OF TUESDAY 25 AUGUST 2026",
            "AT THE DEPARTMENT OF ENVIRONMENT CONFERENCE ROOM,",
            "TIME 9.00 AM.",
        ])
        self.assertEqual(meeting_label(self.prev), "PSC Meeting No. 20 of Friday 07th August 2026")

    def test_items_are_numbered_from_four_across_merged_headings(self):
        a = self._item(self.m, "S1", "appointment")
        b = self._item(self.m, "S2", "contract")
        c = self._item(self.m, "S3", "temporary_salaried")
        d = self._item(self.m, "S4", "other")
        for it in (a, b, c, d):
            it.refresh_from_db()
        self.assertEqual([a.agenda_no, b.agenda_no, c.agenda_no, d.agenda_no], [4, 5, 6, 7])
        doc = build_agenda_document(self.m)
        headings = [r["text"] for r in doc["rows"] if r["kind"] == "heading"]
        self.assertEqual(headings, ["APPOINTMENT & ACTING", "CONTRACT / TEMPORARY", "OTHER"])
        self.assertEqual([r["no"] for r in doc["rows"] if r["kind"] == "item"][:3], [1, 2, 3])

    def test_removing_an_item_renumbers_while_building_but_not_after_circulation(self):
        a = self._item(self.m, "S1", "appointment"); b = self._item(self.m, "S2", "appointment", 2); c = self._item(self.m, "S3", "appointment", 3)
        a.delete()
        b.refresh_from_db(); c.refresh_from_db()
        self.assertEqual((b.agenda_no, c.agenda_no), (4, 5))
        Meeting.objects.filter(pk=self.m.pk).update(agenda_status=AgendaStatus.CIRCULATED)
        b.delete()
        c.refresh_from_db()
        self.assertEqual(c.agenda_no, 5)  # frozen: the number the Commissioners were sent does not move
        late = self._item(self.m, "S9", "appointment", 9)
        late.refresh_from_db()
        self.assertEqual(late.agenda_no, 6)  # a late addition takes the next number

    def test_preliminaries_and_matters_arising_are_not_numbered(self):
        p = self._item(self.m, "P1", "preliminaries"); ma = self._item(self.m, "M1", "matters_arising")
        p.refresh_from_db(); ma.refresh_from_db()
        self.assertIsNone(p.agenda_no); self.assertIsNone(ma.agenda_no)

    def test_matters_arising_reference_comes_from_the_earlier_agenda(self):
        s = self._sub("MA1", "Deferred paper")
        AgendaItem.objects.create(meeting=self.prev, submission=s, category="appointment", sequence=1)
        for _ in range(5):  # give the earlier sitting some other items so the paper is not number 4
            AgendaItem.objects.create(meeting=self.prev, submission=self._sub(f"F{_}"), category="appointment", sequence=2 + _)
        ma = AgendaItem.objects.create(meeting=self.m, submission=s, category="matters_arising", sequence=1,
                                       matters_arising_meeting_ref="MTG-2026-020", matters_arising_agenda_no="1")
        label, no = derive_matters_arising(ma)
        self.assertEqual(label, "PSC Meeting No. 20 of Friday 07th August 2026")
        self.assertEqual(no, "Agenda 04")  # the earlier number, not the stale typed "1"
        doc = build_agenda_document(self.m)
        matter = [r for r in doc["rows"] if r["kind"] == "matter"][0]
        self.assertEqual(matter["text"], "Agenda 04 - Deferred paper")

    def test_typed_reference_is_used_when_nothing_can_be_derived(self):
        ma = AgendaItem.objects.create(meeting=self.m, submission=self._sub("MA2", "Old paper"), category="matters_arising", sequence=1,
                                       matters_arising_meeting_ref="PSC Meeting No. 13 of Friday 22nd May 2026", matters_arising_agenda_no="Agenda 06")
        self.assertEqual(derive_matters_arising(ma), ("PSC Meeting No. 13 of Friday 22nd May 2026", "Agenda 06"))

    def test_minute_row_names_the_previous_sitting(self):
        doc = build_agenda_document(self.m)
        minute = doc["rows"][1]
        self.assertEqual(minute["text"], "MINUTE")
        self.assertIn("PSC Meeting No. 20 of Friday 07th August 2026", minute["lines"])

    def test_pdf_is_letter_size_and_contains_the_title_and_items(self):
        self._item(self.m, "S1", "appointment")
        pdf = render_agenda_pdf(self.m)
        doc = fitz.open(stream=pdf, filetype="pdf")
        self.assertEqual((round(doc[0].rect.width), round(doc[0].rect.height)), (612, 792))
        text = "".join(p.get_text() for p in doc)
        self.assertIn("AGENDA OF PSC MEETING No. 21 OF TUESDAY 25 AUGUST 2026", text)
        self.assertIn("Title S1", text)
        self.assertIn("MATTERS ARISING", text)

    def test_endpoint_hides_a_draft_agenda_from_commissioners(self):
        self._item(self.m, "S1", "appointment")
        comm = User.objects.create_user("ad_comm", password="x")
        Profile.objects.create(user=comm, role=Role.PSC_COMMISSIONER)
        c = APIClient(); c.force_authenticate(user=comm)
        self.assertEqual(c.get(f"/api/meetings/{self.m.id}/agenda-document/").status_code, 403)
        a = APIClient(); a.force_authenticate(user=self.admin)
        res = a.get(f"/api/meetings/{self.m.id}/agenda-document/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["title_lines"][0], "AGENDA OF PSC MEETING No. 21 OF TUESDAY 25 AUGUST 2026")
        Meeting.objects.filter(pk=self.m.pk).update(agenda_status=AgendaStatus.CIRCULATED)
        self.assertEqual(c.get(f"/api/meetings/{self.m.id}/agenda-document/").status_code, 200)

    def test_item_api_exposes_agenda_number_and_matters_arising_labels(self):
        it = self._item(self.m, "S1", "appointment")
        a = APIClient(); a.force_authenticate(user=self.admin)
        res = a.get(f"/api/agenda-items/?meeting={self.m.id}")
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        row = next(r for r in rows if r["id"] == it.id)
        self.assertEqual(row["agenda_no"], 4)
        self.assertIn("matters_arising_label", row)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(), SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class CombinedPdfTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("cp_admin", password="x", is_staff=True)
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.min = Ministry.objects.create(code="TMC", name="Combined Ministry")
        self.sub = Submission.objects.create(reference_number="CP-1", title="Contract for Mr X", ministry=self.min, form_type_code="X", received_at=timezone.now(), created_by=self.admin)

    def _doc(self, name, data):
        d = SubmissionDocument(submission=self.sub, original_name=name, uploaded_by=self.admin)
        d.file.save(name, ContentFile(data), save=False); d.save()

    def test_pdfs_images_merge_in_order_and_office_files_are_listed_not_merged(self):
        import fitz as _f
        pix = _f.Pixmap(_f.csRGB, _f.IRect(0, 0, 40, 40), False); pix.set_rect(pix.irect, (200, 30, 30))
        self._doc("letter.pdf", _pdf_bytes("first document"))
        self._doc("photo.png", pix.tobytes("png"))
        self._doc("budget.xlsx", b"PK fake spreadsheet")
        self._doc("annex.pdf", _pdf_bytes("second document"))
        a = APIClient(); a.force_authenticate(user=self.admin)
        res = a.get(f"/api/submissions/{self.sub.id}/documents-combined/?agenda_no=7")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertIn("Agenda 07 - Contract for Mr X", res["Content-Disposition"])
        doc = _f.open(stream=res.content, filetype="pdf")
        self.assertEqual(doc.page_count, 4)  # cover, letter, photo, annex
        text = "".join(p.get_text() for p in doc)
        self.assertIn("Agenda 07", text); self.assertIn("first document", text); self.assertIn("second document", text)
        self.assertIn("budget.xlsx", doc[0].get_text())  # listed as not merged
        self.assertEqual([t[1] for t in doc.get_toc()], ["letter.pdf", "photo.png", "annex.pdf"])
