import os
import secrets
from datetime import datetime, time, timedelta

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models, transaction
from django.utils import timezone


class Role(models.TextChoices):
    # ── PSC Internal roles ──────────────────────────────────────────────────
    PSC_ADMIN              = "psc_admin",              "PSC Administrator"
    RECEPTIONIST           = "receptionist",           "Receptionist"
    PSC_OFFICER            = "psc_officer",            "PSC Officer"
    PSC_SECRETARY          = "psc_secretary",          "PSC Secretary"
    SENIOR_ADMIN_OFFICER   = "senior_admin_officer",   "Senior Administration Officer"
    PSC_COMMISSIONER       = "psc_commissioner",       "PSC Commissioner"
    CHAIRPERSON            = "chairperson",            "Chairperson, PSC"
    # ── Post-decision execution roles ───────────────────────────────────────
    PSC_MANAGER       = "psc_manager",       "OPSC Manager"
    PRINCIPAL_OFFICER = "principal_officer", "Principal Officer"
    SENIOR_OFFICER    = "senior_officer",    "Senior Officer"
    # ── Ministry-side roles ─────────────────────────────────────────────────
    HEAD_OF_AGENCY = "head_of_agency", "Head of Agency (DG/Director)"
    MINISTRY_HR    = "ministry_hr",    "Ministry HR Officer"
    DEPT_ADMIN     = "dept_admin",     "Department Admin Officer"
    TRAVELLER      = "traveller",      "Public Servant (Travel)"
    # ── OPSC Unit Manager roles (checklist review) ─────────────────────────
    VIPAM_MANAGER       = "vipam_manager",       "VIPAM Manager"
    HR_UNIT_MANAGER     = "hr_unit_manager",     "HR Unit Manager"
    ODU_MANAGER         = "odu_manager",         "ODU Manager"
    COMPLIANCE_MANAGER  = "compliance_manager",  "Compliance Manager"
    COMPLIANCE_SENIOR   = "compliance_senior",   "Compliance Senior Officer"
    CSU_MANAGER         = "csu_manager",         "CSU Manager"
    # ── OPSC Unit Principal roles (assigned checklist/assessment work) ──────
    VIPAM_PRINCIPAL       = "vipam_principal",       "VIPAM Principal"
    HR_UNIT_PRINCIPAL     = "hr_unit_principal",     "HR Unit Principal"
    ODU_PRINCIPAL         = "odu_principal",          "ODU Principal"
    PRINCIPAL_ORG_DEV_ANALYST = "principal_org_dev_analyst", "Principal Organization Development Analyst"
    PRINCIPAL_JOB_ANALYST     = "principal_job_analyst",     "Principal Job Analyst"
    COMPLIANCE_PRINCIPAL  = "compliance_principal",  "Compliance Principal"
    # ── FR-05: Additional compliance-adjacent roles ─────────────────────────
    SECRETARY_OPSC    = "secretary_opsc",    "Secretary, OPSC"
    DG_DIRECTOR       = "dg_director",       "DG / Director (Ministry)"
    COMMISSION_MEMBER = "commission_member", "Commission Member"
    PANEL_MEMBER      = "panel_member",      "Investigation Panel Member"


class WorkflowStage(models.TextChoices):
    # ── Ministry pre-submission ─────────────────────────────────────────────
    DRAFT                      = "draft",                      "Draft"
    PENDING_DG_ENDORSEMENT     = "pending_dg_endorsement",     "Submitted to DG (Pending Endorsement)"
    DG_APPROVED                = "dg_approved",                "Endorsed by DG — Pending HR Submission"
    PENDING_MANAGER_APPROVAL   = "pending_manager_approval",   "Pending Manager Approval"
    PENDING_SECOND_APPROVAL    = "pending_second_approval",    "Pending Second Approval"
    SUBMITTED                  = "submitted",                  "Submitted to PSC"
    # ── PSC intake ─────────────────────────────────────────────────────────
    RECEIVED_BY_PSC            = "received_by_psc",            "Received by PSC"
    RETURNED_FOR_CLARIFICATION = "returned_for_clarification", "Returned for Clarification"
    REGISTERED_ROUTED          = "registered_routed",          "Registered and Routed"
    MANAGER_CHECKLIST_REVIEW   = "manager_checklist_review",   "Manager Checklist Review"
    UNDER_ASSESSMENT           = "under_assessment",           "Under Assessment"
    # ── Secretary approval gate (assessment → commission) ──────────────────
    PENDING_SECRETARY_APPROVAL = "pending_secretary_approval", "Pending Secretary Approval"
    # ── CMS compliance routing ─────────────────────────────────────────────
    COMPLIANCE_UNDER_REVIEW    = "compliance_under_review",    "Compliance Under Review (CMS)"
    # ── Hold / deferral states ─────────────────────────────────────────────
    DEFERRED                   = "deferred",                   "Deferred"
    TABLED                     = "tabled",                     "Tabled"
    AWAITING_LEGAL_ADVICE      = "awaiting_legal_advice",      "Awaiting Legal Advice"
    AWAITING_CABINET_DECISION  = "awaiting_cabinet_decision",  "Awaiting Cabinet Decision"
    # ── Resubmission ───────────────────────────────────────────────────────
    RESUBMITTED                = "resubmitted",                "Resubmitted"
    # ── Commission ─────────────────────────────────────────────────────────
    FORWARDED_TO_COMMISSION    = "forwarded_to_commission",    "Forwarded to Commission"
    COMMISSION_SITTING         = "commission_sitting",         "Commission Sitting"
    MATTERS_ARISING            = "matters_arising",            "Matters Arising"
    APPROVED                   = "approved",                   "Approved"
    NOTED                      = "noted",                      "Noted"
    NOT_APPROVED               = "not_approved",               "Not Approved"
    REJECTED                   = "rejected",                   "Rejected"
    RETURNED                   = "returned",                   "Returned"
    DEFERRED_BACK_TO_HR        = "deferred_back_to_hr",        "Deferred Back to HR"
    DEFERRED_BACK_TO_UNIT      = "deferred_back_to_unit",      "Deferred Back to Unit"
    # ── Internal submission (OPSC-only, Secretary review) ─────────────────
    SECRETARY_REVIEW           = "secretary_review",           "Secretary Review"
    # ── Post-decision ──────────────────────────────────────────────────────
    MINUTES_DRAFTED_SIGNED     = "minutes_drafted_signed",     "Minutes Drafted and Signed"
    DECISION_ENTERED_ASSIGNED  = "decision_entered_assigned",  "Decision Entered and Assigned"
    UNDER_IMPLEMENTATION       = "under_implementation",       "Under Implementation"
    IMPLEMENTATION_REPORT      = "implementation_report",      "Implementation Report"
    RECALLED                   = "recalled",                   "Recalled by Ministry"


class MeetingStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class AgendaStatus(models.TextChoices):
    # Stage-B agenda workflow — a three-party chain:
    #   draft             — Senior Administration Officer builds the agenda, then submits →
    #   with_secretary    — PSC Secretary reviews, then forwards →
    #   with_chairman     — Chairperson endorses →
    #   chairman_approved — endorsed; ready to circulate →
    #   circulated        — issued to Commission members.
    DRAFT = "draft", "Draft"
    WITH_SECRETARY = "with_secretary", "With Secretary for Review"
    WITH_CHAIRMAN = "with_chairman", "With Chairman for Endorsement"
    CHAIRMAN_APPROVED = "chairman_approved", "Chairman Endorsed"
    CIRCULATED = "circulated", "Circulated to Members"

class MeetingType(models.TextChoices):
    ORDINARY = "ordinary", "Ordinary Sitting"
    SPECIAL = "special", "Special Sitting"
    FLYING_MINUTE = "flying_minute", "Flying Minute"
    EMERGENCY = "emergency", "Emergency Sitting"


class AgendaCategory(models.TextChoices):
    PRELIMINARIES         = "preliminaries",         "1. Preliminaries & Endorsements"
    MATTERS_ARISING       = "matters_arising",       "2. Matters Arising"
    DISCIPLINE_COMPLIANCE = "discipline_compliance", "3. Discipline / Compliance"
    HEALTH_COMMISSION     = "health_commission",     "4. Health Commission"
    APPOINTMENT           = "appointment",           "5. Appointment / Acting Appointment"
    DIRECT_APPOINTMENT    = "direct_appointment",    "6. Direct Appointment / Confirmation of Appointment"
    EXTRA_RESPONSIBILITY  = "extra_responsibility",  "7. Extra Responsibility / Overtime Allowance / Special Skills Allowance"
    CONTRACT              = "contract",              "8. Contract / Temporary Salaried Appointment"
    TEMPORARY_SALARIED    = "temporary_salaried",    "9. Temporary Salaried Appointment"
    SALARY_ADJUSTMENT     = "salary_adjustment",     "10. Salary Adjustment"
    TRAINING              = "training",              "11. Long Term Training / Scholarship / Internship / Cadetship / Extension / Direct Appointment"
    MEDICAL_CLAIM         = "medical_claim",         "12. Medical Claim"
    PARTIAL_SEVERANCE     = "partial_severance",     "13. Partial Severance"
    RESIGNATION           = "resignation",           "14. Resignation / Retirement / Death"
    OTHER                 = "other",                 "15. Other Matters"


class RoutedUnit(models.TextChoices):
    ODU = "odu", "ODU"
    HR = "hr", "Manager HR"
    VIPAM = "vipam", "VIPAM"
    COMPLIANCE = "compliance", "Compliance"
    CSU = "csu", "Corporate Services Unit"


class Classification(models.TextChoices):
    CONFIDENTIAL = "confidential", "Confidential"
    UNCLASSIFIED = "unclassified", "Unclassified"
    RESTRICTED = "restricted", "Restricted"

class ImplementationStatus(models.TextChoices):
    NOT_STARTED = "not_started", "Not started"
    IN_PROGRESS = "in_progress", "In Progress"
    IMPLEMENTED = "implemented", "Implemented"
    NOT_IMPLEMENTED = "not_implemented", "Not Implemented"


class EmploymentType(models.TextChoices):
    TEMPORARY_SALARIED = "temporary_salaried", "Temporary Salaried Employee"
    DAILY_RATED = "daily_rated", "Daily Rated Worker"
    CONTRACT = "contract", "Contract Employee"
    OVERDUE = "overdue", "Overdue"
    DEFERRED_NA = "deferred_na", "Deferred/N/A"


class Ministry(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Ministries"

    def __str__(self):
        return self.name


class Department(models.Model):
    ministry = models.ForeignKey(Ministry, on_delete=models.CASCADE, related_name="departments")
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)
    head_position_title = models.CharField(
        max_length=128,
        blank=True,
        help_text=(
            "Title of the department head for travel endorsements "
            "(e.g. Chief Statistician). Leave blank to derive from department name."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["ministry", "name"]
        constraints = [
            models.UniqueConstraint(fields=["ministry", "code"], name="uniq_department_code_per_ministry"),
        ]

    def __str__(self):
        return f"{self.name} ({self.ministry.code})"


class Unit(models.Model):
    """Organizational unit within a department (e.g. ODU, HR Unit, Corporate Services Unit)."""

    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name="units",
    )
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)
    routed_unit = models.CharField(
        max_length=16,
        choices=RoutedUnit.choices,
        blank=True,
        help_text="OPSC workflow routing key when submissions are routed to this unit.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["department__ministry__name", "department__name", "name"]
        verbose_name = "Unit"
        verbose_name_plural = "Units"
        constraints = [
            models.UniqueConstraint(
                fields=["department", "code"],
                name="uniq_unit_code_per_department",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.department.ministry.code})"


class AgendaSection(models.Model):
    """Configurable Commission meeting agenda sections (admin-managed)."""

    code = models.SlugField(
        max_length=32,
        unique=True,
        help_text="Stable key stored on submissions and agenda items (e.g. appointment).",
    )
    label = models.CharField(
        max_length=255,
        help_text="Display label including section number, e.g. '5. Appointment / Acting Appointment'.",
    )
    display_order = models.PositiveIntegerField(default=0)
    is_special = models.BooleanField(
        default=False,
        help_text="Meeting-only sections (Preliminaries, Matters Arising) — hidden from ministry lodge form.",
    )
    is_active = models.BooleanField(default=True)
    receiver_roles = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "PSC profile roles allowed to receive new submissions for this agenda section. "
            "Empty means fallback to routed unit manager only."
        ),
    )
    approval_chain = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "Ordered list of approval steps required before the submission reaches the Secretary / PSC. "
            "Each step: {\"stage\": \"pending_manager_approval\", \"roles\": [\"vipam_manager\"], \"label\": \"VIPAM Manager\"}. "
            "Stages: pending_manager_approval, pending_second_approval."
        ),
    )
    group = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text=(
            "Dropdown group label shown to users when lodging a submission "
            "(e.g. 'Appointments', 'Structure'). Sections with the same group "
            "are listed together. Leave blank to appear ungrouped."
        ),
    )
    digitized_form = models.ForeignKey(
        "PSCFormType",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="agenda_sections_as_default",
        help_text="Default digitized PSC form for submissions lodged under this agenda section.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "id"]
        verbose_name = "Agenda section"
        verbose_name_plural = "Agenda sections"

    def __str__(self):
        return self.label


class FormCategory(models.Model):
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    psc_forms_summary = models.TextField(blank=True)
    display_order = models.IntegerField(default=0,
        help_text="Default agenda sequence: lower numbers appear first.")

    class Meta:
        ordering = ["display_order", "name"]
        verbose_name_plural = "Form categories"

    def __str__(self):
        return self.name


class PublicHoliday(models.Model):
    """Admin-configurable Vanuatu public holidays used by add_working_days()."""
    date  = models.DateField(unique=True)
    name  = models.CharField(max_length=128)
    year  = models.PositiveSmallIntegerField(db_index=True)

    class Meta:
        ordering = ['date']
        verbose_name        = 'Public Holiday'
        verbose_name_plural = 'Public Holidays'

    def __str__(self):
        return f"{self.date} — {self.name}"

    def save(self, *args, **kwargs):
        self.year = self.date.year
        super().save(*args, **kwargs)


class PSCFormType(models.Model):
    """Registry of PSC form types. Drives the form selector and digitized-form display."""
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    form_category = models.ForeignKey(
        'FormCategory',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='form_types',
        help_text="Category this form belongs to — used to filter PSC forms by selected category.",
    )
    is_digitized = models.BooleanField(default=False,
        help_text="True when a structured digital form is available in the system.")
    digitized_form_key = models.CharField(max_length=64, blank=True,
        help_text="Internal key linking to the frontend component, e.g. 'psc_3_7'.")
    is_active = models.BooleanField(default=True,
        help_text="Only active forms appear in the submission dropdown.")
    is_checklist = models.BooleanField(default=False,
        help_text="True when this form type defines a checklist (not a submission form).")
    checklist_form_type = models.ForeignKey(
        'self',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='submission_form_types',
        help_text="Checklist form type attached to this submission form type.",
    )
    routed_unit = models.CharField(
        max_length=16, blank=True, default='',
        help_text="OPSC unit this form type routes to for checklist review. "
                  "Leave blank if no auto-routing is needed.",
    )
    assessment_deadline_days = models.PositiveSmallIntegerField(
        default=21,
        help_text="Working-day assessment deadline for this form type (default 21). "
                  "Set lower for routine forms, higher for complex matters.",
    )
    display_order = models.IntegerField(default=0)
    agenda_category = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text=(
            "Agenda section code (AgendaSection.code). "
            "Used to auto-categorize agenda items when a submission is added to a meeting."
        ),
    )

    class Meta:
        ordering = ["display_order", "code"]
        verbose_name = "PSC Form Type"
        verbose_name_plural = "PSC Form Types"

    def __str__(self):
        return f"{self.code} — {self.name}"


