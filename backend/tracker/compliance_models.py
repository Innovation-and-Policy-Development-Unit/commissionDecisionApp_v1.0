"""
Compliance Case Management — data models merged into SCDMS.

A compliance matter *is* a :class:`tracker.models.Submission` flowing through the
existing workflow. These models carry the compliance-specific data that hangs off it:

  - ``Complaint``            — ministry-lodged intake record (write-only for ministries)
  - ``ComplianceCase``       — one-to-one extension of ``Submission`` (subject-as-person,
                               case family, status)
  - ``ComplianceCaseStage``  — statutory SLA timeline rows
  - ``LitigationRecord``     — litigation & cost tracking (FR-13)
  - ``CaseNote``             — case-scoped notes

Visibility (enforced by the Phase 4 scoping layer): ministry roles may create a
``Complaint`` and read only their own; they never see ``ComplianceCase`` / stages /
litigation / notes. Compliance submissions are ``is_internal=True`` and therefore
already excluded from ministry-facing submission lists.
"""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from .models import Ministry, ReferenceCounter, Submission


# ── Choice enums ──────────────────────────────────────────────────────────────

class CaseFamily(models.TextChoices):
    EMPLOYEE_DISCIPLINARY       = "employee_disciplinary",       "Employee Internal Disciplinary"
    SERIOUS_MISCONDUCT_EMPLOYEE = "serious_misconduct_employee", "Serious Misconduct — Employee"
    TEMPORARY_SUSPENSION        = "temporary_suspension",        "Temporary Suspension"
    GRIEVANCE                   = "grievance",                   "Grievance Process"
    SENIOR_SERIOUS_MISCONDUCT   = "senior_serious_misconduct",   "Senior Executive — Serious Misconduct"
    SENIOR_POOR_PERFORMANCE     = "senior_poor_performance",     "Senior Executive — Poor Performance"
    POLICY_REVIEW               = "policy_review",               "Policy / PSA Amendment"


class ComplianceCaseStatus(models.TextChoices):
    ACTIVE   = "active",   "Active"
    ON_HOLD  = "on_hold",  "On Hold"
    CLOSED   = "closed",   "Closed"
    ARCHIVED = "archived", "Archived"


class SLAStatus(models.TextChoices):
    ON_TRACK  = "on_track",  "On Track"
    AT_RISK   = "at_risk",   "At Risk"
    OVERDUE   = "overdue",   "Overdue"
    COMPLETED = "completed", "Completed"


class StageStatus(models.TextChoices):
    PENDING     = "pending",     "Pending"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED   = "completed",   "Completed"
    SKIPPED     = "skipped",     "Skipped"


class ComplianceDecisionOutcome(models.TextChoices):
    REINSTATE         = "reinstate",         "Reinstated"
    TERMINATE         = "terminate",         "Terminated / Dismissed"
    WARN              = "warn",              "Formal Warning Issued"
    DEMOTE            = "demote",            "Demotion"
    SUSPEND_NO_PAY    = "suspend_no_pay",    "Suspension Without Pay"
    COMPULSORY_RETIRE = "compulsory_retire", "Compulsory Retirement"
    NO_ACTION         = "no_action",         "No Further Action"
    REFERRED_PSDB     = "referred_psdb",     "Referred to PSDB"
    SETTLED           = "settled",           "Settled (Grievance)"
    NOT_SETTLED       = "not_settled",       "Not Settled (Grievance)"


class ComplaintStatus(models.TextChoices):
    RECEIVED     = "received",     "Received"
    UNDER_REVIEW = "under_review", "Under Review"
    ACCEPTED     = "accepted",     "Accepted"
    REJECTED     = "rejected",     "Rejected"
    CONVERTED    = "converted",    "Converted to Case"


class OffenceCategory(models.TextChoices):
    MINOR              = "minor",              "Minor / Disciplinary Offence"
    SERIOUS_MISCONDUCT = "serious_misconduct", "Serious Misconduct (Appendix C)"


