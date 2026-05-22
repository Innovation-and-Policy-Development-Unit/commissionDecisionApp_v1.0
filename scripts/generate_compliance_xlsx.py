#!/usr/bin/env python3
"""Generate Excel templates for compliance digitized forms (no external deps)."""

from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

# Field definitions mirrored from backend/tracker/compliance_forms.py (no Django required).

COMPLIANCE_FORM_CODES = (
    "COMP-SMDR", "COMP-PAR", "COMP-PSDB", "COMP-14D", "COMP-OMB", "COMP-PSA",
)

FORM_META = {
    "COMP-SMDR": {"name": "Staff Member Disciplinary Report (SMDR)", "digitized_form_key": "comp_smdr"},
    "COMP-PAR": {"name": "Preliminary Assessment Report", "digitized_form_key": "comp_par"},
    "COMP-PSDB": {"name": "PSDB Order on Determination", "digitized_form_key": "comp_psdb"},
    "COMP-14D": {"name": "Response to PSC 14 Days Notice", "digitized_form_key": "comp_14d"},
    "COMP-OMB": {"name": "Ombudsman Request for Information from PSC", "digitized_form_key": "comp_omb"},
    "COMP-PSA": {"name": "Proposed Amendment to Public Service Act", "digitized_form_key": "comp_psa"},
}


def _section(label, key, order, new_page=False):
    return {"label": label, "field_key": key, "field_type": "section_header", "is_required": False, "display_order": order, "start_new_page": new_page}


def _fld(label, key, order, field_type="text", required=False, placeholder="", help_text="", choices=""):
    row = {"label": label, "field_key": key, "field_type": field_type, "is_required": required, "display_order": order, "placeholder": placeholder, "help_text": help_text, "start_new_page": False}
    if choices:
        row["choices"] = choices
    return row