class PSCFormField(models.Model):
    """A single field definition in a dynamically-designed PSC form."""
    FIELD_TYPES = [
        ('section_header', 'Section Header'),
        ('text',      'Short Text'),
        ('textarea',  'Long Text / Paragraph'),
        ('number',    'Number'),
        ('date',      'Date'),
        ('datetime',  'Date & Time'),
        ('select',    'Dropdown (Select One)'),
        ('radio',     'Radio Buttons (Select One)'),
        ('checkbox',  'Checkbox (Yes / No)'),
    ]

    form_type     = models.ForeignKey(PSCFormType, on_delete=models.CASCADE, related_name='fields')
    label         = models.CharField(max_length=255)
    field_key     = models.CharField(max_length=64,
        help_text="Unique snake_case key within this form; used as the JSON key when storing responses.")
    field_type    = models.CharField(max_length=32, choices=FIELD_TYPES, default='text')
    placeholder   = models.CharField(max_length=255, blank=True)
    help_text     = models.CharField(max_length=500, blank=True)
    choices       = models.TextField(blank=True,
        help_text="One option per line — used for select and radio field types.")
    is_required    = models.BooleanField(default=False)
    display_order  = models.IntegerField(default=0)
    start_new_page = models.BooleanField(default=False,
        help_text="Only applies to section_header fields. When true, this section starts a new page in the multi-page form renderer.")

    class Meta:
        ordering = ['display_order', 'id']
        unique_together = [('form_type', 'field_key')]
        verbose_name = "PSC Form Field"

    def __str__(self):
        return f"{self.form_type.code} / {self.label}"


class PSCFormResponse(models.Model):
    """Stores a user's answers to a dynamic PSC form attached to a submission."""
    submission = models.OneToOneField(
        'Submission', on_delete=models.CASCADE, related_name='dynamic_form_response')
    form_type  = models.ForeignKey(PSCFormType, on_delete=models.PROTECT)
    data       = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "PSC Form Response"

    def __str__(self):
        return f"Response for {self.submission}"


class SubmissionChecklistResponse(models.Model):
    """
    Stores answers to a dynamic checklist form linked to a submission.
    One record per (submission, checklist_form_type) pair — filled by the
    assigned principal during Manager Checklist Review, reviewed by the manager.
    """

    class Status(models.TextChoices):
        DRAFT     = "draft",     "Draft"
        SUBMITTED = "submitted", "Submitted for manager review"
        APPROVED  = "approved",  "Approved by manager"
        RETURNED  = "returned",  "Returned for revision"

    submission = models.ForeignKey(
        'Submission', on_delete=models.CASCADE,
        related_name='checklist_responses',
    )
    checklist_form_type = models.ForeignKey(
        PSCFormType, on_delete=models.PROTECT,
        related_name='checklist_responses',
        limit_choices_to={'is_checklist': True},
    )
    data = models.JSONField(default=dict,
        help_text="Keyed by PSCFormField.field_key — stores the principal's answers.")
    status = models.CharField(
        max_length=12, choices=Status.choices,
        default=Status.DRAFT, db_index=True,
    )
    manager_comments = models.TextField(blank=True)
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='checklist_responses_created',
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at  = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('submission', 'checklist_form_type')]
        verbose_name        = "Submission Checklist Response"
        verbose_name_plural = "Submission Checklist Responses"
        ordering = ['-created_at']

    def __str__(self):
        return f"Checklist {self.checklist_form_type.code} — {self.submission.reference_number} ({self.status})"


class FormSectionSignature(models.Model):
    """In-system digital signature on a travel form endorsement section."""

    submission = models.ForeignKey(
        "Submission", on_delete=models.CASCADE, related_name="section_signatures"
    )
    section_key = models.CharField(max_length=64)
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="form_section_signatures"
    )
    signer_name = models.CharField(max_length=255, blank=True)
    signed_at = models.DateTimeField(auto_now_add=True)
    approved = models.BooleanField(
        null=True,
        blank=True,
        help_text="For secretary_decision: True=approved, False=not approved.",
    )
    remarks = models.TextField(blank=True)
    signature_image = models.ImageField(
        upload_to="form_section_signatures/%Y/%m/",
        null=True,
        blank=True,
    )

    class Meta:
        unique_together = [("submission", "section_key")]
        ordering = ["signed_at"]

    def __str__(self):
        return f"{self.section_key} on {self.submission_id}"


class TravelApprovalLetter(models.Model):
    """Official PSC letter issued after Secretary approval (Forms 4.5 & 4.6)."""

    submission = models.OneToOneField(
        "Submission", on_delete=models.CASCADE, related_name="travel_approval_letter"
    )
    subject = models.CharField(max_length=500)
    body_text = models.TextField()
    body_html = models.TextField(blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="travel_letters_issued",
    )

    class Meta:
        ordering = ["-issued_at"]

    def __str__(self):
        return f"Letter for {self.submission_id}: {self.subject[:60]}"


class ReferenceCounter(models.Model):
    year = models.PositiveIntegerField(unique=True)
    last_seq = models.PositiveIntegerField(default=0)


class RecordingAudioSource(models.TextChoices):
    LOGITECH_GROUP = "logitech_group", "Logitech GROUP"
    ZOOM_EXPORT = "zoom_export", "Zoom/Teams export"
    BROWSER_EXCEPTION = "browser_exception", "Browser (remote/exception)"
    OTHER = "other", "Other"


class TranscriptSource(models.TextChoices):
    ZOOM_ASR = "zoom_asr", "Zoom/Teams ASR"
    AI_WHISPER = "ai_whisper", "Whisper + Claude refine"
    MANUAL_PASTE = "manual_paste", "Manual paste"


class TranscriptionStatus(models.TextChoices):
    IDLE = "idle", "Idle"
    PENDING = "pending", "Queued"
    TRANSCRIBING = "transcribing", "Transcribing (Whisper)"
    REFINING = "refining", "Refining (Claude)"
    READY = "ready", "Ready for review"
    FAILED = "failed", "Failed"


class Meeting(models.Model):
    reference_number = models.CharField(max_length=32, unique=True, editable=False)
    title = models.CharField(max_length=512)
    date = models.DateField()
    time = models.TimeField()
    venue = models.CharField(max_length=512)
    type = models.CharField(max_length=16, choices=MeetingType.choices, default=MeetingType.ORDINARY)
    status = models.CharField(max_length=16, choices=MeetingStatus.choices, default=MeetingStatus.SCHEDULED)
    notes = models.TextField(blank=True)
    recording_audio_source = models.CharField(
        max_length=32,
        choices=RecordingAudioSource.choices,
        blank=True,
        help_text="How the boardroom recording was captured (Logitech GROUP policy).",
    )
    submission_cutoff = models.DateTimeField(
        null=True, blank=True,
        help_text="Submissions after this datetime are queued for the next meeting.",
    )
    max_items = models.PositiveIntegerField(
        default=30,
        help_text=(
            "Maximum number of agenda items this meeting can accommodate. "
            "Items beyond this limit should be deferred to the next meeting."
        ),
    )
    min_items = models.PositiveIntegerField(
        default=5,
        help_text=(
            "Minimum number of agenda items needed before it is worth convening "
            "the sitting. Drives the Chairman's agenda-readiness signal."
        ),
    )
    # ── Agenda approval gate (SOP Stage 3, steps 2-3) ─────────────────────
    agenda_status = models.CharField(
        max_length=24, choices=AgendaStatus.choices, default=AgendaStatus.DRAFT,
        help_text="Tracking: draft → with Secretary → with Chairman → endorsed → circulated.",
    )
    agenda_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="agendas_approved",
        help_text="Chairperson who endorsed the agenda.",
    )
    agenda_approved_at = models.DateTimeField(null=True, blank=True)
    # ── In-sitting adoption gate (SOP Stage 3) ────────────────────────────
    # The circulated agenda may still be amended at the start of the sitting
    # (e.g. commissioners adding items under "Other Matters"). The Chairperson
    # formally adopts the agenda before deliberations begin; the meeting cannot
    # move to "In Progress" until it has been adopted.
    agenda_adopted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="agendas_adopted",
        help_text="Chairperson who adopted the agenda at the start of the sitting.",
    )
    agenda_adopted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-time"]

    def __str__(self):
        return f"{self.reference_number} — {self.title}"

    # Number of days before the meeting date that submissions close automatically.
    CUTOFF_DAYS_BEFORE = 3

    @property
    def effective_cutoff(self):
        """
        Returns the submission deadline as an aware datetime.
        Uses the manually-set submission_cutoff if provided, otherwise
        defaults to 23:59:59 on the day that is CUTOFF_DAYS_BEFORE before
        the meeting date (i.e. the last moment of the 3rd day before the meeting).
        """
        from datetime import datetime, timedelta
        from django.utils import timezone

        if self.submission_cutoff:
            return self.submission_cutoff
        cutoff_date = self.date - timedelta(days=self.CUTOFF_DAYS_BEFORE)
        naive = datetime.combine(cutoff_date, datetime.max.time().replace(microsecond=0))
        return timezone.make_aware(naive)

    def agenda_readiness(self, count=None):
        """
        Agenda-readiness signal for the Chairman: is there enough on the agenda
        to be worth convening this sitting?

        `count` lets callers pass a pre-fetched/annotated agenda item count to
        avoid an extra query; falls back to a COUNT(*) when omitted.
        Returns a small dict consumed by the API and dashboards.
        """
        if count is None:
            count = self.agenda_items.count()
        min_items = self.min_items or 0
        max_items = self.max_items or 0
        is_ready = count >= min_items and count > 0
        shortfall = max(0, min_items - count)
        if count == 0:
            level = "empty"
        elif max_items and count > max_items:
            level = "over"
        elif max_items and count >= max_items:
            level = "full"
        elif is_ready:
            level = "ready"
        else:
            level = "building"
        return {
            "count": count,
            "min_items": min_items,
            "max_items": max_items,
            "is_ready": is_ready,
            "shortfall": shortfall,
            "level": level,
        }

    def save(self, *args, **kwargs):
        if not self.reference_number:
            self.reference_number = allocate_meeting_reference()
        super().save(*args, **kwargs)


class AgendaItem(models.Model):
    meeting    = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="agenda_items")
    submission = models.ForeignKey("Submission", on_delete=models.CASCADE, related_name="agenda_placements")
    sequence   = models.PositiveIntegerField(default=0, help_text="Order within the category group.")
    category   = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Agenda section code (AgendaSection.code) for this item.",
    )
    # Matters Arising only — reference back to a previous meeting/agenda item
    matters_arising_meeting_ref = models.CharField(
        max_length=128, blank=True,
        help_text="e.g. 'PSC Meeting No. 10 of Monday 30th June 2025'",
    )
    matters_arising_agenda_no = models.CharField(
        max_length=32, blank=True,
        help_text="e.g. 'Agenda 20'",
    )
    added_at = models.DateTimeField(auto_now_add=True)
    agenda_blurb = models.TextField(
        blank=True,
        help_text="AI-generated 2–3 sentence agenda blurb for the sitting pack.",
    )
    agenda_blurb_processed = models.BooleanField(default=False)

    class Meta:
        ordering = ["category", "sequence", "added_at"]
        unique_together = ("meeting", "submission")

    def __str__(self):
        from .agenda_sections import agenda_section_label

        label = agenda_section_label(self.category or "")
        return f"{self.meeting.reference_number} [{label}] #{self.sequence}: {self.submission.reference_number}"


class MeetingOtherMatter(models.Model):
    """
    Ad-hoc "Other Matters" item raised by a commissioner during the sitting,
    not backed by a formal submission.

    Distinct from AgendaItem (which is always tied to a Submission): these are
    items added live under category 15 (Other Matters) when the agenda is
    amended at the start of, or during, a sitting. They surface on the agenda
    and feed the minutes "any other business" block.
    """

    meeting = models.ForeignKey(
        Meeting, on_delete=models.CASCADE, related_name="other_matters",
    )
    title = models.CharField(max_length=512)
    detail = models.TextField(blank=True)
    raised_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="raised_other_matters",
    )
    sequence = models.PositiveIntegerField(default=0)
    decision_text = models.TextField(
        blank=True, help_text="Outcome/decision recorded for this item during the sitting.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence", "created_at"]

    def __str__(self):
        return f"Other Matter — {self.meeting.reference_number}: {self.title[:48]}"


class DeferralType(models.TextChoices):
    TO_NEXT_MEETING = "to_next_meeting", "Deferred to Next Meeting"
    PUSH_TO_NEXT    = "push_to_next",    "Moved to Next Meeting (pre-sitting)"
    BACK_TO_UNIT    = "back_to_unit",    "Deferred Back to Unit"
    BACK_TO_HR      = "back_to_hr",      "Deferred Back to HR"
    ON_HOLD         = "on_hold",         "Deferred (on hold)"


class AgendaDeferral(models.Model):
    """A persistent record of an agenda item being deferred — so deferrals are
    auditable and nothing silently falls off the agenda.

    Written by every defer action (in-sitting defer-to-next-meeting, pre-sitting
    push-to-next, deferred-back-to-unit/HR, and on-hold deferrals). Powers the
    Deferred Agenda register and the per-item deferral count.
    """

    submission = models.ForeignKey(
        "Submission", on_delete=models.CASCADE, related_name="agenda_deferrals",
    )
    agenda_item = models.ForeignKey(
        "AgendaItem", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="deferrals",
    )
    from_meeting = models.ForeignKey(
        "Meeting", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="deferrals_out",
        help_text="The sitting the item was deferred from.",
    )
    to_meeting = models.ForeignKey(
        "Meeting", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="deferrals_in",
        help_text="The sitting the item was carried to (null for back-to-unit/HR/on-hold).",
    )
    deferral_type = models.CharField(max_length=20, choices=DeferralType.choices)
    reason = models.TextField(blank=True)
    deferred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="agenda_deferrals_made",
    )
    deferred_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(
        default=False,
        help_text="True once the deferred item has been decided or re-tabled and concluded.",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-deferred_at"]
        indexes = [
            models.Index(fields=["resolved", "deferral_type"]),
            models.Index(fields=["submission", "resolved"]),
        ]

    def __str__(self):
        return f"Deferral ({self.get_deferral_type_display()}): {self.submission.reference_number}"


class SittingPackSession(models.Model):
    """
    Active Sitting Pack (Meeting Mode) session for a commissioner or secretariat user.
    Drives the on-screen digital seal watermark while the session is open.
    """

    HEARTBEAT_TIMEOUT_MINUTES = 15

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="sitting_pack_sessions")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sitting_pack_sessions",
    )
    seal_code = models.CharField(max_length=16, db_index=True)
    started_at = models.DateTimeField(auto_now_add=True)
    last_heartbeat_at = models.DateTimeField(auto_now=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["meeting", "user", "ended_at"]),
        ]

    def __str__(self):
        state = "active" if self.is_active else "ended"
        return f"SittingPack {self.seal_code} ({self.meeting.reference_number}, {state})"

    @property
    def is_active(self) -> bool:
        if self.ended_at:
            return False
        from django.utils import timezone
        from datetime import timedelta

        cutoff = timezone.now() - timedelta(minutes=self.HEARTBEAT_TIMEOUT_MINUTES)
        return self.last_heartbeat_at >= cutoff