class SuspensionSalaryBasis(models.TextChoices):
    FULL   = "full",   "Full Salary"
    HALF   = "half",   "Half Salary (temporary suspension)"
    NO_PAY = "no_pay", "Without Pay (PSDB sanction)"


class SuspensionReimbursement(models.TextChoices):
    PENDING  = "pending",  "Pending OPSC Assessment"
    REIMBURSE = "reimburse", "Reimburse Withheld Salary"
    FORFEIT  = "forfeit",  "Forfeit Withheld Salary"
    NA       = "na",       "Not Applicable"


class InvestigationStatus(models.TextChoices):
    APPOINTED   = "appointed",   "Panel Appointed"
    IN_PROGRESS = "in_progress", "Investigation In Progress"
    REPORTED    = "reported",    "Report Submitted"
    CLOSED      = "closed",      "Closed"


# ── Reference numbering (shares the global ReferenceCounter, like submissions) ──

def allocate_complaint_reference() -> str:
    year = timezone.now().year
    with transaction.atomic():
        counter, _ = ReferenceCounter.objects.select_for_update().get_or_create(
            year=year, defaults={"last_seq": 0}
        )
        counter.last_seq += 1
        counter.save(update_fields=["last_seq"])
        return f"CMP-{year}-{counter.last_seq:05d}"


# ── Offence catalogue (nature of offence) ─────────────────────────────────────

class OffenceType(models.Model):
    """A catalogued nature-of-offence, classed minor vs serious-misconduct.

    Drives the disciplinary escalation rules: a repeat of the *same* offence type
    within the warning-validity window escalates toward serious misconduct, and a
    warning for a specific offence type stays effective for 3 years.
    """

    code        = models.CharField(max_length=40, unique=True)
    label       = models.CharField(max_length=200)
    category    = models.CharField(
        max_length=20, choices=OffenceCategory.choices, default=OffenceCategory.MINOR,
    )
    description = models.TextField(blank=True)
    statutory_ref = models.CharField(max_length=120, blank=True)
    active      = models.BooleanField(default=True)
    display_order = models.PositiveSmallIntegerField(default=100)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["display_order", "label"]

    def __str__(self):
        return f"{self.label} ({self.get_category_display()})"


# ── Complaint (ministry-lodged intake) ────────────────────────────────────────

class Complaint(models.Model):
    """A complaint lodged by a ministry against a public servant.

    Write-only for ministry users: they create it and may read only their own
    (status + closed_reason). Compliance staff triage it from the Complaints
    Register; accepting it spawns a :class:`ComplianceCase` (+ Submission).
    """

    reference_number = models.CharField(max_length=32, unique=True, editable=False)
    title            = models.CharField(max_length=512)
    description      = models.TextField(blank=True)

    lodged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="lodged_complaints",
    )
    ministry = models.ForeignKey(
        Ministry, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="complaints",
    )

    # Subject of the complaint (the public servant the matter is about)
    subject_name     = models.CharField(max_length=200, blank=True)
    subject_position = models.CharField(max_length=200, blank=True)
    subject_ministry = models.CharField(max_length=200, blank=True)

    status = models.CharField(
        max_length=20, choices=ComplaintStatus.choices, default=ComplaintStatus.RECEIVED,
    )
    closed_reason = models.TextField(
        blank=True, help_text="Reason shown to the lodging ministry if rejected/closed.",
    )

    # Set when triage accepts the complaint and opens a case.
    compliance_case = models.ForeignKey(
        "ComplianceCase", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="source_complaints",
    )
    triaged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="triaged_complaints",
    )
    triaged_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.reference_number:
            self.reference_number = allocate_complaint_reference()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_number} — {self.title}"


# ── ComplianceCase (Submission extension) ─────────────────────────────────────

