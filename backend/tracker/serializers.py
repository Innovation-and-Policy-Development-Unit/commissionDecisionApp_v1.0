from urllib.parse import urlparse
from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    AuditLog,
    CommissionTask,
    CommissionSubTask,
    CommissionTaskUpdate,
    Department,
    EmploymentType,
    FlyingMinuteSignature,
    FormCategory,
    Meeting,
    MeetingBriefingPack,
    MeetingTranscript,
    MeetingType,
    RecordingAudioSource,
    TranscriptSource,
    Minutes,
    AgendaItem,
    Ministry,
    Notification,
    Profile,
    PSCForm37Data,
    PSCFormField,
    PSCFormResponse,
    PSCFormType,
    Role,
    RoleDefinition,
    SecurityIncident,
    SecurityNotice,
    SecurityScan,
    Submission,
    SystemPermission,
    WorkflowEvent,
    WorkflowStage,
    APIKey,
    SystemSetting,
    FeedbackReport,
    FeedbackComment,
    RequiredDocument,
    SubmissionChecklistItem,
    SubmissionDocument,
    DocumentAnnotation,
    DocumentSignature,
    UserSignature,
    ODURestructureChecklist,
    RestructureSubmissionData,
    StaffChatMessage,
    StaffChatSession,
)
from .rbac import (
    rbac_can_access_admin_panel,
    rbac_user_can_manage_roles,
    rbac_user_can_manage_users,
    rbac_user_can_view_audit_log,
)


class MinistrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Ministry
        fields = ("id", "code", "name")

    def validate_code(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Code is required.")
        qs = Ministry.objects.filter(code__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A ministry with this code already exists.")
        return value


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "ministry", "code", "name")

    def validate(self, attrs):
        if "ministry" in attrs and attrs["ministry"] is None:
            raise serializers.ValidationError({"ministry": "Department must belong to a ministry."})
        ministry = attrs.get("ministry") or (self.instance.ministry if self.instance else None)
        code = (attrs.get("code") if attrs.get("code") is not None else (self.instance.code if self.instance else "") or "").strip()
        if not ministry:
            raise serializers.ValidationError({"ministry": "Select a ministry for this department."})
        if not code:
            raise serializers.ValidationError({"code": "Department code is required."})
        qs = Department.objects.filter(ministry=ministry, code__iexact=code)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {"code": "A department with this code already exists for the selected ministry."}
            )
        return attrs


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    ministry = MinistrySerializer(read_only=True, allow_null=True)
    department = DepartmentSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Profile
        fields = ("username", "email", "role", "ministry", "department", "profile_picture", "signature")


class MeSerializer(serializers.ModelSerializer):
    """GET /me/ — profile plus flags for admin UI and RBAC."""

    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    ministry = MinistrySerializer(read_only=True, allow_null=True)
    department = DepartmentSerializer(read_only=True, allow_null=True)
    is_superuser = serializers.BooleanField(source="user.is_superuser", read_only=True)
    is_staff = serializers.BooleanField(source="user.is_staff", read_only=True)
    profile_picture = serializers.SerializerMethodField()
    signature = serializers.SerializerMethodField()
    session_pin_set = serializers.SerializerMethodField()
    can_manage_users    = serializers.SerializerMethodField()
    can_manage_roles    = serializers.SerializerMethodField()
    can_access_admin_panel = serializers.SerializerMethodField()
    can_view_audit_log  = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = (
            "username",
            "email",
            "role",
            "ministry",
            "department",
            "profile_picture",
            "is_superuser",
            "is_staff",
            "can_manage_users",
            "can_manage_roles",
            "can_access_admin_panel",
            "can_view_audit_log",
            "two_factor_enabled",
            "session_pin_set",
            "signature",
        )

    def get_session_pin_set(self, obj):
        return bool(obj.session_pin)

    def get_signature(self, obj):
        if not obj.signature:
            return None
        raw = obj.signature.url
        if raw.startswith(("http://", "https://")):
            return raw
        from urllib.parse import urlparse
        parsed = urlparse(raw)
        return parsed.path or raw

    def get_profile_picture(self, obj):
        """Root-relative URL so the SPA loads images from its own origin (/media → nginx/vite → Django)."""
        if not obj.profile_picture:
            return None
        raw = obj.profile_picture.url
        if raw.startswith(("http://", "https://")):
            path = urlparse(raw).path
            return path if path.startswith("/") else f"/{path.lstrip('/')}"
        if raw.startswith("/"):
            return raw
        return f"/{raw.lstrip('/')}"

    def get_can_manage_users(self, obj):
        return rbac_user_can_manage_users(obj.user)

    def get_can_manage_roles(self, obj):
        return rbac_user_can_manage_roles(obj.user)

    def get_can_access_admin_panel(self, obj):
        return rbac_can_access_admin_panel(obj.user)

    def get_can_view_audit_log(self, obj):
        return rbac_user_can_view_audit_log(obj.user)


_TASK_LINK_STAGES = frozenset(
    {
        WorkflowStage.MINUTES_DRAFTED_SIGNED,
        WorkflowStage.DECISION_ENTERED_ASSIGNED,
        WorkflowStage.UNDER_IMPLEMENTATION,
        WorkflowStage.IMPLEMENTATION_REPORT,
        WorkflowStage.APPROVED,
        WorkflowStage.REJECTED,
    }
)