class SubmissionPresence(models.Model):
    """Who is actively viewing a submission (heartbeat-based, no WebSockets)."""

    PRESENCE_TIMEOUT_SECONDS = 90

    submission = models.ForeignKey(
        "Submission",
        on_delete=models.CASCADE,
        related_name="presence_records",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submission_presence_records",
    )
    last_seen_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        unique_together = ("submission", "user")
        indexes = [
            models.Index(fields=["submission", "last_seen_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} on submission {self.submission_id}"


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="psc_profile",
    )
    role = models.CharField(max_length=32, choices=Role.choices)
    ministry = models.ForeignKey(Ministry, null=True, blank=True, on_delete=models.SET_NULL, related_name="profiles")
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="profiles"
    )
    unit = models.ForeignKey(
        Unit, null=True, blank=True, on_delete=models.SET_NULL, related_name="profiles",
    )
    profile_picture = models.ImageField(upload_to="profile_pics/", null=True, blank=True)
    signature = models.ImageField(upload_to="signatures/", null=True, blank=True,
        help_text="Upload an image of your signature (PNG with transparent background recommended).")
    # Two-factor authentication (TOTP - e.g. Microsoft Authenticator)
    two_factor_enabled = models.BooleanField(default=False)
    totp_secret = models.CharField(max_length=32, blank=True, null=True)
    # Session PIN for trusted-device re-authentication
    session_pin = models.CharField(max_length=128, blank=True, null=True,
        help_text="Hashed 4-6 digit PIN for trusted session re-authentication.")
    session_pin_set_at = models.DateTimeField(null=True, blank=True)
    force_password_change = models.BooleanField(
        default=False,
        help_text="Require user to change password at first sign-in.",
    )
    password_changed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the password was last changed; drives password-expiry enforcement.",
    )
    # ── Two-tier account lockout (NCSS 2030 brute-force escalation) ──────────
    temp_lock_count = models.PositiveIntegerField(
        default=0,
        help_text="Temporary lockouts in the current cycle; reset on a successful login.",
    )
    hard_locked = models.BooleanField(
        default=False,
        help_text="Permanently locked after a repeat lockout; only a superuser can unlock.",
    )
    hard_locked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "PSC profiles"

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class TrustedSession(models.Model):
    """
    Records a successful TOTP verification so the user can re-authenticate
    with a session PIN (instead of full TOTP) for a limited window.
    Expires at min(created_at + TRUST_HOURS, today_at_5pm Pacific/Efate).
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="trusted_sessions",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-started_at"]
        verbose_name = "Trusted Session"
        verbose_name_plural = "Trusted Sessions"
        indexes = [
            models.Index(fields=["user", "is_active", "expires_at"], name="ts_user_active_expires_idx"),
        ]

    def __str__(self):
        return f"TrustedSession(user={self.user_id}, expires={self.expires_at})"

    @classmethod
    def compute_expiry(cls, from_dt=None):
        """Return the earlier of (from_dt + 8h) or today at 5pm Pacific/Efate."""
        from_dt = from_dt or timezone.now()
        tz = timezone.get_current_timezone()
        local_dt = timezone.localtime(from_dt, timezone=tz)

        option_a = from_dt + timedelta(hours=int(os.getenv('SESSION_TRUST_HOURS', '8')))

        today_5pm = local_dt.replace(hour=17, minute=0, second=0, microsecond=0)
        option_b = today_5pm if timezone.is_aware(today_5pm) else timezone.make_aware(today_5pm, timezone=tz)

        if option_b <= from_dt:
            return option_a

        return option_a if option_a < option_b else option_b

    @classmethod
    def valid_for(cls, user, ip_address=None, user_agent=None):
        """Return the most recent active non-expired TrustedSession for user, or None."""
        now = timezone.now()
        qs = cls.objects.filter(user=user, is_active=True, expires_at__gt=now)
        if ip_address:
            qs = qs.filter(ip_address=ip_address)
        return qs.order_by("-started_at").first()

    def deactivate(self):
        self.is_active = False
        self.save(update_fields=["is_active"])


class FlyingMinuteSignature(models.Model):
    """Individual member sign-off on a Flying Minute (SOP Section 8)."""

    class Decision(models.TextChoices):
        APPROVE = "approve", "Approve"
        REJECT = "reject", "Reject"
        ABSTAIN = "abstain", "Abstain"

    meeting = models.ForeignKey(
        "Meeting", on_delete=models.CASCADE, related_name="flying_minute_signatures",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="flying_minute_signatures",
    )
    decision = models.CharField(max_length=16, choices=Decision.choices)
    signed_at = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True,
        help_text="Optional remarks or conditions attached to this member's decision.")

    class Meta:
        ordering = ["signed_at"]
        unique_together = [("meeting", "member")]
        verbose_name = "Flying Minute Signature"
        verbose_name_plural = "Flying Minute Signatures"

    def __str__(self):
        return f"{self.member.username} — {self.get_decision_display()} on {self.meeting.reference_number}"


class PasswordResetToken(models.Model):
    """Single-use token for password reset via email link."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="password_reset_tokens"
    )
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at

    @classmethod
    def generate_for(cls, user):
        cls.objects.filter(user=user, used=False).update(used=True)
        token = secrets.token_urlsafe(48)
        return cls.objects.create(
            user=user,
            token=token,
            expires_at=timezone.now() + timedelta(hours=1),
        )


class APIKey(models.Model):
    """Permanent or long-lived keys for external system integration."""
    name = models.CharField(max_length=255)
    key = models.CharField(max_length=128, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="api_keys",
        help_text="The user account whose permissions this key will inherit."
    )
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "API Key"

    def __str__(self):
        return f"{self.name} (linked to {self.user.username})"

    @classmethod
    def generate(cls, user, name):
        """Generate a fresh key with a human-readable prefix."""
        raw_key = f"psc_{secrets.token_urlsafe(32)}"
        return cls.objects.create(user=user, name=name, key=raw_key)


class SystemSetting(models.Model):
    """Key-value store for runtime configurations (2FA, SMTP, etc)."""
    key = models.CharField(max_length=128, unique=True)
    value = models.TextField(blank=True)
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return self.key

    @classmethod
    def get_val(cls, key, default=None):
        try:
            return cls.objects.get(key=key).value
        except cls.DoesNotExist:
            return default

    @classmethod
    def get_bool(cls, key, default=False):
        val = cls.get_val(key)
        if val is None: return default
        return val.lower() in ("true", "1", "yes", "on")

    @classmethod
    def get_int(cls, key, default=0):
        val = cls.get_val(key)
        try:
            return int(val)
        except (TypeError, ValueError):
            return default


class EmailTemplate(models.Model):
    """Configurable subject/body for transactional emails."""

    class Category(models.TextChoices):
        AUTHENTICATION = "authentication", "Authentication"
        SUBMISSION_WORKFLOW = "submission_workflow", "Submission workflow"
        TASKS = "tasks", "Tasks & deadlines"
        SYSTEM = "system", "System"

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    category = models.CharField(
        max_length=32,
        choices=Category.choices,
        default=Category.SYSTEM,
    )
    description = models.TextField(blank=True)
    placeholders = models.TextField(
        blank=True,
        help_text="Comma-separated placeholder names available in subject/body.",
    )
    subject_template = models.CharField(max_length=255)
    body_text_template = models.TextField()
    body_html_template = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_system = models.BooleanField(
        default=False,
        help_text="System templates can be reset to defaults but not deleted.",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.name} ({self.slug})"