class ComplianceCase(models.Model):
    """Compliance-specific data for a Submission (subject-as-person, family, SLAs)."""

    submission = models.OneToOneField(
        Submission, on_delete=models.CASCADE, related_name="compliance_case",
    )
    case_family = models.CharField(max_length=40, choices=CaseFamily.choices)
    nature_of_offence = models.ForeignKey(
        OffenceType, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="cases",
        help_text="Catalogued nature of the offence (drives repeat-offence escalation).",
    )
    offence_detail = models.TextField(
        blank=True, help_text="Free-text particulars of the offence, if needed.",
    )
    status = models.CharField(
        max_length=20, choices=ComplianceCaseStatus.choices,
        default=ComplianceCaseStatus.ACTIVE,
    )

    # Subject (the public servant the case is about)
    subject_name        = models.CharField(max_length=200)
    subject_position    = models.CharField(max_length=200, blank=True)
    subject_ministry    = models.CharField(max_length=200, blank=True)
    is_senior_executive = models.BooleanField(default=False)

    description = models.TextField(blank=True)
    notes       = models.TextField(blank=True)

    date_received = models.DateField(default=timezone.localdate)
    date_closed   = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Case {self.submission.reference_number} — {self.get_case_family_display()}"


class ComplianceCaseStage(models.Model):
    """A statutory stage in a case's workflow, with its SLA clock."""

    case = models.ForeignKey(
        ComplianceCase, on_delete=models.CASCADE, related_name="stages",
    )
    stage_name  = models.CharField(max_length=150)
    stage_code  = models.CharField(max_length=60, blank=True)
    stage_order = models.PositiveSmallIntegerField()

    responsible_role = models.CharField(max_length=40, blank=True)
    statutory_ref    = models.CharField(max_length=100, blank=True)

    sla_days         = models.PositiveSmallIntegerField(null=True, blank=True)
    sla_working_days = models.BooleanField(default=True)
    due_date         = models.DateField(null=True, blank=True)

    status     = models.CharField(
        max_length=20, choices=StageStatus.choices, default=StageStatus.PENDING,
    )
    sla_status = models.CharField(
        max_length=20, choices=SLAStatus.choices, default=SLAStatus.ON_TRACK,
    )
    is_optional = models.BooleanField(default=False)

    started_at   = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes        = models.TextField(blank=True)
    # Officer-entered detail for the stage (kept separate from ``notes``, which
    # holds the statutory description from the workflow template).
    outcome_notes        = models.TextField(blank=True)
    responsible_officer  = models.CharField(max_length=200, blank=True)

    # Notification guards — prevent duplicate in-app alerts for the same event
    at_risk_notified = models.BooleanField(default=False)
    overdue_notified = models.BooleanField(default=False)

    class Meta:
        ordering = ["stage_order"]
        unique_together = [("case", "stage_order")]

    def __str__(self):
        return f"{self.case.submission.reference_number} · {self.stage_order}. {self.stage_name}"


class ComplianceStageDocument(models.Model):
    """Links a case document to the statutory stage that produced it (e.g. the
    SMDR to the 'SMDR Referral' stage). Documents live once on the case's
    submission; this is an additional per-stage association."""

    stage = models.ForeignKey(
        ComplianceCaseStage, on_delete=models.CASCADE, related_name="document_links",
    )
    document = models.ForeignKey(
        "SubmissionDocument", on_delete=models.CASCADE, related_name="compliance_stage_links",
    )
    linked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="compliance_stage_doc_links",
    )
    linked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["linked_at"]
        unique_together = ("stage", "document")

    def __str__(self):
        return f"Stage doc · {self.stage_id} ← {self.document_id}"