class CommissionTaskSerializer(serializers.ModelSerializer):
    submission_reference_number = serializers.CharField(
        source="submission.reference_number", read_only=True, default=None,
    )
    submission_title = serializers.CharField(
        source="submission.title", read_only=True, default=None,
    )
    assigned_manager_username = serializers.CharField(
        source="assigned_manager.username", read_only=True,
    )
    assigned_staff_username = serializers.CharField(
        source="assigned_staff.username", read_only=True,
    )
    meeting_title = serializers.CharField(
        source="meeting.title", read_only=True, default=None,
    )
    subtasks = serializers.SerializerMethodField()

    class Meta:
        model = CommissionTask
        fields = (
            "id",
            # ── Decision Register fields ──────────────────────────────────
            "decision_number",
            "meeting",
            "meeting_title",
            "decision_detail",
            "decision_outcome",
            "action_unit",
            "implementation_status",
            "way_forward",
            # ── Submission link ───────────────────────────────────────────
            "submission",
            "submission_reference_number",
            "submission_title",
            # ── Task fields ───────────────────────────────────────────────
            "title",
            "description",
            "meeting_reference",
            "meeting_date",
            "minute_reference",
            "decision_type",
            "success_criteria",
            "legal_reference",
            "status",
            "assigned_manager",
            "assigned_manager_username",
            "assigned_staff",
            "assigned_staff_username",
            "assigned_staff_m2m",
            "due_date",
            "due_date_notified",
            "subtasks",
            "ai_subtask_drafts",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "submission_reference_number",
            "submission_title",
            "meeting_title",
            "assigned_manager_username",
            "assigned_staff_username",
            "due_date_notified",
            "subtasks",
            "ai_subtask_drafts",
            "created_by",
            "created_at",
            "updated_at",
        )

    def get_subtasks(self, obj):
        qs = obj.subtasks.select_related("created_by").prefetch_related("assigned_staff").all()
        return CommissionSubTaskSerializer(qs, many=True).data

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields["submission"].read_only = True

    def validate(self, attrs):
        if self.instance is None:
            sub = attrs.get("submission")
            if sub and sub.current_stage not in _TASK_LINK_STAGES:
                raise serializers.ValidationError(
                    {
                        "submission": (
                            "Link tasks only to submissions in post-decision or implementation stages "
                            "(e.g. decision entered, under implementation, approved, rejected)."
                        )
                    }
                )
        return attrs


class CommissionTaskUpdateSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = CommissionTaskUpdate
        fields = ("id", "body", "author_username", "created_at")


class CommissionTaskUpdateBodySerializer(serializers.Serializer):
    body = serializers.CharField(max_length=8000, trim_whitespace=True)


class CommissionSubTaskSerializer(serializers.ModelSerializer):
    assigned_staff_usernames = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    task_title = serializers.CharField(source="task.title", read_only=True)

    class Meta:
        model = CommissionSubTask
        fields = (
            "id", "task", "task_title",
            "title", "description", "status",
            "due_date", "due_date_notified",
            "assigned_staff", "assigned_staff_usernames",
            "created_by", "created_by_username",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "due_date_notified", "created_by", "created_at", "updated_at", "created_by_username", "task_title", "assigned_staff_usernames")

    def get_assigned_staff_usernames(self, obj):
        return [u.username for u in obj.assigned_staff.all()]

    def validate(self, attrs):
        sub_due = attrs.get("due_date")
        if sub_due and self.instance:
            task = self.instance.task
        elif sub_due:
            task_id = self.initial_data.get("task")
            if task_id:
                try:
                    from .models import CommissionTask
                    task = CommissionTask.objects.get(id=task_id)
                except CommissionTask.DoesNotExist:
                    return attrs
            else:
                return attrs
        else:
            return attrs

        if task.due_date and sub_due and sub_due > task.due_date:
            raise serializers.ValidationError(
                {"due_date": "Subtask due date cannot be after the parent task due date."}
            )
        return attrs


class TaskReportSerializer(serializers.Serializer):
    """Query params for task report."""
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    status = serializers.ChoiceField(choices=["open", "in_progress", "completed", "cancelled"], required=False)
    manager_id = serializers.IntegerField(required=False)
    format = serializers.ChoiceField(choices=["json", "csv"], default="json")


class TaskReportRowSerializer(serializers.Serializer):
    """Single row in the task report output."""
    task_id = serializers.IntegerField()
    title = serializers.CharField()
    submission_ref = serializers.CharField()
    submission_title = serializers.CharField()
    manager = serializers.CharField()
    staff = serializers.ListField(child=serializers.CharField())
    status = serializers.CharField()
    due_date = serializers.DateField(allow_null=True)
    meeting_ref = serializers.CharField()
    decision_type = serializers.CharField()
    subtask_count = serializers.IntegerField()
    subtask_completed = serializers.IntegerField()
    days_overdue = serializers.IntegerField()


class FormCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FormCategory
        fields = ("id", "code", "name", "psc_forms_summary", "display_order")


class WorkflowEventSerializer(serializers.ModelSerializer):
    """System/CMS events may have actor=null; use actor_label when present."""

    actor_username = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowEvent
        fields = ("id", "actor_username", "previous_stage", "new_stage", "remarks", "created_at")

    def get_actor_username(self, obj):
        if obj.actor_id:
            return obj.actor.username
        if obj.actor_label:
            return obj.actor_label
        return "System"


class AttachedSubmissionSerializer(serializers.ModelSerializer):
    """Lightweight nested serializer for child submissions shown inside a parent."""
    class Meta:
        model = Submission
        fields = ("id", "reference_number", "title", "form_type_code", "current_stage")