class PasswordHistory(models.Model):
    """Hashed record of a user's previous passwords to prevent reuse."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="password_history",
    )
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Password History"
        verbose_name_plural = "Password History"

    def __str__(self):
        return f"{self.user_id} @ {self.created_at:%Y-%m-%d %H:%M}"


# ── NCSS 2030 / ISO 27001 A.12.4 ─────────────────────────────────────────────

class AuditLog(models.Model):
    """Tamper-evident record of every significant system action."""

    class Action(models.TextChoices):
        LOGIN          = "LOGIN",          "Login"
        LOGOUT         = "LOGOUT",         "Logout"
        LOGIN_FAILED   = "LOGIN_FAILED",   "Login Failed"
        LOCKOUT        = "LOCKOUT",        "Account Locked"
        UNLOCK         = "UNLOCK",         "Account Unlocked"
        CREATE         = "CREATE",         "Create"
        READ           = "READ",           "Read / View"
        UPDATE         = "UPDATE",         "Update"
        DELETE         = "DELETE",         "Delete"
        DOWNLOAD       = "DOWNLOAD",       "Download"
        BACKUP         = "BACKUP",         "Backup"
        RESTORE        = "RESTORE",        "Restore"
        SETTINGS       = "SETTINGS",       "Settings Change"
        PASSWORD_CHANGE= "PASSWORD_CHANGE","Password Change"
        TWO_FA         = "2FA",            "2FA Verification"
        PERMISSION     = "PERMISSION",     "Permission Change"
        EXPORT         = "EXPORT",         "Export"
        FEEDBACK       = "FEEDBACK",       "Feedback Submission"
        DECISION       = "DECISION",       "Decision / Stage Proof"

    actor          = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="audit_logs",
    )
    actor_username = models.CharField(max_length=150, blank=True)   # denormalised — survives user deletion
    action         = models.CharField(max_length=30, choices=Action.choices, db_index=True)
    resource_type  = models.CharField(max_length=100, blank=True, db_index=True)
    resource_id    = models.CharField(max_length=100, blank=True)
    resource_label = models.CharField(max_length=255, blank=True)   # human-readable name / title
    description    = models.TextField(blank=True)
    ip_address     = models.GenericIPAddressField(null=True, blank=True)
    user_agent     = models.CharField(max_length=512, blank=True)
    timestamp      = models.DateTimeField(auto_now_add=True, db_index=True)
    extra_data     = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        indexes = [
            models.Index(fields=["actor", "timestamp"]),
            models.Index(fields=["action", "timestamp"]),
        ]

    def __str__(self):
        return f"{self.timestamp:%Y-%m-%d %H:%M} | {self.actor_username} | {self.action}"


# ── NCSS 2030 CSP-4 / ISO 27001 A.16.1 ───────────────────────────────────────

class SecurityIncident(models.Model):
    """Formal incident report — any user can raise, admin manages."""

    class Severity(models.TextChoices):
        LOW      = "low",      "Low"
        MEDIUM   = "medium",   "Medium"
        HIGH     = "high",     "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        OPEN          = "open",          "Open"
        INVESTIGATING = "investigating", "Investigating"
        RESOLVED      = "resolved",      "Resolved"
        CLOSED        = "closed",        "Closed"

    class Category(models.TextChoices):
        PHISHING             = "phishing",             "Phishing / Social Engineering"
        UNAUTHORIZED_ACCESS  = "unauthorized_access",  "Unauthorized Access"
        DATA_BREACH          = "data_breach",          "Data Breach / Exposure"
        MALWARE              = "malware",              "Malware / Ransomware"
        ACCOUNT_COMPROMISE   = "account_compromise",   "Account Compromise"
        POLICY_VIOLATION     = "policy_violation",     "Policy Violation"
        SUSPICIOUS_ACTIVITY  = "suspicious_activity",  "Suspicious Activity"
        SYSTEM_OUTAGE        = "system_outage",        "System Outage / DoS"
        OTHER                = "other",                "Other"

    title            = models.CharField(max_length=255)
    description      = models.TextField()
    category         = models.CharField(max_length=30, choices=Category.choices)
    severity         = models.CharField(max_length=10, choices=Severity.choices, db_index=True)
    status           = models.CharField(max_length=15, choices=Status.choices, default=Status.OPEN, db_index=True)
    reported_by      = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="reported_incidents",
    )
    assigned_to      = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="assigned_incidents",
    )
    affected_systems = models.CharField(max_length=500, blank=True)
    resolution_notes = models.TextField(blank=True)
    created_at       = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at       = models.DateTimeField(auto_now=True)
    resolved_at      = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Security Incident"
        verbose_name_plural = "Security Incidents"

    def __str__(self):
        return f"[{self.severity.upper()}] {self.title}"


# ── NCSS 2030 CSP-1 / ISO 27001 A.12.6 ───────────────────────────────────────

class SecurityScan(models.Model):
    """Stores the most recent SAST + dependency vulnerability scan result."""

    class ScanType(models.TextChoices):
        DEPENDENCY = "dependency", "Dependency Audit (pip-audit)"
        SAST       = "sast",       "Static Analysis (Bandit)"
        FULL       = "full",       "Full Scan"

    scan_type      = models.CharField(max_length=15, choices=ScanType.choices, default=ScanType.FULL)
    started_at     = models.DateTimeField(auto_now_add=True)
    completed_at   = models.DateTimeField(null=True, blank=True)
    triggered_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="security_scans",
    )
    status         = models.CharField(max_length=20, default="running")  # running | completed | failed
    dependency_results = models.JSONField(default=list, blank=True)
    sast_results       = models.JSONField(default=dict, blank=True)
    summary            = models.JSONField(default=dict, blank=True)
    error_message      = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]
        get_latest_by = "started_at"

    def __str__(self):
        return f"Scan {self.id} — {self.status} ({self.started_at:%Y-%m-%d %H:%M})"


class SecurityNotice(models.Model):
    """Admin-authored notices broadcast to all authenticated users."""

    class NoticeType(models.TextChoices):
        INFO        = "info",        "Information"
        WARNING     = "warning",     "Warning"
        CRITICAL    = "critical",    "Critical Alert"
        MAINTENANCE = "maintenance", "Maintenance"

    title       = models.CharField(max_length=255)
    message     = models.TextField()
    notice_type = models.CharField(
        max_length=20, choices=NoticeType.choices, default=NoticeType.INFO
    )
    is_active  = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="security_notices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Security Notice"
        verbose_name_plural = "Security Notices"

    def __str__(self):
        return f"[{self.notice_type.upper()}] {self.title}"

    def is_live(self):
        """True if active and not yet expired."""
        if not self.is_active:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True


class KnowledgeCategory(models.Model):
    """Groups for Knowledge Base articles (e.g. SOPs, Circulars)."""
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon_name = models.CharField(max_length=50, blank=True, help_text="Lucide or Fluent icon name")
    display_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name_plural = "Knowledge Categories"
        ordering = ["display_order", "title"]

    def __str__(self):
        return self.title


class KnowledgeArticleContentType(models.TextChoices):
    MARKDOWN = "markdown", "Markdown"
    HTML_IFRAME = "html_iframe", "Embedded HTML guide"


class KnowledgeArticle(models.Model):
    """Individual documents/articles within the OPSC Knowledge Base."""
    category = models.ForeignKey(KnowledgeCategory, on_delete=models.CASCADE, related_name="articles")
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    content = models.TextField(
        blank=True,
        help_text="Markdown body, or short summary when content_type is html_iframe.",
    )
    content_type = models.CharField(
        max_length=16,
        choices=KnowledgeArticleContentType.choices,
        default=KnowledgeArticleContentType.MARKDOWN,
    )
    html_asset = models.CharField(
        max_length=128,
        blank=True,
        help_text="Filename under frontend public/guides/ for html_iframe articles.",
    )
    allowed_roles = models.JSONField(
        default=list,
        blank=True,
        help_text="PSC profile roles allowed to view; empty list = all authenticated users.",
    )
    is_published = models.BooleanField(default=False, db_index=True)
    is_internal = models.BooleanField(default=True, help_text="If true, only PSC staff can see this.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="knowledge_articles"
    )

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title


class ActiveSubmissionManager(models.Manager):
    """Default manager: hides trashed (soft-deleted) submissions everywhere —
    lists, analytics, rollups, AI context. Restore via Admin → Trash Bin."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Submission(models.Model):
    reference_number = models.CharField(max_length=32, unique=True, editable=False)
    title = models.CharField(max_length=512)
    form_category = models.ForeignKey(FormCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="submissions")
    form_type_code = models.CharField(max_length=64, blank=True, help_text='e.g. "PSC 3.6"')
    agenda_category = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Agenda section code (AgendaSection.code) chosen at lodge.",
    )
    ministry = models.ForeignKey(Ministry, on_delete=models.PROTECT, related_name="submissions")
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="submissions"
    )
    unit = models.ForeignKey(
        Unit, null=True, blank=True, on_delete=models.SET_NULL, related_name="submissions",
    )
    routed_unit = models.CharField(max_length=16, choices=RoutedUnit.choices, blank=True)
    current_stage = models.CharField(
        max_length=48,
        choices=WorkflowStage.choices,
        default=WorkflowStage.DRAFT,
    )
    received_at = models.DateTimeField()
    registered_at = models.DateTimeField(null=True, blank=True)
    assessment_started_at = models.DateTimeField(null=True, blank=True)
    assessment_deadline_at = models.DateTimeField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True, help_text="Free-text tags (set manually or by automations).")
    checklist_review_started_at  = models.DateTimeField(null=True, blank=True,
        help_text="When this submission entered Manager Checklist Review.")
    checklist_review_deadline_at = models.DateTimeField(null=True, blank=True,
        help_text="SLA deadline for checklist review (configurable working days).")
    recalled_at   = models.DateTimeField(null=True, blank=True)
    recalled_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="recalled_submissions",
    )
    recalled_reason = models.TextField(blank=True)
    closing_deadline_at = models.DateTimeField(null=True, blank=True)
    scheduled_meeting = models.ForeignKey(
        Meeting, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="submissions",
        help_text="Which commission meeting this submission is queued for.",
    )
    # ── Classification (SOP Section 4) ─────────────────────────────────────
    classification = models.CharField(
        max_length=24, choices=Classification.choices, default=Classification.CONFIDENTIAL,
        help_text="All submissions are Confidential by default per SOP Section 4.",
    )
    # ── Unit principal assignment ───────────────────────────────────────────
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="assigned_submissions",
        help_text="Primary responsible principal assigned by the unit manager.",
    )
    assigned_at = models.DateTimeField(null=True, blank=True)
    # Secondary analysts — M2M for concurrent multi-analyst work (e.g. ORG-3.1 restructures)
    co_assigned_principals = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='SubmissionCoAssignment',
        through_fields=('submission', 'principal'),
        related_name='co_assigned_submissions',
        blank=True,
    )
    # ── Head of Agency endorsement (SOP Stage 1, step 2) ───────────────────
    dg_endorsed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="endorsed_submissions",
        help_text="Director General / Head of Agency who endorsed this submission.",
    )
    dg_endorsed_at = models.DateTimeField(null=True, blank=True,
        help_text="When the Head of Agency endorsed this submission.")
    implementation_status = models.CharField(
        max_length=24,
        choices=ImplementationStatus.choices,
        default=ImplementationStatus.NOT_STARTED,
    )
    implementation_due_date = models.DateField(null=True, blank=True)
    commission_approved_at = models.DateTimeField(
        null=True, blank=True,
        help_text="First time the Commission approved this submission "
                  "(starts the implementation clock).",
    )
    implementation_completed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When implementation_status was first marked Implemented.",
    )
    notes = models.TextField(blank=True)
    # ── AI executive brief for Secretariat review ───────────────────────────
    ai_brief_summary = models.TextField(
        blank=True,
        help_text="AI-generated executive brief for PSC Secretary review.",
    )
    ai_brief_processed = models.BooleanField(
        default=False,
        help_text="True once the latest brief generation completed.",
    )
    ai_brief_generated_at = models.DateTimeField(null=True, blank=True)
    ai_brief_context_key = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Fingerprint of stage/docs/checklist when brief was generated.",
    )
    # ── AI quality score (compliance / unit review triage) ───────────────────
    ai_quality_score = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="0–100 AI quality score (higher = less review work expected).",
    )
    ai_quality_explanation = models.TextField(
        blank=True,
        help_text="Brief AI explanation of the quality score.",
    )
    ai_quality_dimensions = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-dimension scores: completeness, clarity, evidence_quality, psc_formatting.",
    )
    ai_quality_review_effort = models.CharField(
        max_length=16,
        blank=True,
        help_text="low | moderate | high — expected reviewer effort.",
    )
    ai_quality_processed = models.BooleanField(
        default=False,
        help_text="True once the latest quality scoring completed.",
    )
    ai_quality_generated_at = models.DateTimeField(null=True, blank=True)
    ai_quality_context_key = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Fingerprint of stage/docs/checklist when quality was scored.",
    )
    # ── AI pre-submit package validation (A3 missing information) ─────────────
    ai_package_gaps = models.JSONField(
        default=list,
        blank=True,
        help_text="List of {severity, category, message} gaps before submit.",
    )
    ai_package_ready = models.BooleanField(
        default=False,
        help_text="True when AI/rules found no critical gaps for submit.",
    )
    ai_package_summary = models.TextField(
        blank=True,
        help_text="One-line AI summary of package readiness.",
    )
    ai_package_processed = models.BooleanField(
        default=False,
        help_text="True once the latest package validation completed.",
    )
    ai_package_generated_at = models.DateTimeField(null=True, blank=True)
    ai_transition_guidance = models.JSONField(
        default=dict,
        blank=True,
        help_text="F1 transition helper: suggestions, blockers, rationales.",
    )
    ai_clarification_bilingual = models.JSONField(
        default=dict,
        blank=True,
        help_text="English + Bislama clarification text for ministry (returned for clarification).",
    )
    # ── AI policy guardrail (pre-submit compliance scan) ────────────────────
    ai_policy_observations = models.JSONField(
        default=list,
        blank=True,
        help_text="List of {severity, category, message, evidence} policy observations.",
    )
    ai_policy_confidence = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="0–100 likelihood of passing PSC review without return (higher is better).",
    )
    ai_policy_summary = models.TextField(
        blank=True,
        help_text="One-line policy guardrail summary for ministry submitters.",
    )
    ai_policy_processed = models.BooleanField(
        default=False,
        help_text="True once the latest policy guardrail scan completed.",
    )
    ai_policy_generated_at = models.DateTimeField(null=True, blank=True)
    ai_policy_context_key = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Fingerprint of form/category data when policy scan ran.",
    )
    # ── A4 Duplicate Detection ──────────────────────────────────────────────
    ai_duplicate_processed    = models.BooleanField(default=False, db_index=True)
    ai_duplicate_is_duplicate = models.BooleanField(null=True, blank=True)
    ai_duplicate_confidence   = models.PositiveSmallIntegerField(null=True, blank=True)
    ai_duplicate_similar_cases = models.JSONField(null=True, blank=True)
    ai_duplicate_recommendation = models.TextField(blank=True)
    ai_duplicate_generated_at = models.DateTimeField(null=True, blank=True)

    # ── B2 Risk Assessment ──────────────────────────────────────────────────
    ai_risk_processed     = models.BooleanField(default=False, db_index=True)
    ai_risk_score         = models.PositiveSmallIntegerField(null=True, blank=True)
    ai_risk_level         = models.CharField(max_length=20, blank=True)
    ai_risk_factors       = models.JSONField(null=True, blank=True)
    ai_risk_mitigation    = models.JSONField(null=True, blank=True)
    ai_risk_recommendation = models.TextField(blank=True)
    ai_risk_generated_at  = models.DateTimeField(null=True, blank=True)

    # ── B3 Recommended Outcome ──────────────────────────────────────────────
    ai_outcome_processed      = models.BooleanField(default=False, db_index=True)
    ai_outcome_recommendation = models.CharField(max_length=50, blank=True)
    ai_outcome_confidence     = models.PositiveSmallIntegerField(null=True, blank=True)
    ai_outcome_rationale      = models.TextField(blank=True)
    ai_outcome_conditions     = models.JSONField(null=True, blank=True)
    ai_outcome_precedents     = models.JSONField(null=True, blank=True)
    ai_outcome_legal_basis    = models.TextField(blank=True)
    ai_outcome_generated_at   = models.DateTimeField(null=True, blank=True)

    # ── B5 Notice of Allegation ─────────────────────────────────────────────
    ai_noa_processed    = models.BooleanField(default=False, db_index=True)
    ai_noa_content      = models.TextField(blank=True)
    ai_noa_subject      = models.CharField(max_length=255, blank=True)
    ai_noa_key_points   = models.JSONField(null=True, blank=True)
    ai_noa_generated_at = models.DateTimeField(null=True, blank=True)

    # ── F3 Outcome Letter ───────────────────────────────────────────────────
    ai_letter_processed    = models.BooleanField(default=False, db_index=True)
    ai_letter_content      = models.TextField(blank=True)
    ai_letter_subject      = models.CharField(max_length=255, blank=True)
    ai_letter_action_items = models.JSONField(null=True, blank=True)
    ai_letter_generated_at = models.DateTimeField(null=True, blank=True)

    # ── Parent/child (attachment) relationship ──────────────────────────────
    parent_submission = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='attached_submissions',
        help_text="Set when this submission is attached to a parent (e.g. Form 2-2 attached to Form 2-1).",
    )
    is_attachment = models.BooleanField(
        default=False,
        help_text="True when this submission is a lightweight attachment reviewed alongside a parent submission.",
    )
    is_internal = models.BooleanField(
        default=False,
        help_text="True when submitted by OPSC staff (CSU/ODU). Routes directly to Secretary, no checklist.",
    )
    secretary_only = models.BooleanField(
        default=False,
        help_text="True for travel forms 4.4–4.6: Secretary decides; never forwarded to Commission.",
    )
    requires_travel_letter = models.BooleanField(
        default=False,
        help_text="True when Secretary approval must generate an official letter (Forms 4.5 & 4.6).",
    )
    travel_endorsers = models.JSONField(
        default=dict,
        blank=True,
        help_text="User IDs for ministry endorsement signers: hod, director, dg, minister.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="submissions_logged"
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # ── Trash bin (soft delete) ───────────────────────────────────────────────
    # Government records are never destroyed: "deletion" marks the row and
    # hides it via the default manager; Admin → Trash Bin restores it.
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="trashed_submissions",
    )
    delete_reason = models.TextField(blank=True)

    objects = ActiveSubmissionManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["-created_at"]
        base_manager_name = "all_objects"

    def __str__(self):
        return f"{self.reference_number} — {self.title}"

    def _assessment_deadline_days(self) -> int:
        """Return the working-day deadline for this submission's form type (default 21)."""
        if self.form_type_code:
            try:
                ft = PSCFormType.objects.get(code=self.form_type_code)
                return ft.assessment_deadline_days
            except PSCFormType.DoesNotExist:
                pass
        return 21

    def _set_assessment_deadline_from_start(self):
        if not self.assessment_started_at:
            self.assessment_deadline_at = None
            return
        start_local = timezone.localtime(self.assessment_started_at)
        deadline_date = add_working_days(start_local.date(), self._assessment_deadline_days())
        tz = timezone.get_current_timezone()
        self.assessment_deadline_at = timezone.make_aware(datetime.combine(deadline_date, time(23, 59, 59)), tz)

    def _set_checklist_review_deadline_from_start(self):
        """Set the checklist review SLA deadline from checklist_review_started_at."""
        from django.conf import settings as django_settings
        sla_days = getattr(django_settings, 'CHECKLIST_REVIEW_SLA_DAYS', 5)
        if self.checklist_review_started_at:
            self.checklist_review_deadline_at = add_working_days(
                self.checklist_review_started_at, sla_days
            )

    @property
    def is_assessment_overdue(self):
        if self.current_stage != WorkflowStage.UNDER_ASSESSMENT:
            return False
        if not self.assessment_deadline_at:
            return False
        return timezone.now() > self.assessment_deadline_at

    @property
    def is_checklist_review_overdue(self):
        if self.current_stage != WorkflowStage.MANAGER_CHECKLIST_REVIEW:
            return False
        if not self.checklist_review_deadline_at:
            return False
        return timezone.now() > self.checklist_review_deadline_at

    @property
    def is_registration_overdue(self):
        """True when submission has been in SUBMITTED state past the SLA."""
        if self.current_stage != WorkflowStage.SUBMITTED:
            return False
        from django.conf import settings as django_settings
        sla_days = getattr(django_settings, 'PSC_REGISTRATION_SLA_DAYS', 2)
        deadline = self.received_at + timedelta(days=sla_days)
        return timezone.now() > deadline

    @property
    def estimated_meeting_date(self):
        """Return the estimated date this submission will be heard, or None."""
        if self.scheduled_meeting_id:
            return self.scheduled_meeting.date
        pre_meeting_stages = {
            WorkflowStage.FORWARDED_TO_COMMISSION,
            WorkflowStage.COMMISSION_SITTING,
            WorkflowStage.MATTERS_ARISING,
            WorkflowStage.APPROVED,
            WorkflowStage.REJECTED,
            WorkflowStage.DEFERRED_BACK_TO_HR,
        }
        if self.current_stage in pre_meeting_stages:
            next_mtg = Meeting.objects.filter(
                status__in=[MeetingStatus.SCHEDULED, MeetingStatus.IN_PROGRESS],
                submission_cutoff__gte=self.received_at,
            ).order_by("date").first()
            if next_mtg:
                return next_mtg.date
        return None

    def save(self, *args, **kwargs):
        if not self.reference_number:
            self.reference_number = allocate_reference_number()
        if self.assessment_started_at:
            self._set_assessment_deadline_from_start()
        else:
            self.assessment_deadline_at = None
        super().save(*args, **kwargs)


class PSCForm37Data(models.Model):
    """Structured data for PSC Form 3-7 (Request to Employ Temporary/Daily/Contract Employee)."""
    submission = models.OneToOneField(
        Submission, on_delete=models.CASCADE, related_name="form37_data"
    )
    # Proposed employee
    proposed_employee_name = models.CharField(max_length=255, blank=True)
    # Established post
    is_established_post = models.BooleanField(default=False)
    post_title = models.CharField(max_length=255, blank=True)
    post_number = models.CharField(max_length=64, blank=True)
    post_level = models.CharField(max_length=64, blank=True)
    # Justification
    reasons_for_employment = models.TextField(blank=True)
    how_selected = models.TextField(blank=True)
    # Employment type
    employment_type = models.CharField(
        max_length=24, choices=EmploymentType.choices, blank=True
    )
    # Period of employment
    period_from = models.DateField(null=True, blank=True)
    period_to = models.DateField(null=True, blank=True)
    # Salary
    salary_vt = models.CharField(max_length=64, blank=True, help_text="VT amount")
    salary_scale = models.CharField(max_length=32, blank=True, help_text="e.g. P12.1 or C2.2")
    # Director certification
    director_name = models.CharField(max_length=255, blank=True)
    director_department = models.CharField(max_length=255, blank=True)
    director_date = models.DateField(null=True, blank=True)
    # Director-General endorsement
    dg_name = models.CharField(max_length=255, blank=True)
    dg_ministry = models.CharField(max_length=255, blank=True)
    dg_date = models.DateField(null=True, blank=True)
    # OPSC office use only (filled by PSC secretary after review)
    approved = models.BooleanField(null=True, blank=True)
    secretary_name = models.CharField(max_length=255, blank=True)
    secretary_date = models.DateField(null=True, blank=True)
    ministry_advised_date = models.DateField(null=True, blank=True)
    job_offer_letter_date = models.DateField(null=True, blank=True)
    agreement_service_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PSC Form 3-7 — {self.submission.reference_number}"


def _submission_doc_path(instance, filename):
    return f"submission_documents/{instance.submission_id}/{filename}"


class DocumentOcrStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    SKIPPED = "skipped", "Skipped"


class DocumentClassificationType(models.TextChoices):
    """A2 — AI / rule-assigned document tags for search and checklist matching."""
    UNCLASSIFIED = "unclassified", "Unclassified"
    APPOINTMENT_LETTER = "appointment_letter", "Appointment letter"
    MEDICAL_CERTIFICATE = "medical_certificate", "Medical certificate"
    PSC_FORM = "psc_form", "PSC form"
    POSITION_DESCRIPTION = "position_description", "Position description"
    DG_ENDORSEMENT = "dg_endorsement", "DG / HoA endorsement"
    ORGANISATIONAL_CHART = "organisational_chart", "Organisational chart"
    LEGISLATION_POLICY = "legislation_policy", "Legislation / policy"
    FINANCIAL_COSTING = "financial_costing", "Financial / costing"
    CORRESPONDENCE = "correspondence", "Correspondence"
    SUPPORTING_EVIDENCE = "supporting_evidence", "Supporting evidence"
    MINUTES_REPORT = "minutes_report", "Minutes / report"
    OTHER = "other", "Other"


class SubmissionCoAssignment(models.Model):
    """
    Through-model for Submission.co_assigned_principals M2M.

    Records secondary/concurrent analyst assignments alongside the primary
    ``assigned_to`` FK. Used when multiple analysts need to work on the same
    submission concurrently (e.g. large ORG-3.1 restructure submissions).

    The primary ``assigned_to`` remains the responsible officer; co-assignees
    are collaborators with read/write access to checklist and assessment fields.
    """

    class Role(models.TextChoices):
        SECONDARY  = 'secondary',  'Secondary analyst'
        SPECIALIST = 'specialist', 'Specialist reviewer'

    submission  = models.ForeignKey(
        'Submission', on_delete=models.CASCADE, related_name='co_assignments',
    )
    principal   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='co_assignment_records',
    )
    role        = models.CharField(max_length=16, choices=Role.choices, default=Role.SECONDARY)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    notes       = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = [('submission', 'principal')]
        ordering = ['assigned_at']
        verbose_name        = 'Co-Assignment'
        verbose_name_plural = 'Co-Assignments'

    def __str__(self):
        return f"{self.principal.get_full_name() or self.principal.username} → {self.submission.reference_number} ({self.role})"


