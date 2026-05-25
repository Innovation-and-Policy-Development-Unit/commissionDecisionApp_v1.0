#!/usr/bin/env python3
"""Generate Form Builder import XML for PSC travel forms 4.4, 4.5, 4.6.

Field layout matches backend/tracker/travel_forms.py (keep in sync when editing).
"""

from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = Path("/home/ipdu/Documents/Commission Decision App/PSC Forms")

TRAVEL_FORM_44 = "PSC 4.4"
TRAVEL_FORM_45 = "PSC 4.5"
TRAVEL_FORM_46 = "PSC 4.6"

FORM_META = {
    TRAVEL_FORM_44: {
        "name": "Domestic Travel Allowance (Form 4.4)",
        "digitized_form_key": "psc_4_4",
        "pdf": "4.4.pdf",
        "workflow": (
            "Secretary-only — not Commission. No separate submission paper. "
            "Ministry endorsements (claimant + HOD) are digital signatures before submit."
        ),
    },
    TRAVEL_FORM_45: {
        "name": "Individual Overseas Travel Approval (Form 4.5)",
        "digitized_form_key": "psc_4_5",
        "pdf": "4.5.pdf",
        "workflow": (
            "Secretary-only. Endorsements: applicant, director, DG, minister (optional). "
            "PSC Secretary issues approval letter after sign-off."
        ),
    },
    TRAVEL_FORM_46: {
        "name": "Mission Group Overseas Travel Approval (Form 4.6)",
        "digitized_form_key": "psc_4_6",
        "pdf": "4.6.pdf",
        "workflow": (
            "Secretary-only. Endorsements: mission leader, director, DG, minister/PM. "
            "PSC Secretary issues approval letter after sign-off."
        ),
    },
}

TRAVEL_FORM_CODES = (TRAVEL_FORM_44, TRAVEL_FORM_45, TRAVEL_FORM_46)


def _section(label, key, order, new_page=False):
    return {
        "label": label,
        "field_key": key,
        "field_type": "section_header",
        "is_required": False,
        "display_order": order,
        "start_new_page": new_page,
        "placeholder": "",
        "help_text": "",
        "choices": "",
    }


def _fld(label, key, order, field_type="text", required=False, placeholder="", help_text="", choices=""):
    return {
        "label": label,
        "field_key": key,
        "field_type": field_type,
        "is_required": required,
        "display_order": order,
        "start_new_page": False,
        "placeholder": placeholder,
        "help_text": help_text,
        "choices": choices,
    }


def fields_for_form_44():
    o = 10
    return [
        _section("Claimant details", "section_10", o),
        _fld("Name of claimant", "claimant_name", o + 10, required=True),
        _fld("Payroll number", "payroll_number", o + 20, required=True),
        _fld("Post title", "post_title", o + 30, required=True),
        _fld("Post number", "post_number", o + 40),
        _fld("Employment status", "employment_status", o + 50),
        _fld("Normal work location", "normal_work_location", o + 60, required=True),
        _section("Purpose of travel", "section_100", o + 100),
        _fld(
            "Purpose",
            "travel_purpose",
            o + 110,
            field_type="radio",
            required=True,
            choices="Duty Travel\nWorkshop/Training\nTemporary Transfer\nOthers",
        ),
        _fld("Other purpose (specify)", "travel_purpose_other", o + 120),
        _section("Itinerary & accommodation", "section_200", o + 200, new_page=True),
        _fld(
            "Itinerary details",
            "itinerary_details",
            o + 210,
            field_type="textarea",
            required=True,
            help_text="Place(s), arrival/departure dates and times, accommodation type and cost.",
        ),
        _fld("Total amount (VT)", "total_amount_vt", o + 220, field_type="number", required=True),
    ]


def fields_for_form_45():
    o = 10
    return [
        _section("Applicant information", "section_10", o),
        _fld("Name", "applicant_name", o + 10, required=True),
        _fld("Payroll number", "payroll_number", o + 20, required=True),
        _fld("Post title", "post_title", o + 30, required=True),
        _fld("Post number", "post_number", o + 40),
        _fld("Department", "department_name", o + 50, required=True),
        _fld("Ministry", "ministry_name", o + 60, required=True),
        _fld(
            "Previous overseas official travel",
            "previous_overseas_travel",
            o + 70,
            field_type="radio",
            choices="Yes\nNo",
        ),
        _section("Justification and duration", "section_100", o + 100),
        _fld("Purpose of travel", "travel_purpose", o + 110, field_type="textarea", required=True),
        _fld("Duration from", "duration_from", o + 120, field_type="date", required=True),
        _fld("Duration to", "duration_to", o + 130, field_type="date", required=True),
        _fld("Benefit to Vanuatu", "benefit_to_vanuatu", o + 140, field_type="textarea", required=True),
        _section("Places to visit", "section_200", o + 200),
        _fld("Itinerary / places", "places_itinerary", o + 210, field_type="textarea", required=True),
        _section("Acting arrangements", "section_300", o + 300),
        _fld("Acting officer name", "acting_name", o + 310),
        _fld("Acting post title", "acting_post_title", o + 320),
        _fld("Acting post number", "acting_post_number", o + 330),
        _fld("Acting salary (VT)", "acting_salary_vt", o + 340, field_type="number"),
        _section("Cost of proposed travel", "section_400", o + 400, new_page=True),
        _fld("Funding source", "funding_source", o + 410, field_type="textarea", required=True),
        _fld("Total estimated travel cost (VT)", "estimated_cost_vt", o + 420, field_type="number", required=True),
        _fld("Total acting allowance (VT)", "acting_allowance_vt", o + 430, field_type="number"),
        _fld("Travelling with imprest?", "with_imprest", o + 440, field_type="radio", choices="Yes\nNo"),
        _fld("Government imprest amount (VT)", "imprest_amount_vt", o + 450, field_type="number"),
        _fld(
            "DG is the applicant (Minister approval required)",
            "dg_is_applicant",
            o + 460,
            field_type="checkbox",
        ),
    ]


