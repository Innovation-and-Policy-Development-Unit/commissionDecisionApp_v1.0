"""
Statutory workflow definitions for compliance case families.

Ported from the standalone CCMS. Each stage carries an SLA clock; working-day SLAs
are computed against the SCDMS ``PublicHoliday`` calendar (via ``add_working_days``),
calendar-day SLAs by simple date arithmetic.

A case's stages are *materialised* from its family template when the
:class:`~tracker.compliance_models.ComplianceCase` is created (see ``signals.py``),
producing concrete ``ComplianceCaseStage`` rows with computed due dates. A periodic
task (:func:`tracker.tasks.recompute_compliance_sla`) keeps each stage's
``sla_status`` (on-track / at-risk / overdue) current.
"""

from __future__ import annotations

from datetime import date, timedelta

from .compliance_models import CaseFamily, SLAStatus, StageStatus

# At-risk threshold: a stage is "at risk" when this many working days or fewer remain.
AT_RISK_DAYS = 3


def _s(order, name, code, sla_days, is_working_days, responsible_role,
       statutory_ref, description, is_optional=False):
    return {
        "order":            order,
        "name":             name,
        "stage_code":       code,
        "sla_days":         sla_days,
        "is_working_days":  is_working_days,
        "responsible_role": responsible_role,
        "statutory_ref":    statutory_ref,
        "description":      description,
        "is_optional":      is_optional,
    }


# 1. EMPLOYEE INTERNAL DISCIPLINARY (PSC Reg. 27–32)
_EMPLOYEE_DISCIPLINARY = [
    _s(1, "Notice of Allegation Served", "allegation_notice", 5, True, "compliance_unit", "PSC Reg. 28(1)", "Written notice of allegation served on the subject employee within 5 working days of case registration."),
    _s(2, "Subject Response Period", "subject_response", 5, True, "employee_subject", "PSC Reg. 28(2)", "Subject has 5 working days to lodge a written response to the allegation notice."),
    _s(3, "Investigation Committee Appointed", "committee_appointed", 5, True, "compliance_unit", "PSC Reg. 29(1)", "An Investigation Committee of three members is constituted within 5 working days of the response deadline."),
    _s(4, "Investigation Conducted", "investigation", 21, True, "compliance_unit", "PSC Reg. 29(2)", "Committee conducts its investigation and interviews within 21 working days of appointment."),
    _s(5, "Investigation Report Submitted", "investigation_report", 5, True, "compliance_unit", "PSC Reg. 30(1)", "Committee submits a written report with findings and recommendations within 5 working days of completing the investigation."),
    _s(6, "Head of Department / PSC Decision", "hod_decision", 10, True, "secretary_opsc", "PSC Reg. 31(1)", "Appointing authority reviews the report and makes a disciplinary decision within 10 working days."),
    _s(7, "Outcome Letter Issued to Subject", "outcome_letter", 3, True, "compliance_unit", "PSC Reg. 32(1)", "Written outcome letter issued to the subject within 3 working days of the decision."),
]

# 2. SERIOUS MISCONDUCT — EMPLOYEE (PSC Reg. 33–42)
_SERIOUS_MISCONDUCT_EMPLOYEE = [
    _s(1, "Show-Cause Notice Issued", "show_cause_notice", 2, True, "compliance_unit", "PSC Reg. 33(1)", "A show-cause notice is issued to the subject within 2 working days of the allegation being substantiated."),
    _s(2, "Subject Show-Cause Response", "show_cause_response", 5, True, "employee_subject", "PSC Reg. 33(2)", "Subject must provide a written response to the show-cause notice within 5 working days."),
    _s(3, "Interim Suspension Decision", "interim_suspension", 2, True, "secretary_opsc", "PSC Reg. 34(1)", "Appointing authority decides whether to impose interim suspension pending investigation.", is_optional=True),
    _s(4, "Independent Investigator Appointed", "investigator_appointed", 5, True, "compliance_unit", "PSC Reg. 35(1)", "An independent investigator or panel is appointed within 5 working days of the show-cause deadline."),
    _s(5, "Investigation Conducted", "investigation", 30, True, "compliance_unit", "PSC Reg. 35(2)", "Full disciplinary investigation conducted and completed within 30 working days of appointment."),
    _s(6, "Investigation Report to OPSC", "investigation_report", 5, True, "compliance_unit", "PSC Reg. 36(1)", "Investigator submits a written report with findings to the OPSC within 5 working days."),
    _s(7, "PSC Preliminary Assessment", "psc_assessment", 5, True, "secretary_opsc", "PSC Reg. 37(1)", "PSC conducts a preliminary review of the investigation report to determine whether a formal hearing is warranted."),
    _s(8, "PSDB Referral", "psdb_referral", 5, True, "secretary_opsc", "PSC Reg. 38(1)", "If the subject contests the findings, the matter may be referred to the PSDB.", is_optional=True),
    _s(9, "Formal PSC / PSDB Hearing", "psc_hearing", 10, True, "secretary_opsc", "PSC Reg. 39(1)", "Formal hearing conducted where both parties present their case, within 10 working days of the assessment."),
    _s(10, "PSC Decision & Sanction Issued", "psc_decision", 5, True, "secretary_opsc", "PSC Reg. 40(1)", "PSC issues a written decision and applies the appropriate sanction within 5 working days of the hearing."),
    _s(11, "Outcome Letter Issued to Subject", "outcome_letter", 3, True, "compliance_unit", "PSC Reg. 41(1)", "Written outcome letter formally notifying the subject of the decision and sanction within 3 working days."),
]