class ActiveDocumentManager(models.Manager):
    """Default manager: hides archived (soft-removed) documents everywhere —
    document lists, AI context, checklists, decision-proof fingerprints."""

    def get_queryset(self):
        return super().get_queryset().filter(archived_at__isnull=True)


class SubmissionDocument(models.Model):
    """A file uploaded to a submission (DG-endorsed letter, position desc, etc.).

    Evidence-preservation rules:
    - Replacing a file snapshots the superseded file into DocumentVersion
      (version chain) instead of overwriting it.
    - Once a submission has entered the workflow, documents are archived
      (archived_at set), never hard-deleted — what the Commission saw is
      always recoverable.
    """
    submission = models.ForeignKey(
        'Submission', on_delete=models.CASCADE, related_name='documents',
    )
    file = models.FileField(upload_to=_submission_doc_path)
    original_name = models.CharField(max_length=255)
    description = models.CharField(max_length=255, blank=True)
    note = models.TextField(blank=True, help_text="Free-text note about this document (e.g. compliance evidence note).")
    uploaded_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    version_num = models.PositiveSmallIntegerField(
        default=1,
        help_text="Current version number; superseded files live in DocumentVersion.",
    )
    archived_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Soft-removal timestamp — archived documents are hidden, not destroyed.",
    )
    archived_by = models.ForeignKey(
        'auth.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='archived_documents',
    )

    objects = ActiveDocumentManager()
    all_objects = models.Manager()
    ocr_status = models.CharField(
        max_length=16,
        choices=DocumentOcrStatus.choices,
        default=DocumentOcrStatus.PENDING,
    )
    extracted_text = models.TextField(
        blank=True,
        help_text="Full OCR / text extraction for search and AI context.",
    )
    extracted_facts = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured key facts: names, dates, positions, references, statements.",
    )
    ocr_error = models.TextField(blank=True)
    ocr_processed_at = models.DateTimeField(null=True, blank=True)
    document_type = models.CharField(
        max_length=32,
        choices=DocumentClassificationType.choices,
        default=DocumentClassificationType.UNCLASSIFIED,
        db_index=True,
    )
    document_type_confidence = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="0–100 confidence for document_type classification.",
    )
    document_type_note = models.CharField(max_length=255, blank=True)
    document_classified_at = models.DateTimeField(null=True, blank=True)
    ai_annotation_suggestions = models.JSONField(
        default=dict,
        blank=True,
        help_text="AI-suggested PDF review highlights (verify before applying).",
    )
    ai_redaction_spans = models.JSONField(
        default=dict,
        blank=True,
        help_text="E3 suggested redaction spans (human approves).",
    )

    class Meta:
        ordering = ['uploaded_at']

    def __str__(self):
        return f"{self.submission.reference_number} – {self.original_name}"


def _annotation_snapshot_path(instance, filename):
    return f"annotations/{instance.document_id}/page{instance.page_number}/{filename}"


def _user_sig_path(instance, filename):
    return f"user_signatures/{instance.user_id}/{filename}"


class UserSignature(models.Model):
    """A user's pre-saved signature image (uploaded or drawn in their profile)."""
    user = models.OneToOneField(
        'auth.User', on_delete=models.CASCADE, related_name='stored_signature',
    )
    image = models.ImageField(upload_to=_user_sig_path)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Signature of {self.user.username}"


def _signature_snapshot_path(instance, filename):
    return f"signatures/{instance.document_id}/{instance.signed_by_id}/{filename}"


class DocumentSignature(models.Model):
    """A placed signature on a submission document page."""
    document = models.ForeignKey(
        SubmissionDocument, on_delete=models.CASCADE, related_name='signatures',
    )
    signed_by = models.ForeignKey(
        'auth.User', on_delete=models.CASCADE, related_name='doc_signatures',
    )
    page_number = models.PositiveIntegerField(default=1)
    position_x  = models.FloatField(default=0.1, help_text="Left edge as fraction of canvas width.")
    position_y  = models.FloatField(default=0.7, help_text="Top edge as fraction of canvas height.")
    sig_scale   = models.FloatField(default=1.0, help_text="Scale applied to the signature image.")
    snapshot = models.ImageField(
        upload_to=_signature_snapshot_path, null=True, blank=True,
        help_text="Combined PDF-page + signature PNG export.",
    )
    signed_date = models.DateField(help_text="Date entered by the signer.")
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['document', 'signed_by']]
        ordering = ['document', 'created_at']

    def __str__(self):
        return f"Signature by {self.signed_by.username} on doc {self.document_id} p{self.page_number}"


class DocumentAnnotation(models.Model):
    """Per-page annotation on a submission document (PDF)."""
    document = models.ForeignKey(
        SubmissionDocument, on_delete=models.CASCADE, related_name='annotations',
    )
    annotated_by = models.ForeignKey(
        'auth.User', on_delete=models.CASCADE, related_name='doc_annotations',
    )
    page_number = models.PositiveIntegerField(default=1)
    fabric_json = models.JSONField(default=list, blank=True,
        help_text="Fabric.js objects array (no background) for this page.",
    )
    snapshot = models.ImageField(
        upload_to=_annotation_snapshot_path, null=True, blank=True,
        help_text="Combined PDF-page + annotation PNG export.",
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['document', 'annotated_by', 'page_number']]
        ordering = ['document', 'annotated_by', 'page_number']

    def __str__(self):
        return f"Annotation by {self.annotated_by.username} on doc {self.document_id} p{self.page_number}"


class RequiredDocument(models.Model):
    """A document or procedural task that must be completed/present.

    Scoping rules (evaluated in order — most specific wins):
      form_type set   → applies only to submissions of that exact form type
      form_category set (form_type null) → applies to all submissions in that category
      both null       → applies to every submission
    """
    class ItemType(models.TextChoices):
        DOCUMENT   = "document",   "Required Document"
        PROCEDURAL = "procedural", "Procedural Task / Milestone"

    form_category = models.ForeignKey(
        FormCategory, null=True, blank=True,
        on_delete=models.CASCADE, related_name='required_documents',
        help_text="Leave blank to apply to all form categories.",
    )
    form_type = models.ForeignKey(
        'PSCFormType', null=True, blank=True,
        on_delete=models.CASCADE, related_name='required_documents',
        help_text="When set, applies only to submissions of this specific form type.",
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    item_type = models.CharField(
        max_length=20, choices=ItemType.choices, default=ItemType.DOCUMENT
    )
    mandatory_for_stage = models.CharField(
        max_length=50, choices=WorkflowStage.choices, null=True, blank=True,
        help_text="Block transition FROM this stage if this item is incomplete."
    )
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['form_category', 'form_type', 'order', 'name']
        verbose_name = "Required Document / Task"
        verbose_name_plural = "Required Documents & Tasks"

    def __str__(self):
        if self.form_type_id:
            return f"[{self.form_type.code}] {self.name}"
        cat = self.form_category.name if self.form_category_id else "All categories"
        return f"[{cat}] {self.name}"


class SubmissionChecklistItem(models.Model):
    """Per-submission record of whether a required document is present."""
    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name='checklist_items',
    )
    document = models.ForeignKey(
        RequiredDocument, on_delete=models.PROTECT, related_name='checklist_items',
    )
    is_present = models.BooleanField(default=False)
    notes = models.TextField(blank=True, help_text="Officer notes or AI-generated reason for this item's status.")
    checked_by = models.ForeignKey(
        'auth.User', null=True, blank=True, on_delete=models.SET_NULL,
    )
    checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['submission', 'document']
        ordering = ['document__order', 'document__name']

    def __str__(self):
        tick = '✓' if self.is_present else '✗'
        return f"{self.submission.reference_number} – {self.document.name} {tick}"


class CommissionTaskStatus(models.TextChoices):
    OPEN = "open", "Open"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class CommissionTaskDecisionType(models.TextChoices):
    APPOINTMENT = "appointment", "Appointment"
    DISCIPLINE = "discipline", "Discipline"
    POLICY_CHANGE = "policy_change", "Policy change"
    TERMINATION = "termination", "Termination"
    PROMOTION = "promotion", "Promotion"
    OTHER = "other", "Other"


class CommissionDecisionOutcome(models.TextChoices):
    APPROVED              = "approved",              "Approved"
    NOTED                 = "noted",                 "Noted"
    NOT_APPROVED          = "not_approved",          "Not Approved"
    REJECTED              = "rejected",              "Rejected"
    DEFERRED_BACK_TO_UNIT = "deferred_back_to_unit", "Deferred Back to Unit"
    DEFERRED_NEXT         = "deferred_next",         "Deferred To Next Meeting"
    # Retained for back-compatibility with existing decision-register rows.
    DEFERRED_INFO         = "deferred_info",         "Deferred — Need more information"


class CommissionActionUnit(models.TextChoices):
    CIU            = "CIU",            "CIU"
    CSU            = "CSU",            "CSU"
    FHU            = "FHU",            "FHU"
    HRMU           = "HRMU",           "HRMU"
    ODU            = "ODU",            "ODU"
    OPSC_SECRETARY = "OPSC_Secretary", "OPSC Secretary"
    VIPAM_HRDU     = "VIPAM_HRDU",     "VIPAM/HRDU"


class CommissionImplementationStatus(models.TextChoices):
    WITH_UNIT       = "with_unit",       "With Unit Responsible"
    MATTERS_ARISING = "matters_arising", "Matters Arising"
    ACTIONED        = "actioned",        "Actioned"
    NOW_IRRELEVANT  = "now_irrelevant",  "Now Irrelevant"


class CommissionTask(models.Model):
    """
    Post-decision action item: secretariat allocates to an OPSC Manager;
    the manager may assign work to Principal / Senior Officers.

    Also serves as the Decision Register — tracks the outcome of each
    commission decision and its implementation status (mirrors the
    PS Commission Implementation Tracker spreadsheet).
    """

    # ── Decision Register fields (from spreadsheet) ──────────────────────────
    decision_number = models.CharField(
        max_length=64, blank=True,
        help_text="e.g. '02-28-2025' (decision#-meeting#-year).",
    )
    meeting = models.ForeignKey(
        "Meeting", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="commission_tasks",
        help_text="Commission sitting that produced this decision.",
    )
    decision_detail = models.TextField(
        blank=True,
        help_text="Full text of what the Commission decided.",
    )
    decision_outcome = models.CharField(
        max_length=32, blank=True,
        choices=CommissionDecisionOutcome.choices,
    )
    action_unit = models.CharField(
        max_length=32, blank=True,
        choices=CommissionActionUnit.choices,
        help_text="OPSC unit responsible for actioning this decision.",
    )
    implementation_status = models.CharField(
        max_length=32, blank=True,
        choices=CommissionImplementationStatus.choices,
        default=CommissionImplementationStatus.WITH_UNIT,
    )
    way_forward = models.TextField(
        blank=True,
        help_text="Notes on next steps or way forward.",
    )

    # ── Submission link (optional) ────────────────────────────────────────────
    submission = models.ForeignKey(
        Submission, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="commission_tasks",
    )
    agenda_item = models.ForeignKey(
        "AgendaItem", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="commission_tasks",
        help_text=(
            "Agenda item in the signed minutes that produced this task. "
            "Used for idempotent auto-allocation and unit-scoped minutes visibility."
        ),
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    meeting_reference = models.CharField(
        max_length=255,
        blank=True,
        help_text="Sitting that produced the action (e.g. PSC Meeting 05/2026).",
    )
    meeting_date = models.DateField(null=True, blank=True)
    minute_reference = models.CharField(
        max_length=255,
        blank=True,
        help_text="Paragraph or item in official minutes (e.g. Item 4.2).",
    )
    decision_type = models.CharField(
        max_length=32,
        choices=CommissionTaskDecisionType.choices,
        blank=True,
    )
    success_criteria = models.TextField(blank=True)
    legal_reference = models.CharField(
        max_length=512,
        blank=True,
        help_text="PSC Staff Manual, Act, or other legal cite (optional).",
    )
    status = models.CharField(
        max_length=20,
        choices=CommissionTaskStatus.choices,
        default=CommissionTaskStatus.OPEN,
    )
    assigned_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="managed_commission_tasks",
    )
    assigned_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="staff_commission_tasks",
    )
    assigned_staff_m2m = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="commission_tasks_assigned",
        help_text="One or more staff assigned to this task (supersedes single assigned_staff).",
    )
    due_date_notified = models.BooleanField(
        default=False,
        help_text="True once the due-date reminder notification has been sent.",
    )
    due_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="commission_tasks_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    ai_subtask_drafts = models.JSONField(
        default=dict,
        blank=True,
        help_text="AI-drafted subtask suggestions (verify before creating).",
    )
    tags = models.JSONField(default=list, blank=True, help_text="Free-text tags (set manually or by automations).")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        ref = self.submission.reference_number if self.submission_id else (self.decision_number or "—")
        return f"{ref}: {self.title}"