class SubmissionListSerializer(serializers.ModelSerializer):
    ministry_name = serializers.CharField(source="ministry.name", read_only=True)
    category_name = serializers.CharField(source="form_category.name", read_only=True)
    logged_by = serializers.CharField(source="created_by.username", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    is_assessment_overdue = serializers.SerializerMethodField()
    estimated_meeting_date = serializers.SerializerMethodField()
    parent_reference = serializers.CharField(
        source="parent_submission.reference_number", read_only=True, default=None
    )
    attached_submissions = AttachedSubmissionSerializer(many=True, read_only=True)
    # Agenda auto-categorisation: resolved agenda section for this form type
    form_agenda_category = serializers.SerializerMethodField()

    def get_is_assessment_overdue(self, obj):
        return obj.is_assessment_overdue

    def get_estimated_meeting_date(self, obj):
        return obj.estimated_meeting_date

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() or obj.assigned_to.username if obj.assigned_to else None

    def get_form_agenda_category(self, obj):
        """Return the agenda_category from the linked PSCFormType, or 'other'.
        Uses a per-request cache to avoid N+1 queries."""
        cache = self.context.get("_ft_agenda_cache")
        if cache is None:
            cache = dict(PSCFormType.objects.values_list("code", "agenda_category"))
            # Store back — context is a shared dict for this serializer instance
            self.context["_ft_agenda_cache"] = cache
        return cache.get(obj.form_type_code) or "other"

    class Meta:
        model = Submission
        fields = (
            "id",
            "reference_number",
            "title",
            "form_type_code",
            "form_agenda_category",
            "ministry_name",
            "category_name",
            "logged_by",
            "current_stage",
            "classification",
            "estimated_meeting_date",
            "received_at",
            "assessment_deadline_at",
            "is_assessment_overdue",
            "assigned_to",
            "assigned_to_name",
            "assigned_at",
            "is_attachment",
            "is_internal",
            "parent_submission",
            "parent_reference",
            "attached_submissions",
            "ai_brief_summary",
            "ai_brief_processed",
            "ai_brief_generated_at",
            "ai_quality_score",
            "ai_quality_explanation",
            "ai_quality_dimensions",
            "ai_quality_review_effort",
            "ai_quality_processed",
            "ai_quality_generated_at",
        )


class SubmissionDetailSerializer(serializers.ModelSerializer):
    ministry = MinistrySerializer(read_only=True)
    department = DepartmentSerializer(read_only=True)
    form_category = FormCategorySerializer(read_only=True)
    events = WorkflowEventSerializer(many=True, read_only=True)
    logged_by = serializers.CharField(source="created_by.username", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    is_assessment_overdue = serializers.SerializerMethodField()
    estimated_meeting_date = serializers.SerializerMethodField()
    dg_endorsed_by_name = serializers.SerializerMethodField()
    form_type_detail = serializers.SerializerMethodField()
    parent_reference = serializers.CharField(
        source="parent_submission.reference_number", read_only=True, default=None
    )
    parent_title = serializers.CharField(
        source="parent_submission.title", read_only=True, default=None
    )
    attached_submissions = AttachedSubmissionSerializer(many=True, read_only=True)
    preliminary_quality_score = serializers.SerializerMethodField()

    def get_preliminary_quality_score(self, obj):
        from .ai.submission_quality_score import preliminary_quality_score

        return preliminary_quality_score(obj)

    def get_is_assessment_overdue(self, obj):
        return obj.is_assessment_overdue

    def get_estimated_meeting_date(self, obj):
        return obj.estimated_meeting_date

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() or obj.assigned_to.username if obj.assigned_to else None

    def get_dg_endorsed_by_name(self, obj):
        return obj.dg_endorsed_by.username if obj.dg_endorsed_by else None

    def get_form_type_detail(self, obj):
        if not obj.form_type_code:
            return None
        try:
            ft = PSCFormType.objects.get(code=obj.form_type_code)
            return {
                'id': ft.id,
                'code': ft.code,
                'name': ft.name,
                'is_digitized': ft.is_digitized,
                'digitized_form_key': ft.digitized_form_key,
                'agenda_category': ft.agenda_category,
            }
        except PSCFormType.DoesNotExist:
            return None

    class Meta:
        model = Submission
        fields = (
            "id",
            "reference_number",
            "title",
            "form_type_code",
            "form_type_detail",
            "ministry",
            "department",
            "routed_unit",
            "form_category",
            "current_stage",
            "classification",
            "dg_endorsed_by",
            "dg_endorsed_by_name",
            "dg_endorsed_at",
            "received_at",
            "registered_at",
            "assessment_started_at",
            "assessment_deadline_at",
            "closing_deadline_at",
            "scheduled_meeting",
            "implementation_status",
            "implementation_due_date",
            "notes",
            "logged_by",
            "assigned_to",
            "assigned_to_name",
            "assigned_at",
            "created_at",
            "updated_at",
            "events",
            "is_assessment_overdue",
            "estimated_meeting_date",
            "is_attachment",
            "is_internal",
            "cms_case_id",
            "cms_case_closed_at",
            "cms_case_reference",
            "cms_dispatched_at",
            "cms_signoff_at",
            "cms_signoff_outcome",
            "parent_submission",
            "parent_reference",
            "parent_title",
            "attached_submissions",
            "ai_brief_summary",
            "ai_brief_processed",
            "ai_brief_generated_at",
            "ai_quality_score",
            "ai_quality_explanation",
            "ai_quality_dimensions",
            "ai_quality_review_effort",
            "ai_quality_processed",
            "ai_quality_generated_at",
            "preliminary_quality_score",
            "ai_package_gaps",
            "ai_package_ready",
            "ai_package_summary",
            "ai_package_processed",
            "ai_package_generated_at",
            "ai_transition_guidance",
            "ai_clarification_bilingual",
        )
        read_only_fields = (
            "ai_brief_summary",
            "ai_brief_processed",
            "ai_brief_generated_at",
            "ai_quality_score",
            "ai_quality_explanation",
            "ai_quality_dimensions",
            "ai_quality_review_effort",
            "ai_quality_processed",
            "ai_quality_generated_at",
            "preliminary_quality_score",
            "ai_package_gaps",
            "ai_package_ready",
            "ai_package_summary",
            "ai_package_processed",
            "ai_package_generated_at",
            "ai_transition_guidance",
            "ai_clarification_bilingual",
        )


class SubmissionDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)
    file_size = serializers.SerializerMethodField()
    content_type = serializers.SerializerMethodField()
    ocr_status_display = serializers.CharField(source='get_ocr_status_display', read_only=True)
    document_type_display = serializers.CharField(
        source='get_document_type_display', read_only=True,
    )

    def get_file_size(self, obj):
        try:
            return obj.file.size
        except Exception:
            return None

    def get_content_type(self, obj):
        name = obj.original_name.lower()
        if name.endswith('.pdf'):
            return 'application/pdf'
        if name.endswith(('.doc', '.docx')):
            return 'application/msword'
        if name.endswith(('.xls', '.xlsx')):
            return 'application/vnd.ms-excel'
        return 'application/octet-stream'

    class Meta:
        model = SubmissionDocument
        fields = (
            'id', 'original_name', 'description', 'uploaded_by_username',
            'uploaded_at', 'file_size', 'content_type',
            'ocr_status', 'ocr_status_display', 'extracted_text', 'extracted_facts',
            'ocr_error', 'ocr_processed_at',
            'document_type', 'document_type_display', 'document_type_confidence',
            'document_type_note', 'document_classified_at',
            'ai_annotation_suggestions', 'ai_redaction_spans',
        )
        read_only_fields = fields


class MeetingBriefingPackSerializer(serializers.ModelSerializer):
    meeting_reference = serializers.CharField(
        source='meeting.reference_number', read_only=True,
    )
    meeting_title = serializers.CharField(source='meeting.title', read_only=True)
    downloads = serializers.SerializerMethodField()

    class Meta:
        model = MeetingBriefingPack
        fields = (
            'id', 'meeting', 'meeting_reference', 'meeting_title', 'status',
            'error_message', 'narrative_markdown', 'pack_data',
            'created_at', 'completed_at', 'downloads',
        )
        read_only_fields = fields

    def get_downloads(self, obj):
        if obj.status != MeetingBriefingPack.Status.READY:
            return None
        base = f"/api/meetings/briefing-packs/{obj.id}/download/"
        return {'html': f"{base}?format=html"}


class UserSignatureSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    def get_image_url(self, obj):
        return obj.image.url if obj.image else None

    class Meta:
        model = UserSignature
        fields = ('id', 'image_url', 'created_at', 'updated_at')


class DocumentSignatureSerializer(serializers.ModelSerializer):
    signed_by_username  = serializers.CharField(source='signed_by.username',   read_only=True)
    signed_by_full_name = serializers.SerializerMethodField()

    def get_signed_by_full_name(self, obj):
        return obj.signed_by.get_full_name() or obj.signed_by.username

    class Meta:
        model = DocumentSignature
        fields = (
            'id', 'document', 'signed_by', 'signed_by_username', 'signed_by_full_name',
            'page_number', 'position_x', 'position_y', 'sig_scale',
            'snapshot', 'signed_date', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'signed_by', 'signed_by_username', 'signed_by_full_name',
                            'created_at', 'updated_at')

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        if instance.snapshot:
            rep['snapshot'] = instance.snapshot.url
        return rep


class DocumentAnnotationSerializer(serializers.ModelSerializer):
    annotated_by_username = serializers.CharField(source='annotated_by.username', read_only=True)

    class Meta:
        model = DocumentAnnotation
        fields = (
            'id', 'document', 'annotated_by', 'annotated_by_username',
            'page_number', 'fabric_json', 'snapshot', 'note',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'annotated_by', 'annotated_by_username', 'created_at', 'updated_at')

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        if instance.snapshot:
            rep['snapshot'] = instance.snapshot.url
        return rep


class RequiredDocumentSerializer(serializers.ModelSerializer):
    form_type_code = serializers.CharField(source='form_type.code', read_only=True, default=None)
    form_category_name = serializers.CharField(source='form_category.name', read_only=True, default=None)

    class Meta:
        model = RequiredDocument
        fields = (
            'id', 'form_type', 'form_type_code',
            'form_category', 'form_category_name',
            'name', 'description', 'order', 'is_active',
        )


class ChecklistItemSerializer(serializers.ModelSerializer):
    document_name = serializers.CharField(source='document.name', read_only=True)
    document_description = serializers.CharField(source='document.description', read_only=True)
    checked_by_username = serializers.CharField(source='checked_by.username', read_only=True)

    class Meta:
        model = SubmissionChecklistItem
        fields = ('id', 'document', 'document_name', 'document_description',
                  'is_present', 'notes', 'checked_by_username', 'checked_at')
        read_only_fields = ('document', 'checked_by_username', 'checked_at')


class SubmissionWriteSerializer(serializers.ModelSerializer):
    # Ministry is required for external submissions but auto-resolved for internal
    # (CSU/ODU) submissions on the backend, so we make it optional here.
    ministry = serializers.PrimaryKeyRelatedField(
        queryset=Ministry.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Submission
        fields = (
            "id",
            "title",
            "form_category",
            "form_type_code",
            "ministry",
            "department",
            "routed_unit",
            "classification",
            "received_at",
            "registered_at",
            "closing_deadline_at",
            "scheduled_meeting",
            "notes",
            "parent_submission",
            "is_attachment",
            "is_internal",
        )
        read_only_fields = ("id", "is_internal")

    def validate(self, attrs):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None):
            return attrs
        try:
            profile = request.user.psc_profile
            role = profile.role
        except Exception:
            return attrs
        from .cms_register import CMS_ORIGIN_MESSAGE
        from .compliance_forms import COMPLIANCE_SUBMITTER_ROLES

        form_type_code = attrs.get("form_type_code") or ""
        if role in COMPLIANCE_SUBMITTER_ROLES:
            raise PermissionDenied(CMS_ORIGIN_MESSAGE)
        elif form_type_code.startswith("COMP-"):
            from django.core.exceptions import PermissionDenied
            raise PermissionDenied("Only Compliance unit staff may create compliance submission types.")
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        return Submission.objects.create(created_by=user, **validated_data)


class PSCFormFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = PSCFormField
        fields = ('id', 'form_type', 'label', 'field_key', 'field_type',
                  'placeholder', 'help_text', 'choices', 'is_required', 'display_order',
                  'start_new_page')
        read_only_fields = ('form_type',)


class PSCFormResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PSCFormResponse
        fields = ('id', 'submission', 'form_type', 'data', 'created_at', 'updated_at')
        read_only_fields = ('submission', 'form_type', 'created_at', 'updated_at')


class PSCFormTypeSerializer(serializers.ModelSerializer):
    form_category_name = serializers.CharField(source='form_category.name', read_only=True)

    class Meta:
        model = PSCFormType
        fields = ('id', 'code', 'name', 'description', 'form_category',
                  'form_category_name', 'is_digitized', 'digitized_form_key',
                  'is_active', 'display_order', 'agenda_category')


class TransitionSerializer(serializers.Serializer):
    new_stage = serializers.ChoiceField(choices=WorkflowStage.choices)
    remarks = serializers.CharField(required=False, allow_blank=True)
    acknowledge_gaps = serializers.BooleanField(required=False, default=False)


class UserProfileSerializer(serializers.ModelSerializer):
    """Full user record (User + Profile) for admin listing."""
    role            = serializers.SerializerMethodField()
    ministry_id     = serializers.SerializerMethodField()
    ministry_name   = serializers.SerializerMethodField()
    department_id   = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    # Security — lockout info injected from view context (batch-loaded, no N+1)
    is_locked       = serializers.SerializerMethodField()
    failed_attempts = serializers.SerializerMethodField()
    two_factor_enabled = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "is_active", "date_joined",
            "role", "ministry_id", "ministry_name", "department_id", "department_name",
            "is_locked", "failed_attempts", "two_factor_enabled",
        )

    def _profile(self, obj):
        try:
            return obj.psc_profile
        except Profile.DoesNotExist:
            return None

    def get_role(self, obj):
        p = self._profile(obj)
        return p.role if p else None

    def get_ministry_id(self, obj):
        p = self._profile(obj)
        return p.ministry_id if p else None

    def get_ministry_name(self, obj):
        p = self._profile(obj)
        return p.ministry.name if p and p.ministry else None

    def get_department_id(self, obj):
        p = self._profile(obj)
        return p.department_id if p else None

    def get_department_name(self, obj):
        p = self._profile(obj)
        return p.department.name if p and p.department else None

    def get_is_locked(self, obj):
        """True if axes has locked this username out."""
        return obj.username in self.context.get("locked_usernames", set())

    def get_failed_attempts(self, obj):
        """Number of consecutive failed attempts recorded by axes."""
        return self.context.get("attempts_map", {}).get(obj.username, 0)

    def get_two_factor_enabled(self, obj):
        p = self._profile(obj)
        return p.two_factor_enabled if p else False


