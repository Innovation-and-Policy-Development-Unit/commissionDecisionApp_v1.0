"""AI first-pass review of a ministry Annual Report, Business Plan or Corporate Plan against
the OPSC guideline (Sonnet).

The review is driven by a ``Profile`` per form type: its ODU checklist, what the guideline
asks for under each item, the lodging deadline (if any) and, for the Corporate Plan, the
five-year rule. The module keeps its original name because the Annual Report came first.

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

from dataclasses import dataclass, field

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import get_model_tier

CHECKLIST_CODE = "ANNUAL-REPORT-CHECKLIST"  # the Annual Report profile's checklist
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

# What the 2021 PSC Guidelines for Preparing Department Business Plans ask for. The five key
# components are the Executive Summary, the Program-Activity M&E Framework, the Human
# Resource Operational Plan, the Cash Flow Projection and the Procurement Plan. Items the
# guideline PDF does not spell out are described by what the ODU checklist item asks.
BUSINESS_PLAN_GUIDELINE = {
    "department_name_check": "The departments covered by the plan are named; the Ministry presents one consolidated Business Plan covering all its Departments.",
    "ministry_check": "The Ministry the plan belongs to is named.",
    "responsible_head_check": "The responsible head (Director General or Director) is named.",
    "plan_type_check": "The plan states its duration: a Business Plan is a one-year (12-month) plan.",
    "period_dates_check": "The planning period (start and end dates) is stated.",
    "key_outcomes_check": "An Executive Summary: a high-level summary of the key outcomes the Ministry wants to achieve this year in relation to the Corporate Plan.",
    "main_programs_check": "A short description of the key programs and activities that will deliver those outcomes.",
    "nsdp_alignment_check": "How the plan links to the outputs and outcomes of the Corporate Plan and to the NSDP.",
    "me_matrix_check": "The Program / Activity M&E Framework: programs and activities by Department, matching the Budget Narrative, with output or service target, actions, action completion dates, target and comments/risks.",
    "kpis_check": "Output or service targets (indicators) with a target number for each activity; targets should be SMART.",
    "risks_mitigation_check": "Comments and risks against each activity, with ways to reduce them.",
    "me_matrix_columns_check": "The M&E matrix includes the officer-in-charge (OIC) and location columns (ODU checklist item).",
    "budget_narrative_mandate_check": "For each Department, the Mandate Statement from the Budget Narrative (ODU checklist item).",
    "budget_narrative_objectives_check": "For each Department, the objectives from the Budget Narrative (ODU checklist item).",
    "budget_narrative_service_delivery_check": "For each Department, the Means of Service Delivery from the Budget Narrative (ODU checklist item).",
    "budget_narrative_performance_check": "For each Department, the performance measures / service targets from the Budget Narrative (ODU checklist item).",
    "staffing_table_check": "The Human Resource Operational Plan's staffing table: total staff in the PSC-approved structure, split permanent, probation, contract, daily rated and vacant, plus staff in acting positions.",
    "retirement_severance_check": "Retirements, severance to be paid during the year and the accrued leave estimate for retiring staff.",
    "vacancy_plan_check": "Priority vacant posts in the approved structure to be advertised (position, scale, salary, allowances).",
    "training_budget_check": "Key training to be delivered, with cost and duration.",
    "scholarship_programs_check": "Officers on scholarship: name, salary, allowances and area of scholarship.",
    "cashflow_matrix_check": "The Cash Flow Forecast: vatu amounts by Department, Program and Activity, month by month (no need to list individual COA).",
    "payroll_projection_check": "The payroll cash flow by activity and month.",
    "overheads_forecast_check": "The overheads cash flow by activity and month.",
    "funding_gaps_check": "Cash constraints or funding gaps noted against the forecast.",
    "procurement_schedule_check": "The Procurement Plan: purchases by cost centre, description, department, program, activity and fund, with execution timing; consistent with the plan sent to the Central Tender Board and with the activity plan.",
    "capital_equipment_check": "Capital equipment purchases listed in the Procurement Plan.",
    "service_contracts_check": "Service contracts and renewals listed in the Procurement Plan.",
    "procurement_risks_check": "Procurement risks and contingency noted.",
    "procurement_approvals_check": "The Director General's cash-flow endorsement and document approvals (CSU / Central Tender Board) recorded (ODU checklist item).",
    "procurement_complex_stages_check": "Complex procurements show their stages and any Ministerial / Council of Ministers approvals needed (ODU checklist item).",
    "provincial_priorities_check": "Priorities addressed for Torba, Sanma, Penama, Malampa, Shefa and Tafea (ODU checklist item).",
}

# What the 2021 PSC Guidelines for Preparing Ministry Corporate Plans ask for. The Corporate
# Plan covers five years (2021-2025, then 2026-2030), and Departments do not prepare separate
# Corporate Plans.
CORPORATE_PLAN_GUIDELINE = {
    "ministry_name_check": "The Ministry the plan belongs to is named.",
    "minister_name_check": "The Minister endorsing the plan is named.",
    "ps_name_check": "The Director General (head of the ministry) is named.",
    "plan_duration_check": "The plan states its period. The Corporate Plan must cover a five-year framework (PFEM Act), for example 2021 to 2025.",
    "vision_statement_check": "The Ministry's Vision Statement: a long-term look at where the Ministry would like to be.",
    "mission_statement_check": "The Ministry's Mission Statement: the purpose of the Ministry and its key clients.",
    "core_values_check": "The Ministry's values (six to eight, clear in day-to-day behavioural terms).",
    "nsdp_alignment_check": "How the plan positions the Ministry against the vision, goals and policy objectives of the NSDP, and the Ministry's ADR targets.",
    "minister_preface_check": "A short Preface from the Minister endorsing the plan, about one page, on how the plan positions the Ministry against the NSDP.",
    "strategic_programs_check": "Strategic Directions: Programs, at least two and no more than six, that form the basis of the Budget Narratives.",
    "program_activity_matrix_check": "The Corporate Plan Matrix: for each Program the objectives, outcome, key activities, output or service target, time frame, responsibility by position and delivery risk assessment and mitigation.",
    "strategic_priorities_check": "Strategic Directions: objectives and focus areas drawn from the NSDP and relevant sector, provincial or recovery strategies.",
    "kpis_by_program_check": "Outcomes and output / service targets mapped to each Program and Activity; targets should be SMART (specific, measurable, achievable, relevant, time-bound).",
    "org_structure_check": "The organisational structure of the overall Ministry as gazetted, showing affiliated State Owned Entities and Statutory Authorities.",
    "org_chart_reference_check": "An organisation chart of the Ministry, as gazetted.",
    "staffing_structure_check": "Human Resources: an analysis of the current structure and the OPSC-approved staffing structures of the Departments, Units and agencies, showing permanent, probation, intern, volunteer and vacant posts.",
    "staffing_allocation_check": "The total approved staffing allocation (permanent, full-time, probationary, contract and daily-rated numbers).",
    "capability_gaps_check": "Skills and capability gaps against what delivering the plan needs.",
    "fit_for_purpose_check": "Where a restructure is proposed in the five years, a Fit For Purpose self-assessment, with the Department, Agency or Unit and the year.",
    "budget_allocation_check": "Budget: the current-year budget and a five-year forecast budget by program and activity.",
    "payroll_costs_check": "Payroll and personnel costs within the budget.",
    "operational_expenses_check": "Operational expenses and overheads within the budget.",
    "capital_investment_check": "The capital investment programme within the budget.",
    "resource_gaps_check": "Resource gaps and constraints that affect delivery of the plan.",
    "training_programs_check": "A Training Plan: area of study, subject, delivery agency and possible scholarships.",
    "succession_planning_check": "A Succession Plan for the next five years.",
    "technology_upgrades_check": "Technology and systems upgrades planned.",
    "institutional_strengthening_check": "Institutional strengthening initiatives planned.",
    "retirement_plan_check": "A Retirement Plan for the five-year period.",
    "major_risks_check": "Risks of the operating environment appraised, including an Environmental Scan (a SWOT table is encouraged).",
    "risk_mitigation_check": "Risk assessment and mitigation measures against each activity (a column of the Corporate Plan Matrix).",
    "compliance_requirements_check": "Authorising legislation and compliance requirements, including the Public Service Act and PFEM Act, that the plan responds to.",
    "me_framework_check": "How the Ministry will monitor and report progress: SMART indicators and targets reported in the Annual Report.",
    "plan_five_year_check": "The plan period must cover exactly five years (for example 2021 to 2025). This item is set by the system from the period found in the plan.",
}

# Items that belong to the digitized submission form (issue / discussion / recommendation),
# not to the plan document itself, so the AI is not asked about them.
_NOT_IN_THE_DOCUMENT = frozenset({"issue_check", "discussion_check", "recommendation_check"})


@dataclass(frozen=True)
class Profile:
    form_type: str
    checklist_code: str
    label: str            # "Annual Report"
    guideline_name: str   # "Annual Report Guideline"
    guidelines: dict = field(repr=False)
    deadline: tuple | None = None   # (month, day) of the year the paper was lodged
    exclude: frozenset = frozenset()
    five_year_key: str = ""         # checklist item set from the plan's own period


PROFILES: dict[str, Profile] = {
    "ANNUAL-REPORT": Profile(
        "ANNUAL-REPORT", "ANNUAL-REPORT-CHECKLIST", "Annual Report", "Annual Report Guideline",
        GUIDELINE, deadline=(3, 31),
    ),
    "BUSINESS-PLAN": Profile(
        "BUSINESS-PLAN", "BUSINESS-PLAN-CHECKLIST", "Business Plan", "Department Business Plan Guideline",
        BUSINESS_PLAN_GUIDELINE, deadline=(2, 28), exclude=_NOT_IN_THE_DOCUMENT,
    ),
    "CORPORATE-PLAN": Profile(
        "CORPORATE-PLAN", "CORPORATE-PLAN-CHECKLIST", "Corporate Plan", "Ministry Corporate Plan Guideline",
        CORPORATE_PLAN_GUIDELINE, deadline=None, exclude=_NOT_IN_THE_DOCUMENT,
        five_year_key="plan_five_year_check",
    ),
}
REVIEWED_FORM_TYPES = frozenset(PROFILES)
FIVE_YEARS = 5


def profile_for(form_type_code: str) -> Profile | None:
    return PROFILES.get(form_type_code or "")


def system_chunk(profile: Profile) -> str:
    text = (
        "You assist the Organisation Development Unit (ODU) of the Vanuatu Public Service "
        f"Commission in checking a ministry {profile.label} against the PSC guideline. You are "
        f"shown ONE PART of the {profile.label.lower()} and a list of criteria, each with what the guideline asks "
        "for. For every criterion decide from this part only: 'met' (it clearly provides "
        "it), 'partial' (some of it, or only a heading or a vague mention) or 'not_found' (nothing "
        "in this part). Use ONLY the text given and never assume. For 'met' and 'partial' give a "
        "short verbatim quote (under 160 characters) as evidence and a one-sentence note on what "
        "is there or what is missing. Return JSON: {\"items\": {\"<key>\": {\"status\": "
        "\"met|partial|not_found\", \"evidence\": \"...\", \"note\": \"...\"}}} including every "
        "key given."
    )
    if profile.five_year_key:
        text += (
            " Also look for the period the plan covers (for example 2021 to 2025). If this part "
            "states it, add to the JSON \"plan_period\": {\"start_year\": 2021, \"end_year\": 2025, "
            "\"evidence\": \"short verbatim quote\"}; use null for a year this part does not state."
        )
    return text


def system_summary(profile: Profile) -> str:
    return (
        f"You write a short advisory note for an ODU officer reviewing a ministry {profile.label}. "
        "From the criterion results given, write: 'summary' (2-4 plain sentences on how complete "
        f"the {profile.label.lower()} is, naming the most important gaps) and 'recommendation', exactly one of "
        "'accept' (complete enough to proceed), 'accept_with_follow_up' (minor gaps ODU can ask "
        "the ministry to fill) or 'return_for_clarification' (material gaps). Be factual and "
        "never invent content. Return JSON: {\"summary\": \"...\", \"recommendation\": \"...\"}"
    )


# Kept for callers that still import the Annual Report prompts by name.
SYSTEM_CHUNK = system_chunk(PROFILES["ANNUAL-REPORT"])
SYSTEM_SUMMARY = system_summary(PROFILES["ANNUAL-REPORT"])


def checklist_items(profile: Profile | None = None) -> list[dict]:
    """The review criteria: the live fields of the profile's ODU review checklist."""
    from ..models import PSCFormField

    profile = profile or PROFILES["ANNUAL-REPORT"]
    fields = (
        PSCFormField.objects.filter(form_type__code=profile.checklist_code)
        .exclude(field_type="section_header")
        .exclude(field_key__in=profile.exclude)
        .order_by("display_order", "id")
    )
    return [
        {"key": f.field_key, "label": f.label, "guideline": profile.guidelines.get(f.field_key, f.label)}
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
    """Lateness against the profile's yearly deadline, in the year the paper was lodged."""
    from datetime import date

    profile = profile_for(submission.form_type_code)
    received = submission.received_at.date() if submission.received_at else None
    if not profile or not profile.deadline or not received:
        return {"deadline": None, "deadline_text": "", "days_late": 0, "late": False}
    deadline = date(received.year, *profile.deadline)
    days = (received - deadline).days
    return {
        "deadline": deadline.isoformat(),
        "deadline_text": f"{deadline.day} {deadline.strftime('%B')}",
        "days_late": max(days, 0),
        "late": days > 0,
    }


def _plan_period(found: dict | None) -> dict:
    """Turn the period the model quoted into the five-year verdict (computed here, not by the model)."""
    start = (found or {}).get("start_year")
    end = (found or {}).get("end_year")
    if not (isinstance(start, int) and isinstance(end, int) and 1990 <= start <= end <= 2100):
        return {"found": False, "start_year": None, "end_year": None, "years": None,
                "five_years": False, "evidence": str((found or {}).get("evidence") or "")[:200]}
    years = end - start + 1
    return {"found": True, "start_year": start, "end_year": end, "years": years,
            "five_years": years == FIVE_YEARS, "evidence": str((found or {}).get("evidence") or "")[:200]}


def _period_item(period: dict) -> dict:
    if not period["found"]:
        return {"status": "not_found", "evidence": period["evidence"],
                "note": "The plan period (start and end year) could not be found."}
    span = f"{period['start_year']} to {period['end_year']} ({period['years']} year{'s' if period['years'] != 1 else ''})"
    if period["five_years"]:
        return {"status": "met", "evidence": period["evidence"], "note": f"Plan period {span}."}
    return {"status": "not_found", "evidence": period["evidence"],
            "note": f"Plan period is {span}, but a Corporate Plan must cover five years."}


def review_report(submission) -> tuple[dict | None, str | None]:
    """Return (result, error). ``result`` is stored as-is on ReportAIReview.result."""
    if not ai_enabled():
        return None, "AI is switched off."
    profile = profile_for(submission.form_type_code)
    if not profile:
        return None, "There is no AI review for this type of submission."
    items = checklist_items(profile)
    if not items:
        return None, f"The {profile.label} review checklist is not set up."
    texts = report_texts(submission)
    unreadable = max(0, _document_count(submission) - len(texts))
    if not texts:
        return None, "None of the uploaded documents has readable text, so there is nothing for the AI to check."

    tier = get_model_tier("annual_report_review")
    system = system_chunk(profile)
    period_found: dict | None = None
    best: dict[str, dict] = {i["key"]: {"status": "not_found", "evidence": "", "note": ""} for i in items}
    chunk_errors = 0
    chunks = _chunks(texts)
    for n, chunk in enumerate(chunks, 1):
        data, err = complete_json_with_error(
            system=system,
            user=f"Part {n} of {len(chunks)} of the {profile.label.lower()}.\n\nCRITERIA\n{_criteria_block(items)}\n\nREPORT TEXT\n{chunk}",
            tier=tier,
            max_tokens=6000,
        )
        raw = (data or {}).get("items") if isinstance(data, dict) else None
        if not isinstance(raw, dict):
            chunk_errors += 1
            continue
        if profile.five_year_key and isinstance(data.get("plan_period"), dict):
            candidate = _plan_period(data["plan_period"])
            if candidate["found"] and not (period_found and period_found["found"]):
                period_found = candidate
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
        return None, f"The AI could not read the {profile.label.lower()}. Try again."

    period = None
    if profile.five_year_key:
        period = period_found or _plan_period(None)
        if profile.five_year_key in best:
            best[profile.five_year_key] = _period_item(period)

    counts = {s: sum(1 for v in best.values() if v["status"] == s) for s in RANK}
    lines = [f"{i['label']}: {best[i['key']]['status']} ({best[i['key']]['note']})" for i in items]
    sdata, _ = complete_json_with_error(
        system=system_summary(profile),
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
    if period and period["found"] and not period["five_years"] and recommendation == "accept":
        recommendation = "accept_with_follow_up"  # a wrong-length plan is never a clean pass
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
        "lateness": late_info(submission),
        "plan_period": period,
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
        "disclaimer": "AI first-pass review. Advice for ODU only: check it against the document.",
        "label": (profile_for(submission.form_type_code) or PROFILES["ANNUAL-REPORT"]).label,
        "guideline_name": (profile_for(submission.form_type_code) or PROFILES["ANNUAL-REPORT"]).guideline_name,
        "plan_period": (review.result or {}).get("plan_period"),
    }
