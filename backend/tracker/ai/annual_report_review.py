"""AI first-pass review of a ministry Annual Report against the OPSC guideline (Sonnet).

The criteria are the items of the ODU "Annual Report review checklist", so what the AI
finds lines up one-to-one with what the allocated ODU officer ticks. Each item carries
the guideline's own requirement (``GUIDELINE``) so the model checks against what the
guideline asks for, not its own idea of a good report.

Long reports are read in chunks: every chunk is checked against every criterion and the
best evidence for each item wins. The AI only ever advises. It reports ``met``,
``partial`` or ``not_found`` with a short quote as evidence, and says so when a document
has no readable text (a scan that could not be read) rather than marking everything
missing.
"""

from __future__ import annotations

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import get_model_tier

CHECKLIST_CODE = "ANNUAL-REPORT-CHECKLIST"
CHUNK_CHARS = 45000
MAX_CHUNKS = 8
RANK = {"not_found": 0, "partial": 1, "met": 2}

# What the 2021 PSC Guidelines for Preparing Annual Reports ask for, per checklist item.
GUIDELINE = {
    "minister_statement_check": "A brief introduction and a Minister's statement that the report is prepared under s.20(1)(h) of the Public Service Act 1998 and in line with the guidelines; the Minister also signs a statement of responsibility for the financial statements (PFEM Act s.30(3)).",
    "dg_statement_check": "A Director General's statement that the report is prepared under s.20(1)(h) of the Public Service Act 1998 and in line with the guidelines.",
    "dg_issues_table_check": "The DG's statement can usefully include a table of issues, progress in resolving them and the way forward.",
    "org_chart_check": "An organisation chart of the ministry as at the end of the reporting year, with any explanation needed.",
    "structural_changes_check": "A summary of significant changes to the ministry's structure during the year.",
    "ministry_functions_check": "A statement of the ministry's functions.",
    "vision_statement_check": "The ministry's vision.",
    "mission_statement_check": "The ministry's mission.",
    "core_values_check": "The ministry's values (and objectives).",
    "objectives_performance_check": "Each Corporate Plan objective for the reporting year spelled out, with achievements, progress and difficulties against each (a table is fine).",
    "main_activities_check": "The main activities and services provided, including disaster recovery initiatives and any data on use and impact of services.",
    "service_delivery_check": "Service delivery improvements, including increased access to services (including in the provinces) and performance gains.",
    "adr_targets_check": "Achievement against the Annual Development Report (ADR) targets of the National Sustainable Development Plan (NSDP).",
    "budget_performance_check": "Each performance measure in the ministry's Budget Narrative, with progress against each.",
    "policy_summary_check": "New, reviewed or retired policies (a table with implementation plan and partner agencies is recommended).",
    "legislation_changes_check": "New legislation passed during the year and any transfer of responsibility for legislation.",
    "conventions_check": "New Conventions agreed in the year, added to a table of existing Conventions with ratification status and implementation progress.",
    "major_risks_check": "Major emerging issues, risks and challenges that affected the ministry's work (for example natural disasters).",
    "staffing_data_check": "Permanent staff numbers, and full-time/probationary/contract/daily-rated numbers, disaggregated by gender and language group; geographic distribution of officers across provinces.",
    "cessation_data_check": "Cessation of employment in the period: retirements, redundancies and terminations.",
    "compliance_report_check": "Compliance report (discipline cases).",
    "training_delivered_check": "Training delivered: area of study, subject and delivery agency.",
    "scholarships_check": "Scholarships by area of study, subject and level, disaggregated by gender and language group.",
    "equity_initiatives_check": "Initiatives undertaken to improve equity and inclusivity, and action to enhance inclusion, equality, access and participation for staff and customers.",
    "financial_note_check": "Financial statements for audit, drawn from the FMIS (PFEM Act s.24).",
    "fin_representation_check": "A Statement of Representation (a PFEM Act financial statement).",
    "fin_appropriation_check": "A Statement of Appropriation (a PFEM Act financial statement).",
    "fin_expense_summary_check": "An Expense Summary Report (a PFEM Act financial statement).",
    "fin_commitments_check": "A Statement of Commitments & Contingencies (a PFEM Act financial statement).",
    "dev_projects_check": "Technical assistance attached to the ministry and all major development projects carried out in the year (a table is recommended).",
    "statutory_authorities_check": "Statutory authorities or offices set up by the ministry's legislation, and whether they produce their own annual reports.",
    "non_statutory_bodies_check": "Non-statutory bodies, for example government-owned companies of which the ministry is parent.",
    "auditor_general_reports_check": "Titles and tabling dates of Auditor General reports tabled in Parliament in the year that concern the ministry, and remedial action taken.",
    "ombudsman_response_check": "Reports to the ministry by the Ombudsman and a summary table of action taken in response.",
    "rti_requests_check": "Requests received under the Right to Information Act, listed in a table.",
    "court_decisions_check": "Judicial decisions that significantly affect (or could affect) the ministry's operation.",
    "complaints_summary_check": "The complaints mechanism, main areas of dissatisfaction, and changes made as a result.",
    "capital_expenditure_check": "Brief information on each major approved capital item, including vehicles, acquired by the ministry and its departments/agencies.",
    "fraud_control_check": "Action taken in the year to assess fraud risk and to develop and apply fraud control arrangements.",
    "contact_officer_check": "Title, address and telephone number of the contact officer for enquiries.",
    "leave_accrual_check": "A leave accrual analysis.",
}