# ── User Feedback Serializers ─────────────────────────────────────────────────

class FeedbackCommentSerializer(serializers.ModelSerializer):
    author_username = serializers.ReadOnlyField(source="author.username")

    class Meta:
        model = FeedbackComment
        fields = (
            "id", "report", "author", "author_username", "body", "is_internal",
            "created_at",
            "ai_summary", "ai_severity", "ai_category", "ai_translated_text",
            "ai_processed",
        )
        read_only_fields = (
            "id", "author", "created_at",
            "ai_summary", "ai_severity", "ai_category", "ai_translated_text",
            "ai_processed",
        )


class FeedbackReportSerializer(serializers.ModelSerializer):
    created_by_username = serializers.ReadOnlyField(source="created_by.username")
    assigned_to_username = serializers.ReadOnlyField(source="assigned_to.username")
    comment_count = serializers.IntegerField(source="comments.count", read_only=True)

    class Meta:
        model = FeedbackReport
        fields = (
            "id", "title", "description", "feedback_type", "severity", "status",
            "screenshot", "annotated_screenshot", "page_url", "module_name",
            "browser_info", "viewport_size", "system_version",
            "created_by", "created_by_username", "assigned_to", "assigned_to_username",
            "created_at", "updated_at", "resolved_at", "comment_count",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at", "resolved_at")

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # Return path-only URLs for media fields so the browser resolves them
        # relative to the current origin — avoids Host-header port-stripping issues.
        if instance.screenshot:
            rep["screenshot"] = instance.screenshot.url
        if instance.annotated_screenshot:
            rep["annotated_screenshot"] = instance.annotated_screenshot.url
        return rep

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)


