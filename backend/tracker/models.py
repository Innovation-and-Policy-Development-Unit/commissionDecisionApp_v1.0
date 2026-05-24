import os
import secrets
from datetime import datetime, time, timedelta

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class Role(models.TextChoices):
    # ── PSC Internal roles ──────────────────────────────────────────────────
    PSC_ADMIN              = "psc_admin",              "PSC Administrator"
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
    COMPLIANCE_PRINCIPAL  = "compliance_principal",  "Compliance Principal"


class WorkflowStage(models.TextChoices):
    # ── Ministry pre-submission ─────────────────────────────────────────────
    DRAFT                      = "draft",                      "Draft"
    SUBMITTED                  = "submitted",                  "Submitted to PSC"
    # ── PSC intake ─────────────────────────────────────────────────────────
    RECEIVED_BY_PSC            = "received_by_psc",            "Received by PSC"
    RETURNED_FOR_CLARIFICATION = "returned_for_clarification", "Returned for Clarification"
    REGISTERED_ROUTED          = "registered_routed",          "Registered and Routed"
    MANAGER_CHECKLIST_REVIEW   = "manager_checklist_review",   "Manager Checklist Review"
    UNDER_ASSESSMENT           = "under_assessment",           "Under Assessment"
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
    REJECTED                   = "rejected",                   "Rejected"
    RETURNED                   = "returned",                   "Returned"
    DEFERRED_BACK_TO_HR        = "deferred_back_to_hr",        "Deferred Back to HR"
    # ── Internal submission (OPSC-only, Secretary review) ─────────────────
    SECRETARY_REVIEW           = "secretary_review",           "Secretary Review"
    # ── Post-decision ──────────────────────────────────────────────────────
    MINUTES_DRAFTED_SIGNED     = "minutes_drafted_signed",     "Minutes Drafted and Signed"
    DECISION_ENTERED_ASSIGNED  = "decision_entered_assigned",  "Decision Entered and Assigned"
    UNDER_IMPLEMENTATION       = "under_implementation",       "Under Implementation"
    IMPLEMENTATION_REPORT      = "implementation_report",      "Implementation Report"


class MeetingStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class AgendaStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    WITH_CHAIRMAN = "with_chairman", "With Chairman for Approval"
    CHAIRMAN_APPROVED = "chairman_approved", "Chairman Approved"
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["ministry", "name"]
        constraints = [
            models.UniqueConstraint(fields=["ministry", "code"], name="uniq_department_code_per_ministry"),
        ]

    def __str__(self):
        return f"{self.name} ({self.ministry.code})"


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
    display_order = models.IntegerField(default=0)
    agenda_category = models.CharField(
        max_length=32,
        choices=AgendaCategory.choices,
        default=AgendaCategory.OTHER,
        blank=True,
        help_text=(
            "Which PSC agenda section this form type belongs to. "
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
    AI_WHISPER = "ai_whisper", "AI-assisted transcript (text via Claude)"
    MANUAL_PASTE = "manual_paste", "Manual paste"


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
    # ── Agenda approval gate (SOP Stage 3, steps 2-3) ─────────────────────
    agenda_status = models.CharField(
        max_length=24, choices=AgendaStatus.choices, default=AgendaStatus.DRAFT,
        help_text="Tracking: draft → with Chairman → Chairman approved → circulated.",
    )
    agenda_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="agendas_approved",
        help_text="Chairperson who reviewed and approved the agenda.",
    )
    agenda_approved_at = models.DateTimeField(null=True, blank=True)
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

    def save(self, *args, **kwargs):
        if not self.reference_number:
            self.reference_number = allocate_meeting_reference()
        super().save(*args, **kwargs)


class AgendaItem(models.Model):
    meeting    = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="agenda_items")
    submission = models.ForeignKey("Submission", on_delete=models.CASCADE, related_name="agenda_placements")
    sequence   = models.PositiveIntegerField(default=0, help_text="Order within the category group.")
    category   = models.CharField(
        max_length=32, choices=AgendaCategory.choices, default=AgendaCategory.OTHER,
        help_text="Agenda section this item belongs to.",
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
        return f"{self.meeting.reference_number} [{self.get_category_display()}] #{self.sequence}: {self.submission.reference_number}"


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


class KnowledgeArticle(models.Model):
    """Individual documents/articles within the OPSC Knowledge Base."""
    category = models.ForeignKey(KnowledgeCategory, on_delete=models.CASCADE, related_name="articles")
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    content = models.TextField(help_text="Markdown content for the article.")
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


class Submission(models.Model):
    reference_number = models.CharField(max_length=32, unique=True, editable=False)
    title = models.CharField(max_length=512)
    form_category = models.ForeignKey(FormCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="submissions")
    form_type_code = models.CharField(max_length=64, blank=True, help_text='e.g. "PSC 3.6"')
    ministry = models.ForeignKey(Ministry, on_delete=models.PROTECT, related_name="submissions")
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="submissions"
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
        help_text="Unit principal this submission has been assigned to by the unit manager.",
    )
    assigned_at = models.DateTimeField(null=True, blank=True)
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
    # ── CMS integration ────────────────────────────────────────────────────
    cms_case_id        = models.CharField(max_length=50, blank=True, default="",
        help_text="Primary key of the corresponding Case in the CMS (set after dispatch).")
    cms_case_reference = models.CharField(max_length=50, blank=True, default="",
        help_text="Human-readable CMS reference, e.g. CCMS-SM-2026-0001.")
    cms_dispatched_at  = models.DateTimeField(null=True, blank=True,
        help_text="When the submission was successfully dispatched to the CMS.")
    cms_signoff_at     = models.DateTimeField(null=True, blank=True,
        help_text="When the CMS compliance manager signed off and returned the submission.")
    cms_signoff_outcome = models.CharField(max_length=255, blank=True, default="",
        help_text="Outcome note from the CMS sign-off callback.")
    cms_case_closed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When SCDMS notified CMS to close the linked case after portal completion.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="submissions_logged"
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference_number} — {self.title}"

    def _set_assessment_deadline_from_start(self):
        if not self.assessment_started_at:
            self.assessment_deadline_at = None
            return
        start_local = timezone.localtime(self.assessment_started_at)
        deadline_date = add_working_days(start_local.date(), 21)
        tz = timezone.get_current_timezone()
        self.assessment_deadline_at = timezone.make_aware(datetime.combine(deadline_date, time(23, 59, 59)), tz)

    @property
    def is_assessment_overdue(self):
        if self.current_stage != WorkflowStage.UNDER_ASSESSMENT:
            return False
        if not self.assessment_deadline_at:
            return False
        return timezone.now() > self.assessment_deadline_at

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