class DecisionRegisterReport(models.Model):
    """AI-generated Commission Decision Register export (Quarto HTML + PDF)."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="decision_register_reports",
    )
    prompt = models.TextField(help_text="Natural-language report request from the user.")
    title = models.CharField(max_length=200, blank=True)
    subtitle = models.CharField(max_length=300, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    error_message = models.TextField(blank=True)
    filter_spec = models.JSONField(default=dict, blank=True)
    column_spec = models.JSONField(default=list, blank=True)
    narrative_markdown = models.TextField(blank=True)
    include_summary = models.BooleanField(default=True)
    row_count = models.PositiveIntegerField(default=0)
    html_file = models.FileField(
        upload_to="decision_register_reports/%Y/%m/",
        blank=True,
    )
    pdf_file = models.FileField(
        upload_to="decision_register_reports/%Y/%m/",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Register report #{self.pk} — {self.title or self.status}"


class ImplementationDashboardReport(models.Model):
    """Stored implementation-rollup PDF (quarterly schedule or on demand).

    Rendered with WeasyPrint from the build_implementation_rollup dataset —
    "% of decisions implemented within target, by ministry, over time".
    """

    label = models.CharField(max_length=64, help_text='Period label, e.g. "Q1 2026".')
    period_start = models.DateField()
    period_end = models.DateField()
    target_days = models.PositiveIntegerField(
        default=30,
        help_text="IMPLEMENTATION_TARGET_DAYS in effect when generated.",
    )
    summary = models.JSONField(
        default=dict, blank=True,
        help_text="Snapshot of the overall KPI block at generation time.",
    )
    pdf_file = models.FileField(
        upload_to="implementation_reports/%Y/%m/",
        blank=True,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="implementation_reports",
        help_text="Null when generated by the quarterly schedule.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Implementation report {self.label}"


class AnnualReport(models.Model):
    """Frozen statistics report for a reporting period.

    Originally the Annual Report statistics chapter (calendar year), now the
    snapshot behind any period: a full year, a quarter, a month, or a custom
    on-the-go range. The dataset is snapshotted at generation time so the
    published figures stay reproducible even as the live data moves on.
    """

    class PeriodType(models.TextChoices):
        ANNUAL = "annual", "Annual"
        QUARTERLY = "quarterly", "Quarterly"
        MONTHLY = "monthly", "Monthly"
        CUSTOM = "custom", "Custom range"

    year = models.PositiveIntegerField(
        null=True, blank=True, db_index=True,
        help_text="Calendar year for annual reports; the start year otherwise.",
    )
    period_type = models.CharField(
        max_length=12, choices=PeriodType.choices, default=PeriodType.ANNUAL,
    )
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    period_label = models.CharField(
        max_length=120, blank=True,
        help_text="Human label for the period, e.g. 'Q2 2025'.",
    )
    options = models.JSONField(
        default=dict, blank=True,
        help_text="Generation options, e.g. {'include': [...sections]}.",
    )
    dataset = models.JSONField(
        default=dict, blank=True,
        help_text="Frozen statistics dataset behind the PDF.",
    )
    pdf_file = models.FileField(upload_to="annual_reports/%Y/", blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="annual_reports",
        help_text="Null when generated by the yearly schedule.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report statistics {self.period_label or self.year}"


class ReportTemplate(models.Model):
    """Admin-managed, global report template (Reports product).

    A template is a *guided-builder spec* (sections/kpis/charts/table) over a data
    domain, plus the parameter form to expose at generation time. No code/`.qmd` is
    ever stored — only validated vocabulary — so there is no code-execution surface.
    """

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    domain = models.CharField(max_length=24, default="submissions", help_text="Resolver domain key.")
    spec = models.JSONField(default=dict, help_text="Validated render spec: sections/kpis/charts/table/narrative.")
    param_schema = models.JSONField(default=list, blank=True, help_text="Params exposed on the Generate form.")
    default_params = models.JSONField(default=dict, blank=True)
    visible_to_all = models.BooleanField(default=True)
    visible_roles = models.JSONField(default=list, blank=True, help_text="Role codes when not visible to all.")
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="report_templates_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="report_templates_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.slug})"


class SmartReport(models.Model):
    """Enterprise Reporting Engine job — async Quarto HTML report (catalog or ad-hoc NL).

    Generalizes the DecisionRegisterReport pipeline across data domains. The first
    domain is Submissions; decisions/compliance/meetings/travel follow in later phases.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    class Domain(models.TextChoices):
        SUBMISSIONS = "submissions", "Submissions"
        # decisions, compliance, meetings, travel → later phases

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="smart_reports",
    )
    template = models.ForeignKey(
        "ReportTemplate", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="generated_reports",
    )
    domain = models.CharField(
        max_length=24, choices=Domain.choices, default=Domain.SUBMISSIONS
    )
    report_type = models.CharField(
        max_length=64, default="adhoc",
        help_text='Template slug or "adhoc".',
    )
    prompt = models.TextField(blank=True, help_text="Ad-hoc natural-language request.")
    params = models.JSONField(default=dict, blank=True, help_text="Catalog params / filters.")
    spec = models.JSONField(default=dict, blank=True, help_text="Resolved render spec.")
    title = models.CharField(max_length=200, blank=True)
    subtitle = models.CharField(max_length=300, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    error_message = models.TextField(blank=True)
    row_count = models.PositiveIntegerField(default=0)
    html_file = models.FileField(upload_to="smart_reports/%Y/%m/", blank=True)
    pdf_file = models.FileField(upload_to="smart_reports/%Y/%m/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["requested_by", "-created_at"], name="smartrep_req_created_idx"),
            models.Index(fields=["status"], name="smartrep_status_idx"),
        ]

    def __str__(self):
        return f"Smart report #{self.pk} — {self.title or self.report_type} ({self.status})"


class MeetingBriefingPack(models.Model):
    """C2 — AI-generated Commission sitting briefing pack (Quarto HTML + PDF)."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    meeting = models.ForeignKey(
        Meeting,
        on_delete=models.CASCADE,
        related_name="briefing_packs",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meeting_briefing_packs",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    error_message = models.TextField(blank=True)
    narrative_markdown = models.TextField(blank=True)
    pack_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured agenda sections, flags, and submission rows for the template.",
    )
    html_file = models.FileField(
        upload_to="meeting_briefing_packs/%Y/%m/",
        blank=True,
    )
    pdf_file = models.FileField(
        upload_to="meeting_briefing_packs/%Y/%m/",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Briefing pack #{self.pk} — {self.meeting.reference_number}"


class CommissionTaskUpdate(models.Model):
    """
    Append-only status / comment log for transparency and ministerial reporting
    (e.g. deadline slips, progress notes).
    """

    task = models.ForeignKey(
        CommissionTask,
        on_delete=models.CASCADE,
        related_name="status_updates",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="commission_task_updates_authored",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Update on {self.task_id} by {self.author_id}"


class CommissionSubTask(models.Model):
    """
    A sub-task within a CommissionTask, created by the manager.
    Can be assigned to one or more staff. Due date must be <= parent task due date.
    """

    task = models.ForeignKey(
        CommissionTask, on_delete=models.CASCADE, related_name="subtasks",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=CommissionTaskStatus.choices,
        default=CommissionTaskStatus.OPEN,
    )
    due_date = models.DateField(null=True, blank=True)
    due_date_notified = models.BooleanField(
        default=False,
        help_text="True once the due-date reminder notification has been sent.",
    )
    assigned_staff = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="subtasks",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_subtasks",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.task_id}] {self.title}"


class WorkflowEvent(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        help_text="Null for system-generated events (e.g. CMS callback).",
    )
    actor_label = models.CharField(max_length=150, blank=True,
        help_text="Denormalised label used when actor is a system (not a user).")
    previous_stage = models.CharField(max_length=48, choices=WorkflowStage.choices)
    new_stage = models.CharField(max_length=48, choices=WorkflowStage.choices)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    content_hash = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        help_text="SHA-256 of canonical decision snapshot (decision transitions only).",
    )
    proof_payload = models.JSONField(
        default=dict,
        blank=True,
        help_text="Immutable JSON snapshot used to verify content_hash.",
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.submission.reference_number}: {self.previous_stage} → {self.new_stage}"


class DecisionService(models.Model):
    """Formal service of a Commission decision on the responsible ministry.

    Created when the Secretariat serves the outcome letter; the ministry must
    acknowledge receipt in-system. The served letter is an immutable snapshot
    (text + PDF + SHA-256), so "we never received it" and "that's not what we
    were sent" are both answerable from the record.
    """

    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name="decision_services",
    )
    ministry = models.ForeignKey(
        Ministry, on_delete=models.PROTECT, related_name="decision_services",
    )
    decision_outcome = models.CharField(
        max_length=48, blank=True,
        help_text="Workflow stage of the decision at serve time (approved / rejected / …).",
    )
    letter_subject = models.CharField(max_length=255, blank=True)
    letter_body = models.TextField(
        help_text="Letter text exactly as served — never edited after service.",
    )
    letter_pdf = models.FileField(
        upload_to="decision_service/%Y/%m/", blank=True,
    )
    content_hash = models.CharField(
        max_length=64, blank=True, db_index=True,
        help_text="SHA-256 of the canonical service snapshot (proof_payload).",
    )
    proof_payload = models.JSONField(
        default=dict, blank=True,
        help_text="Immutable JSON snapshot used to verify content_hash.",
    )
    served_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="decisions_served",
    )
    served_at = models.DateTimeField(auto_now_add=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="decisions_acknowledged",
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledgement_note = models.TextField(blank=True)
    superseded = models.BooleanField(
        default=False,
        help_text="True when a corrected letter was re-served after this one.",
    )
    reminder_count = models.PositiveSmallIntegerField(default=0)
    last_reminder_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-served_at"]

    def __str__(self):
        state = "acknowledged" if self.acknowledged_at else "pending acknowledgement"
        return f"Service of {self.submission.reference_number} ({state})"


class DecisionLetterStatus(models.TextChoices):
    DRAFT            = "draft",            "Draft"
    PREPARED         = "prepared",         "Prepared"
    PRINTED          = "printed",          "Printed"
    SIGNED           = "signed",           "Signed by Secretary"
    READY_FOR_PICKUP = "ready_for_pickup", "Ready for Pickup"
    PICKED_UP        = "picked_up",        "Picked Up"


class DecisionLetter(models.Model):
    """A formal decision/action letter prepared by the responsible OPSC unit for
    a Commission decision (e.g. a direct-appointment letter).

    Interim wet-ink flow until the DCDT digital-signature policy is in force:
    the assigned action officer drafts the letter, prints it, the Secretary
    signs it on paper, then the unit notifies the originating ministry HR that
    the signed letter is ready for physical pickup. Mirrors the manual-signature
    pattern used for minutes.
    """

    commission_task = models.ForeignKey(
        CommissionTask, on_delete=models.CASCADE, related_name="decision_letters",
    )
    submission = models.ForeignKey(
        Submission, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="decision_letters",
        help_text="Convenience link (derived from the task) for ministry/HR lookup.",
    )
    subject = models.CharField(max_length=500)
    body_text = models.TextField(blank=True)
    document = models.FileField(
        upload_to="decision_letters/%Y/%m/", null=True, blank=True,
        help_text="The prepared (unsigned) letter, generated or uploaded for printing.",
    )
    signed_scan = models.FileField(
        upload_to="decision_letters/signed/%Y/%m/", null=True, blank=True,
        help_text="Optional scan of the wet-ink signed letter, for the record.",
    )
    status = models.CharField(
        max_length=20, choices=DecisionLetterStatus.choices,
        default=DecisionLetterStatus.DRAFT,
    )
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="prepared_decision_letters",
        help_text="Action officer (principal/senior) who prepared the letter.",
    )
    prepared_at = models.DateTimeField(null=True, blank=True)
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="signed_decision_letters",
        help_text="Secretary who signed the letter (wet-ink record).",
    )
    signed_at = models.DateTimeField(null=True, blank=True)
    pickup_notified_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the originating ministry HR was notified the letter is ready.",
    )
    picked_up_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="collected_decision_letters",
        help_text="Ministry HR who confirmed physical collection.",
    )
    picked_up_at = models.DateTimeField(null=True, blank=True)
    pickup_note = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="created_decision_letters",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Decision letter ({self.get_status_display()}): {self.subject[:60]}"


class PermissionCategory(models.TextChoices):
    SUBMISSIONS    = "submissions",    "Submissions"
    WORKFLOW       = "workflow",       "Workflow & Transitions"
    REPORTS        = "reports",        "Reports & Analytics"
    SECRETARIAT    = "secretariat",    "Secretariat Functions"
    TASKS          = "tasks",          "Task Allocation"
    ADMINISTRATION = "administration", "System Administration"


class SystemPermission(models.Model):
    """
    A named capability that can be granted to one or more roles.
    Built-in permissions are seeded at deploy time and cannot be deleted via the UI.
    Custom permissions may be added by administrators.
    """
    code        = models.CharField(max_length=100, unique=True)
    label       = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category    = models.CharField(
        max_length=50,
        choices=PermissionCategory.choices,
        default=PermissionCategory.ADMINISTRATION,
    )
    is_builtin  = models.BooleanField(default=False)

    class Meta:
        ordering = ["category", "code"]

    def __str__(self):
        return self.code


class RoleDefinition(models.Model):
    """
    Metadata and permission set for each system role.
    The `role` field maps 1-to-1 with Role TextChoices.
    Built-in role definitions cannot be deleted but their description and
    permissions can be updated by administrators.
    """
    role        = models.CharField(max_length=50, choices=Role.choices, unique=True)
    description = models.TextField(blank=True)
    is_builtin  = models.BooleanField(default=True)
    permissions = models.ManyToManyField(
        SystemPermission,
        blank=True,
        related_name="role_definitions",
    )

    class Meta:
        ordering = ["role"]

    def __str__(self):
        return self.get_role_display()


def _load_holiday_set(start_date, end_date=None):
    """Load public holidays from DB as a set of (year, month, day) tuples.

    Falls back to an empty set if the table doesn't exist yet (pre-migration).
    """
    if end_date is None:
        from datetime import date
        end_date = date(start_date.year + 2, 12, 31)
    try:
        from django.db import connection
        if 'tracker_publicholiday' not in connection.introspection.table_names():
            return set()
        return {
            (h.year, h.date.month, h.date.day)
            for h in PublicHoliday.objects.filter(
                date__gte=start_date, date__lte=end_date
            )
        }
    except Exception:
        return set()


def add_working_days(start_date, days: int):
    """Add ``days`` Mon–Fri working days, skipping Vanuatu public holidays.

    Holidays are read from the ``PublicHoliday`` model so they can be
    maintained by admins without code changes.
    """
    from datetime import date as _date
    # Normalise to a plain date if a datetime was passed
    if hasattr(start_date, 'date'):
        d = start_date.date()
    else:
        d = start_date

    # Load holidays for the probable date range (start + days * 2 to be safe)
    end_estimate = d + timedelta(days=days * 2 + 30)
    holidays = _load_holiday_set(d, end_estimate)

    added = 0
    while added < days:
        d += timedelta(days=1)
        if d.weekday() < 5 and (d.year, d.month, d.day) not in holidays:
            added += 1
    return d


def working_days_elapsed(start_dt, end_dt=None):
    end_dt = end_dt or timezone.now()
    if timezone.is_naive(start_dt):
        start_dt = timezone.make_aware(start_dt)
    if timezone.is_naive(end_dt):
        end_dt = timezone.make_aware(end_dt)
    s = timezone.localtime(start_dt).date()
    e = timezone.localtime(end_dt).date()
    if e < s:
        return 0
    
    # Same holidays list as above (should ideally be in a model or config)
    holidays = {
        (2025, 1, 1), (2025, 2, 21), (2025, 3, 5), (2025, 4, 18), (2025, 4, 21),
        (2025, 5, 1), (2025, 5, 29), (2025, 7, 24), (2025, 7, 30), (2025, 8, 15),
        (2025, 10, 5), (2025, 11, 29), (2025, 12, 25), (2025, 12, 26),
        (2026, 1, 1), (2026, 2, 21), (2026, 3, 5), (2026, 4, 3), (2026, 4, 6),
        (2026, 5, 1), (2026, 5, 14), (2026, 7, 24), (2026, 7, 30), (2026, 8, 15),
        (2026, 10, 5), (2026, 11, 29), (2026, 12, 25), (2026, 12, 26),
    }

    n = 0
    d = s
    while d <= e:
        if d.weekday() < 5 and (d.year, d.month, d.day) not in holidays:
            n += 1
        d += timedelta(days=1)
    return n


def allocate_reference_number():
    year = timezone.now().year
    with transaction.atomic():
        counter, _ = ReferenceCounter.objects.select_for_update().get_or_create(year=year, defaults={"last_seq": 0})
        counter.last_seq += 1
        counter.save(update_fields=["last_seq"])
        return f"PSC-{year}-{counter.last_seq:05d}"


def allocate_meeting_reference():
    year = timezone.now().year
    with transaction.atomic():
        counter, _ = ReferenceCounter.objects.select_for_update().get_or_create(year=year, defaults={"last_seq": 0})
        counter.last_seq += 1
        counter.save(update_fields=["last_seq"])
        return f"MTG-{year}-{counter.last_seq:03d}"


# ── User Feedback & Screenshot Reporting ──────────────────────────────────────

class FeedbackType(models.TextChoices):
    BUG               = "bug",               "Bug / Error"
    UI_ISSUE          = "ui_issue",          "UI / Layout Issue"
    WORKFLOW_PROBLEM  = "workflow_problem",  "Workflow Problem"
    SUGGESTION        = "suggestion",        "Suggestion / Enhancement"
    PERFORMANCE       = "performance",       "Performance Issue"
    SECURITY          = "security",          "Security Concern"
    OTHER             = "other",             "Other"


class FeedbackSeverity(models.TextChoices):
    LOW      = "low",      "Low"
    MEDIUM   = "medium",   "Medium"
    HIGH     = "high",     "High"
    CRITICAL = "critical", "Critical"


class FeedbackStatus(models.TextChoices):
    OPEN          = "open",          "Open"
    UNDER_REVIEW  = "under_review",  "Under Review"
    IN_PROGRESS   = "in_progress",   "In Progress"
    RESOLVED      = "resolved",      "Resolved"
    CLOSED        = "closed",        "Closed"
    REJECTED      = "rejected",      "Rejected"


class FeedbackReport(models.Model):
    title       = models.CharField(max_length=255)
    description = models.TextField()
    feedback_type = models.CharField(max_length=30, choices=FeedbackType.choices, default=FeedbackType.BUG)
    severity      = models.CharField(max_length=15, choices=FeedbackSeverity.choices, default=FeedbackSeverity.MEDIUM)
    status        = models.CharField(max_length=20, choices=FeedbackStatus.choices, default=FeedbackStatus.OPEN)

    # Media
    screenshot           = models.ImageField(upload_to="feedback/screenshots/", null=True, blank=True)
    annotated_screenshot = models.ImageField(upload_to="feedback/annotated/", null=True, blank=True)

    # Technical Context
    page_url      = models.URLField(max_length=1000, blank=True)
    module_name   = models.CharField(max_length=255, blank=True)
    browser_info  = models.TextField(blank=True)
    viewport_size = models.CharField(max_length=50, blank=True)
    system_version = models.CharField(max_length=50, blank=True)

    # Management
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feedback_reports"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_feedback"
    )

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "User Feedback"
        verbose_name_plural = "User Feedback Reports"

    def __str__(self):
        return f"[{self.feedback_type.upper()}] {self.title}"


class FeedbackComment(models.Model):
    report = models.ForeignKey(FeedbackReport, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body   = models.TextField()
    is_internal = models.BooleanField(
        default=False, help_text="Internal notes only visible to staff with manage permissions."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # AI-powered analysis fields (populated asynchronously)
    ai_summary        = models.TextField(blank=True, default="",
        help_text="AI-generated 1-sentence summary of the feedback.")
    ai_severity       = models.CharField(max_length=15, blank=True, default="",
        help_text="AI-assigned severity: Low, Medium, High, or Critical.")
    ai_category       = models.CharField(max_length=30, blank=True, default="",
        help_text="AI-assigned category: Bug, Feature Request, Legal/Compliance, or General Inquiry.")
    ai_translated_text = models.TextField(blank=True, default="",
        help_text="AI-translated English version of the original feedback.")
    ai_processed      = models.BooleanField(default=False,
        help_text="True once the AI has finished analysing this comment.")

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.author.username} on {self.report_id}"


class Notification(models.Model):
    class Channel(models.TextChoices):
        IN_APP = "in_app", "In-App"
        EMAIL = "email", "Email"
        BOTH = "both", "Both"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name="notifications", null=True, blank=True
    )
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.BOTH)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    link = models.CharField(
        max_length=512, blank=True, default="",
        help_text="In-app path opened when the notification is clicked (falls back to the submission page).",
    )
    is_read = models.BooleanField(default=False)
    emailed = models.BooleanField(default=False)
    push = models.BooleanField(
        default=False,
        help_text="Send a mobile/desktop web-push for this notification (important events only).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title}"


class Comment(models.Model):
    """
    Polymorphic discussion comment (A7 Collaboration).

    Attached to any collaboratable object (Submission first; Meeting / CommissionTask
    later) via a GenericForeignKey so the thread is built once and reused. As part of
    the government record, comments are **soft-deleted only** and edits keep a history
    counter; every write is mirrored to the AuditLog by the API layer.
    """

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="comments_authored",
    )
    body = models.TextField()
    # One level of threading (replies). Null = top-level comment.
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="replies",
    )
    # PSC-only note: hidden from ministry-side users even when they can see the object.
    is_internal = models.BooleanField(
        default=False,
        help_text="If true, only PSC staff can see this comment (ministry firewall).",
    )

    # ── Evidentiary fields (official record) ──────────────────────────────────
    edited_at = models.DateTimeField(null=True, blank=True)
    edit_count = models.PositiveIntegerField(default=0)
    is_deleted = models.BooleanField(default=False)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="comments_deleted",
    )
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(
                fields=["content_type", "object_id", "created_at"],
                name="tracker_com_content_2b9d6e_idx",
            ),
        ]

    def __str__(self):
        return f"Comment {self.pk} by {self.author_id} on {self.content_type_id}:{self.object_id}"


class Mention(models.Model):
    """
    A staff @mention inside a Comment (A7 P2). Derived from the comment body on save
    so notifications and rendering are reliable (not re-parsed). Each row that passes
    the RBAC/firewall check fans out one Notification (in-app + email).
    """

    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name="mentions",
    )
    mentioned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mentions_received",
    )
    notified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("comment", "mentioned_user")

    def __str__(self):
        return f"Mention of {self.mentioned_user_id} in comment {self.comment_id}"


class DeadlineReminderDraft(models.Model):
    """AI-drafted personalised deadline reminder email (F2) — review before send."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        CANCELLED = "cancelled", "Cancelled"

    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="deadline_reminder_drafts",
    )
    recipient_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deadline_reminder_drafts",
    )
    recipient_email = models.EmailField()
    recipient_name = models.CharField(max_length=255)
    recipient_role = models.CharField(max_length=64, blank=True)
    ministry = models.ForeignKey(
        "Ministry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deadline_reminder_drafts",
    )
    stage = models.CharField(max_length=64)
    deadline_at = models.DateTimeField()
    outstanding_summary = models.TextField(blank=True)
    consequence_note = models.TextField(blank=True)
    subject = models.CharField(max_length=500)
    body = models.TextField()
    subject_bi = models.CharField(max_length=500, blank=True)
    body_bi = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    drafted_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-drafted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["submission", "recipient_email", "stage", "deadline_at"],
                name="uniq_deadline_reminder_draft",
            ),
        ]

    def __str__(self):
        return f"Deadline draft — {self.submission.reference_number} → {self.recipient_email}"


class MinutesStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    REVIEWED = "reviewed", "Reviewed"
    # Minutes have been finalised and printed for manual (wet-ink) signature at
    # the next sitting; awaiting the scanned signed copy. Interim state until the
    # DCDT digital-signature policy is in force.
    AWAITING_SIGNATURE = "awaiting_signature", "Awaiting Signature"
    SIGNED = "signed", "Signed"


class Minutes(models.Model):
    """Formal minutes document for a Commission sitting."""

    meeting = models.OneToOneField(Meeting, on_delete=models.CASCADE, related_name="minutes")
    status = models.CharField(max_length=20, choices=MinutesStatus.choices, default=MinutesStatus.DRAFT)
    content = models.JSONField(
        default=dict, blank=True,
        help_text=(
            "Structured minutes content as JSON. "
            "Top-level keys: opening, confirmation_previous_minutes, agenda_items (list), "
            "any_other_business, closing, next_meeting_date."
        ),
    )
    pdf_version = models.FileField(
        upload_to="minutes/", null=True, blank=True,
        help_text="Generated (unsigned) PDF used for printing and for digital signing.",
    )
    # ── Manual (wet-ink) signature, interim until DCDT digital-signature policy ──
    # The formatted minutes are printed, signed on paper by the Chairperson and
    # Commissioners at the next sitting, then the scanned signed copy is uploaded
    # here for reference. Kept separate from ``pdf_version`` so the generated
    # print copy is never overwritten.
    signed_document = models.FileField(
        upload_to="minutes/signed/", null=True, blank=True,
        help_text="Scanned copy of the manually (wet-ink) signed minutes.",
    )
    signed_uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="uploaded_signed_minutes",
        help_text="Senior Admin Officer who uploaded the scanned signed minutes.",
    )
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="signed_minutes",
    )
    signed_at = models.DateTimeField(null=True, blank=True)
    # ── Post-meeting SLA enforcement (SOP Stage 3, steps 7-8) ─────────────
    circulated_at = models.DateTimeField(null=True, blank=True,
        help_text="When signed minutes were circulated to managers for task allocation.")
    minutes_due_at = models.DateTimeField(null=True, blank=True,
        help_text="SLA: minutes must be finalised within 3 days of the meeting.")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="created_minutes",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-meeting__date"]
        verbose_name_plural = "Minutes"

    def __str__(self):
        return f"Minutes — {self.meeting.reference_number} ({self.get_status_display()})"


class MinuteAgendaIntake(models.Model):
    """
    Per-agenda-item minute capture during/after a sitting.
    Claude formats plain-English notes into PSC-style minute blocks.
    """

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="minute_intakes")
    agenda_item = models.ForeignKey(
        AgendaItem, on_delete=models.CASCADE, related_name="minute_intake",
    )
    agenda_title = models.CharField(max_length=512)
    agenda_description = models.TextField(
        blank=True,
        help_text="From approved agenda (blurb / submission summary).",
    )
    discussion_notes = models.TextField(
        blank=True,
        help_text="Plain English discussion notes from the minute-taker.",
    )
    decision_text = models.TextField(
        blank=True,
        help_text="Free-text decision notes from the minute-taker.",
    )
    action_officer = models.CharField(
        max_length=255,
        blank=True,
        help_text="Officer or unit responsible for follow-up.",
    )
    formatted_discussion = models.TextField(blank=True)
    formatted_decision = models.TextField(blank=True)
    formatted_decision_type = models.CharField(max_length=32, blank=True)
    formatted_action_items = models.JSONField(default=list, blank=True)
    formatted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["agenda_item__sequence", "agenda_item__id"]
        constraints = [
            models.UniqueConstraint(
                fields=["meeting", "agenda_item"],
                name="uniq_minute_intake_per_agenda_item",
            ),
        ]

    def __str__(self):
        return f"Intake — {self.meeting.reference_number} / {self.agenda_title[:40]}"


class MeetingTranscript(models.Model):
    """AI-generated transcript and structured analysis of a meeting recording."""

    meeting = models.OneToOneField(Meeting, on_delete=models.CASCADE, related_name="transcript")
    source = models.CharField(
        max_length=16,
        choices=TranscriptSource.choices,
        default=TranscriptSource.ZOOM_ASR,
        help_text="Origin of raw_text (Zoom ASR paste, AI transcribe, etc.).",
    )
    raw_text = models.TextField(
        blank=True, help_text="Full verbatim transcript from AI transcription.",
    )
    structured_data = models.JSONField(
        default=dict, blank=True,
        help_text="AI-extracted structured data: speakers, topics, decisions, actions.",
    )
    audio_file = models.CharField(
        max_length=255, blank=True,
        help_text="Filename of the source audio recording in MEDIA_ROOT/recordings/.",
    )
    ai_processed = models.BooleanField(
        default=False, help_text="True once transcription is complete.",
    )
    transcription_status = models.CharField(
        max_length=16,
        choices=TranscriptionStatus.choices,
        default=TranscriptionStatus.IDLE,
        blank=True,
    )
    transcription_error = models.TextField(
        blank=True,
        help_text="Last pipeline error message when transcription_status is failed.",
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Transcript — {self.meeting.reference_number}"


# ── Organisation Restructure Submission (Section 3.1 template) ───────────────

class RestructureSubmissionData(models.Model):
    """
    Structured data for an Organisation Restructure / Establishment Variation
    submission (PSC Section 3.1 standard template).

    Filled by the Ministry/Department HR officer. One record per Submission.
    The costing table rows are stored as a JSON array so that the number of
    position rows can vary per submission.

    costing_rows schema (list of dicts):
    {
      "current_post_no":    str,
      "current_title":      str,     # Title / Occupant
      "current_level":      str,     # Level / Grade
      "current_salary":     str,     # VT amount as string
      "proposed_post_no":   str,
      "proposed_title":     str,
      "proposed_level":     str,
      "proposed_salary":    str,
      "salary_difference":  str,     # +/- VT amount
    }
    """

    submission = models.OneToOneField(
        Submission, on_delete=models.CASCADE,
        related_name="restructure_data",
    )

    # ── Cover ─────────────────────────────────────────────────────────────────
    subject_title = models.CharField(
        max_length=512, blank=True,
        help_text="Full subject/title of the proposal, e.g. 'Proposal to Revise the Organisation Structure …'",
    )

    # ── Section 1 — Background ────────────────────────────────────────────────
    background = models.TextField(blank=True)

    # ── Section 2 — Proposal ─────────────────────────────────────────────────
    proposal = models.TextField(blank=True)

    # ── Section 3 — Costing ───────────────────────────────────────────────────
    costing_rows = models.JSONField(
        default=list, blank=True,
        help_text="Array of position rows for the costing table (see model docstring).",
    )
    costing_notes = models.TextField(
        blank=True,
        help_text="Notes below the table (vacancy funding, part-year calculations, etc.).",
    )

    # ── Section 4 — Implementation Plan ──────────────────────────────────────
    implementation_plan = models.TextField(blank=True)

    # ── Section 5 — Recommendation ───────────────────────────────────────────
    recommendation = models.TextField(blank=True)

    # ── Director sign-off ────────────────────────────────────────────────────
    director_name = models.CharField(max_length=255, blank=True)
    director_date = models.DateField(null=True, blank=True)

    # ── Attachments checklist ─────────────────────────────────────────────────
    attach_current_org_chart  = models.BooleanField(default=False)
    attach_proposed_org_chart = models.BooleanField(default=False)
    attach_job_descriptions   = models.BooleanField(default=False)
    attach_other              = models.BooleanField(default=False)
    attach_other_description  = models.CharField(max_length=512, blank=True)

    # ── Director-General endorsement ──────────────────────────────────────────
    dg_endorses = models.BooleanField(
        null=True, blank=True,
        help_text="True = I support / endorse; False = I do not support.",
    )
    dg_name = models.CharField(max_length=255, blank=True)
    dg_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Restructure Submission Data"
        verbose_name_plural = "Restructure Submission Data"

    def __str__(self):
        return f"Restructure — {self.submission.reference_number}"


# ── ODU Restructure Submission Checklist ──────────────────────────────────────

class ODUChecklistStatus(models.TextChoices):
    DRAFT     = "draft",     "Draft"
    SUBMITTED = "submitted", "Submitted"
    APPROVED  = "approved",  "Approved"


class ODURestructureChecklist(models.Model):
    """
    Digital version of the OPSC ODU Checklist for Restructure Submissions.
    One per submission; completed by the ODU Principal Job Analyst and
    finalised by the Manager ODU before forwarding to the Commission.
    """

    submission = models.OneToOneField(
        Submission, on_delete=models.CASCADE,
        related_name="odu_checklist",
        help_text="The restructure submission this checklist belongs to.",
    )
    status = models.CharField(
        max_length=12, choices=ODUChecklistStatus.choices,
        default=ODUChecklistStatus.DRAFT, db_index=True,
    )

    # ── Section A — Submission Information ───────────────────────────────────
    ministry_department = models.CharField(max_length=255, blank=True)
    division_unit       = models.CharField(max_length=255, blank=True)

    class SubmissionType(models.TextChoices):
        FULL_RESTRUCTURE = "full_restructure", "Full Restructure"
        PARTIAL_REVIEW   = "partial_review",   "Partial Review"
        NEW_JD           = "new_jd",           "New Job Description"
        AMENDMENT        = "amendment",        "Amendment"

    submission_type = models.CharField(
        max_length=20, choices=SubmissionType.choices, blank=True,
    )
    odu_officer_assigned = models.CharField(max_length=255, blank=True)
    manager_odu          = models.CharField(max_length=255, blank=True)

    # ── Section B — Verification Checklist (20 yes/no items) ─────────────────
    # Each item: True = Yes, False = No, None = Not yet answered
    # Group 1: Submission Completeness
    b1_cover_letter         = models.BooleanField(null=True, blank=True)
    b2_org_chart            = models.BooleanField(null=True, blank=True)
    b3_positions_list       = models.BooleanField(null=True, blank=True)
    b4_jds_attached         = models.BooleanField(null=True, blank=True)
    b5_rationale_stated     = models.BooleanField(null=True, blank=True)
    # Group 2: Structure Compliance
    b6_mandate_alignment    = models.BooleanField(null=True, blank=True)
    b7_reporting_lines      = models.BooleanField(null=True, blank=True)
    b8_no_duplication       = models.BooleanField(null=True, blank=True)
    b9_span_of_control      = models.BooleanField(null=True, blank=True)
    # Group 3: Job Description Verification
    b10_job_purpose_linked  = models.BooleanField(null=True, blank=True)
    b11_kra_kta_kpi         = models.BooleanField(null=True, blank=True)
    b12_competencies        = models.BooleanField(null=True, blank=True)
    b13_qual_experience     = models.BooleanField(null=True, blank=True)
    # Group 4: Financial Implications
    b14_cost_analysis       = models.BooleanField(null=True, blank=True)
    b15_grt_mapping         = models.BooleanField(null=True, blank=True)
    b16_consultation        = models.BooleanField(null=True, blank=True)
    # Group 6: ODU Review & Feedback (no Group 5 in source doc)
    b17_odu_analysis        = models.BooleanField(null=True, blank=True)
    b18_feedback_provided   = models.BooleanField(null=True, blank=True)
    # Group 7: Documentation for Commission
    b19_final_docs_ready    = models.BooleanField(null=True, blank=True)
    b20_manager_final_check = models.BooleanField(null=True, blank=True)

    # ── Section C — ODU Officer Recommendation ───────────────────────────────
    class Recommendation(models.TextChoices):
        VERIFIED      = "verified",      "Submission verified and ready for Commission submission"
        NEEDS_REVISION = "needs_revision", "Submission requires revision before further processing"
        INCOMPLETE    = "incomplete",    "Submission incomplete — return to Ministry for clarification"

    recommendation = models.CharField(
        max_length=20, choices=Recommendation.choices, blank=True,
    )
    officer_comments = models.TextField(blank=True)

    # ── Section D — Authorization ─────────────────────────────────────────────
    verifying_officer_name  = models.CharField(max_length=255, blank=True)
    verifying_officer_date  = models.DateField(null=True, blank=True)
    manager_verifier_name   = models.CharField(max_length=255, blank=True)
    manager_verifier_date   = models.DateField(null=True, blank=True)

    # ── Meta ──────────────────────────────────────────────────────────────────
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="odu_checklists_created",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name        = "ODU Restructure Checklist"
        verbose_name_plural = "ODU Restructure Checklists"

    def __str__(self):
        return f"ODU Checklist — {self.submission.reference_number} ({self.get_status_display()})"

    @property
    def items_answered(self):
        """Count of the 20 Section B items that have been answered (not None)."""
        fields = [
            self.b1_cover_letter, self.b2_org_chart, self.b3_positions_list,
            self.b4_jds_attached, self.b5_rationale_stated,
            self.b6_mandate_alignment, self.b7_reporting_lines,
            self.b8_no_duplication, self.b9_span_of_control,
            self.b10_job_purpose_linked, self.b11_kra_kta_kpi,
            self.b12_competencies, self.b13_qual_experience,
            self.b14_cost_analysis, self.b15_grt_mapping, self.b16_consultation,
            self.b17_odu_analysis, self.b18_feedback_provided,
            self.b19_final_docs_ready, self.b20_manager_final_check,
        ]
        return sum(1 for f in fields if f is not None)

    @property
    def items_yes(self):
        """Count of items answered Yes."""
        fields = [
            self.b1_cover_letter, self.b2_org_chart, self.b3_positions_list,
            self.b4_jds_attached, self.b5_rationale_stated,
            self.b6_mandate_alignment, self.b7_reporting_lines,
            self.b8_no_duplication, self.b9_span_of_control,
            self.b10_job_purpose_linked, self.b11_kra_kta_kpi,
            self.b12_competencies, self.b13_qual_experience,
            self.b14_cost_analysis, self.b15_grt_mapping, self.b16_consultation,
            self.b17_odu_analysis, self.b18_feedback_provided,
            self.b19_final_docs_ready, self.b20_manager_final_check,
        ]
        return sum(1 for f in fields if f is True)


class StaffChatSession(models.Model):
    """Per-user conversation thread for Staff Assistant or Status Assistant."""

    class Purpose(models.TextChoices):
        STAFF = "staff", "Staff Assistant"
        STATUS = "status", "Status Assistant"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_chat_sessions",
    )
    purpose = models.CharField(
        max_length=16,
        choices=Purpose.choices,
        default=Purpose.STAFF,
        db_index=True,
    )
    title = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"Chat #{self.pk}"


