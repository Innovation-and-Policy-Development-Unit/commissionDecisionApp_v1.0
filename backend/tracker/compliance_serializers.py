"""DRF serializers for the compliance module (cases, stages, complaints)."""

from __future__ import annotations

from django.utils import timezone as tz
from rest_framework import serializers

from .compliance_models import (
    CaseFamily,
    CaseNote,
    Complaint,
    ComplianceCase,
    ComplianceCaseStage,
    LitigationRecord,
)
from .compliance_forms import COMPLIANCE_FORM_CODES


class ComplianceCaseStageSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    sla_status_display = serializers.CharField(source="get_sla_status_display", read_only=True)

    class Meta:
        model = ComplianceCaseStage
        fields = (
            "id", "stage_order", "stage_name", "stage_code",
            "responsible_role", "statutory_ref",
            "sla_days", "sla_working_days", "due_date",
            "status", "status_display", "sla_status", "sla_status_display",
            "is_optional", "started_at", "completed_at", "notes",
        )


class LitigationRecordSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = LitigationRecord
        fields = (
            "id", "description", "legal_counsel", "court_reference",
            "status", "status_display", "estimated_cost", "actual_cost",
            "date_initiated", "date_resolved", "notes", "created_at",
        )


class CaseNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = CaseNote
        fields = ("id", "text", "author", "author_name", "created_at", "updated_at")
        read_only_fields = ("author", "created_at", "updated_at")

    def get_author_name(self, obj):
        if not obj.author:
            return None
        return obj.author.get_full_name() or obj.author.username


def _sla_summary(case) -> dict:
    counts = {"on_track": 0, "at_risk": 0, "overdue": 0, "completed": 0}
    for stage in case.stages.all():
        counts[stage.sla_status] = counts.get(stage.sla_status, 0) + 1
    return counts


class ComplianceCaseListSerializer(serializers.ModelSerializer):
    reference_number = serializers.CharField(source="submission.reference_number", read_only=True)
    title = serializers.CharField(source="submission.title", read_only=True)
    current_stage = serializers.CharField(source="submission.current_stage", read_only=True)
    case_family_display = serializers.CharField(source="get_case_family_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    sla_summary = serializers.SerializerMethodField()
    days_open = serializers.SerializerMethodField()
    next_action_due = serializers.SerializerMethodField()
    latest_note = serializers.SerializerMethodField()
    year_group = serializers.SerializerMethodField()

    class Meta:
        model = ComplianceCase
        fields = (
            "id", "reference_number", "title", "current_stage",
            "case_family", "case_family_display",
            "subject_name", "subject_position", "subject_ministry", "is_senior_executive",
            "status", "status_display", "date_received", "created_at", "sla_summary",
            "days_open", "next_action_due", "latest_note", "year_group",
        )

    def get_sla_summary(self, obj):
        return _sla_summary(obj)

    def get_days_open(self, obj):
        if not obj.date_received:
            return None
        return (tz.localdate() - obj.date_received).days

    def get_next_action_due(self, obj):
        from .compliance_models import StageStatus
        pending = [s for s in obj.stages.all() if s.status != StageStatus.COMPLETED and s.due_date]
        if not pending:
            return None
        return str(min(s.due_date for s in pending))

    def get_latest_note(self, obj):
        notes = sorted(obj.case_notes.all(), key=lambda n: n.created_at, reverse=True)
        return notes[0].text[:250] if notes else None

    def get_year_group(self, obj):
        return obj.date_received.year if obj.date_received else None


class ComplianceCaseDetailSerializer(ComplianceCaseListSerializer):
    stages = ComplianceCaseStageSerializer(many=True, read_only=True)
    litigation_records = LitigationRecordSerializer(many=True, read_only=True)
    case_notes = CaseNoteSerializer(many=True, read_only=True)

    class Meta(ComplianceCaseListSerializer.Meta):
        fields = ComplianceCaseListSerializer.Meta.fields + (
            "description", "notes", "stages", "litigation_records", "case_notes",
        )


class ComplaintSerializer(serializers.ModelSerializer):
    ministry_name = serializers.CharField(source="ministry.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    lodged_by_name = serializers.SerializerMethodField()
    # FIREWALL: the linked case reference is exposed ONLY to compliance staff.
    # A ministry user must never see the case their complaint became.
    case_reference = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = (
            "id", "reference_number", "title", "description",
            "ministry", "ministry_name",
            "subject_name", "subject_position", "subject_ministry",
            "status", "status_display", "closed_reason",
            "lodged_by", "lodged_by_name", "case_reference",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "reference_number", "status", "closed_reason",
            "lodged_by", "case_reference", "created_at", "updated_at",
        )

    def get_lodged_by_name(self, obj):
        if not obj.lodged_by:
            return None
        return obj.lodged_by.get_full_name() or obj.lodged_by.username

    def get_case_reference(self, obj):
        from .compliance_scoping import user_can_view_compliance

        request = self.context.get("request")
        if not request or not user_can_view_compliance(request.user):
            return None
        if obj.compliance_case_id and obj.compliance_case.submission_id:
            return obj.compliance_case.submission.reference_number
        return None


class ComplaintLodgeSerializer(serializers.ModelSerializer):
    """Write serializer for a ministry lodging a complaint (write-only)."""

    class Meta:
        model = Complaint
        fields = (
            "id", "reference_number", "title", "description",
            "subject_name", "subject_position", "subject_ministry",
            "status", "created_at",
        )
        read_only_fields = ("id", "reference_number", "status", "created_at")


class ComplianceCaseCreateSerializer(serializers.Serializer):
    """Create a compliance case (Submission + ComplianceCase) in one call."""

    case_family = serializers.ChoiceField(choices=CaseFamily.choices)
    subject_name = serializers.CharField(max_length=200)
    subject_position = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    subject_ministry = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    is_senior_executive = serializers.BooleanField(required=False, default=False)
    form_type_code = serializers.ChoiceField(choices=[(c, c) for c in COMPLIANCE_FORM_CODES], default="COMP-SMDR")
    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    # Optional: triage an existing complaint into this case.
    complaint_id = serializers.IntegerField(required=False, allow_null=True)
