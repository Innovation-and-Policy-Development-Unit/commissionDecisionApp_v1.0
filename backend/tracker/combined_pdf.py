"""One PDF from all of a submission's documents, for reading an agenda item in one go.

PDFs and images are merged in the order they were filed, after a cover page that carries the agenda
number, title, ministry and reference. Each document gets a bookmark. Word, Excel and other files cannot
be merged without an office suite on the server, so they are listed on a closing page by name."""
from __future__ import annotations

import os

import fitz  # PyMuPDF

_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff"}


def _wrap(text: str, width: int) -> list[str]:
    words, lines, cur = (text or "").split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width:
            lines.append(cur); cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return lines


def build_combined_pdf(submission, docs, agenda_no=None) -> tuple[bytes, list[str]]:
    out = fitz.open()
    skipped: list[str] = []
    toc: list[list] = []

    out.new_page(width=595, height=842)  # the cover; drawn after merging, because inserting pages invalidates page objects

    included: list[tuple[str, int]] = []
    for d in docs:
        name = d.original_name or os.path.basename(d.file.name)
        ext = os.path.splitext(d.file.name)[1].lower()
        try:
            with d.file.open("rb") as fh:
                data = fh.read()
            if ext == ".pdf":
                src = fitz.open(stream=data, filetype="pdf")
            elif ext in _IMAGE_EXT:
                img = fitz.open(stream=data, filetype=ext.lstrip("."))
                src = fitz.open(stream=img.convert_to_pdf(), filetype="pdf")
            else:
                skipped.append(name)
                continue
            start = out.page_count
            out.insert_pdf(src)
            included.append((name, start + 1))
            toc.append([1, name, start + 1])
        except Exception:  # noqa: BLE001 — one bad file must not stop the rest
            skipped.append(f"{name} (could not be read)")

    cover = out[0]
    y = 90
    heading = f"Agenda {int(agenda_no):02d}" if agenda_no and str(agenda_no).isdigit() else "Agenda item"
    cover.insert_text((60, y), heading, fontsize=26, fontname="hebo"); y += 44
    for line in _wrap(submission.title or "", 52):
        cover.insert_text((60, y), line, fontsize=15, fontname="hebo"); y += 22
    y += 12
    ministry = getattr(getattr(submission, "ministry", None), "name", "") or ""
    for label, val in (("Ministry", ministry), ("Reference", submission.reference_number or "")):
        if val:
            cover.insert_text((60, y), f"{label}: {val}", fontsize=11, fontname="helv"); y += 18
    y += 14
    cover.insert_text((60, y), "Documents in this file", fontsize=12, fontname="hebo"); y += 20
    for name, page in included:
        for k, line in enumerate(_wrap(name, 80)):
            cover.insert_text((70, y), (f"p.{page}  " if k == 0 else "      ") + line, fontsize=10, fontname="helv"); y += 14
    if not included:
        cover.insert_text((70, y), "No documents that can be merged.", fontsize=10, fontname="helv"); y += 14
    if skipped:
        y += 10
        cover.insert_text((60, y), "Not merged (open them from the submission):", fontsize=11, fontname="hebo"); y += 18
        for name in skipped:
            for line in _wrap(name, 80):
                cover.insert_text((70, y), line, fontsize=10, fontname="helv"); y += 14
    if toc:
        out.set_toc(toc)
    data = out.tobytes(garbage=3, deflate=True)
    out.close()
    return data, skipped