class FeedbackReportDetailSerializer(FeedbackReportSerializer):
    comments = FeedbackCommentSerializer(many=True, read_only=True)

    class Meta(FeedbackReportSerializer.Meta):
        fields = FeedbackReportSerializer.Meta.fields + ("comments",)


class UserAdminUpdateSerializer(serializers.Serializer):
    """Update User fields + Profile role/ministry/department."""
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=Role.choices)
    ministry_id = serializers.IntegerField(required=False, allow_null=True)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)

    def validate_username(self, value):
        user = self.instance
        if User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def update(self, instance, validated_data):
        instance.username = validated_data.get("username", instance.username)
        instance.email = validated_data.get("email", instance.email) or ""
        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]
        instance.save()

        try:
            profile = instance.psc_profile
        except Profile.DoesNotExist:
            profile = Profile(user=instance)

        profile.role = validated_data["role"]
        profile.ministry_id = validated_data.get("ministry_id")
        profile.department_id = validated_data.get("department_id")
        profile.save()
        return instance


class AgendaItemSerializer(serializers.ModelSerializer):
    submission_reference = serializers.CharField(source="submission.reference_number", read_only=True)
    submission_title     = serializers.CharField(source="submission.title", read_only=True)
    submission_ministry  = serializers.SerializerMethodField()
    category_display     = serializers.CharField(source="get_category_display", read_only=True)

    def get_submission_ministry(self, obj):
        return obj.submission.ministry.name if obj.submission.ministry else ""

    class Meta:
        model = AgendaItem
        fields = (
            "id", "meeting", "submission", "submission_reference", "submission_title",
            "submission_ministry", "sequence", "category", "category_display",
            "matters_arising_agenda_no", "matters_arising_meeting_ref",
            "agenda_blurb", "agenda_blurb_processed",
        )
        read_only_fields = ("agenda_blurb", "agenda_blurb_processed")


class MeetingSerializer(serializers.ModelSerializer):
    agenda_items = AgendaItemSerializer(many=True, read_only=True)
    agenda_count = serializers.IntegerField(source="agenda_items.count", read_only=True)
    decisions_count = serializers.SerializerMethodField()
    agenda_approved_by_name = serializers.SerializerMethodField()
    flying_minute_signatures = serializers.SerializerMethodField()
    # Effective submission deadline: manual cutoff if set, else auto 3-day rule
    effective_cutoff = serializers.DateTimeField(read_only=True)

    def get_agenda_approved_by_name(self, obj):
        return obj.agenda_approved_by.username if obj.agenda_approved_by else None

    def get_flying_minute_signatures(self, obj):
        if obj.type != MeetingType.FLYING_MINUTE:
            return []
        sigs = obj.flying_minute_signatures.select_related("member").all()
        return FlyingMinuteSignatureSerializer(sigs, many=True).data

    class Meta:
        model = Meeting
        fields = (
            "id",
            "reference_number",
            "title",
            "date",
            "time",
            "venue",
            "type",
            "status",
            "notes",
            "recording_audio_source",
            "submission_cutoff",
            "effective_cutoff",
            "max_items",
            "agenda_status",
            "agenda_approved_by",
            "agenda_approved_by_name",
            "agenda_approved_at",
            "agenda_items",
            "agenda_count",
            "decisions_count",
            "flying_minute_signatures",
        )

    def get_decisions_count(self, obj):
        # Count submissions in this meeting that are in a post-sitting stage
        return obj.agenda_items.filter(
            submission__current_stage__in=[
                WorkflowStage.APPROVED,
                WorkflowStage.REJECTED,
                WorkflowStage.RETURNED,
                WorkflowStage.MINUTES_DRAFTED_SIGNED,
                WorkflowStage.DECISION_ENTERED_ASSIGNED,
                WorkflowStage.UNDER_IMPLEMENTATION,
                WorkflowStage.IMPLEMENTATION_REPORT,
            ]
        ).count()