class StaffChatMessage(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"

    session = models.ForeignKey(
        StaffChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class UiTranslation(models.Model):
    """
    Dashboard UI string overrides (i18next keys).
    Bundled en/fr/bi JSON files are the baseline; rows here override at runtime.
    """

    key = models.CharField(max_length=255, unique=True, db_index=True)
    namespace = models.CharField(max_length=64, db_index=True, blank=True, default="")
    text_en = models.TextField(blank=True)
    text_fr = models.TextField(blank=True)
    text_bi = models.TextField(blank=True)
    is_customized = models.BooleanField(
        default=False,
        help_text="True when an administrator edited values in the UI.",
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ui_translation_updates",
    )

    class Meta:
        ordering = ["namespace", "key"]
        verbose_name = "UI translation"
        verbose_name_plural = "UI translations"

    def save(self, *args, **kwargs):
        if not self.namespace:
            from .i18n_utils import namespace_from_key

            self.namespace = namespace_from_key(self.key)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.key


class WebPushSubscription(models.Model):
    """Stores browser Web Push subscriptions per user."""
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint   = models.TextField(unique=True)
    p256dh_key = models.TextField()
    auth_key   = models.TextField()
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Push subscription for {self.user.username}"


class DocumentVersion(models.Model):
    """Tracks uploaded versions of a submission document."""
    document    = models.ForeignKey('SubmissionDocument', on_delete=models.CASCADE, related_name="versions")
    version_num = models.PositiveSmallIntegerField(default=1)
    file        = models.FileField(upload_to='documents/versions/')
    filename    = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    notes       = models.TextField(blank=True)
    is_current  = models.BooleanField(default=True)

    class Meta:
        ordering = ["-version_num"]
        unique_together = [("document", "version_num")]

    def __str__(self):
        return f"{self.document} v{self.version_num}"


class SavedExploration(models.Model):
    """A named SCDMS Intelligence exploration (dataset + query spec).

    Lets users save and reload an explorer view without a long share URL. Each
    is owned by a user; `is_shared` makes it visible to everyone who can use
    Intelligence (read-only for non-owners).
    """

    name = models.CharField(max_length=200)
    dataset = models.CharField(max_length=64)
    spec = models.JSONField(default=dict, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_explorations",
    )
    is_shared = models.BooleanField(
        default=False,
        help_text="Visible to everyone who can use SCDMS Intelligence.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["owner", "-updated_at"], name="intel_saved_owner_upd_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({self.dataset})"


class Dashboard(models.Model):
    """A composed board of SCDMS Intelligence chart tiles.

    Each tile is a self-contained snapshot — ``{id, title, dataset, spec,
    chart_type, width}`` — so a dashboard keeps working even if the saved
    exploration it was pinned from is later edited or deleted. Owned by a user;
    ``is_shared`` makes it visible (read-only) to everyone who can use
    Intelligence.
    """

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    tiles = models.JSONField(default=list, blank=True)
    # Native filter definitions: [{id, type: "category"|"time", col, label, default}].
    # Applied across every tile whose dataset has the referenced column.
    filters = models.JSONField(default=list, blank=True)
    # Organisation: tabs [{id, label}] (tiles carry a `tab` id) and free-text tags.
    tabs = models.JSONField(default=list, blank=True)
    tags = models.JSONField(default=list, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="intelligence_dashboards",
    )
    is_shared = models.BooleanField(
        default=False,
        help_text="Visible to everyone who can use SCDMS Intelligence.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["owner", "-updated_at"], name="intel_dash_owner_upd_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({len(self.tiles or [])} tiles)"


class IntelligenceFavorite(models.Model):
    """A user's starred dashboard."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="intelligence_favorites",
    )
    dashboard = models.ForeignKey(
        Dashboard, on_delete=models.CASCADE, related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "dashboard")
        indexes = [models.Index(fields=["user"], name="intel_fav_user_idx")]

    def __str__(self):
        return f"{self.user_id} ★ {self.dashboard_id}"


class IntelligenceReport(models.Model):
    """A scheduled SCDMS Intelligence report or threshold alert.

    Runs a saved query (as its owner, so RBAC scoping applies) on a
    daily / weekly / monthly cadence and emails the result table with a link to
    the live chart. For ``kind="alert"`` the email is only sent when the chosen
    metric crosses a threshold.
    """

    class Kind(models.TextChoices):
        REPORT = "report", "Scheduled report"
        ALERT = "alert", "Alert"

    class Frequency(models.TextChoices):
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"

    class Operator(models.TextChoices):
        GT = "gt", "greater than"
        GTE = "gte", "at least"
        LT = "lt", "less than"
        LTE = "lte", "at most"

    class Status(models.TextChoices):
        SENT = "sent", "Sent"
        TRIGGERED = "triggered", "Alert triggered"
        OK = "ok", "Checked — no alert"
        SKIPPED = "skipped", "Skipped"
        FAILED = "failed", "Failed"

    name = models.CharField(max_length=200)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="intelligence_reports",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.REPORT)
    dataset = models.CharField(max_length=64)
    spec = models.JSONField(default=dict, blank=True)

    # Alert condition (used when kind == "alert"): metric total vs threshold.
    alert_metric = models.CharField(max_length=64, blank=True)
    alert_operator = models.CharField(max_length=8, choices=Operator.choices, blank=True)
    alert_threshold = models.FloatField(null=True, blank=True)

    # Schedule — evaluated in Pacific/Efate local time.
    frequency = models.CharField(max_length=16, choices=Frequency.choices, default=Frequency.DAILY)
    hour = models.PositiveSmallIntegerField(default=7, help_text="Hour (0–23) to send.")
    day_of_week = models.PositiveSmallIntegerField(default=0, help_text="Weekly: 0=Mon … 6=Sun.")
    day_of_month = models.PositiveSmallIntegerField(default=1, help_text="Monthly: 1–28.")
    recipients = models.JSONField(default=list, blank=True, help_text="List of email addresses.")

    is_active = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=16, choices=Status.choices, blank=True)
    last_value = models.FloatField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["is_active", "frequency"], name="intel_report_active_idx"),
        ]

    def __str__(self):
        return f"{self.name} [{self.kind}]"


class SubmissionRule(models.Model):
    """A FlagGuard-style rule that flags at-risk submissions.

    Conditions are a flat list of ``{field, op, value}`` leaves combined with
    ``match`` (all=AND / any=OR). The evaluator translates each leaf into a
    validated ORM ``Q`` (whitelist only — no raw SQL), so rules inherit the same
    safety posture as SCDMS Intelligence.
    """

    class Level(models.TextChoices):
        CRITICAL = "critical", "Critical"
        AT_RISK = "at_risk", "At risk"
        MONITORING = "monitoring", "Monitoring"

    class Match(models.TextChoices):
        ALL = "all", "Match all (AND)"
        ANY = "any", "Match any (OR)"

    class Entity(models.TextChoices):
        SUBMISSION = "submission", "Submission"
        COMMISSION_TASK = "commission_task", "Commission task"
        MEETING = "meeting", "Meeting / minutes"

    name = models.CharField(max_length=200)
    description = models.CharField(max_length=300, blank=True)
    entity = models.CharField(max_length=20, choices=Entity.choices, default=Entity.SUBMISSION)
    level = models.CharField(max_length=16, choices=Level.choices, default=Level.AT_RISK)
    conditions = models.JSONField(default=list, blank=True)
    match = models.CharField(max_length=4, choices=Match.choices, default=Match.ALL)

    is_active = models.BooleanField(default=True)
    is_builtin = models.BooleanField(default=False, help_text="Seeded rule migrated from SLA/escalation logic.")
    test_mode = models.BooleanField(default=False, help_text="Evaluate and flag, but send no alert emails.")
    cooldown_minutes = models.PositiveIntegerField(default=60)
    realert = models.BooleanField(
        default=False,
        help_text="Re-alert an open flag every cooldown window (anti-spam); off = alert once.",
    )

    notify_assignee = models.BooleanField(default=True)
    notify_roles = models.JSONField(default=list, blank=True, help_text="Profile role keys to alert.")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="submission_rules",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} [{self.level}]"


class SubmissionFlag(models.Model):
    """An open/acknowledged/cleared flag raised by a SubmissionRule on a submission."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        CLEARED = "cleared", "Cleared"

    rule = models.ForeignKey(SubmissionRule, on_delete=models.CASCADE, related_name="flags")
    # Exactly one entity FK is set, per the rule's entity type.
    submission = models.ForeignKey(
        Submission, null=True, blank=True, on_delete=models.CASCADE, related_name="flags")
    commission_task = models.ForeignKey(
        "CommissionTask", null=True, blank=True, on_delete=models.CASCADE, related_name="flags")
    meeting = models.ForeignKey(
        "Meeting", null=True, blank=True, on_delete=models.CASCADE, related_name="flags")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    opened_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="acknowledged_flags",
    )
    cleared_at = models.DateTimeField(null=True, blank=True)
    last_alerted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-opened_at"]
        indexes = [
            models.Index(fields=["status"], name="subflag_status_idx"),
            models.Index(fields=["rule", "status"], name="subflag_rule_status_idx"),
        ]

    def __str__(self):
        return f"{self.rule_id} ({self.status})"


class Automation(models.Model):
    """Act engine: trigger → conditions → actions on an entity.

    Reuses the Watch condition layer (same field catalogs / Q translator). Actions
    are a safe set (notify / escalate / comment / tag / create task / remind /
    shift due date). Stage transitions are intentionally not auto-applied here.
    """

    class Entity(models.TextChoices):
        SUBMISSION = "submission", "Submission"
        COMMISSION_TASK = "commission_task", "Commission task"
        MEETING = "meeting", "Meeting / minutes"

    class Trigger(models.TextChoices):
        CREATED = "created", "On create"
        UPDATED = "updated", "On update"
        SCHEDULE = "schedule", "On schedule (periodic)"

    class Match(models.TextChoices):
        ALL = "all", "Match all (AND)"
        ANY = "any", "Match any (OR)"

    name = models.CharField(max_length=200)
    description = models.CharField(max_length=300, blank=True)
    entity = models.CharField(max_length=20, choices=Entity.choices, default=Entity.SUBMISSION)
    trigger = models.CharField(max_length=16, choices=Trigger.choices, default=Trigger.UPDATED)
    conditions = models.JSONField(default=list, blank=True)
    match = models.CharField(max_length=4, choices=Match.choices, default=Match.ALL)
    actions = models.JSONField(default=list, blank=True, help_text="Ordered [{type, params}] actions.")

    is_active = models.BooleanField(default=True)
    test_mode = models.BooleanField(default=False, help_text="Simulate — log actions but make no changes.")
    cooldown_minutes = models.PositiveIntegerField(default=60)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="automations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["is_active", "entity", "trigger"], name="automation_active_idx")]

    def __str__(self):
        return f"{self.name} [{self.entity}/{self.trigger}]"


class AutomationRun(models.Model):
    """Immutable log of an automation firing on one entity."""

    class Status(models.TextChoices):
        RAN = "ran", "Ran"
        SIMULATED = "simulated", "Simulated"
        FAILED = "failed", "Failed"

    automation = models.ForeignKey(Automation, on_delete=models.CASCADE, related_name="runs")
    submission = models.ForeignKey(Submission, null=True, blank=True, on_delete=models.CASCADE, related_name="automation_runs")
    commission_task = models.ForeignKey("CommissionTask", null=True, blank=True, on_delete=models.CASCADE, related_name="automation_runs")
    meeting = models.ForeignKey("Meeting", null=True, blank=True, on_delete=models.CASCADE, related_name="automation_runs")
    trigger = models.CharField(max_length=16, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.RAN)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["automation", "-created_at"], name="automationrun_idx")]

    def __str__(self):
        return f"{self.automation_id} {self.status} @ {self.created_at:%Y-%m-%d}"


# ── Compliance Case Management models (merged in) ──────────────────────────────
# Defined in a sibling module and imported here so Django discovers them as part of
# the ``tracker`` app. The import sits at the bottom of this file because the
# compliance models reference ``Submission`` / ``Ministry`` / ``ReferenceCounter``
# defined above.
from .compliance_models import (  # noqa: E402,F401
    CaseFamily,
    CaseNote,
    Complaint,
    ComplaintStatus,
    ComplianceCase,
    ComplianceCaseStage,
    ComplianceCaseStatus,
    ComplianceDecisionOutcome,
    LitigationRecord,
    SLAStatus,
    StageStatus,
)
