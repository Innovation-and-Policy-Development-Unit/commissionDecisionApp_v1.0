"""DRF serializers for the compliance module (cases, stages, complaints)."""

from __future__ import annotations

from django.utils import timezone as tz
from rest_framework import serializers

from .compliance_models import (
    CaseFamily,
    CaseNote,
    Complaint,
    ComplianceCase,
    ComplianceCaseDecision,
    ComplianceCaseStage,
    GrievanceMediatorAppointment,
    Investigation,
    LitigationRecord,
    OffenceType,
    SuspensionRecord,
)
from .compliance_forms import COMPLIANCE_FORM_CODES


class ComplianceCaseStageSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    sla_status_display = serializers.CharField(source="get_sla_status_display", read_only=True)
    documents = serializers.SerializerMethodField()

    def get_documents(self, obj):
        return [
            {
                "id": link.document_id,
                "original_name": link.document.original_name,
                "description": link.document.description,
                "note": link.document.note,
            }
            for link in obj.document_links.select_related("document").all()
        ]

    class Meta:
        model = ComplianceCaseStage
        fields = (
            "id", "stage_order", "stage_name", "stage_code",
            "responsible_role", "responsible_officer", "statutory_ref",
            "sla_days", "sla_working_days", "due_date",
            "status", "status_display", "sla_status", "sla_status_display",
            "is_optional", "started_at", "completed_at", "notes", "outcome_notes",
            "documents",
        )


class LitigationRecordSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = LitigationRecord
        fields = (
            "id", "description",
            "court_name", "court_reference", "legal_counsel", "opposing_counsel",
            "status", "status_display", "estimated_cost", "actual_cost",
            "date_initiated", "next_court_date", "court_date_notified", "date_resolved", "notes",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "court_date_notified", "created_at", "updated_at")