# 3. TEMPORARY SUSPENSION (PSC Reg. 43–47)
_TEMPORARY_SUSPENSION = [
    _s(1, "Suspension Order Issued", "suspension_order", 1, True, "secretary_opsc", "PSC Reg. 43(1)", "The appointing authority issues a written suspension order within 1 working day of the trigger event."),
    _s(2, "Formal Allegation Notice Served", "allegation_notice", 3, True, "compliance_unit", "PSC Reg. 43(2)", "A formal notice of allegation detailing the grounds for suspension is served within 3 working days."),
    _s(3, "Subject Response Period", "subject_response", 5, True, "employee_subject", "PSC Reg. 44(1)", "Subject has 5 working days to respond in writing to the formal allegation notice."),
    _s(4, "Review by Appointing Authority", "authority_review", 5, True, "secretary_opsc", "PSC Reg. 45(1)", "The appointing authority reviews the subject's response and available evidence within 5 working days."),
    _s(5, "Decision: Continue or Reinstate", "continuation_decision", 3, True, "secretary_opsc", "PSC Reg. 46(1)", "A formal decision is made to continue the suspension and escalate, or reinstate the employee."),
    _s(6, "Outcome Communicated to Subject", "outcome_letter", 2, True, "compliance_unit", "PSC Reg. 47(1)", "Written notice of the decision is communicated to the subject within 2 working days."),
]

# 4. GRIEVANCE PROCESS (PSC Reg. 48–56 / Employment Act s.57)
_GRIEVANCE = [
    _s(1, "Grievance Lodged & Acknowledged", "grievance_lodged", 2, True, "compliance_unit", "PSC Reg. 48(1)", "Grievance is formally received and an acknowledgement letter issued to the complainant within 2 working days."),
    _s(2, "MDC Assessment", "mdc_assessment", 5, True, "mdc_panel_mediator", "PSC Reg. 49(1) / Employment Act s.57", "The Mediation & Dispute Committee conducts an initial assessment within 5 working days."),
    _s(3, "Conciliation / Mediation Conducted", "mediation", 21, True, "mdc_panel_mediator", "PSC Reg. 50(1)", "MDC-facilitated conciliation or mediation conducted; up to 21 working days to reach a settlement."),
    _s(4, "Mediation Outcome Documented", "mediation_outcome", 3, True, "mdc_panel_mediator", "PSC Reg. 51(1)", "The mediator documents the outcome (settled or not settled) within 3 working days of the final session."),
    _s(5, "Referral to PSDB (if unresolved)", "psdb_referral", 5, True, "compliance_unit", "PSC Reg. 52(1)", "If mediation fails, the grievance is referred to the PSDB within 5 working days.", is_optional=True),
    _s(6, "PSDB Hearing", "psdb_hearing", 14, True, "secretary_opsc", "PSC Reg. 53(1)", "PSDB schedules and conducts a formal grievance hearing within 14 working days of referral.", is_optional=True),
    _s(7, "PSDB Determination Issued", "psdb_determination", 5, True, "secretary_opsc", "PSC Reg. 54(1)", "PSDB issues a written determination within 5 working days of the hearing.", is_optional=True),
    _s(8, "Outcome Letter Issued", "outcome_letter", 3, True, "compliance_unit", "PSC Reg. 55(1)", "Final outcome letter issued to all parties within 3 working days of the determination or settled mediation."),
]