SYSTEM_CHUNK = (
    "You assist the Organisation Development Unit (ODU) of the Vanuatu Public Service "
    "Commission in checking a ministry Annual Report against the PSC guideline. You are "
    "shown ONE PART of the report and a list of criteria, each with what the guideline asks "
    "for. For every criterion decide from this part only: 'met' (the report clearly provides "
    "it), 'partial' (some of it, or only a heading or a vague mention) or 'not_found' (nothing "
    "in this part). Use ONLY the text given and never assume. For 'met' and 'partial' give a "
    "short verbatim quote (under 160 characters) as evidence and a one-sentence note on what "
    "is there or what is missing. Return JSON: {\"items\": {\"<key>\": {\"status\": "
    "\"met|partial|not_found\", \"evidence\": \"...\", \"note\": \"...\"}}} including every "
    "key given."
)

SYSTEM_SUMMARY = (
    "You write a short advisory note for an ODU officer reviewing a ministry Annual Report. "
    "From the criterion results given, write: 'summary' (2-4 plain sentences on how complete "
    "the report is, naming the most important gaps) and 'recommendation', exactly one of "
    "'accept' (complete enough to proceed), 'accept_with_follow_up' (minor gaps ODU can ask "
    "the ministry to fill) or 'return_for_clarification' (material gaps). Be factual and "
    "never invent content. Return JSON: {\"summary\": \"...\", \"recommendation\": \"...\"}"
)


def checklist_items() -> list[dict]:
    """The review criteria: the live fields of the Annual Report review checklist."""
    from ..models import PSCFormField

    fields = (
        PSCFormField.objects.filter(form_type__code=CHECKLIST_CODE)
        .exclude(field_type="section_header")
        .order_by("display_order", "id")
    )
    return [
        {"key": f.field_key, "label": f.label, "guideline": GUIDELINE.get(f.field_key, f.label)}
        for f in fields
    ]


def report_texts(submission) -> list[tuple[str, str]]:
    """(name, text) of every active document that has readable text."""
    from ..models import SubmissionDocument

    return [
        (d.original_name, d.extracted_text)
        for d in SubmissionDocument.objects.filter(submission=submission).order_by("uploaded_at")
        if (d.extracted_text or "").strip()
    ]


def documents_waiting_for_text(submission) -> int:
    from ..models import DocumentOcrStatus, SubmissionDocument

    return SubmissionDocument.objects.filter(
        submission=submission,
        ocr_status__in=[DocumentOcrStatus.PENDING, DocumentOcrStatus.PROCESSING],
    ).count()


def _chunks(texts: list[tuple[str, str]]) -> list[str]:
    parts: list[str] = []
    for name, text in texts:
        for i in range(0, len(text), CHUNK_CHARS):
            parts.append(f"[Document: {name}, characters {i}-{min(i + CHUNK_CHARS, len(text))}]\n{text[i:i + CHUNK_CHARS]}")
    return parts[:MAX_CHUNKS]