class GrievanceMediatorSerializer(serializers.ModelSerializer):
    outcome_display  = serializers.CharField(source="get_outcome_display", read_only=True)
    appointed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GrievanceMediatorAppointment
        fields = (
            "id", "mediator_name", "mediator_organisation", "mediator_contact",
            "appointment_date", "mediation_start_date", "mediation_end_date",
            "outcome", "outcome_display", "mom_reference", "outcome_notes",
            "appointed_by", "appointed_by_name", "created_at", "updated_at",
        )
        read_only_fields = ("id", "appointed_by", "created_at", "updated_at")

    def get_appointed_by_name(self, obj):
        if not obj.appointed_by:
            return None
        return obj.appointed_by.get_full_name() or obj.appointed_by.username


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
    nature_of_offence_label = serializers.CharField(source="nature_of_offence.label", read_only=True, default=None)
    offence_category = serializers.CharField(source="nature_of_offence.category", read_only=True, default=None)
    sla_summary = serializers.SerializerMethodField()
    days_open = serializers.SerializerMethodField()
    next_action_due = serializers.SerializerMethodField()
    latest_note = serializers.SerializerMethodField()
    year_group = serializers.SerializerMethodField()
    # Included in the list payload so the Litigation Tracker (which reads the
    # case list) can flatten records across cases. Prefetched in the viewset.
    litigation_records = LitigationRecordSerializer(many=True, read_only=True)

    class Meta:
        model = ComplianceCase
        fields = (
            "id", "reference_number", "title", "current_stage",
            "case_family", "case_family_display",
            "nature_of_offence", "nature_of_offence_label", "offence_category", "offence_detail",
            "subject_name", "subject_position", "subject_ministry", "is_senior_executive",
            "status", "status_display", "date_received", "created_at", "sla_summary",
            "days_open", "next_action_due", "latest_note", "year_group",
            "litigation_records",
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


class ComplianceCaseDecisionSerializer(serializers.ModelSerializer):
    outcome_display      = serializers.CharField(source="get_outcome_display", read_only=True)
    decision_body_display = serializers.CharField(source="get_decision_body_display", read_only=True)
    decided_by_name      = serializers.SerializerMethodField()

    class Meta:
        model = ComplianceCaseDecision
        fields = (
            "id", "outcome", "outcome_display",
            "decision_body", "decision_body_display",
            "decision_date", "narrative", "stage_reference",
            "decided_by", "decided_by_name", "created_at",
        )
        read_only_fields = ("id", "decided_by", "created_at")

    def get_decided_by_name(self, obj):
        if not obj.decided_by:
            return None
        return obj.decided_by.get_full_name() or obj.decided_by.username


class OffenceTypeSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = OffenceType
        fields = ("id", "code", "label", "category", "category_display",
                  "description", "statutory_ref", "active", "display_order")
        read_only_fields = ("id",)


class InvestigationSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    panel_member_names = serializers.SerializerMethodField()
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = Investigation
        fields = (
            "id", "case", "panel_members", "panel_member_names", "panel_members_text",
            "terms_of_reference", "appointed_at", "started_at", "completed_at",
            "findings", "recommendation", "report_document", "has_report",
            "status", "status_display", "created_by", "created_at", "updated_at",
        )
        read_only_fields = ("id", "case", "created_by", "created_at", "updated_at")

    def get_panel_member_names(self, obj):
        return [u.get_full_name() or u.username for u in obj.panel_members.all()]

    def get_has_report(self, obj):
        return bool(obj.report_document)


class SuspensionRecordSerializer(serializers.ModelSerializer):
    salary_basis_display = serializers.CharField(source="get_salary_basis_display", read_only=True)
    reimbursement_status_display = serializers.CharField(source="get_reimbursement_status_display", read_only=True)
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = SuspensionRecord
        fields = (
            "id", "case", "salary_basis", "salary_basis_display",
            "monthly_salary", "withheld_amount", "reimbursed_amount",
            "suspension_start", "suspension_end", "max_period_days", "days_remaining",
            "reimbursement_status", "reimbursement_status_display",
            "opsc_assessed_by", "opsc_assessed_at",
            "reinstated_at", "reinstated_on_full_salary", "notes",
            "created_by", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "case", "suspension_end", "opsc_assessed_by", "opsc_assessed_at",
            "reinstated_on_full_salary", "created_by", "created_at", "updated_at",
        )

    def get_days_remaining(self, obj):
        if not obj.suspension_end or obj.reinstated_at:
            return None
        return (obj.suspension_end - tz.localdate()).days


class ComplianceCaseDetailSerializer(ComplianceCaseListSerializer):
    stages             = ComplianceCaseStageSerializer(many=True, read_only=True)
    case_notes         = CaseNoteSerializer(many=True, read_only=True)
    decisions          = ComplianceCaseDecisionSerializer(many=True, read_only=True)
    mediator_appointment = GrievanceMediatorSerializer(read_only=True)
    investigation      = InvestigationSerializer(read_only=True)
    suspensions        = SuspensionRecordSerializer(many=True, read_only=True)
    repeat_offence     = serializers.SerializerMethodField()

    class Meta(ComplianceCaseListSerializer.Meta):
        fields = ComplianceCaseListSerializer.Meta.fields + (
            "description", "notes", "stages",
            "case_notes", "decisions", "mediator_appointment",
            "investigation", "suspensions", "repeat_offence",
        )

    def get_repeat_offence(self, obj):
        """Prior cases for the same subject + same offence type within the 3-year
        warning-validity window — the signal that escalates a repeat to serious
        misconduct. Returns None when no offence type is set."""
        if not obj.nature_of_offence_id or not obj.subject_name:
            return None
        from datetime import timedelta
        cutoff = tz.localdate() - timedelta(days=3 * 365)
        prior = (
            ComplianceCase.objects
            .filter(
                nature_of_offence_id=obj.nature_of_offence_id,
                subject_name__iexact=obj.subject_name.strip(),
                date_received__gte=cutoff,
            )
            .exclude(pk=obj.pk)
            .count()
        )
        return {
            "prior_count": prior,
            "is_repeat": prior > 0,
            "window_years": 3,
        }


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
    nature_of_offence_id = serializers.IntegerField(required=False, allow_null=True)
    offence_detail = serializers.CharField(required=False, allow_blank=True, default="")
    # Optional: triage an existing complaint into this case.
    complaint_id = serializers.IntegerField(required=False, allow_null=True)