# 5. SENIOR EXECUTIVE — SERIOUS MISCONDUCT (PSC Act s.22–29)
_SENIOR_SERIOUS_MISCONDUCT = [
    _s(1, "Allegation Referred to Commission", "allegation_referral", 3, True, "compliance_unit", "PSC Act s.22(1)", "Allegation against the senior executive is referred to the Commission within 3 working days of receipt."),
    _s(2, "Commission Preliminary Assessment", "commission_assessment", 10, True, "commission_member", "PSC Act s.22(2)", "The Commission conducts a preliminary assessment within 10 working days."),
    _s(3, "Notice of Allegation Issued to Executive", "allegation_notice", 5, True, "secretary_opsc", "PSC Act s.23(1)", "Commission issues a formal notice of allegation within 5 working days of the assessment decision."),
    _s(4, "Executive Response Period", "executive_response", 5, True, "employee_subject", "PSC Act s.23(2)", "Senior executive has 5 working days to lodge a written response to the notice of allegation."),
    _s(5, "Interim Suspension (if warranted)", "interim_suspension", 3, True, "secretary_opsc", "PSC Act s.24(1)", "Commission may recommend interim suspension pending the inquiry outcome.", is_optional=True),
    _s(6, "Independent Investigator Appointed", "investigator_appointed", 5, True, "commission_member", "PSC Act s.25(1)", "Commission appoints an independent investigator within 5 working days of the response deadline."),
    _s(7, "Investigation Conducted", "investigation", 45, True, "compliance_unit", "PSC Act s.25(2)", "Full independent investigation conducted within 45 working days of investigator appointment."),
    _s(8, "Investigation Report to Commission", "investigation_report", 5, True, "compliance_unit", "PSC Act s.26(1)", "Investigator submits the full report to the Commission within 5 working days of completion."),
    _s(9, "Commission Deliberation", "commission_deliberation", 21, False, "commission_member", "PSC Act s.27(1)", "Commission deliberates and prepares its determination over a statutory 21 calendar days."),
    _s(10, "Commission Determination Issued", "commission_determination", 10, True, "commission_member", "PSC Act s.27(2)", "Commission issues its formal written determination within 10 working days of deliberation."),
    _s(11, "Commission Confirmation Period", "commission_confirmation", 45, False, "commission_member", "PSC Act s.28(1)", "A 45-calendar-day confirmation period during which the executive may appeal before the sanction takes effect."),
    _s(12, "Referral to Minister / Prime Minister", "ministerial_referral", 5, True, "secretary_opsc", "PSC Act s.29(1)", "If the sanction requires Ministerial/PM approval, the Commission refers its determination within 5 working days.", is_optional=True),
    _s(13, "Decision Implemented", "decision_implemented", 5, True, "compliance_unit", "PSC Act s.29(2)", "The Commission's decision is implemented and the executive notified within 5 working days of all approvals."),
]

# 6. SENIOR EXECUTIVE — POOR PERFORMANCE (PSC Act s.30–38)
_SENIOR_POOR_PERFORMANCE = [
    _s(1, "Performance Concerns Documented", "performance_concerns", 5, True, "compliance_unit", "PSC Act s.30(1)", "Supervisor formally documents specific performance concerns within 5 working days of identification."),
    _s(2, "Performance Improvement Notice Issued", "pip_notice", 3, True, "secretary_opsc", "PSC Act s.30(2)", "A formal Performance Improvement Notice is issued within 3 working days of concerns being documented."),
    _s(3, "PIP Plan Agreed & Commenced", "pip_commenced", 10, True, "compliance_unit", "PSC Act s.31(1)", "A Performance Improvement Plan with measurable targets is agreed and commenced within 10 working days."),
    _s(4, "PIP Monitoring Period", "pip_monitoring", 90, False, "compliance_unit", "PSC Act s.31(2)", "The executive is given 90 calendar days to demonstrate measurable improvement against PIP targets."),
    _s(5, "PIP Review Assessment", "pip_review", 10, True, "compliance_unit", "PSC Act s.32(1)", "Formal review assessment documented within 10 working days of the PIP expiry."),
    _s(6, "Commission Assessment", "commission_assessment", 10, True, "commission_member", "PSC Act s.33(1)", "If performance has not improved, the matter is referred to the Commission within 10 working days."),
    _s(7, "PSDB Assessment (if contested)", "psdb_assessment", 10, True, "secretary_opsc", "PSC Act s.34(1)", "If the executive contests the finding, the matter may be reviewed by the PSDB within 10 working days.", is_optional=True),
    _s(8, "Commission Recommendation to Minister", "commission_recommendation", 10, True, "commission_member", "PSC Act s.35(1)", "Commission submits its formal recommendation to the relevant Minister within 10 working days."),
    _s(9, "Ministerial Decision", "ministerial_decision", 21, False, "secretary_opsc", "PSC Act s.36(1)", "The Minister has 21 calendar days to accept, modify, or reject the Commission's recommendation."),
    _s(10, "Commission Confirmation Period", "commission_confirmation", 45, False, "commission_member", "PSC Act s.37(1)", "The Ministerial decision is subject to a 45-calendar-day Commission confirmation period before it takes effect."),
    _s(11, "Decision Implemented", "decision_implemented", 5, True, "compliance_unit", "PSC Act s.38(1)", "The final decision is implemented and the executive notified in writing within 5 working days."),
]