class SetPasswordSerializer(serializers.Serializer):
    """Admin-initiated password reset (no old-password required)."""
    password = serializers.CharField(min_length=8, write_only=True)


class TOTPVerifySerializer(serializers.Serializer):
    """Verify a 6-digit TOTP code (Microsoft Authenticator).
    In DEMO_MODE, accepts push_approved=true to simulate push notification."""
    username = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=6, required=False)
    push_approved = serializers.BooleanField(default=False, required=False)

    def validate(self, attrs):
        from django.conf import settings
        try:
            user = User.objects.get(username=attrs["username"])
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid credentials.")

        from .totp import verify_totp_code, generate_totp
        profile = getattr(user, 'psc_profile', None)
        if not profile or not profile.totp_secret:
            raise serializers.ValidationError("2FA not configured for this account.")

        # Demo mode: push notification simulation
        if settings.DEMO_MODE and attrs.get("push_approved"):
            code = generate_totp(profile.totp_secret)
            if not verify_totp_code(profile.totp_secret, code):
                raise serializers.ValidationError("Push approval failed.")
            attrs["user"] = user
            return attrs

        # Normal TOTP code verification
        code = attrs.get("code")
        if not code:
            raise serializers.ValidationError("Verification code is required.")
        if not verify_totp_code(profile.totp_secret, code):
            raise serializers.ValidationError("Invalid verification code.")

        attrs["user"] = user
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    """Request a password reset link by email."""
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Confirm password reset with token + new password."""
    token = serializers.CharField()
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_token(self, value):
        from .models import PasswordResetToken
        try:
            rt = PasswordResetToken.objects.get(token=value)
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired reset link.")
        if not rt.is_valid():
            raise serializers.ValidationError("This reset link has expired.")
        return rt

    def validate_password(self, value):
        from django.core.exceptions import ValidationError as DjangoValidationError

        from .validators import validate_complexity

        try:
            validate_complexity(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def save(self):
        from django.core.exceptions import ValidationError as DjangoValidationError

        from .validators import record_password, validate_history

        rt = self.validated_data["token"]
        user = rt.user
        password = self.validated_data["password"]
        try:
            validate_history(password, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        record_password(user)
        user.set_password(password)
        user.save(update_fields=["password"])
        rt.used = True
        rt.save(update_fields=["used"])
        return user


class SystemPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemPermission
        fields = ("id", "code", "label", "description", "category", "is_builtin")

    def validate_code(self, value):
        qs = SystemPermission.objects.filter(code=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A permission with this code already exists.")
        return value


class RoleDefinitionSerializer(serializers.ModelSerializer):
    role_label   = serializers.CharField(source="get_role_display", read_only=True)
    permissions  = SystemPermissionSerializer(many=True, read_only=True)
    user_count   = serializers.SerializerMethodField()

    def get_user_count(self, obj):
        return Profile.objects.filter(role=obj.role).count()

    class Meta:
        model = RoleDefinition
        fields = ("id", "role", "role_label", "description", "is_builtin", "permissions", "user_count")


class RoleDefinitionWriteSerializer(serializers.Serializer):
    """Update description and permission set for a role definition."""
    description    = serializers.CharField(required=False, allow_blank=True)
    permission_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )

    def update(self, instance, validated_data):
        if "description" in validated_data:
            instance.description = validated_data["description"]
            instance.save(update_fields=["description"])
        if "permission_ids" in validated_data:
            instance.permissions.set(validated_data["permission_ids"])
        return instance


class RegisterSerializer(serializers.Serializer):
    """Development convenience — disable or protect in production."""

    username = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=Role.choices)
    ministry_id = serializers.IntegerField(required=False, allow_null=True)
    department_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if User.objects.filter(username=attrs["username"]).exists():
            raise serializers.ValidationError({"username": "Username already taken."})
        return attrs

    def create(self, validated_data):
        ministry_id = validated_data.pop("ministry_id", None)
        department_id = validated_data.pop("department_id", None)
        role = validated_data.pop("role")
        password = validated_data.pop("password")
        email = validated_data.pop("email", "") or ""
        user = User.objects.create_user(
            username=validated_data["username"],
            password=password,
            email=email,
        )
        profile_kwargs = {"user": user, "role": role}
        if ministry_id:
            profile_kwargs["ministry_id"] = ministry_id
        if department_id:
            profile_kwargs["department_id"] = department_id
        Profile.objects.create(**profile_kwargs)
        return user


class APIKeySerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = APIKey
        fields = ("id", "name", "key", "user", "user_username", "is_active", "last_used_at", "created_at")
        read_only_fields = ("key", "last_used_at", "created_at")


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ("id", "key", "value", "description", "updated_at")
        read_only_fields = ("updated_at",)


class EmailTemplateSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    placeholder_list = serializers.SerializerMethodField()

    class Meta:
        from .models import EmailTemplate

        model = EmailTemplate
        fields = (
            "slug",
            "name",
            "category",
            "category_label",
            "description",
            "placeholders",
            "placeholder_list",
            "subject_template",
            "body_text_template",
            "body_html_template",
            "is_active",
            "is_system",
            "updated_at",
            "created_at",
        )
        read_only_fields = ("slug", "is_system", "created_at", "updated_at")

    def get_placeholder_list(self, obj):
        if not obj.placeholders:
            return []
        return [p.strip() for p in obj.placeholders.split(",") if p.strip()]


# ── Security feature serializers (NCSS 2030 / ISO 27001) ─────────────────────

class AuditLogSerializer(serializers.ModelSerializer):
    """Read-only audit trail — admin eyes only."""

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor_username",
            "action",
            "resource_type",
            "resource_id",
            "resource_label",
            "description",
            "ip_address",
            "timestamp",
            "extra_data",
        )
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "recipient",
            "submission",
            "channel",
            "title",
            "body",
            "is_read",
            "emailed",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class SecurityIncidentSerializer(serializers.ModelSerializer):
    """Any authenticated user can raise; admin manages status & assignment."""

    reported_by_username = serializers.CharField(
        source="reported_by.username", read_only=True, default=None
    )
    assigned_to_username = serializers.CharField(
        source="assigned_to.username", read_only=True, default=None
    )

    class Meta:
        model = SecurityIncident
        fields = (
            "id",
            "title",
            "description",
            "category",
            "severity",
            "status",
            "reported_by",
            "reported_by_username",
            "assigned_to",
            "assigned_to_username",
            "affected_systems",
            "resolution_notes",
            "created_at",
            "updated_at",
            "resolved_at",
        )
        read_only_fields = ("id", "reported_by", "created_at", "updated_at")


class SecurityNoticeSerializer(serializers.ModelSerializer):
    """Security notice broadcast to all users. Admin-only write."""

    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None
    )
    is_live = serializers.SerializerMethodField()

    class Meta:
        model = SecurityNotice
        fields = (
            "id",
            "title",
            "message",
            "notice_type",
            "is_active",
            "is_live",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "expires_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at", "is_live")

    def get_is_live(self, obj):
        return obj.is_live()


class SecurityScanSerializer(serializers.ModelSerializer):
    """Latest SAST + dependency scan result — admin read / trigger only."""

    triggered_by_username = serializers.CharField(
        source="triggered_by.username", read_only=True, default=None
    )

    class Meta:
        model = SecurityScan
        fields = (
            "id",
            "scan_type",
            "started_at",
            "completed_at",
            "triggered_by_username",
            "status",
            "dependency_results",
            "sast_results",
            "summary",
            "error_message",
        )
        read_only_fields = fields


class MinutesSerializer(serializers.ModelSerializer):
    meeting_title = serializers.CharField(source="meeting.title", read_only=True)
    meeting_reference = serializers.CharField(source="meeting.reference_number", read_only=True)
    meeting_date = serializers.DateField(source="meeting.date", read_only=True)
    signed_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Minutes
        fields = (
            "id", "meeting", "meeting_title", "meeting_reference", "meeting_date",
            "status", "content", "pdf_version",
            "signed_by", "signed_by_name", "signed_at",
            "circulated_at", "minutes_due_at",
            "created_by", "created_by_name",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "created_by")

    def get_signed_by_name(self, obj):
        return obj.signed_by.username if obj.signed_by else None


class FlyingMinuteSignatureSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.username", read_only=True)

    class Meta:
        model = FlyingMinuteSignature
        fields = ("id", "meeting", "member", "member_name", "decision", "signed_at", "remarks")
        read_only_fields = ("id", "signed_at")


class MeetingTranscriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeetingTranscript
        fields = (
            "id", "meeting", "source", "raw_text", "structured_data",
            "audio_file", "ai_processed", "processed_at", "created_at",
        )
        read_only_fields = ("id", "created_at", "processed_at", "ai_processed")


class MeetingTranscriptPatchSerializer(serializers.Serializer):
    """Manual Zoom/Teams transcript paste before AI minutes drafting."""
    raw_text = serializers.CharField(required=True, allow_blank=False)
    source = serializers.ChoiceField(
        choices=TranscriptSource.choices,
        default=TranscriptSource.MANUAL_PASTE,
        required=False,
    )


class MinutesGenerateSerializer(serializers.Serializer):
    """Trigger AI minutes generation from transcript."""
    meeting_id = serializers.IntegerField()


class TranscriptGenerateSerializer(serializers.Serializer):
    """Trigger AI transcription of a meeting recording."""
    meeting_id = serializers.IntegerField()


class DecisionExtractSerializer(serializers.Serializer):
    """Extract decisions from minutes content."""
    meeting_id = serializers.IntegerField()


class ActionItemsExtractSerializer(serializers.Serializer):
    """Extract structured action register from minutes (C4)."""
    meeting_id = serializers.IntegerField()
    minutes_text = serializers.CharField(required=False, allow_blank=True)


class DeadlineReminderDraftSerializer(serializers.ModelSerializer):
    submission_reference = serializers.CharField(
        source='submission.reference_number', read_only=True,
    )
    submission_title = serializers.CharField(source='submission.title', read_only=True)
    ministry_name = serializers.CharField(source='ministry.name', read_only=True, allow_null=True)

    class Meta:
        from .models import DeadlineReminderDraft

        model = DeadlineReminderDraft
        fields = (
            'id', 'submission', 'submission_reference', 'submission_title',
            'recipient_user', 'recipient_email', 'recipient_name', 'recipient_role',
            'ministry', 'ministry_name', 'stage', 'deadline_at',
            'outstanding_summary', 'consequence_note', 'subject', 'body',
            'subject_bi', 'body_bi',
            'status', 'drafted_at', 'sent_at',
        )
        read_only_fields = (
            'submission_reference', 'submission_title', 'ministry_name',
            'drafted_at', 'sent_at', 'submission', 'recipient_user', 'ministry',
            'stage', 'deadline_at', 'recipient_email', 'recipient_name', 'recipient_role',
            'subject_bi', 'body_bi',
        )


class SessionPinSetupSerializer(serializers.Serializer):
    """Set or change the user's 4-6 digit session PIN."""
    pin = serializers.CharField(min_length=4, max_length=6, write_only=True)
    current_password = serializers.CharField(write_only=True, required=False,
        help_text="Required when changing an existing PIN.")

    def validate_pin(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("PIN must contain only digits (0-9).")
        return value


class SessionPinVerifySerializer(serializers.Serializer):
    """Verify the session PIN to obtain JWT tokens within a trusted window.
    Rate-limited to 5 attempts/min/IP via SessionPinVerifyThrottle."""
    username = serializers.CharField()
    pin = serializers.CharField(min_length=4, max_length=6, write_only=True)

    def validate(self, attrs):
        from django.contrib.auth.models import User
        try:
            user = User.objects.get(username__iexact=attrs["username"])
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid credentials.")

        profile = getattr(user, 'psc_profile', None)
        if not profile or not profile.session_pin:
            raise serializers.ValidationError("Session PIN not configured.")

        from django.contrib.auth.hashers import check_password
        if not check_password(attrs["pin"], profile.session_pin):
            raise serializers.ValidationError("Invalid PIN.")

        # Verify a trusted session exists and is valid
        from .models import TrustedSession
        ts = TrustedSession.valid_for(user)
        if not ts:
            raise serializers.ValidationError("Trusted session has expired. Please log in with your authenticator app.")

        attrs["user"] = user
        attrs["trusted_session"] = ts
        return attrs


class PSCForm37DataSerializer(serializers.ModelSerializer):
    employment_type_display = serializers.CharField(
        source="get_employment_type_display", read_only=True
    )

    class Meta:
        model = PSCForm37Data
        fields = [
            "id",
            "proposed_employee_name",
            "is_established_post",
            "post_title",
            "post_number",
            "post_level",
            "reasons_for_employment",
            "how_selected",
            "employment_type",
            "employment_type_display",
            "period_from",
            "period_to",
            "salary_vt",
            "salary_scale",
            "director_name",
            "director_department",
            "director_date",
            "dg_name",
            "dg_ministry",
            "dg_date",
            "approved",
            "secretary_name",
            "secretary_date",
            "ministry_advised_date",
            "job_offer_letter_date",
            "agreement_service_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ── ODU Restructure Checklist ─────────────────────────────────────────────────

class ODUChecklistSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the ODU Restructure Checklist."""

    items_answered = serializers.IntegerField(read_only=True)
    items_yes      = serializers.IntegerField(read_only=True)
    status_display         = serializers.CharField(source="get_status_display", read_only=True)
    submission_type_display = serializers.CharField(source="get_submission_type_display", read_only=True)
    recommendation_display  = serializers.CharField(source="get_recommendation_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        u = obj.created_by
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    class Meta:
        model  = ODURestructureChecklist
        fields = [
            "id", "submission",
            "status", "status_display",
            # Section A
            "ministry_department", "division_unit", "submission_type",
            "submission_type_display", "odu_officer_assigned", "manager_odu",
            # Section B
            "b1_cover_letter", "b2_org_chart", "b3_positions_list",
            "b4_jds_attached", "b5_rationale_stated",
            "b6_mandate_alignment", "b7_reporting_lines",
            "b8_no_duplication", "b9_span_of_control",
            "b10_job_purpose_linked", "b11_kra_kta_kpi",
            "b12_competencies", "b13_qual_experience",
            "b14_cost_analysis", "b15_grt_mapping", "b16_consultation",
            "b17_odu_analysis", "b18_feedback_provided",
            "b19_final_docs_ready", "b20_manager_final_check",
            # Progress
            "items_answered", "items_yes",
            # Section C
            "recommendation", "recommendation_display", "officer_comments",
            # Section D
            "verifying_officer_name", "verifying_officer_date",
            "manager_verifier_name", "manager_verifier_date",
            # Meta
            "created_by", "created_by_name", "submitted_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "created_by", "created_by_name",
            "items_answered", "items_yes",
            "status_display", "submission_type_display", "recommendation_display",
            "submitted_at", "created_at", "updated_at",
        ]


# ── Organisation Restructure Submission Data ──────────────────────────────────

class RestructureSubmissionDataSerializer(serializers.ModelSerializer):
    """Serializer for the Section 3.1 Organisation Restructure template data."""

    class Meta:
        model  = RestructureSubmissionData
        fields = [
            "id",
            # Cover
            "subject_title",
            # Section 1
            "background",
            # Section 2
            "proposal",
            # Section 3
            "costing_rows",
            "costing_notes",
            # Section 4
            "implementation_plan",
            # Section 5
            "recommendation",
            # Director
            "director_name",
            "director_date",
            # Attachments
            "attach_current_org_chart",
            "attach_proposed_org_chart",
            "attach_job_descriptions",
            "attach_other",
            "attach_other_description",
            # DG endorsement
            "dg_endorses",
            "dg_name",
            "dg_date",
            # Meta
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_costing_rows(self, value):
        """Ensure each row has the expected keys; fill missing ones with ''."""
        EXPECTED = [
            "current_post_no", "current_title", "current_level", "current_salary",
            "proposed_post_no", "proposed_title", "proposed_level",
            "proposed_salary", "salary_difference",
        ]
        if not isinstance(value, list):
            raise serializers.ValidationError("costing_rows must be a list.")
        cleaned = []
        for row in value:
            if not isinstance(row, dict):
                raise serializers.ValidationError("Each costing row must be an object.")
            cleaned.append({k: row.get(k, "") for k in EXPECTED})
        return cleaned


class StaffChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffChatMessage
        fields = ("id", "role", "content", "created_at")
        read_only_fields = fields


class StaffChatSessionListSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()
    last_preview = serializers.SerializerMethodField()

    class Meta:
        model = StaffChatSession
        fields = ("id", "title", "created_at", "updated_at", "message_count", "last_preview")
        read_only_fields = ("id", "created_at", "updated_at", "message_count", "last_preview")

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_last_preview(self, obj):
        last = obj.messages.order_by("-created_at").first()
        if not last:
            return ""
        text = last.content or ""
        return text[:120] + ("…" if len(text) > 120 else "")


class StaffChatSessionDetailSerializer(serializers.ModelSerializer):
    messages = StaffChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = StaffChatSession
        fields = ("id", "title", "created_at", "updated_at", "messages")
        read_only_fields = fields


class StaffChatSendSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=8000, trim_whitespace=True)
    session_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_message(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Message cannot be empty.")
        return value.strip()