class LitigationRecord(models.Model):
    """Litigation matter and associated costs for a case (FR-13)."""

    class LitigationStatus(models.TextChoices):
        ACTIVE   = "active",   "Active"
        SETTLED  = "settled",  "Settled"
        CLOSED   = "closed",   "Closed"
        APPEALED = "appealed", "Appealed"

    case = models.ForeignKey(
        ComplianceCase, on_delete=models.CASCADE, related_name="litigation_records",
    )
    description      = models.TextField()
    court_name       = models.CharField(max_length=200, blank=True)
    court_reference  = models.CharField(max_length=100, blank=True)
    legal_counsel    = models.CharField(max_length=200, blank=True)
    opposing_counsel = models.CharField(max_length=200, blank=True)
    status = models.CharField(
        max_length=20, choices=LitigationStatus.choices, default=LitigationStatus.ACTIVE,
    )
    estimated_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    actual_cost    = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    date_initiated = models.DateField(default=timezone.localdate)
    next_court_date = models.DateField(null=True, blank=True)
    court_date_notified = models.DateField(
        null=True, blank=True,
        help_text="The next_court_date value a reminder was last sent for (dedupe guard).",
    )
    date_resolved   = models.DateField(null=True, blank=True)
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_initiated"]

    def __str__(self):
        return f"Litigation · {self.case.submission.reference_number} ({self.status})"


# ── FR-11: Grievance mediator appointment ─────────────────────────────────────

class GrievanceMediatorAppointment(models.Model):
    """Tracks the mediator appointed for a grievance case (FR-11)."""

    class MediationOutcome(models.TextChoices):
        PENDING     = "pending",     "Pending"
        SETTLED     = "settled",     "Settled"
        NOT_SETTLED = "not_settled", "Not Settled"

    case = models.OneToOneField(
        ComplianceCase, on_delete=models.CASCADE, related_name="mediator_appointment",
    )
    mediator_name         = models.CharField(max_length=200)
    mediator_organisation = models.CharField(max_length=200, blank=True)
    mediator_contact      = models.CharField(max_length=200, blank=True)
    appointment_date      = models.DateField()
    mediation_start_date  = models.DateField(null=True, blank=True)
    mediation_end_date    = models.DateField(null=True, blank=True)

    outcome = models.CharField(
        max_length=20, choices=MediationOutcome.choices, default=MediationOutcome.PENDING,
    )
    mom_reference  = models.CharField(max_length=200, blank=True,
                                      help_text="Reference / file number of the Form 6.8 MoM")
    outcome_notes  = models.TextField(blank=True)

    appointed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="grievance_mediator_appointments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-appointment_date"]

    def __str__(self):
        return f"Mediator · {self.case.submission.reference_number} · {self.mediator_name}"


class CaseNote(models.Model):
    """A case-scoped note authored by compliance staff."""

    case = models.ForeignKey(
        ComplianceCase, on_delete=models.CASCADE, related_name="case_notes",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="compliance_case_notes",
    )
    text       = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note · {self.case.submission.reference_number}"


class DecisionBody(models.TextChoices):
    COMMISSION  = "commission",  "PSC Commission"
    PSDB        = "psdb",        "PSDB"
    HOD         = "hod",         "Head of Department"
    MINISTER    = "minister",    "Minister"
    SECRETARY   = "secretary",   "Secretary OPSC"


TERMINAL_OUTCOMES = {
    ComplianceDecisionOutcome.REINSTATE,
    ComplianceDecisionOutcome.TERMINATE,
    ComplianceDecisionOutcome.WARN,
    ComplianceDecisionOutcome.DEMOTE,
    ComplianceDecisionOutcome.SUSPEND_NO_PAY,
    ComplianceDecisionOutcome.COMPULSORY_RETIRE,
    ComplianceDecisionOutcome.NO_ACTION,
    ComplianceDecisionOutcome.SETTLED,
    ComplianceDecisionOutcome.NOT_SETTLED,
}


