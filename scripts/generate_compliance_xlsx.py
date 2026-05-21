#!/usr/bin/env python3
"""Generate Excel templates for compliance digitized forms (no external deps)."""

from __future__ import annotations

import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from tracker.compliance_forms import (  # noqa: E402
    COMPLIANCE_FORM_CODES,
    FORM_META,
    fields_for_form_type,
)

OUTPUT_DIRS = [
    Path("/home/ipdu/Documents/Commission Decision App/Compliance"),
    Path("/home/ipdu/Documents/Commission Decision App/PSC Forms"),
]

PDF_NAMES = {
    "COMP-PSA": "1-Submission- Proposed Amendment to Public Service Act.pdf",
    "COMP-SMDR": "2-SMDR Submission.pdf",
    "COMP-PSDB": "3-Submission-PSDB Order on Determination.pdf",
    "COMP-14D": "4-Submission- Response to PSC 14 days Notice.pdf",
    "COMP-PAR": "5-Submission- Preliminary Assessment Report.pdf",
    "COMP-OMB": "6-Submission- Ombudsman request of information from PSC.pdf",
}


def safe_filename(code: str) -> str:
    name = FORM_META[code]["name"].replace("/", "-").replace(":", "")
    return f"{code} - {name}.xlsx"


class SimpleXlsx:
    def __init__(self):
        self.strings: list[str] = []
        self._index: dict[str, int] = {}

    def s(self, text: str) -> int:
        text = str(text) if text is not None else ""
        if text not in self._index:
            self._index[text] = len(self.strings)
            self.strings.append(text)
        return self._index[text]

    def write(self, path: Path, rows: list[list]) -> None:
        sheet_rows = []
        for r_idx, row in enumerate(rows, 1):
            cells = []
            for c_idx, val in enumerate(row, 1):
                col = self._col_name(c_idx)
                if val is None or val == "":
                    continue
                if isinstance(val, (int, float)) and not isinstance(val, bool):
                    cells.append(f'<c r="{col}{r_idx}"><v>{val}</v></c>')
                else:
                    si = self.s(val)
                    cells.append(f'<c r="{col}{r_idx}" t="s"><v>{si}</v></c>')
            if cells:
                sheet_rows.append(f'<row r="{r_idx}">{"".join(cells)}</row>')

        sheet_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<sheetData>{"".join(sheet_rows)}</sheetData></worksheet>'
        )

        shared = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            f'count="{len(self.strings)}" uniqueCount="{len(self.strings)}">'
            + "".join(f"<si><t>{escape(t)}</t></si>" for t in self.strings)
            + "</sst>"
        )

        content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>"""

        rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

        wb_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>"""

        workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Form" sheetId="1" r:id="rId1"/></sheets>
</workbook>"""

        path.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("[Content_Types].xml", content_types)
            zf.writestr("_rels/.rels", rels)
            zf.writestr("xl/workbook.xml", workbook)
            zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
            zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
            zf.writestr("xl/sharedStrings.xml", shared)

    @staticmethod
    def _col_name(n: int) -> str:
        name = ""
        while n:
            n, r = divmod(n - 1, 26)
            name = chr(65 + r) + name
        return name


def rows_for_form(code: str) -> list[list]:
    meta = FORM_META[code]
    fields = fields_for_form_type(code)
    rows: list[list] = [
        [meta["name"]],
        [f"Form code: {code}"],
        [f"Digitized key: {meta['digitized_form_key']}"],
        [f"Source PDF: {PDF_NAMES.get(code, '')}"],
        ["Fill the Value column, then attach when uploading to SCDMS."],
        [],
        ["#", "Field Key", "Label", "Field Type", "Required", "Value"],
    ]
    n = 0
    for fdef in fields:
        if fdef["field_type"] == "section_header":
            rows.append(["", fdef["field_key"], fdef["label"], "SECTION", "", ""])
            continue
        n += 1
        rows.append([
            n,
            fdef["field_key"],
            fdef["label"],
            fdef["field_type"],
            "Yes" if fdef.get("is_required") else "No",
            "",
        ])
        help_text = fdef.get("help_text") or ""
        choices = fdef.get("choices") or ""
        if help_text or choices:
            note = []
            if help_text:
                note.append(f"Help: {help_text}")
            if choices:
                note.append("Choices: " + choices.replace("\n", " | "))
            rows.append(["", "", " ".join(note), "", "", ""])
    return rows


def main() -> None:
    created = []
    for code in COMPLIANCE_FORM_CODES:
        fname = safe_filename(code)
        rows = rows_for_form(code)
        for out_dir in OUTPUT_DIRS:
            out_dir.mkdir(parents=True, exist_ok=True)
            path = out_dir / fname
            SimpleXlsx().write(path, rows)
            created.append(path)
    print(f"Generated {len(created)} files ({len(COMPLIANCE_FORM_CODES)} forms x {len(OUTPUT_DIRS)} folders)")
    for p in sorted(set(created)):
        print(f"  {p}")


if __name__ == "__main__":
    main()