def fields_for_form_46():
    o = 10
    return [
        _section("Mission description", "section_10", o),
        _fld("Purpose of mission", "mission_purpose", o + 10, field_type="textarea", required=True),
        _fld("Benefits to Vanuatu", "benefits_to_vanuatu", o + 20, field_type="textarea", required=True),
        _section("Mission members", "section_100", o + 100),
        _fld(
            "Mission group members",
            "mission_members",
            o + 110,
            field_type="textarea",
            required=True,
            help_text="Name, post title, and justification for each member.",
        ),
        _fld("Acting arrangements", "acting_arrangements", o + 120, field_type="textarea"),
        _section("Places and dates", "section_200", o + 200),
        _fld("Places / organizations / dates", "places_and_dates", o + 210, field_type="textarea", required=True),
        _section("Cost of mission", "section_300", o + 300, new_page=True),
        _fld("Funding source", "funding_source", o + 310, field_type="textarea", required=True),
        _fld("Total estimated travel costs (VT)", "estimated_cost_vt", o + 320, field_type="number", required=True),
        _fld("Total acting allowances (VT)", "acting_allowance_vt", o + 330, field_type="number"),
    ]


BUILDERS = {
    TRAVEL_FORM_44: fields_for_form_44,
    TRAVEL_FORM_45: fields_for_form_45,
    TRAVEL_FORM_46: fields_for_form_46,
}


def _workflow_notice(meta: dict) -> dict:
    return _fld(
        "Workflow (read only)",
        "workflow_notice",
        5,
        field_type="textarea",
        help_text=meta["workflow"],
    )


def fields_for_export(code: str) -> list[dict]:
    meta = FORM_META[code]
    return [_workflow_notice(meta), *BUILDERS[code]()]


def _elem(tag: str, value: str) -> str:
    if not value:
        return ""
    return f"    <{tag}>{escape(value)}</{tag}>\n"


def field_to_xml(fdef: dict) -> str:
    parts = ["  <field>\n"]
    parts.append(_elem("label", fdef["label"]))
    parts.append(_elem("field_key", fdef["field_key"]))
    parts.append(_elem("field_type", fdef["field_type"]))
    parts.append(_elem("placeholder", fdef.get("placeholder", "")))
    parts.append(_elem("help_text", fdef.get("help_text", "")))
    parts.append(_elem("choices", fdef.get("choices", "")))
    parts.append(f"    <is_required>{'true' if fdef.get('is_required') else 'false'}</is_required>\n")
    parts.append(f"    <display_order>{fdef['display_order']}</display_order>\n")
    if fdef.get("start_new_page"):
        parts.append("    <start_new_page>true</start_new_page>\n")
    parts.append("  </field>\n")
    return "".join(parts)


def build_xml(code: str) -> str:
    meta = FORM_META[code]
    fields = fields_for_export(code)
    header = f"""<?xml version="1.0" encoding="UTF-8"?>
<!--
  {meta['name']} ({code})
  Secretary-only travel approval — no Commission sitting, no separate submission paper.
  Import: Admin → Form Types → open "{code}" → Import (.xml) → Replace fields
  Source PDF: {meta['pdf']}
  Suggested digitized_form_key: {meta['digitized_form_key']}
  Form category: TRAVEL (Travel & allowances)
-->
<fields>

"""
    body = "".join(field_to_xml(f) for f in fields)
    return header + body + "</fields>\n"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for code in TRAVEL_FORM_CODES:
        meta = FORM_META[code]
        filename = f"{meta['digitized_form_key']}.xml"
        content = build_xml(code)
        out_path = OUTPUT_DIR / filename
        out_path.write_text(content, encoding="utf-8")
        (ROOT / filename).write_text(content, encoding="utf-8")
        print(f"  {out_path}")
    print(f"\nDone — {len(TRAVEL_FORM_CODES)} files. Form codes: {', '.join(TRAVEL_FORM_CODES)}")


if __name__ == "__main__":
    main()