def _criteria_block(items: list[dict]) -> str:
    return "\n".join(f"- key={i['key']}: {i['label']} | Guideline: {i['guideline']}" for i in items)


def late_info(submission) -> dict:
    """Deadline is 31 March of the year the report was lodged."""
    from datetime import date

    received = submission.received_at.date() if submission.received_at else None
    if not received:
        return {"deadline": None, "days_late": 0, "late": False}
    deadline = date(received.year, 3, 31)
    days = (received - deadline).days
    return {"deadline": deadline.isoformat(), "days_late": max(days, 0), "late": days > 0}


def review_report(submission) -> tuple[dict | None, str | None]:
    """Return (result, error). ``result`` is stored as-is on ReportAIReview.result."""
    if not ai_enabled():
        return None, "AI is switched off."
    items = checklist_items()
    if not items:
        return None, "The Annual Report review checklist is not set up."
    texts = report_texts(submission)
    unreadable = max(0, _document_count(submission) - len(texts))
    if not texts:
        return None, "None of the uploaded documents has readable text, so there is nothing for the AI to check."

    tier = get_model_tier("annual_report_review")
    best: dict[str, dict] = {i["key"]: {"status": "not_found", "evidence": "", "note": ""} for i in items}
    chunk_errors = 0
    chunks = _chunks(texts)
    for n, chunk in enumerate(chunks, 1):
        data, err = complete_json_with_error(
            system=SYSTEM_CHUNK,
            user=f"Part {n} of {len(chunks)} of the report.\n\nCRITERIA\n{_criteria_block(items)}\n\nREPORT TEXT\n{chunk}",
            tier=tier,
            max_tokens=6000,
        )
        raw = (data or {}).get("items") if isinstance(data, dict) else None
        if not isinstance(raw, dict):
            chunk_errors += 1
            continue
        for key, val in raw.items():
            if key not in best or not isinstance(val, dict):
                continue
            status = val.get("status") if val.get("status") in RANK else "not_found"
            if RANK[status] > RANK[best[key]["status"]]:
                best[key] = {
                    "status": status,
                    "evidence": str(val.get("evidence") or "")[:300],
                    "note": str(val.get("note") or "")[:400],
                }
    if chunk_errors == len(chunks):
        return None, "The AI could not read the report. Try again."

    counts = {s: sum(1 for v in best.values() if v["status"] == s) for s in RANK}
    lines = [f"{i['label']}: {best[i['key']]['status']} ({best[i['key']]['note']})" for i in items]
    sdata, _ = complete_json_with_error(
        system=SYSTEM_SUMMARY,
        user="Criterion results:\n" + "\n".join(lines),
        tier=tier,
        max_tokens=800,
    )
    sdata = sdata if isinstance(sdata, dict) else {}
    recommendation = sdata.get("recommendation")
    if recommendation not in ("accept", "accept_with_follow_up", "return_for_clarification"):
        recommendation = (
            "accept" if counts["not_found"] == 0 and counts["partial"] <= 2
            else "accept_with_follow_up" if counts["not_found"] <= max(3, len(items) // 6)
            else "return_for_clarification"
        )
    return {
        "items": best,
        "counts": counts,
        "total": len(items),
        "summary": str(sdata.get("summary") or "")[:1200],
        "recommendation": recommendation,
        "parts_read": len(chunks) - chunk_errors,
        "parts_total": len(chunks),
        "truncated": sum(len(t) for _, t in texts) > CHUNK_CHARS * MAX_CHUNKS,
        "unreadable_documents": unreadable,
        **{"lateness": late_info(submission)},
    }, None


def _document_count(submission) -> int:
    from ..models import SubmissionDocument

    return SubmissionDocument.objects.filter(submission=submission).count()


def payload(submission) -> dict | None:
    """What the ODU screen needs, or None when no review has been requested."""
    from ..models import ReportAIReview

    review = ReportAIReview.objects.filter(submission=submission).first()
    if not review:
        return None
    return {
        "state": review.state,
        "error": review.error,
        "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
        "result": review.result or {},
        "lateness": (review.result or {}).get("lateness") or late_info(submission),
        "disclaimer": "AI first-pass review. Advice for ODU only: check it against the report.",
    }