WORKFLOW_STAGES: dict[str, list[dict]] = {
    CaseFamily.EMPLOYEE_DISCIPLINARY:       _EMPLOYEE_DISCIPLINARY,
    CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE: _SERIOUS_MISCONDUCT_EMPLOYEE,
    CaseFamily.TEMPORARY_SUSPENSION:        _TEMPORARY_SUSPENSION,
    CaseFamily.GRIEVANCE:                   _GRIEVANCE,
    CaseFamily.SENIOR_SERIOUS_MISCONDUCT:   _SENIOR_SERIOUS_MISCONDUCT,
    CaseFamily.SENIOR_POOR_PERFORMANCE:     _SENIOR_POOR_PERFORMANCE,
}


def get_stages_for_family(family: str) -> list[dict]:
    """Return the ordered stage template for a case family (empty if unknown)."""
    return WORKFLOW_STAGES.get(family, [])


def compute_due_date(start: date, sla_days: int, is_working_days: bool) -> date:
    """Due date = start + sla_days, honouring the PublicHoliday calendar for working days."""
    if not sla_days:
        return start
    if is_working_days:
        from .models import add_working_days
        return add_working_days(start, sla_days)
    return start + timedelta(days=sla_days)


def materialize_stages(case) -> int:
    """Create ComplianceCaseStage rows for a case from its family template.

    Idempotent: does nothing if the case already has stages. Returns the number
    of stages created. Due dates are computed from ``case.date_received``.
    """
    from .compliance_models import ComplianceCaseStage

    if case.stages.exists():
        return 0

    start = case.date_received or date.today()
    rows = []
    for st in get_stages_for_family(case.case_family):
        rows.append(ComplianceCaseStage(
            case=case,
            stage_name=st["name"],
            stage_code=st["stage_code"],
            stage_order=st["order"],
            responsible_role=st["responsible_role"],
            statutory_ref=st["statutory_ref"],
            sla_days=st["sla_days"],
            sla_working_days=st["is_working_days"],
            due_date=compute_due_date(start, st["sla_days"], st["is_working_days"]),
            is_optional=st["is_optional"],
            notes=st["description"],
        ))
    ComplianceCaseStage.objects.bulk_create(rows)
    return len(rows)


def sla_status_for_stage(stage, today: date | None = None) -> str:
    """Compute (without saving) the SLA status for a single stage."""
    if stage.status in (StageStatus.COMPLETED, StageStatus.SKIPPED):
        return SLAStatus.COMPLETED
    if not stage.due_date:
        return SLAStatus.ON_TRACK
    today = today or date.today()
    if today > stage.due_date:
        return SLAStatus.OVERDUE
    # At risk if within AT_RISK_DAYS calendar days of the deadline.
    if (stage.due_date - today).days <= AT_RISK_DAYS:
        return SLAStatus.AT_RISK
    return SLAStatus.ON_TRACK


def recompute_case_sla(case) -> int:
    """Refresh every stage's sla_status for a case. Returns rows updated."""
    today = date.today()
    updated = 0
    for stage in case.stages.all():
        new_status = sla_status_for_stage(stage, today)
        if stage.sla_status != new_status:
            stage.sla_status = new_status
            stage.save(update_fields=["sla_status"])
            updated += 1
    return updated
