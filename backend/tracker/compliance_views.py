"""
Compliance module API.

Everything runs inside SCDMS — there is no external system.

  * Compliance staff (manager / senior / principal) create and manage cases, and
    triage complaints from the Complaints Register.
  * Ministry staff (Head of Agency / HR) lodge complaints (write-only) and see only
    their own complaint + its coarse status — never the resulting case.

Phase 4 adds the full visibility-scoping test matrix; this phase implements the
queryset scoping and per-action permissions.
"""

from __future__ import annotations

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .compliance_actions import (
    approve_compliance_case,
    create_compliance_case,
    return_compliance_case,
    submit_compliance_case,
)
from .compliance_models import Complaint, ComplaintStatus, ComplianceCase
from .compliance_scoping import (
    MINISTRY_LODGE_ROLES,
    complaint_queryset,
    compliance_case_queryset,
    user_can_view_compliance,
    user_is_compliance_manager,
)
from .compliance_serializers import (
    CaseNoteSerializer,
    ComplaintLodgeSerializer,
    ComplaintSerializer,
    ComplianceCaseCreateSerializer,
    ComplianceCaseDetailSerializer,
    ComplianceCaseListSerializer,
    LitigationRecordSerializer,
)


def _is_compliance_staff(user) -> bool:
    return user_can_view_compliance(user)


def _user_role(user) -> str | None:
    from .profile_utils import ensure_psc_profile

    try:
        return ensure_psc_profile(user).role
    except Exception:
        return None


class IsComplianceStaff(permissions.BasePermission):
    """Only compliance unit staff (and site admins) may use this endpoint."""

    message = "Only Compliance unit staff may access compliance cases."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return user_can_view_compliance(request.user)