def fields_for_form_type(code):
    return {
        "COMP-SMDR": lambda: [
            _section("Staff member details", "smdr_staff_hdr", 10),
            _fld("Employee full name", "employee_full_name", 20, required=True),
            _fld("Employee ID / file number", "employee_id", 30),
            _fld("Ministry / agency", "employee_ministry", 40, required=True),
            _fld("Department / unit", "employee_department", 50),
            _fld("Position title", "position_title", 60, required=True),
            _fld("Salary scale / grade", "salary_grade", 70),
            _section("Disciplinary matter", "smdr_matter_hdr", 80, new_page=True),
            _fld("Date of incident / conduct", "incident_date", 90, field_type="date", required=True),
            _fld("Place of incident", "incident_place", 100),
            _fld("Summary of alleged conduct", "conduct_summary", 110, field_type="textarea", required=True),
            _fld("Policy / regulation breached", "policy_breached", 120, field_type="textarea"),
            _fld("Witnesses (names & contact)", "witnesses", 130, field_type="textarea"),
            _fld("Prior warnings or related cases", "prior_warnings", 140, field_type="textarea"),
            _section("Reporting officer", "smdr_report_hdr", 150),
            _fld("Reporting officer name & title", "reporting_officer", 160, required=True),
            _fld("Date of report", "report_date", 170, field_type="date", required=True),
            _fld("Attachments list", "attachments_list", 180, field_type="textarea", help_text="List documents uploaded to this submission."),
        ],
        "COMP-PAR": lambda: [
            _section("Case reference", "par_ref_hdr", 10),
            _fld("Linked SMDR / case reference", "case_reference", 20, required=True),
            _fld("Subject employee name", "subject_name", 30, required=True),
            _fld("Ministry / agency", "subject_ministry", 40, required=True),
            _section("Preliminary assessment", "par_assess_hdr", 50, new_page=True),
            _fld("Date of assessment", "assessment_date", 60, field_type="date", required=True),
            _fld("Summary of facts considered", "facts_summary", 70, field_type="textarea", required=True),
            _fld("Preliminary findings", "preliminary_findings", 80, field_type="textarea", required=True),
            _fld("Recommended next steps", "recommended_steps", 90, field_type="textarea", required=True),
            _fld("Risk / urgency notes", "risk_notes", 100, field_type="textarea"),
            _section("Sign-off", "par_sign_hdr", 110),
            _fld("Assessing officer", "assessing_officer", 120, required=True),
            _fld("Compliance Manager endorsement", "manager_endorsement", 130, field_type="textarea"),
        ],
        "COMP-PSDB": lambda: [
            _section("PSDB order", "psdb_hdr", 10),
            _fld("Order reference number", "order_reference", 20, required=True),
            _fld("Date of order", "order_date", 30, field_type="date", required=True),
            _fld("Subject employee / matter", "order_subject", 40, required=True),
            _fld("Ministry / agency", "order_ministry", 50, required=True),
            _section("Determination", "psdb_det_hdr", 60, new_page=True),
            _fld("Summary of determination", "determination_summary", 70, field_type="textarea", required=True),
            _fld("Orders made (sanction / outcome)", "orders_made", 80, field_type="textarea", required=True),
            _fld("Effective date", "effective_date", 90, field_type="date"),
            _fld("Appeal / review rights noted", "appeal_rights", 100, field_type="textarea"),
            _fld("Distribution list", "distribution", 110, field_type="textarea"),
            _fld("Recording officer", "recording_officer", 120, required=True),
        ],
        "COMP-14D": lambda: [
            _section("PSC notice", "d14_notice_hdr", 10),
            _fld("PSC notice reference", "notice_reference", 20, required=True),
            _fld("Date notice received", "notice_received_date", 30, field_type="date", required=True),
            _fld("Original 14-day deadline", "notice_deadline", 40, field_type="date", required=True),
            _fld("Ministry / agency responding", "responding_ministry", 50, required=True),
            _section("Response", "d14_resp_hdr", 60, new_page=True),
            _fld("Summary of notice requirements", "notice_requirements", 70, field_type="textarea", required=True),
            _fld("Response narrative", "response_narrative", 80, field_type="textarea", required=True),
            _fld("Action taken to comply", "actions_taken", 90, field_type="textarea", required=True),
            _fld("Response submitted on time?", "on_time", 100, field_type="select", required=True, choices="Yes\nNo\nPartially"),
            _fld("Authorised signatory", "signatory", 110, required=True),
            _fld("Date of response", "response_date", 120, field_type="date", required=True),
        ],
        "COMP-OMB": lambda: [
            _section("Ombudsman correspondence", "omb_hdr", 10),
            _fld("Ombudsman reference", "omb_reference", 20, required=True),
            _fld("Date received at PSC", "received_date", 30, field_type="date", required=True),
            _fld("Response due date", "due_date", 40, field_type="date"),
            _fld("Requesting party", "requesting_party", 50),
            _section("Information request", "omb_req_hdr", 60, new_page=True),
            _fld("Information requested (verbatim summary)", "information_requested", 70, field_type="textarea", required=True),
            _fld("PSC units consulted", "units_consulted", 80, field_type="textarea"),
            _fld("Draft PSC response", "draft_response", 90, field_type="textarea", required=True),
            _fld("Confidentiality / redaction notes", "confidentiality_notes", 100, field_type="textarea"),
            _fld("Responsible compliance officer", "responsible_officer", 110, required=True),
        ],
        "COMP-PSA": lambda: [
            _section("Amendment proposal", "psa_hdr", 10),
            _fld("Short title of proposed amendment", "amendment_title", 20, required=True),
            _fld("Bill / instrument reference", "bill_reference", 30),
            _fld("Sections / schedules affected", "sections_affected", 40, field_type="textarea", required=True),
            _section("Policy assessment", "psa_policy_hdr", 50, new_page=True),
            _fld("Purpose and policy rationale", "policy_rationale", 60, field_type="textarea", required=True),
            _fld("Impact on ministries / agencies", "impact_summary", 70, field_type="textarea", required=True),
            _fld("Legal / HR implications", "legal_implications", 80, field_type="textarea"),
            _fld("Compliance unit recommendation", "compliance_recommendation", 90, field_type="textarea", required=True),
            _section("Endorsement", "psa_endorse_hdr", 100),
            _fld("Prepared by (Compliance Principal / Manager)", "prepared_by", 110, required=True),
            _fld("Date prepared", "prepared_date", 120, field_type="date", required=True),
            _fld("Further comments for Secretary / Commission", "secretary_comments", 130, field_type="textarea"),
        ],
    }[code]()

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
