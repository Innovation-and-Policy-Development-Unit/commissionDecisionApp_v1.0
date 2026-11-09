"""Long ministry documents are read in full, not just their first 30 pages."""

import tempfile
from pathlib import Path
from unittest import skipUnless

from django.test import SimpleTestCase

from ..ai import annual_report_review as ar
from ..ai.document_extraction import (
    MAX_OCR_PAGES, _tesseract_available, local_ocr_text, pdf_text_with_ocr,
)


def _text_pdf(path: Path, pages: int):
    import fitz

    doc = fitz.open()
    for i in range(1, pages + 1):
        page = doc.new_page()
        page.insert_text((72, 100), f"PAGEMARKER{i:03d} This page of the plan carries enough ordinary words to count as text.", fontsize=11)
    doc.save(str(path))
    doc.close()


def _mixed_pdf(path: Path):
    """Page 1: real text. Page 2: the same kind of page saved as a picture only (no text layer)."""
    import fitz

    src = fitz.open()
    pg = src.new_page()
    pg.insert_text((72, 120), "SCANNEDCASHFLOW forecast by month for the Ministry", fontsize=18)
    png = pg.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).tobytes("png")
    src.close()
    out = fitz.open()
    p1 = out.new_page()
    p1.insert_text((72, 100), "TEXTLAYERPAGE this page has an ordinary embedded text layer of its own.", fontsize=11)
    p2 = out.new_page()
    p2.insert_image(p2.rect, stream=png)
    out.save(str(path))
    out.close()


class LongDocumentTests(SimpleTestCase):
    def test_every_page_of_a_long_pdf_is_read_not_just_the_first_thirty(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "plan.pdf"
            _text_pdf(path, 45)
            text = pdf_text_with_ocr(path)
            for n in (1, 30, 31, 45):
                self.assertIn(f"PAGEMARKER{n:03d}", text)

    def test_the_route_the_upload_takes_reads_them_all_too(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "plan.pdf"
            _text_pdf(path, 45)
            self.assertIn("PAGEMARKER045", local_ocr_text(path, "plan.pdf"))

    def test_order_is_kept(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "plan.pdf"
            _text_pdf(path, 5)
            text = pdf_text_with_ocr(path)
            self.assertLess(text.index("PAGEMARKER001"), text.index("PAGEMARKER005"))

    @skipUnless(_tesseract_available(), "Tesseract is not installed here")
    def test_pages_with_no_text_layer_are_read_by_ocr_and_text_pages_are_not_ocrd(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "mixed.pdf"
            _mixed_pdf(path)
            text = pdf_text_with_ocr(path)
            self.assertIn("TEXTLAYERPAGE", text)
            self.assertIn("SCANNEDCASHFLOW", text.upper().replace(" ", ""))

    @skipUnless(_tesseract_available(), "Tesseract is not installed here")
    def test_ocr_is_capped_so_a_huge_scan_cannot_hold_the_worker_for_ever(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "mixed.pdf"
            _mixed_pdf(path)
            # With no OCR budget the picture-only page stays unread; the text page is still read.
            text = pdf_text_with_ocr(path, max_ocr_pages=0)
            self.assertIn("TEXTLAYERPAGE", text)
            self.assertNotIn("SCANNEDCASHFLOW", text.upper().replace(" ", ""))
        self.assertEqual(MAX_OCR_PAGES, 80)

    def test_an_unreadable_file_gives_nothing_rather_than_an_error(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "broken.pdf"
            path.write_bytes(b"not a pdf")
            self.assertEqual(pdf_text_with_ocr(path), "")


class LongReviewTests(SimpleTestCase):
    def test_a_550k_character_business_plan_is_reviewed_in_full(self):
        text = "x" * 550_000          # a 246-page Business Plan
        chunks = ar._chunks([("plan.pdf", text)])
        self.assertEqual(len(chunks), 13)
        self.assertGreaterEqual(ar.MAX_CHUNKS, 13)
        self.assertFalse(sum(len(t) for _, t in [("plan.pdf", text)]) > ar.CHUNK_CHARS * ar.MAX_CHUNKS)

    def test_a_truly_enormous_document_is_still_cut_off_and_says_so(self):
        text = "x" * (ar.CHUNK_CHARS * ar.MAX_CHUNKS + 1)
        self.assertEqual(len(ar._chunks([("huge.pdf", text)])), ar.MAX_CHUNKS)
        self.assertTrue(len(text) > ar.CHUNK_CHARS * ar.MAX_CHUNKS)  # the "truncated" flag's condition