class SubmissionDocument(models.Model):
    """A file uploaded to a submission (DG-endorsed letter, position desc, etc.)."""
    submission = models.ForeignKey(
        'Submission', on_delete=models.CASCADE, related_name='documents',
    )
    file = models.FileField(upload_to=_submission_doc_path)
    original_name = models.CharField(max_length=255)
    description = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
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
    """A document that must be present before a submission can pass checklist review.

    Scoping rules (evaluated in order — most specific wins):
      form_type set   → applies only to submissions of that exact form type
      form_category set (form_type null) → applies to all submissions in that category
      both null       → applies to every submission
    """
    form_category = models.ForeignKey(
        FormCategory, null=True, blank=True,
        on_delete=models.CASCADE, related_name='required_documents',
        help_text="Leave blank to apply to all form categories.",
    )
    form_type = models.ForeignKey(
        'PSCFormType', null=True, blank=True,
        on_delete=models.CASCADE, related_name='required_documents',
        help_text="When set, applies only to submissions of this specific form type (overrides form_category).",
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['form_category', 'form_type', 'order', 'name']
        verbose_name = "Required Document"
        verbose_name_plural = "Required Documents"

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
    APPROVED       = "approved",       "Approved"
    DEFERRED_NEXT  = "deferred_next",  "Deferred To Next Meeting"
    DEFERRED_INFO  = "deferred_info",  "Deferred — Need more information"
    REJECTED       = "rejected",       "Rejected"


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


def add_working_days(start_date, days: int):
    """Add `days` Mon–Fri working days (including Vanuatu public holidays)."""
    # 2025/2026 Vanuatu Public Holidays (Approximation for Phase 1)
    holidays = {
        # 2025
        (2025, 1, 1),   # New Year's Day
        (2025, 2, 21),  # Father Lini Day
        (2025, 3, 5),   # Custom Chief's Day
        (2025, 4, 18),  # Good Friday
        (2025, 4, 21),  # Easter Monday
        (2025, 5, 1),   # Labour Day
        (2025, 5, 29),  # Ascension Day
        (2025, 7, 24),  # Children's Day
        (2025, 7, 30),  # Independence Day
        (2025, 8, 15),  # Assumption Day
        (2025, 10, 5),  # Constitution Day
        (2025, 11, 29), # Unity Day
        (2025, 12, 25), # Christmas Day
        (2025, 12, 26), # Family Day
        # 2026
        (2026, 1, 1),
        (2026, 2, 21),
        (2026, 3, 5),
        (2026, 4, 3),   # Good Friday 2026
        (2026, 4, 6),   # Easter Monday 2026
        (2026, 5, 1),
        (2026, 5, 14),  # Ascension 2026
        (2026, 7, 24),
        (2026, 7, 30),
        (2026, 8, 15),
        (2026, 10, 5),
        (2026, 11, 29),
        (2026, 12, 25),
        (2026, 12, 26),
    }

    d = start_date
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
    is_read = models.BooleanField(default=False)
    emailed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title}"


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
    SIGNED = "signed", "Signed"


class Minutes(models.Model):
    """Formal minutes document for a Commission sitting."""

    meeting = models.OneToOneField(Meeting, on_delete=models.CASCADE, related_name="minutes")
    status = models.CharField(max_length=16, choices=MinutesStatus.choices, default=MinutesStatus.DRAFT)
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
        help_text="Generated PDF version of the signed minutes.",
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