class Investigation(models.Model):
    """A structured investigation / MDC preliminary assessment for a case.

    Complements the SLA *stages* (which track timing) by capturing the substance:
    the panel, terms of reference, findings, and recommendation.
    """

    case = models.OneToOneField(
        ComplianceCase, on_delete=models.CASCADE, related_name="investigation",
    )
    panel_members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="investigation_panels",
        help_text="Appointed panel / investigator (typically users with the Panel Member role).",
    )
    panel_members_text = models.CharField(
        max_length=500, blank=True,
        help_text="Free-text panel names for external members not in the system.",
    )
    terms_of_reference = models.TextField(blank=True)
    appointed_at = models.DateField(null=True, blank=True)
    started_at   = models.DateField(null=True, blank=True)
    completed_at = models.DateField(null=True, blank=True)
    findings        = models.TextField(blank=True)
    recommendation  = models.TextField(blank=True)
    report_document = models.FileField(
        upload_to="compliance/investigations/%Y/%m/", null=True, blank=True,
    )
    status = models.CharField(
        max_length=20, choices=InvestigationStatus.choices,
        default=InvestigationStatus.APPOINTED,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="investigations_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Investigation · {self.case.submission.reference_number} ({self.status})"


class SuspensionRecord(models.Model):
    """Financial implication of a suspension: half/full/no-pay basis, withheld
    salary, OPSC reimbursement assessment, and the 2-month expiry / deemed
    reinstatement on full salary (temporary-suspension rules)."""

    case = models.ForeignKey(
        ComplianceCase, on_delete=models.CASCADE, related_name="suspensions",
    )
    salary_basis = models.CharField(
        max_length=10, choices=SuspensionSalaryBasis.choices,
        default=SuspensionSalaryBasis.HALF,
    )
    monthly_salary  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    withheld_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Salary withheld during suspension (e.g. the half not paid).",
    )
    reimbursed_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    suspension_start = models.DateField()
    # Temporary suspension is capped at 2 months; default the expiry accordingly.
    suspension_end   = models.DateField(
        null=True, blank=True,
        help_text="Expiry of the suspension (temporary suspension max 2 months).",
    )
    max_period_days  = models.PositiveSmallIntegerField(
        default=60, help_text="Statutory cap (60 days ≈ 2 months for temporary suspension).",
    )

    reimbursement_status = models.CharField(
        max_length=12, choices=SuspensionReimbursement.choices,
        default=SuspensionReimbursement.PENDING,
        help_text="OPSC assessment of whether withheld salary is reimbursed on reinstatement.",
    )
    opsc_assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="suspension_assessments",
    )
    opsc_assessed_at = models.DateTimeField(null=True, blank=True)

    reinstated_at = models.DateField(null=True, blank=True)
    reinstated_on_full_salary = models.BooleanField(
        default=False,
        help_text="True once deemed reinstated on full salary at expiry of the suspension.",
    )
    expiry_notified = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="suspensions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-suspension_start"]

    def save(self, *args, **kwargs):
        # Default the expiry to start + max_period_days (2 months) when not set.
        if self.suspension_start and not self.suspension_end:
            self.suspension_end = self.suspension_start + timedelta(days=self.max_period_days or 60)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Suspension · {self.case.submission.reference_number} · {self.get_salary_basis_display()}"


class ComplianceCaseDecision(models.Model):
    """A structured decision (Commission/PSDB/HOD) recorded against a case."""

    case = models.ForeignKey(
        ComplianceCase, on_delete=models.CASCADE, related_name="decisions",
    )
    outcome = models.CharField(
        max_length=30, choices=ComplianceDecisionOutcome.choices,
    )
    decision_body = models.CharField(
        max_length=20, choices=DecisionBody.choices, default=DecisionBody.COMMISSION,
    )
    decision_date  = models.DateField()
    narrative      = models.TextField(blank=True)
    stage_reference = models.CharField(max_length=60, blank=True)

    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="compliance_decisions_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-decision_date", "-created_at"]

    def __str__(self):
        return f"Decision · {self.case.submission.reference_number} · {self.get_outcome_display()}"