class ComplianceCaseViewSet(viewsets.ModelViewSet):
    """Create, list, retrieve, and run the approval flow for compliance cases."""

    permission_classes = [permissions.IsAuthenticated, IsComplianceStaff]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        base = (
            ComplianceCase.objects
            .select_related("submission")
            .prefetch_related("stages", "litigation_records", "case_notes")
            .order_by("-created_at")
        )
        return compliance_case_queryset(self.request.user, base)

    def get_serializer_class(self):
        if self.action == "create":
            return ComplianceCaseCreateSerializer
        if self.action == "retrieve":
            return ComplianceCaseDetailSerializer
        return ComplianceCaseListSerializer

    def create(self, request, *args, **kwargs):
        ser = ComplianceCaseCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)

        complaint = None
        complaint_id = data.pop("complaint_id", None)
        if complaint_id:
            complaint = Complaint.objects.filter(pk=complaint_id).first()
            if not complaint:
                raise ValidationError({"complaint_id": "Complaint not found."})

        try:
            case = create_compliance_case(creator=request.user, complaint=complaint, **data)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        out = ComplianceCaseDetailSerializer(case, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Submit the case: Senior/Principal → Manager approval; Manager → Secretary."""
        case = self.get_object()
        submit_compliance_case(case, request.user, _user_role(request.user))
        return Response(ComplianceCaseDetailSerializer(case, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Compliance Manager approves → forwarded to Secretary review."""
        if not user_is_compliance_manager(request.user):
            raise PermissionDenied("Only the Compliance Manager may approve a case.")
        case = self.get_object()
        approve_compliance_case(case, request.user)
        return Response(ComplianceCaseDetailSerializer(case, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="return")
    def return_for_changes(self, request, pk=None):
        """Compliance Manager returns the case to the originating officer."""
        if not user_is_compliance_manager(request.user):
            raise PermissionDenied("Only the Compliance Manager may return a case.")
        case = self.get_object()
        return_compliance_case(case, request.user, reason=request.data.get("reason", ""))
        return Response(ComplianceCaseDetailSerializer(case, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def notes(self, request, pk=None):
        """Add a case note."""
        case = self.get_object()
        ser = CaseNoteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(case=case, author=request.user)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def litigation(self, request, pk=None):
        """Add a litigation record (FR-13 cost tracking)."""
        case = self.get_object()
        ser = LitigationRecordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(case=case)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="stage")
    def update_stage(self, request, pk=None):
        """Update a statutory stage's status (e.g. mark complete) and refresh SLA."""
        from django.utils import timezone

        from .compliance_models import StageStatus
        from .compliance_workflows import recompute_case_sla

        case = self.get_object()
        stage_id = request.data.get("stage_id")
        new_status = request.data.get("status")
        stage = case.stages.filter(pk=stage_id).first()
        if not stage:
            raise ValidationError({"stage_id": "Stage not found for this case."})
        if new_status not in StageStatus.values:
            raise ValidationError({"status": "Invalid stage status."})
        stage.status = new_status
        if new_status == StageStatus.IN_PROGRESS and not stage.started_at:
            stage.started_at = timezone.now()
        if new_status == StageStatus.COMPLETED:
            stage.completed_at = timezone.now()
        stage.save(update_fields=["status", "started_at", "completed_at"])
        recompute_case_sla(case)
        return Response(ComplianceCaseDetailSerializer(case, context={"request": request}).data)


class CanLodgeOrViewComplaint(permissions.BasePermission):
    """Ministry staff may lodge + view their own; compliance staff may do everything."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user_can_view_compliance(user):
            return True
        # Ministry staff: may create and read (queryset is scoped to their own).
        if view.action in ("create", "list", "retrieve"):
            return _user_role(user) in MINISTRY_LODGE_ROLES
        return False


class ComplaintViewSet(viewsets.ModelViewSet):
    """Complaints Register (compliance) + ministry write-only lodgement."""

    permission_classes = [permissions.IsAuthenticated, CanLodgeOrViewComplaint]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create" and not _is_compliance_staff(self.request.user):
            return ComplaintLodgeSerializer
        return ComplaintSerializer

    def get_queryset(self):
        base = Complaint.objects.select_related("ministry", "compliance_case__submission").order_by("-created_at")
        return complaint_queryset(self.request.user, base)

    def perform_create(self, serializer):
        user = self.request.user
        from .profile_utils import ensure_psc_profile

        ministry_id = None
        try:
            ministry_id = ensure_psc_profile(user).ministry_id
        except Exception:
            pass
        serializer.save(lodged_by=user, ministry_id=ministry_id)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """Compliance triages a complaint and opens a case from it."""
        if not _is_compliance_staff(request.user):
            raise PermissionDenied("Only Compliance staff may triage complaints.")
        complaint = self.get_object()
        if complaint.compliance_case_id:
            raise ValidationError("This complaint has already been converted to a case.")

        ser = ComplianceCaseCreateSerializer(data={
            **request.data,
            "subject_name": request.data.get("subject_name") or complaint.subject_name or complaint.title,
            "subject_position": request.data.get("subject_position") or complaint.subject_position,
            "subject_ministry": request.data.get("subject_ministry") or complaint.subject_ministry,
            "title": request.data.get("title") or complaint.title,
            "description": request.data.get("description") or complaint.description,
        })
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        data.pop("complaint_id", None)
        case = create_compliance_case(creator=request.user, complaint=complaint, **data)
        return Response(
            ComplianceCaseDetailSerializer(case, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Compliance rejects a complaint with a reason visible to the lodging ministry."""
        if not _is_compliance_staff(request.user):
            raise PermissionDenied("Only Compliance staff may triage complaints.")
        complaint = self.get_object()
        complaint.status = ComplaintStatus.REJECTED
        complaint.closed_reason = request.data.get("reason", "")
        from django.utils import timezone
        complaint.triaged_by = request.user
        complaint.triaged_at = timezone.now()
        complaint.save(update_fields=["status", "closed_reason", "triaged_by", "triaged_at"])
        return Response(ComplaintSerializer(complaint, context={"request": request}).data)
