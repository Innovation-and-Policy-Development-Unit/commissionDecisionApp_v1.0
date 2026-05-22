import os
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.db import models, transaction
from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import get_resolver
from django.urls.resolvers import URLPattern, URLResolver
from django.utils import timezone
from datetime import timedelta
from rest_framework import mixins, parsers, permissions, status, viewsets, exceptions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AgendaStatus,
    APIKey,
    Classification,
    CommissionTask,
    CommissionSubTask,
    CommissionTaskUpdate,
    Department,
    FlyingMinuteSignature,
    FormCategory,
    PSCFormField,
    PSCFormResponse,
    PSCFormType,
    Meeting,
    MeetingStatus,
    MeetingType,
    AgendaItem,
    Ministry,
    Notification,
    Profile,
    Role,
    RoleDefinition,
    SecurityNotice,
    Submission,
    SystemPermission,
    SystemSetting,
    WorkflowEvent,
    WorkflowStage,
    RequiredDocument,
    RoutedUnit,
    SubmissionChecklistItem,
    SubmissionDocument,
    DocumentAnnotation,
    DocumentSignature,
    UserSignature,
)
from .models import PasswordResetToken
from .rbac import (
    rbac_can_access_admin_panel,
    rbac_can_mutate_ministry_department,
    rbac_user_can_manage_roles,
    rbac_user_can_manage_users,
    rbac_user_can_view_audit_log,
    rbac_user_has_permission,
)
from .serializers import (
    CommissionTaskSerializer,
    CommissionTaskUpdateBodySerializer,
    CommissionTaskUpdateSerializer,
    DepartmentSerializer,
    FormCategorySerializer,
    PSCFormFieldSerializer,
    PSCFormResponseSerializer,
    PSCFormTypeSerializer,
    MeetingSerializer,
    AgendaItemSerializer,
    MinistrySerializer,
    MeSerializer,
    TOTPVerifySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileSerializer,
    RegisterSerializer,
    RoleDefinitionSerializer,
    RoleDefinitionWriteSerializer,
    SetPasswordSerializer,
    SubmissionDetailSerializer,
    SubmissionListSerializer,
    SubmissionWriteSerializer,
    SystemPermissionSerializer,
    TransitionSerializer,
    UserAdminUpdateSerializer,
    UserProfileSerializer,
    APIKeySerializer,
    SystemSettingSerializer,
    FeedbackReportSerializer,
    FeedbackReportDetailSerializer,
    FeedbackCommentSerializer,
    NotificationSerializer,
    MinutesSerializer,
    MeetingTranscriptSerializer,
    MinutesGenerateSerializer,
    TranscriptGenerateSerializer,
    SessionPinSetupSerializer,
    SessionPinVerifySerializer,
    DecisionExtractSerializer,
    CommissionSubTaskSerializer,
    FlyingMinuteSignatureSerializer,
    TaskReportSerializer,
    ChecklistItemSerializer,
    RequiredDocumentSerializer,
    SubmissionDocumentSerializer,
    DocumentAnnotationSerializer,
    DocumentSignatureSerializer,
    UserSignatureSerializer,
    ODUChecklistSerializer,
    RestructureSubmissionDataSerializer,
)
from .transitions import assert_transition_allowed, iter_allowed_targets
from .totp import generate_totp_secret, get_totp_uri, get_totp_qr_base64, verify_totp_code
from .throttles import SessionPinVerifyThrottle
from .models import (
    AuditLog,
    CommissionTask,
    CommissionTaskUpdate,
    Department,
    FormCategory,
    Meeting,
    MeetingTranscript,
    Minutes,
    MinutesStatus,
    AgendaItem,
    Ministry,
    Profile,
    Role,
    RoleDefinition,
    SecurityIncident,
    SecurityNotice,
    SecurityScan,
    Submission,
    SystemPermission,
    TrustedSession,
    WorkflowEvent,
    WorkflowStage,
    APIKey,
    SystemSetting,
    FeedbackReport,
    FeedbackComment,
    FeedbackStatus,
    ODURestructureChecklist,
    ODUChecklistStatus,
    RestructureSubmissionData,
)


def _profile(user):
    try:
        return user.psc_profile
    except Profile.DoesNotExist as exc:
        raise PermissionDenied("User profile is not configured for Commission Decision App.") from exc


def _resolve_opsc_ministry(profile):
    """Return the Ministry PK for an OPSC internal submitter.

    Uses the user's own profile ministry if set, otherwise looks for the OPSC
    ministry by name (contains 'Public Service Commission').
    Raises PermissionDenied if no ministry can be resolved.
    """
    if profile.ministry_id:
        return profile.ministry_id
    opsc = (
        Ministry.objects.filter(code__iexact="OPSC").first()
        or Ministry.objects.filter(
            models.Q(name__icontains="Public Service Commission")
            | models.Q(name__icontains="OPSC")
        ).first()
    )
    if opsc:
        return opsc.pk
    raise PermissionDenied(
        "Could not resolve an OPSC ministry for this internal submission. "
        "Please ensure your profile has a Ministry set or that an OPSC ministry record exists."
    )


def _submission_queryset_for(user):
    qs = Submission.objects.select_related(
        "ministry",
        "department",
        "form_category",
        "created_by",
        "parent_submission",
    ).prefetch_related("events__actor", "attached_submissions")
    if user.is_superuser or user.is_staff:
        return qs
    profile = _profile(user)
    role = profile.role
    if role in {Role.MINISTRY_HR, Role.HEAD_OF_AGENCY}:
        if not profile.ministry_id:
            return qs.none()
        return qs.filter(ministry_id=profile.ministry_id)
    if role == Role.DEPT_ADMIN:
        if not profile.department_id:
            return qs.none()
        return qs.filter(department_id=profile.department_id)
    _UNIT_PRINCIPAL_ROLES = {
        Role.ODU_PRINCIPAL,
        Role.HR_UNIT_PRINCIPAL,
        Role.VIPAM_PRINCIPAL,
        Role.COMPLIANCE_PRINCIPAL,
    }
    if role in {Role.COMPLIANCE_SENIOR, Role.COMPLIANCE_MANAGER, Role.COMPLIANCE_PRINCIPAL}:
        return qs.filter(
            form_category__code="COMPLIANCE",
            is_internal=True,
        ).exclude(cms_case_id="").filter(cms_case_id__isnull=False)
    if role in _UNIT_PRINCIPAL_ROLES:
        # Principals see only submissions explicitly assigned to them
        return qs.filter(assigned_to=user)
    # CSU Manager sees only internal submissions
    if role == Role.CSU_MANAGER:
        return qs.filter(is_internal=True)
    if role in {
        Role.PSC_OFFICER,
        Role.PSC_SECRETARY,
        Role.PSC_COMMISSIONER,
        Role.CHAIRPERSON,
        Role.PSC_ADMIN,
        Role.SENIOR_ADMIN_OFFICER,
        Role.PSC_MANAGER,
        Role.PRINCIPAL_OFFICER,
        Role.SENIOR_OFFICER,
        Role.VIPAM_MANAGER,
        Role.HR_UNIT_MANAGER,
        Role.ODU_MANAGER,
        Role.COMPLIANCE_MANAGER,
    }:
        return qs
    if rbac_user_has_permission(user, "view_submissions"):
        return qs
    return qs.none()


def _commission_task_queryset_for(user):
    qs = CommissionTask.objects.select_related(
        "submission",
        "submission__ministry",
        "assigned_manager",
        "assigned_staff",
        "created_by",
    ).prefetch_related("assigned_staff_m2m", "subtasks")
    if user.is_superuser or user.is_staff:
        return qs
    profile = _profile(user)
    if profile.role == Role.PSC_ADMIN:
        return qs
    if rbac_user_has_permission(user, "allocate_decision"):
        return qs
    if rbac_user_has_permission(user, "assign_task"):
        return qs.filter(assigned_manager=user)
    if rbac_user_has_permission(user, "update_implementation"):
        return qs.filter(
            models.Q(assigned_staff=user) | models.Q(assigned_staff_m2m=user)
        ).distinct()
    return qs.none()


def _user_can_add_commission_task_update(user, task):
    if user.is_superuser or user.is_staff:
        return True
    if rbac_user_has_permission(user, "allocate_decision"):
        return True
    if task.assigned_manager_id == user.id and rbac_user_has_permission(user, "assign_task"):
        return True
    if task.assigned_staff_id == user.id and rbac_user_has_permission(user, "update_implementation"):
        return True
    if task.assigned_staff_m2m.filter(id=user.id).exists() and rbac_user_has_permission(user, "update_implementation"):
        return True
    return False


class HasManageUsers(permissions.BasePermission):
    """PSC Admin, Django staff/superuser, or role with ``manage_users`` permission."""

    message = "You need manage_users permission, staff/superuser access, or PSC Administrator role."

    def has_permission(self, request, view):
        return rbac_user_can_manage_users(request.user)


class HasManageRoles(permissions.BasePermission):
    """PSC Admin, Django staff/superuser, or role with ``manage_roles`` permission."""

    message = "You need manage_roles permission, staff/superuser access, or PSC Administrator role."

    def has_permission(self, request, view):
        return rbac_user_can_manage_roles(request.user)


class CanMutateMinistryDepartment(permissions.BasePermission):
    """Create/update/delete ministries or departments."""

    message = "You need manage_users or manage_roles (or staff/superuser / PSC Admin) to change ministries or departments."

    def has_permission(self, request, view):
        return rbac_can_mutate_ministry_department(request.user)


class HasProfilePermission(permissions.BasePermission):
    """PSC Tracker expects a Profile for role-scoped users; Django staff/superuser may access without one."""

    message = (
        "This account has no PSC profile. Open Django Admin → PSC profiles → Add, "
        "link this user, and set a role (e.g. PSC Admin)."
    )

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        try:
            request.user.psc_profile
        except ObjectDoesNotExist:
            return False
        return True


# ── Notification helpers ─────────────────────────────────────────────────────


def _updated_fields(submission, prev, target):
    """Return minimal set of fields to save given the transition."""
    fields = {"current_stage"}
    if target == WorkflowStage.UNDER_ASSESSMENT and submission.assessment_started_at is not None:
        fields.add("assessment_started_at")
        fields.add("assessment_deadline_at")
    if submission.scheduled_meeting_id:
        fields.add("scheduled_meeting")
    return fields


def _dispatch_transition_notifications(submission, prev, target, actor):
    """Create in-app Notification records for the relevant parties."""
    from .models import Meeting, Notification as NotificationModel

    recipients = []

    if prev == WorkflowStage.DRAFT and target == WorkflowStage.SUBMITTED:
        # Notify the relevant OPSC Unit Manager
        unit_to_role = {
            "odu": Role.ODU_MANAGER,
            "hr": Role.HR_UNIT_MANAGER,
            "vipam": Role.VIPAM_MANAGER,
            "compliance": Role.COMPLIANCE_MANAGER,
        }
        manager_role = unit_to_role.get(submission.routed_unit, Role.PSC_OFFICER)
        recipients = User.objects.filter(
            psc_profile__role=manager_role, is_active=True
        )
        title = f"New submission: {submission.reference_number}"
        body = f"{submission.title} has been submitted and needs your checklist review."

    elif target == WorkflowStage.RETURNED_FOR_CLARIFICATION:
        recipients = User.objects.filter(
            pk=submission.created_by_id, is_active=True
        )
        title = f"Submission returned: {submission.reference_number}"
        body = f"Your submission '{submission.title}' was returned. Please check the remarks."

    elif prev == WorkflowStage.RETURNED_FOR_CLARIFICATION and target == WorkflowStage.SUBMITTED:
        unit_to_role = {
            "odu": Role.ODU_MANAGER,
            "hr": Role.HR_UNIT_MANAGER,
            "vipam": Role.VIPAM_MANAGER,
            "compliance": Role.COMPLIANCE_MANAGER,
        }
        manager_role = unit_to_role.get(submission.routed_unit, Role.PSC_OFFICER)
        recipients = User.objects.filter(
            psc_profile__role=manager_role, is_active=True
        )
        title = f"Resubmitted: {submission.reference_number}"
        body = f"{submission.title} has been resubmitted after clarification."

    elif target == WorkflowStage.FORWARDED_TO_COMMISSION:
        recipients = User.objects.filter(
            psc_profile__role__in=[
                Role.PSC_SECRETARY, Role.PSC_COMMISSIONER,
            ],
            is_active=True,
        )
        title = f"Ready for Commission: {submission.reference_number}"
        body = f"{submission.title} has been forwarded to the Commission."

    elif target == WorkflowStage.DEFERRED_BACK_TO_HR:
        recipients = User.objects.filter(
            pk=submission.created_by_id, is_active=True,
        )
        title = f"Deferred back to HR: {submission.reference_number}"
        body = f"The Commission has deferred '{submission.title}' back to your ministry for further action."

    elif target in (WorkflowStage.APPROVED, WorkflowStage.REJECTED):
        unit_to_role = {
            "odu": Role.ODU_MANAGER,
            "hr": Role.HR_UNIT_MANAGER,
            "vipam": Role.VIPAM_MANAGER,
            "compliance": Role.COMPLIANCE_MANAGER,
        }
        manager_role = unit_to_role.get(submission.routed_unit, Role.PSC_OFFICER)
        recipients = User.objects.filter(
            psc_profile__role__in=[manager_role, Role.PSC_MANAGER],
            is_active=True,
        ).union(
            User.objects.filter(pk=submission.created_by_id, is_active=True)
        )
        label = "approved" if target == WorkflowStage.APPROVED else "rejected"
        title = f"Submission {label}: {submission.reference_number}"
        body = f"'{submission.title}' has been {label} by the Commission."

    for user in recipients:
        NotificationModel.objects.create(
            recipient=user,
            submission=submission,
            channel=NotificationModel.Channel.BOTH,
            title=title,
            body=body,
        )


class SubmissionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]

    def get_throttles(self):
        if self.action == 'create':
            from .throttles import SubmissionCreateThrottle
            return [SubmissionCreateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = _submission_queryset_for(self.request.user)
        # Attached submissions are shown nested inside their parent, not as top-level rows
        if self.action == 'list':
            qs = qs.filter(is_attachment=False)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return SubmissionListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return SubmissionWriteSerializer
        return SubmissionDetailSerializer

    def perform_create(self, serializer):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        from .transitions import INTERNAL_SUBMITTER_ROLES
        profile = _profile(self.request.user)

        if profile.role in {Role.MINISTRY_HR, Role.DEPT_ADMIN}:
            # External ministry submission — standard workflow
            kwargs = {"current_stage": WorkflowStage.DRAFT, "is_internal": False}
            if profile.ministry_id:
                kwargs["ministry_id"] = profile.ministry_id
            if profile.department_id:
                kwargs["department_id"] = profile.department_id
            submission = serializer.save(**kwargs)

        elif profile.role == Role.CSU_MANAGER:
            # OPSC CSU internal submission — routes directly to Secretary
            ministry_id = _resolve_opsc_ministry(profile)
            kwargs = {
                "current_stage": WorkflowStage.DRAFT,
                "is_internal": True,
                "routed_unit": RoutedUnit.CSU,
                "ministry_id": ministry_id,
            }
            submission = serializer.save(**kwargs)

        elif profile.role == Role.ODU_MANAGER:
            # OPSC ODU internal submission — only the manager creates, routes to Secretary
            ministry_id = _resolve_opsc_ministry(profile)
            kwargs = {
                "current_stage": WorkflowStage.DRAFT,
                "is_internal": True,
                "routed_unit": RoutedUnit.ODU,
                "ministry_id": ministry_id,
            }
            submission = serializer.save(**kwargs)

        elif profile.role in {
            Role.COMPLIANCE_SENIOR,
            Role.COMPLIANCE_PRINCIPAL,
            Role.COMPLIANCE_MANAGER,
        }:
            from .cms_register import CMS_ORIGIN_MESSAGE
            raise PermissionDenied(CMS_ORIGIN_MESSAGE)

        elif profile.role in {Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY}:
            submission = serializer.save()
        else:
            raise PermissionDenied(
                "Only PSC Officers, Admins, Secretaries, Ministry staff, OPSC unit staff, "
                "or Compliance unit staff can create submissions."
            )
        _log(self.request, _AL.Action.CREATE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Submission created ({submission.current_stage}): {submission.title}")

    def perform_update(self, serializer):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY}:
            raise PermissionDenied("Only PSC staff or Ministry users can edit submissions.")
        submission = serializer.save()
        _log(self.request, _AL.Action.UPDATE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Submission updated: {submission.title}")

    def destroy(self, request, *args, **kwargs):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        submission = self.get_object()
        ref = submission.reference_number
        title = submission.title
        resp = super().destroy(request, *args, **kwargs)
        _log(request, _AL.Action.DELETE,
             resource_type="Submission", resource_label=ref,
             description=f"Submission deleted: {title}")
        return resp

    def retrieve(self, request, *args, **kwargs):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        submission = self.get_object()
        _log(request, _AL.Action.READ,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Submission viewed: {submission.title}")
        return Response(SubmissionDetailSerializer(submission).data)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        from .audit import log_action as _log
        from .models import AuditLog as _AL, Meeting
        submission = self.get_object()
        profile = _profile(request.user)
        ser = TransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        target = ser.validated_data["new_stage"]
        remarks = ser.validated_data.get("remarks", "")
        prev = submission.current_stage

        assert_transition_allowed(
            role=profile.role,
            current_stage=prev,
            target_stage=target,
            is_internal=submission.is_internal,
        )

        # ── Unit managers can only transition submissions routed to their unit ──
        _unit_role_to_routed = {
            Role.ODU_MANAGER: "odu",
            Role.VIPAM_MANAGER: "vipam",
            Role.HR_UNIT_MANAGER: "hr",
            Role.COMPLIANCE_MANAGER: "compliance",
            Role.CSU_MANAGER: "csu",
        }
        if profile.role in _unit_role_to_routed:
            expected = _unit_role_to_routed[profile.role]
            if submission.routed_unit != expected:
                raise PermissionDenied(
                    f"This submission is routed to {submission.routed_unit}, "
                    f"not your unit ({expected})."
                )

        # ── Unit principals can only transition submissions assigned to them ──
        _unit_principal_to_routed = {
            Role.ODU_PRINCIPAL: "odu",
            Role.VIPAM_PRINCIPAL: "vipam",
            Role.HR_UNIT_PRINCIPAL: "hr",
            Role.COMPLIANCE_PRINCIPAL: "compliance",
        }
        if profile.role in _unit_principal_to_routed:
            expected_unit = _unit_principal_to_routed[profile.role]
            if submission.routed_unit != expected_unit:
                raise PermissionDenied(
                    f"This submission is routed to {submission.routed_unit}, not your unit ({expected_unit})."
                )
            if submission.assigned_to_id != request.user.id:
                raise PermissionDenied(
                    "This submission has not been assigned to you. Contact your unit manager."
                )

        # ── Checklist gate: all required documents must be present ──────────────
        if prev == WorkflowStage.MANAGER_CHECKLIST_REVIEW and target == WorkflowStage.UNDER_ASSESSMENT:
            items = SubmissionChecklistItem.objects.filter(submission=submission)
            if items.exists():
                unchecked = items.filter(is_present=False).count()
                if unchecked > 0:
                    return Response(
                        {"detail": f"Cannot proceed: {unchecked} required document(s) not confirmed as present. Please complete the checklist first."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        with transaction.atomic():
            submission.current_stage = target

            # ── On first submission: auto-assign scheduled_meeting based on cutoff ──
            if prev == WorkflowStage.DRAFT and target == WorkflowStage.SUBMITTED:
                self._assign_scheduled_meeting(submission)

            # ── On HR responding to deferral: route to manager queue ──
            if prev == WorkflowStage.DEFERRED_BACK_TO_HR and target == WorkflowStage.SUBMITTED:
                submission.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW

            # ── Start assessment timer when entering UNDER_ASSESSMENT ──
            if target == WorkflowStage.UNDER_ASSESSMENT and submission.assessment_started_at is None:
                submission.assessment_started_at = timezone.now()
                submission._set_assessment_deadline_from_start()

            submission.save(update_fields=_updated_fields(submission, prev, target))
            WorkflowEvent.objects.create(
                submission=submission,
                actor=request.user,
                previous_stage=prev,
                new_stage=target,
                remarks=remarks,
            )

            # ── Cascade final decisions to attached child submissions ──────────
            _CASCADE_STAGES = {
                WorkflowStage.APPROVED,
                WorkflowStage.REJECTED,
                WorkflowStage.RETURNED,
                WorkflowStage.RETURNED_FOR_CLARIFICATION,
            }
            if target in _CASCADE_STAGES:
                children = Submission.objects.filter(parent_submission=submission, is_attachment=True)
                for child in children:
                    child_prev = child.current_stage
                    child.current_stage = target
                    child.save(update_fields=['current_stage', 'updated_at'])
                    WorkflowEvent.objects.create(
                        submission=child,
                        actor=request.user,
                        previous_stage=child_prev,
                        new_stage=target,
                        remarks=f"Auto-cascaded from parent submission {submission.reference_number}",
                    )

        # ── Fire notifications after commit ──
        transaction.on_commit(
            lambda: _dispatch_transition_notifications(submission, prev, target, request.user)
        )

        # ── Legacy: dispatch to CMS only when portal created submission without CMS link ──
        if target == WorkflowStage.COMPLIANCE_UNDER_REVIEW and not submission.cms_case_id:
            from .tasks.cms_bridge import dispatch_submission_to_cms
            transaction.on_commit(lambda: dispatch_submission_to_cms.delay(submission.pk))

        # ── CMS-first: close linked CMS case when SCDMS matter is complete ──
        if submission.cms_case_id:
            from .cms_close import maybe_close_cms_case
            sid = submission.pk
            transaction.on_commit(
                lambda: maybe_close_cms_case(
                    Submission.objects.prefetch_related(
                        "commission_tasks__subtasks"
                    ).get(pk=sid)
                )
            )

        _log(request, _AL.Action.UPDATE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Stage transition: {prev} → {target}" + (f" | {remarks}" if remarks else ""))
        return Response(SubmissionDetailSerializer(submission).data)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """
        Unit manager assigns a submission to one of their unit's principals.
        POST { "assigned_to": <user_id> }  — pass null to unassign.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        from django.contrib.auth.models import User

        submission = self.get_object()
        profile = _profile(request.user)

        _manager_to_unit = {
            Role.ODU_MANAGER: "odu",
            Role.VIPAM_MANAGER: "vipam",
            Role.HR_UNIT_MANAGER: "hr",
            Role.COMPLIANCE_MANAGER: "compliance",
        }
        _manager_to_principal_role = {
            Role.ODU_MANAGER: Role.ODU_PRINCIPAL,
            Role.VIPAM_MANAGER: Role.VIPAM_PRINCIPAL,
            Role.HR_UNIT_MANAGER: Role.HR_UNIT_PRINCIPAL,
            Role.COMPLIANCE_MANAGER: Role.COMPLIANCE_PRINCIPAL,
        }

        is_admin = profile.role == Role.PSC_ADMIN or request.user.is_superuser or request.user.is_staff
        is_unit_manager = profile.role in _manager_to_unit

        if not (is_admin or is_unit_manager):
            raise PermissionDenied("Only unit managers can assign submissions to principals.")

        if is_unit_manager:
            expected_unit = _manager_to_unit[profile.role]
            if submission.routed_unit != expected_unit:
                raise PermissionDenied(
                    f"This submission is routed to {submission.routed_unit}, not your unit ({expected_unit})."
                )

        assignee_id = request.data.get("assigned_to")

        if assignee_id is None:
            # Unassign
            submission.assigned_to = None
            submission.assigned_at = None
            submission.save(update_fields=["assigned_to", "assigned_at"])
            _log(request, _AL.Action.UPDATE, resource_type="Submission",
                 resource_id=submission.id, resource_label=submission.reference_number,
                 description="Submission unassigned from principal")
            return Response(SubmissionDetailSerializer(submission).data)

        try:
            assignee = User.objects.get(pk=assignee_id, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found or inactive."}, status=status.HTTP_400_BAD_REQUEST)

        # Verify the assignee is a principal in the correct unit
        assignee_profile = getattr(assignee, "psc_profile", None)
        if assignee_profile is None:
            return Response({"detail": "That user has no PSC profile."}, status=status.HTTP_400_BAD_REQUEST)

        if is_unit_manager:
            required_principal_role = _manager_to_principal_role[profile.role]
            if assignee_profile.role != required_principal_role:
                return Response(
                    {"detail": f"Assignee must be a principal in your unit ({required_principal_role})."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        submission.assigned_to = assignee
        submission.assigned_at = timezone.now()
        submission.save(update_fields=["assigned_to", "assigned_at"])

        _log(request, _AL.Action.UPDATE, resource_type="Submission",
             resource_id=submission.id, resource_label=submission.reference_number,
             description=f"Submission assigned to {assignee.username}")
        return Response(SubmissionDetailSerializer(submission).data)

    def _assign_scheduled_meeting(self, submission):
        """Set scheduled_meeting based on the next meeting's submission_cutoff."""
        from .models import Meeting
        now = timezone.now()
        next_meeting = Meeting.objects.filter(
            status__in=("scheduled", "in_progress"),
            date__gte=now.date(),
        ).order_by("date").first()
        if not next_meeting:
            submission.scheduled_meeting = None
            return

        if next_meeting.submission_cutoff and now > next_meeting.submission_cutoff:
            later = Meeting.objects.filter(
                status="scheduled",
                date__gt=next_meeting.date,
            ).order_by("date").first()
            submission.scheduled_meeting = later or next_meeting
        else:
            submission.scheduled_meeting = next_meeting

    @action(detail=True, methods=["get"])
    def allowed_transitions(self, request, pk=None):
        submission = self.get_object()
        profile = _profile(request.user)
        return Response(
            {"allowed": iter_allowed_targets(profile.role, submission.current_stage, is_internal=submission.is_internal)}
        )

    @action(detail=True, methods=["get"])
    def checklist(self, request, pk=None):
        """Return checklist items for a submission, auto-creating from RequiredDocuments.

        Matching priority (most specific first):
          1. form_type-specific docs (form_type matches submission.form_type_code)
          2. form_category-scoped docs (form_category matches, form_type is null)
          3. Global docs (both form_category and form_type are null)
        """
        submission = self.get_object()

        # Attached submissions have no independent checklist — reviewed alongside parent
        if submission.is_attachment:
            return Response([])

        # Internal OPSC submissions have no required-document checklist
        if submission.is_internal:
            return Response([])

        # Resolve the PSCFormType instance for this submission (may be None)
        form_type_obj = None
        if submission.form_type_code:
            from tracker.models import PSCFormType
            form_type_obj = PSCFormType.objects.filter(code=submission.form_type_code).first()

        if form_type_obj:
            # If there are form-type-specific docs, show those INSTEAD of category docs
            type_specific = RequiredDocument.objects.filter(
                is_active=True, form_type=form_type_obj
            )
            if type_specific.exists():
                required_docs = type_specific
            else:
                # Fall back to category-level + global docs
                required_docs = RequiredDocument.objects.filter(
                    is_active=True, form_type__isnull=True
                ).filter(
                    models.Q(form_category=submission.form_category) |
                    models.Q(form_category__isnull=True)
                )
        else:
            required_docs = RequiredDocument.objects.filter(
                is_active=True, form_type__isnull=True
            ).filter(
                models.Q(form_category=submission.form_category) |
                models.Q(form_category__isnull=True)
            )

        for doc in required_docs:
            SubmissionChecklistItem.objects.get_or_create(submission=submission, document=doc)
        items = SubmissionChecklistItem.objects.filter(
            submission=submission
        ).select_related('document', 'checked_by')
        return Response(ChecklistItemSerializer(items, many=True).data)

    @action(detail=True, methods=["patch"], url_path="checklist/(?P<item_id>[0-9]+)")
    def checklist_toggle(self, request, pk=None, item_id=None):
        """Toggle is_present on a checklist item."""
        submission = self.get_object()
        item = get_object_or_404(SubmissionChecklistItem, id=item_id, submission=submission)
        is_present = bool(request.data.get("is_present", False))
        item.is_present = is_present
        if is_present:
            item.checked_by = request.user
            item.checked_at = timezone.now()
        else:
            item.checked_by = None
            item.checked_at = None
        item.save()
        return Response(ChecklistItemSerializer(item).data)

    @action(detail=True, methods=["get", "post"])
    def documents(self, request, pk=None):
        """List or upload documents for a submission."""
        submission = self.get_object()
        profile = _profile(request.user)

        if request.method == "GET":
            docs = SubmissionDocument.objects.filter(submission=submission)
            return Response(SubmissionDocumentSerializer(docs, many=True).data)

        # POST — upload
        _upload_allowed_roles = {
            Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY,
            Role.PSC_ADMIN, Role.PSC_OFFICER, Role.PSC_SECRETARY,
            # OPSC unit managers upload supporting documents for their internal submissions
            Role.CSU_MANAGER, Role.ODU_MANAGER,
        }
        if profile.role not in _upload_allowed_roles:
            raise PermissionDenied("Only ministry HR, PSC staff, or OPSC unit staff may upload documents.")

        # Support multiple files in one request (for internal submissions free-form upload)
        files = request.FILES.getlist("files") or (
            [request.FILES["file"]] if "file" in request.FILES else []
        )
        if not files:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        created_docs = []
        for idx, uploaded in enumerate(files):
            if uploaded.size > 20 * 1024 * 1024:
                return Response(
                    {"detail": f"File '{uploaded.name}' exceeds the 20 MB limit."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # For internal submissions, the user may supply a human-readable name per file.
            # Accept document_name (single upload) or document_names[idx] (multi-upload).
            document_names = request.data.getlist("document_names")
            document_name = (
                document_names[idx]
                if document_names and idx < len(document_names)
                else request.data.get("document_name", "")
            )
            description = document_name or request.data.get("description", "")

            doc = SubmissionDocument.objects.create(
                submission=submission,
                file=uploaded,
                original_name=document_name if document_name else uploaded.name,
                description=description,
                uploaded_by=request.user,
            )
            created_docs.append(doc)

        if len(created_docs) == 1:
            return Response(SubmissionDocumentSerializer(created_docs[0]).data, status=status.HTTP_201_CREATED)
        return Response(SubmissionDocumentSerializer(created_docs, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "delete"], url_path="documents/(?P<doc_id>[0-9]+)")
    def document_detail(self, request, pk=None, doc_id=None):
        """Download or delete a single document."""
        from django.http import FileResponse
        import mimetypes

        submission = self.get_object()
        doc = get_object_or_404(SubmissionDocument, id=doc_id, submission=submission)

        if request.method == "DELETE":
            profile = _profile(request.user)
            if profile.role not in {Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY, Role.PSC_ADMIN}:
                raise PermissionDenied("Only the submitting ministry or PSC Admin may delete documents.")
            doc.file.delete(save=False)
            doc.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        # GET — serve the file
        try:
            file_handle = doc.file.open('rb')
        except Exception:
            return Response({"detail": "File not found on server."}, status=status.HTTP_404_NOT_FOUND)

        content_type, _ = mimetypes.guess_type(doc.original_name)
        content_type = content_type or 'application/octet-stream'
        is_pdf = doc.original_name.lower().endswith('.pdf')

        response = FileResponse(file_handle, content_type=content_type)
        disposition = 'inline' if is_pdf else 'attachment'
        response['Content-Disposition'] = f'{disposition}; filename="{doc.original_name}"'
        return response

    @action(detail=True, methods=["get", "post", "put"], url_path="form37")
    def form37(self, request, pk=None):
        """Get or create/update PSC Form 3-7 structured data for a submission."""
        from .models import PSCForm37Data
        from .serializers import PSCForm37DataSerializer
        submission = self.get_object()
        profile = _profile(request.user)

        if request.method == "GET":
            try:
                data = submission.form37_data
                return Response(PSCForm37DataSerializer(data).data)
            except PSCForm37Data.DoesNotExist:
                return Response({}, status=status.HTTP_200_OK)

        # POST / PUT — ministry HR, dept admin, PSC officer/admin/secretary may write
        allowed_write_roles = {
            Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY,
            Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY,
        }
        if profile.role not in allowed_write_roles:
            raise PermissionDenied("You do not have permission to update PSC Form 3-7 data.")

        try:
            instance = submission.form37_data
        except PSCForm37Data.DoesNotExist:
            instance = None

        partial = (request.method == "PUT")
        ser = PSCForm37DataSerializer(
            instance=instance,
            data=request.data,
            partial=partial,
        )
        ser.is_valid(raise_exception=True)
        ser.save(submission=submission)
        code = status.HTTP_200_OK if instance else status.HTTP_201_CREATED
        return Response(ser.data, status=code)

    @action(detail=True, methods=["get", "post", "put"], url_path="restructure-data")
    def restructure_data(self, request, pk=None):
        """Get or create/update Organisation Restructure submission data (Section 3.1 template)."""
        submission = self.get_object()
        profile = _profile(request.user)

        if request.method == "GET":
            try:
                data = submission.restructure_data
                return Response(RestructureSubmissionDataSerializer(data).data)
            except RestructureSubmissionData.DoesNotExist:
                return Response({}, status=status.HTTP_200_OK)

        # Write access: ministry HR, dept admin, head of agency, PSC staff
        allowed_write_roles = {
            Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY,
            Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY,
        }
        if profile.role not in allowed_write_roles:
            raise PermissionDenied("You do not have permission to update restructure submission data.")

        try:
            instance = submission.restructure_data
        except RestructureSubmissionData.DoesNotExist:
            instance = None

        partial = (request.method == "PUT")
        ser = RestructureSubmissionDataSerializer(
            instance=instance,
            data=request.data,
            partial=partial,
        )
        ser.is_valid(raise_exception=True)
        ser.save(submission=submission)
        code = status.HTTP_200_OK if instance else status.HTTP_201_CREATED
        return Response(ser.data, status=code)

    @action(detail=True, methods=["get", "post", "put"], url_path="dynamic-form")
    def dynamic_form(self, request, pk=None):
        """GET or save dynamic form response for any PSC form type that uses the form builder."""
        submission = self.get_object()

        if request.method == "GET":
            try:
                resp = submission.dynamic_form_response
                return Response(PSCFormResponseSerializer(resp).data)
            except PSCFormResponse.DoesNotExist:
                return Response({}, status=status.HTTP_200_OK)

        allowed_write_roles = {
            Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY,
            Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY,
        }
        profile = _profile(request.user)
        if profile.role not in allowed_write_roles:
            raise PermissionDenied("You do not have permission to submit form data.")

        try:
            instance = submission.dynamic_form_response
        except PSCFormResponse.DoesNotExist:
            instance = None

        form_type_id = request.data.get('form_type') or (
            instance.form_type_id if instance else None)
        data_payload = request.data.get('data', {})

        if instance:
            instance.data = data_payload
            instance.save()
            return Response(PSCFormResponseSerializer(instance).data)
        else:
            try:
                form_type = PSCFormType.objects.get(pk=form_type_id)
            except (PSCFormType.DoesNotExist, TypeError):
                return Response({'detail': 'form_type is required.'}, status=400)
            resp = PSCFormResponse.objects.create(
                submission=submission, form_type=form_type, data=data_payload)
            return Response(PSCFormResponseSerializer(resp).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def export_csv(self, request):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        profile = _profile(request.user)
        if profile.role in {Role.MINISTRY_HR, Role.DEPT_ADMIN}:
            raise PermissionDenied("CSV export is for PSC staff.")

        import csv
        from io import StringIO

        qs = self.filter_queryset(self.get_queryset())
        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "reference_number",
                "title",
                "form_category",
                "ministry",
                "department",
                "current_stage",
                "received_at",
                "assessment_deadline_at",
                "logged_by",
            ]
        )
        count = 0
        for s in qs.iterator():
            writer.writerow(
                [
                    s.reference_number,
                    s.title,
                    s.form_category.name,
                    s.ministry.name,
                    s.department.name if s.department_id else "",
                    s.current_stage,
                    s.received_at.isoformat(),
                    s.assessment_deadline_at.isoformat() if s.assessment_deadline_at else "",
                    s.created_by.username,
                ]
            )
            count += 1
        _log(request, _AL.Action.EXPORT,
             resource_type="Submission",
             description=f"CSV export: {count} submissions exported")
        response = HttpResponse(buf.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="submissions_export.csv"'
        return response


class MinistryViewSet(viewsets.ModelViewSet):
    """
    List/retrieve: any authenticated user with a PSC profile (reference data for forms).
    Create/update/delete: PSC Administrators only.
    """
    serializer_class = MinistrySerializer

    def get_queryset(self):
        user = self.request.user
        qs = Ministry.objects.all().order_by("name")
        if user.is_superuser or user.is_staff:
            return qs

        profile = _profile(user)
        # PSC staff see everything. Ministry/Dept staff see only their own.
        psc_roles = {
            Role.PSC_ADMIN, Role.PSC_OFFICER, Role.PSC_SECRETARY,
            Role.PSC_MANAGER, Role.CHAIRPERSON, Role.PSC_COMMISSIONER,
            Role.SENIOR_ADMIN_OFFICER, Role.PRINCIPAL_OFFICER, Role.SENIOR_OFFICER,
            Role.VIPAM_MANAGER, Role.HR_UNIT_MANAGER, Role.ODU_MANAGER, Role.COMPLIANCE_MANAGER
        }
        if profile.role not in psc_roles:
            if profile.ministry_id:
                return qs.filter(id=profile.ministry_id)
            return qs.none()
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), CanMutateMinistryDepartment()]
        return [permissions.IsAuthenticated(), HasProfilePermission()]


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    List/retrieve: any authenticated user with a PSC profile (optionally filter ?ministry=).
    Create/update/delete: PSC Administrators only.
    """
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), CanMutateMinistryDepartment()]
        return [permissions.IsAuthenticated(), HasProfilePermission()]

    def get_queryset(self):
        user = self.request.user
        qs = Department.objects.select_related("ministry").order_by("ministry__name", "name")
        if user.is_superuser or user.is_staff:
            pass # keep qs
        else:
            profile = _profile(user)
            psc_roles = {
                Role.PSC_ADMIN, Role.PSC_OFFICER, Role.PSC_SECRETARY,
                Role.PSC_MANAGER, Role.CHAIRPERSON, Role.PSC_COMMISSIONER,
                Role.SENIOR_ADMIN_OFFICER, Role.PRINCIPAL_OFFICER, Role.SENIOR_OFFICER,
                Role.VIPAM_MANAGER, Role.HR_UNIT_MANAGER, Role.ODU_MANAGER, Role.COMPLIANCE_MANAGER
            }
            if profile.role not in psc_roles:
                if profile.ministry_id:
                    qs = qs.filter(ministry_id=profile.ministry_id)
                else:
                    qs = qs.none()

        mid = self.request.query_params.get("ministry")
        if mid:
            qs = qs.filter(ministry_id=mid)
        return qs


class FormCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    queryset = FormCategory.objects.all().order_by('display_order', 'name')
    serializer_class = FormCategorySerializer

    def _require_admin(self):
        if self.request.user.is_superuser or self.request.user.is_staff:
            return
        try:
            profile = self.request.user.psc_profile
        except Exception:
            raise PermissionDenied("Admin access required.")
        if profile.role != Role.PSC_ADMIN:
            raise PermissionDenied("Only PSC Administrators can manage form categories.")

    def perform_create(self, serializer):
        self._require_admin()
        serializer.save()

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        self._require_admin()
        instance = self.get_object()
        instance.submissions.all().update(form_category=None)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PSCFormTypeViewSet(viewsets.ModelViewSet):
    """
    CRUD for PSC Form Types.
    Read: any authenticated user (drives submission dropdowns).
    Write: PSC Admins only.
    """
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    serializer_class = PSCFormTypeSerializer

    def get_queryset(self):
        qs = PSCFormType.objects.select_related('form_category').all()
        if self.request.query_params.get('active_only') == '1':
            qs = qs.filter(is_active=True)
        cat = self.request.query_params.get('form_category')
        if cat:
            qs = qs.filter(form_category_id=cat)
        audience = self.request.query_params.get('audience')
        if audience == 'compliance':
            from .compliance_forms import compliance_form_codes_for_role

            try:
                profile = self.request.user.psc_profile
            except Exception:
                return qs.none()
            codes = compliance_form_codes_for_role(profile.role)
            if not codes:
                return qs.none()
            qs = qs.filter(code__in=codes)
        return qs

    def _require_admin(self):
        if self.request.user.is_superuser or self.request.user.is_staff:
            return
        try:
            profile = self.request.user.psc_profile
        except Exception:
            raise PermissionDenied("Admin access required.")
        if profile.role != Role.PSC_ADMIN:
            raise PermissionDenied("Only PSC Administrators can manage form types.")

    def perform_create(self, serializer):
        self._require_admin()
        serializer.save()

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        self._require_admin()
        return super().destroy(request, *args, **kwargs)


class PSCFormFieldViewSet(viewsets.ModelViewSet):
    """
    Fields for a dynamic PSC form design.
    Read: any authenticated user.
    Write: PSC Admins (form designers) only.
    """
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    serializer_class = PSCFormFieldSerializer

    def get_queryset(self):
        qs = PSCFormField.objects.select_related('form_type').all()
        form_type = self.request.query_params.get('form_type')
        if form_type:
            qs = qs.filter(form_type_id=form_type)
        return qs

    def _require_admin(self):
        if self.request.user.is_superuser or self.request.user.is_staff:
            return
        try:
            profile = self.request.user.psc_profile
        except Exception:
            raise PermissionDenied("Admin access required.")
        if profile.role != Role.PSC_ADMIN:
            raise PermissionDenied("Only PSC Administrators can design forms.")

    def perform_create(self, serializer):
        self._require_admin()
        form_type_id = self.request.data.get('form_type')
        try:
            form_type = PSCFormType.objects.get(pk=form_type_id)
        except PSCFormType.DoesNotExist:
            raise PermissionDenied("Form type not found.")
        serializer.save(form_type=form_type)

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        self._require_admin()
        return super().destroy(request, *args, **kwargs)


class RequiredDocumentViewSet(viewsets.ModelViewSet):
    """
    CRUD for RequiredDocument entries.
    Read: any authenticated user with a profile.
    Write: PSC Admins only.
    Supports ?form_type=<id> and ?form_category=<id> query filters.
    """
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    serializer_class = RequiredDocumentSerializer

    def get_queryset(self):
        qs = RequiredDocument.objects.select_related('form_type', 'form_category').all()
        form_type = self.request.query_params.get('form_type')
        if form_type:
            qs = qs.filter(form_type_id=form_type)
        form_category = self.request.query_params.get('form_category')
        if form_category:
            qs = qs.filter(form_category_id=form_category)
        return qs

    def _require_admin(self):
        if self.request.user.is_superuser or self.request.user.is_staff:
            return
        try:
            profile = self.request.user.psc_profile
        except Exception:
            raise PermissionDenied("Admin access required.")
        if profile.role != Role.PSC_ADMIN:
            raise PermissionDenied("Only PSC Administrators can manage required documents.")

    def perform_create(self, serializer):
        self._require_admin()
        serializer.save()

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        self._require_admin()
        return super().destroy(request, *args, **kwargs)


class CommissionTaskViewSet(viewsets.ModelViewSet):
    """
    Commission Decision action items: allocate to OPSC Managers (secretariat),
    assign to Principal/Senior Officers (manager), update status (staff).
    """

    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    serializer_class = CommissionTaskSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return _commission_task_queryset_for(self.request.user)

    def perform_create(self, serializer):
        if not rbac_user_has_permission(self.request.user, "allocate_decision"):
            raise PermissionDenied("You do not have permission to allocate commission tasks.")
        sub = serializer.validated_data.get("submission")
        if sub is not None:
            # When a submission is provided, verify the user can access it.
            if not _submission_queryset_for(self.request.user).filter(pk=sub.pk).exists():
                raise PermissionDenied("You cannot attach a task to this submission.")
            # Minutes-signed gate only applies when a linked submission has a meeting.
            meeting = getattr(sub, "scheduled_meeting", None)
            if meeting:
                minutes = getattr(meeting, "minutes", None)
                if not minutes or minutes.status != "signed":
                    raise PermissionDenied(
                        "Cannot allocate task: Commission minutes have not been signed yet. "
                        "Task allocation is only permitted after the Chairperson has signed the minutes."
                    )
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        task = serializer.instance
        user = self.request.user
        if user.is_superuser or user.is_staff:
            serializer.save()
            self._maybe_close_cms_for_task(task)
            return

        vd = serializer.validated_data
        keys = set(vd.keys())

        if rbac_user_has_permission(user, "allocate_decision"):
            if "submission" in vd:
                raise PermissionDenied("Cannot move a task to another submission.")
            serializer.save()
            self._maybe_close_cms_for_task(task)
            return

        is_manager = task.assigned_manager_id == user.id and rbac_user_has_permission(user, "assign_task")
        is_staff = (
            task.assigned_staff_id == user.id
            or task.assigned_staff_m2m.filter(id=user.id).exists()
        ) and rbac_user_has_permission(user, "update_implementation")

        if is_manager:
            if "submission" in keys or "assigned_manager" in keys:
                raise PermissionDenied("You cannot reassign the submission or manager for this task.")
            serializer.save()
            self._maybe_close_cms_for_task(task)
            return

        if is_staff:
            if keys - {"status"}:
                raise PermissionDenied("You may only update the task status.")
            serializer.save()
            self._maybe_close_cms_for_task(task)
            return

        raise PermissionDenied("You cannot update this task.")

    def _maybe_close_cms_for_task(self, task):
        sub = task.submission
        if not sub or not (sub.cms_case_id or "").strip():
            return
        from .cms_close import maybe_close_cms_case
        sub_id = sub.pk
        transaction.on_commit(
            lambda: maybe_close_cms_case(
                Submission.objects.prefetch_related("commission_tasks__subtasks").get(pk=sub_id)
            )
        )

    @action(detail=True, methods=["get", "post", "patch", "delete"], url_path="subtasks")
    def subtasks(self, request, pk=None):
        """CRUD for subtasks within a commission task."""
        task = self.get_object()
        is_manager = (
            request.user.is_superuser
            or request.user.is_staff
            or rbac_user_has_permission(request.user, "allocate_decision")
            or (task.assigned_manager_id == request.user.id and rbac_user_has_permission(request.user, "assign_task"))
        )

        if request.method == "GET":
            qs = task.subtasks.select_related("created_by").prefetch_related("assigned_staff").all()
            return Response(CommissionSubTaskSerializer(qs, many=True).data)

        if not is_manager:
            raise PermissionDenied("Only the task manager can manage subtasks.")

        if request.method == "POST":
            ser = CommissionSubTaskSerializer(data={**request.data, "task": task.id})
            ser.is_valid(raise_exception=True)
            obj = ser.save(created_by=request.user)
            return Response(CommissionSubTaskSerializer(obj).data, status=status.HTTP_201_CREATED)

        subtask_id = request.query_params.get("subtask_id")
        if not subtask_id:
            return Response({"detail": "Provide subtask_id query parameter."}, status=400)
        try:
            subtask = task.subtasks.get(id=subtask_id)
        except CommissionSubTask.DoesNotExist:
            return Response({"detail": "Subtask not found."}, status=404)

        if request.method == "PATCH":
            ser = CommissionSubTaskSerializer(subtask, data=request.data, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
            self._maybe_close_cms_for_task(task)
            return Response(CommissionSubTaskSerializer(subtask).data)

        if request.method == "DELETE":
            subtask.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="reassign")
    def reassign(self, request, pk=None):
        """Manager reassigns task to one or more staff. Accepts {assigned_staff_m2m: [id, ...]}."""
        task = self.get_object()
        is_manager = (
            request.user.is_superuser
            or request.user.is_staff
            or (task.assigned_manager_id == request.user.id and rbac_user_has_permission(request.user, "assign_task"))
        )
        if not is_manager:
            raise PermissionDenied("Only the task manager can reassign staff.")

        staff_ids = request.data.get("assigned_staff_m2m", [])
        if not isinstance(staff_ids, list) or not staff_ids:
            return Response({"detail": "Provide assigned_staff_m2m as a non-empty list of user IDs."}, status=400)

        from django.contrib.auth.models import User
        valid_staff = User.objects.filter(
            id__in=staff_ids,
            psc_profile__role__in=(Role.PRINCIPAL_OFFICER, Role.SENIOR_OFFICER),
            is_active=True,
        )
        if valid_staff.count() != len(set(staff_ids)):
            return Response(
                {"detail": "One or more staff IDs are invalid or inactive."},
                status=400,
            )

        task.assigned_staff_m2m.set(valid_staff)
        task.assigned_staff = valid_staff.first()  # keep FK in sync
        task.save(update_fields=["assigned_staff"])

        from .audit import log_action as _log
        _log(request, _AL.Action.UPDATE, resource_type="CommissionTask",
             resource_id=str(task.id), resource_label=task.title,
             description=f"Task reassigned to {valid_staff.count()} staff")

        return Response(CommissionTaskSerializer(task).data)

    @action(detail=False, methods=["get"], url_path="report")
    def report(self, request):
        """Generate a task report for secretaries. Supports ?date_from=&date_to=&status=&manager_id=&format=csv"""
        from django.db.models import Count, Q
        from datetime import date, datetime

        qs = CommissionTask.objects.select_related(
            "submission", "assigned_manager", "created_by",
        ).prefetch_related("assigned_staff_m2m", "subtasks")

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        status_filter = request.query_params.get("status")
        manager_id = request.query_params.get("manager_id")

        if date_from:
            try:
                qs = qs.filter(created_at__gte=datetime.strptime(date_from, "%Y-%m-%d"))
            except ValueError:
                pass
        if date_to:
            try:
                qs = qs.filter(created_at__lte=datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1))
            except ValueError:
                pass
        if status_filter:
            qs = qs.filter(status=status_filter)
        if manager_id:
            qs = qs.filter(assigned_manager_id=manager_id)

        today = date.today()
        rows = []
        for t in qs:
            staff_names = [u.username for u in t.assigned_staff_m2m.all()]
            subtask_qs = t.subtasks.all()
            subtask_total = subtask_qs.count()
            subtask_done = subtask_qs.filter(status="completed").count()
            overdue_days = (today - t.due_date).days if t.due_date and t.due_date < today else 0

            rows.append({
                "task_id": t.id,
                "decision_number": t.decision_number,
                "title": t.title,
                "submission_ref": t.submission.reference_number if t.submission_id else "",
                "submission_title": t.submission.title if t.submission_id else "",
                "meeting_ref": t.meeting_reference or (t.meeting.title if t.meeting_id else ""),
                "decision_detail": t.decision_detail,
                "decision_outcome": t.get_decision_outcome_display() if t.decision_outcome else "",
                "action_unit": t.action_unit,
                "implementation_status": t.get_implementation_status_display() if t.implementation_status else "",
                "way_forward": t.way_forward,
                "manager": t.assigned_manager.username,
                "staff": staff_names,
                "status": t.status,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "decision_type": t.decision_type,
                "subtask_count": subtask_total,
                "subtask_completed": subtask_done,
                "days_overdue": overdue_days,
            })

        output_format = request.query_params.get("format", "json")
        if output_format == "csv":
            import csv
            from django.http import HttpResponse as CSVResponse
            response = CSVResponse(content_type="text/csv")
            response["Content-Disposition"] = "attachment; filename=commission_task_report.csv"
            writer = csv.DictWriter(response, fieldnames=[
                "task_id", "decision_number", "title", "submission_ref", "submission_title",
                "meeting_ref", "decision_detail", "decision_outcome", "action_unit",
                "implementation_status", "way_forward", "manager", "staff", "status",
                "due_date", "decision_type", "subtask_count", "subtask_completed", "days_overdue",
            ])
            writer.writeheader()
            for r in rows:
                r["staff"] = "; ".join(r["staff"])
                writer.writerow(r)
            return response

        return Response(rows)

    @action(detail=True, methods=["get", "post"], url_path="status-updates")
    def status_updates(self, request, pk=None):
        """Append-only log for progress notes and reporting (GET list, POST add)."""
        task = self.get_object()
        if request.method == "GET":
            qs = task.status_updates.select_related("author").order_by("-created_at")
            return Response(CommissionTaskUpdateSerializer(qs, many=True).data)
        if not _user_can_add_commission_task_update(request.user, task):
            raise PermissionDenied("You cannot add status updates on this task.")
        ser = CommissionTaskUpdateBodySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        body = ser.validated_data["body"].strip()
        if not body:
            return Response(
                {"detail": "Comment cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj = CommissionTaskUpdate.objects.create(task=task, author=request.user, body=body)
        return Response(CommissionTaskUpdateSerializer(obj).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="eligible-managers")
    def eligible_managers(self, request):
        if not rbac_user_has_permission(request.user, "allocate_decision"):
            raise PermissionDenied()
        qs = (
            User.objects.filter(psc_profile__role=Role.PSC_MANAGER, is_active=True)
            .select_related("psc_profile")
            .order_by("username")
        )
        return Response([{"id": u.id, "username": u.username} for u in qs])

    @action(detail=False, methods=["get"], url_path="eligible-staff")
    def eligible_staff(self, request):
        if not rbac_user_has_permission(request.user, "assign_task"):
            raise PermissionDenied()
        qs = User.objects.filter(
            psc_profile__role__in=(Role.PRINCIPAL_OFFICER, Role.SENIOR_OFFICER),
            is_active=True,
        )
        try:
            prof = request.user.psc_profile
            if prof.ministry_id:
                qs = qs.filter(psc_profile__ministry_id=prof.ministry_id)
        except Profile.DoesNotExist:
            pass
        qs = qs.select_related("psc_profile").order_by("username")
        return Response([{"id": u.id, "username": u.username} for u in qs])


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    user = request.user
    try:
        profile = user.psc_profile
    except Profile.DoesNotExist:
        if user.is_superuser or user.is_staff:
            # Superuser without a PSC profile: return a synthetic admin identity
            return Response({
                "id": None,
                "username": user.username,
                "email": user.email,
                "role": "psc_admin",
                "role_display": "PSC Administrator",
                "full_name": user.get_full_name() or user.username,
                "ministry": None,
                "ministry_name": None,
                "department": None,
                "department_name": None,
                "is_superuser": True,
            })
        return Response(
            {"detail": "This account has no PSC profile. Contact an administrator."},
            status=403,
        )
    if request.method == "PATCH":
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        profile.refresh_from_db()
        return Response(MeSerializer(profile, context={"request": request}).data)
    return Response(MeSerializer(profile, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def change_password_view(request):
    """POST /me/change-password/ — self-service password change."""
    user = request.user
    old_password = request.data.get("old_password", "").strip()
    new_password = request.data.get("new_password", "").strip()
    confirm_password = request.data.get("confirm_password", "").strip()

    if not old_password or not new_password:
        return Response(
            {"detail": "Current password and new password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not user.check_password(old_password):
        return Response(
            {"detail": "Current password is incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    from .models import SystemSetting as _SS
    min_len = _SS.get_val("PASSWORD_MIN_LENGTH")
    if min_len is None:
        min_len = 8
    else:
        min_len = int(min_len)
    if len(new_password) < min_len:
        return Response(
            {"detail": f"New password must be at least {min_len} characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if confirm_password and new_password != confirm_password:
        return Response(
            {"detail": "New passwords do not match."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user.set_password(new_password)
    user.save(update_fields=["password"])
    _security_log.info("PASSWORD_CHANGED | username=%s", user.username)
    from .audit import log_action as _log
    from .models import AuditLog as _AL
    _log(request, _AL.Action.PASSWORD_CHANGE,
         resource_type="User", resource_id=user.id,
         resource_label=user.username,
         description=f"Self-service password change by: {user.username}")
    return Response({"detail": "Password changed successfully."})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def password_policy_view(request):
    """GET /auth/password-policy/ — live policy from SystemSetting."""
    from .models import SystemSetting

    def _bool(key, default):
        val = SystemSetting.get_val(key)
        if val is None:
            return default
        return val.lower() in ("1", "true", "yes")

    def _int(key, default):
        val = SystemSetting.get_val(key)
        if val is None:
            return default
        try:
            return int(val)
        except (ValueError, TypeError):
            return default

    return Response(
        {
            "min_length": _int("PASSWORD_MIN_LENGTH", 8),
            "require_uppercase": _bool("PASSWORD_REQUIRE_UPPERCASE", True),
            "require_lowercase": _bool("PASSWORD_REQUIRE_LOWERCASE", True),
            "require_digits": _bool("PASSWORD_REQUIRE_DIGITS", True),
            "require_special": _bool("PASSWORD_REQUIRE_SPECIAL", True),
            "history_count": _int("PASSWORD_HISTORY_COUNT", 5),
        }
    )


def _security_audit_checks():
    from django.conf import settings

    checks = []
    checks.append(
        {
            "id": "debug",
            "label": "DEBUG mode",
            "detail": "Production deployments should run with DEBUG disabled.",
            "status": "fail" if settings.DEBUG else "pass",
        }
    )
    secret = getattr(settings, "SECRET_KEY", "") or ""
    checks.append(
        {
            "id": "secret_key",
            "label": "Secret key",
            "detail": "A non-empty SECRET_KEY must be configured.",
            "status": "pass" if len(secret) >= 20 else "fail",
        }
    )
    hosts = getattr(settings, "ALLOWED_HOSTS", []) or []
    checks.append(
        {
            "id": "allowed_hosts",
            "label": "ALLOWED_HOSTS",
            "detail": "Restrict host headers in production (avoid '*' when DEBUG is False).",
            "status": "warn"
            if hosts == ["*"] and not settings.DEBUG
            else ("pass" if hosts else "fail"),
        }
    )
    checks.append(
        {
            "id": "session_cookie_secure",
            "label": "Secure session cookies",
            "detail": "SESSION_COOKIE_SECURE should be True behind HTTPS in production.",
            "status": "warn"
            if not getattr(settings, "SESSION_COOKIE_SECURE", False) and not settings.DEBUG
            else "pass",
        }
    )
    summary = {"pass": 0, "warn": 0, "fail": 0}
    for c in checks:
        summary[c["status"]] += 1
    return summary, checks


def _api_endpoint_inventory():
    rows = []
    root = get_resolver()

    def walk(patterns, prefix):
        for pattern in patterns:
            if isinstance(pattern, URLResolver):
                walk(pattern.url_patterns, prefix + str(pattern.pattern))
            elif isinstance(pattern, URLPattern):
                raw = prefix + str(pattern.pattern)
                path = raw.replace("^", "").replace("$", "")
                path = "/" + path.lstrip("/")
                path = path.replace("//", "/")
                if "api/" in path:
                    cb = pattern.callback
                    handler = getattr(cb, "__qualname__", getattr(cb, "__name__", repr(cb)))
                    rows.append(
                        {
                            "path": path,
                            "name": pattern.name or "",
                            "handler": handler,
                        }
                    )

    walk(root.url_patterns, "")
    rows.sort(key=lambda r: r["path"])
    return rows


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, HasProfilePermission])
def global_search_view(request):
    """GET /search/?q= — cross-entity search scoped to the requesting user's permissions."""
    q = (request.GET.get("q") or "").strip()
    if len(q) < 2:
        return Response({"results": [], "total": 0, "query": q})

    profile = _profile(request.user)
    results = []

    # ── Submissions ────────────────────────────────────────────────────────
    subs = (
        _submission_queryset_for(request.user)
        .filter(
            models.Q(reference_number__icontains=q)
            | models.Q(title__icontains=q)
            | models.Q(notes__icontains=q)
            | models.Q(ministry__name__icontains=q)
        )
        .select_related("ministry")[:20]
    )
    for s in subs:
        results.append({
            "type": "submission",
            "id": s.id,
            "label": s.reference_number,
            "sublabel": s.title,
            "meta": s.ministry.name,
            "stage": s.current_stage,
            "url": f"/submissions/{s.id}",
        })

    # ── Commission tasks (PSC staff only) ──────────────────────────────────
    if profile.role not in {Role.MINISTRY_HR, Role.DEPT_ADMIN}:
        tasks = (
            _commission_task_queryset_for(request.user)
            .filter(
                models.Q(title__icontains=q)
                | models.Q(description__icontains=q)
                | models.Q(submission__reference_number__icontains=q)
            )[:10]
        )
        for t in tasks:
            results.append({
                "type": "task",
                "id": t.id,
                "label": t.title,
                "sublabel": t.submission.reference_number,
                "meta": t.get_status_display(),
                "stage": None,
                "url": f"/secretariat/tasks",
            })

    # ── Ministries (PSC staff only) ────────────────────────────────────────
    if profile.role in {
        Role.PSC_OFFICER, Role.PSC_SECRETARY, Role.PSC_ADMIN,
        Role.PSC_COMMISSIONER, Role.PSC_MANAGER,
    }:
        mins = Ministry.objects.filter(
            models.Q(name__icontains=q) | models.Q(code__icontains=q)
        )[:5]
        for m in mins:
            results.append({
                "type": "ministry",
                "id": m.id,
                "label": m.name,
                "sublabel": m.code,
                "meta": None,
                "stage": None,
                "url": "/admin/ministries-departments",
            })

    return Response({"results": results, "total": len(results), "query": q})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, HasProfilePermission])
def security_audit_view(request):
    """GET /auth/security-audit/ — configuration checks for the System Audit UI."""
    if not rbac_can_access_admin_panel(request.user):
        raise PermissionDenied()
    summary, checks = _security_audit_checks()
    return Response({"summary": summary, "checks": checks})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, HasProfilePermission])
def api_inventory_view(request):
    """GET /auth/api-inventory/ — registered URL patterns under /api/ for inventory UI."""
    if not rbac_can_access_admin_panel(request.user):
        raise PermissionDenied()
    endpoints = _api_endpoint_inventory()
    return Response({"count": len(endpoints), "endpoints": endpoints})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, HasProfilePermission])
def reports_view(request):
    from django.db.models.functions import TruncMonth
    from django.db.models import Avg, F, ExpressionWrapper, fields
    
    qs = _submission_queryset_for(request.user)
    
    # Optional date filters
    start_date = request.query_params.get("start_date")
    end_date = request.query_params.get("end_date")
    if start_date:
        qs = qs.filter(received_at__gte=start_date)
    if end_date:
        qs = qs.filter(received_at__lte=end_date)

    total = qs.count()
    
    # KPIs
    active_stages = [
        WorkflowStage.RECEIVED_BY_PSC,
        WorkflowStage.REGISTERED_ROUTED,
        WorkflowStage.MANAGER_CHECKLIST_REVIEW,
        WorkflowStage.UNDER_ASSESSMENT,
        WorkflowStage.DEFERRED,
        WorkflowStage.RESUBMITTED,
        WorkflowStage.FORWARDED_TO_COMMISSION,
        WorkflowStage.COMMISSION_SITTING,
    ]
    active_count = qs.filter(current_stage__in=active_stages).count()
    
    overdue_count = qs.filter(
        current_stage=WorkflowStage.UNDER_ASSESSMENT,
        assessment_deadline_at__isnull=False,
        assessment_deadline_at__lt=timezone.now(),
    ).count()

    # Completed submissions (for turnaround time and resolution stats)
    terminal_stages = [WorkflowStage.APPROVED, WorkflowStage.REJECTED, WorkflowStage.RETURNED]
    completed_qs = qs.filter(current_stage__in=terminal_stages)

    # Resolution Breakdown
    resolutions = list(completed_qs.values("current_stage").annotate(count=Count("id")))

    # Efficiency Index: % completed within 21 days of received_at
    efficiency_count = 0
    efficiency_total = completed_qs.count()
    if efficiency_total > 0:
        # We define efficiency as completing within 21 days
        # Again, using updated_at as a proxy for completion time
        efficiency_count = completed_qs.annotate(
            duration=ExpressionWrapper(F('updated_at') - F('received_at'), output_field=fields.DurationField())
        ).filter(duration__lte=timedelta(days=21)).count()

    efficiency_rate = (efficiency_count / efficiency_total * 100) if efficiency_total > 0 else 0

    # Average turnaround by Category
    category_turnaround = list(
        completed_qs.values("form_category__name")
        .annotate(
            avg_dur=Avg(ExpressionWrapper(F('updated_at') - F('received_at'), output_field=fields.DurationField()))
        )
        .order_by("avg_dur")
    )
    # Convert timedelta to days for JSON
    for item in category_turnaround:
        if item["avg_dur"]:
            item["avg_days"] = item["avg_dur"].days
        else:
            item["avg_days"] = 0
        del item["avg_dur"]

    # Simple turnaround: received_at to updated_at for completed ones
    avg_days = 0
    if completed_qs.exists():
        turnaround = completed_qs.annotate(
            duration=ExpressionWrapper(F('updated_at') - F('received_at'), output_field=fields.DurationField())
        ).aggregate(avg_dur=Avg('duration'))['avg_dur']
        if turnaround:
            avg_days = turnaround.days

    # Monthly Trends (Last 6 months)
    six_months_ago = timezone.now() - timedelta(days=180)
    trends = (
        qs.filter(received_at__gte=six_months_ago)
        .annotate(month=TruncMonth('received_at'))
        .values('month')
        .annotate(count=Count('id'))
        .order_by('month')
    )

    by_stage = list(qs.values("current_stage").annotate(count=Count("id")).order_by("-count"))
    by_ministry = list(qs.values("ministry__name").annotate(count=Count("id")).order_by("-count")[:10])
    by_category = list(qs.values("form_category__name").annotate(count=Count("id")).order_by("-count")[:10])

    return Response({
        "summary": {
            "total_submissions": total,
            "active_submissions": active_count,
            "overdue_assessments": overdue_count,
            "avg_turnaround_days": avg_days,
            "efficiency_rate": round(efficiency_rate, 1),
        },
        "trends": trends,
        "distributions": {
            "by_stage": by_stage,
            "by_ministry": by_ministry,
            "by_category": by_category,
            "by_resolution": resolutions,
            "category_turnaround": category_turnaround,
        }
    })

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, HasProfilePermission])
def dashboard_view(request):
    qs = _submission_queryset_for(request.user)
    total = qs.count()
    by_stage = dict(qs.values("current_stage").annotate(c=Count("id")).values_list("current_stage", "c"))
    overdue = (
        qs.filter(
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            assessment_deadline_at__isnull=False,
            assessment_deadline_at__lt=timezone.now(),
        ).count()
    )
    by_ministry = list(
        qs.values("ministry__name")
        .annotate(c=Count("id"))
        .order_by("-c")[:12]
    )
    by_category = list(
        qs.values("form_category__name")
        .annotate(c=Count("id"))
        .order_by("-c")[:12]
    )
    return Response(
        {
            "total_submissions": total,
            "by_stage": by_stage,
            "assessment_overdue_count": overdue,
            "submissions_by_ministry": by_ministry,
            "submissions_by_category": by_category,
        }
    )


def _axes_lockout_context(usernames=None):
    """
    Return a dict with two keys for UserProfileSerializer context:
      locked_usernames – set of usernames currently locked out by axes
      attempts_map     – {username: max_failures_since_start}
    Batch-loaded so there is no N+1 per user.
    """
    try:
        from axes.models import AccessAttempt
        from django.db.models import Max as _Max
        from django.conf import settings as _settings

        limit = getattr(_settings, "AXES_FAILURE_LIMIT", 5)
        qs = AccessAttempt.objects.all()
        if usernames is not None:
            qs = qs.filter(username__in=usernames)
        rows = (
            qs.values("username")
            .annotate(max_f=_Max("failures_since_start"))
        )
        attempts_map = {r["username"]: r["max_f"] for r in rows}
        locked_usernames = {u for u, f in attempts_map.items() if f >= limit}
        return {"locked_usernames": locked_usernames, "attempts_map": attempts_map}
    except Exception:  # axes not ready during migrate, etc.
        return {"locked_usernames": set(), "attempts_map": {}}


class UserAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD-lite for user management — manage_users / staff / superuser / PSC Admin."""
    permission_classes = [permissions.IsAuthenticated, HasManageUsers]
    queryset = (
        User.objects
        .select_related("psc_profile__ministry", "psc_profile__department")
        .order_by("username")
    )

    def get_serializer_class(self):
        if self.action in {"update", "partial_update"}:
            return UserAdminUpdateSerializer
        return UserProfileSerializer

    # ── list — inject lockout context (one extra DB query total) ─────────────
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        ctx = self.get_serializer_context()
        ctx.update(_axes_lockout_context())
        ser = UserProfileSerializer(queryset, many=True, context=ctx)
        return Response(ser.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        ctx = self.get_serializer_context()
        ctx.update(_axes_lockout_context(usernames=[instance.username]))
        ser = UserProfileSerializer(instance, context=ctx)
        return Response(ser.data)

    # ── create ────────────────────────────────────────────────────────────────
    def create(self, request, *args, **kwargs):
        """Create a new user + profile via RegisterSerializer."""
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        _log(request, _AL.Action.CREATE,
             resource_type="User", resource_id=user.id,
             resource_label=user.username,
             description=f"User account created: {user.username} (role: {request.data.get('role', '')})")
        ctx = self.get_serializer_context()
        ctx.update(_axes_lockout_context(usernames=[user.username]))
        out = UserProfileSerializer(user, context=ctx)
        return Response(out.data, status=status.HTTP_201_CREATED)

    # ── update ────────────────────────────────────────────────────────────────
    def update(self, request, *args, **kwargs):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        ser = UserAdminUpdateSerializer(instance, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        ser.save()
        _log(request, _AL.Action.UPDATE,
             resource_type="User", resource_id=instance.id,
             resource_label=instance.username,
             description=f"User profile updated: {instance.username}")
        ctx = self.get_serializer_context()
        ctx.update(_axes_lockout_context(usernames=[instance.username]))
        out = UserProfileSerializer(instance, context=ctx)
        return Response(out.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    # ── set-password ──────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="set-password")
    def set_password(self, request, pk=None):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        user = self.get_object()
        ser = SetPasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user.set_password(ser.validated_data["password"])
        user.save()
        _log(request, _AL.Action.PASSWORD_CHANGE,
             resource_type="User", resource_id=user.id,
             resource_label=user.username,
             description=f"Admin-initiated password reset for user: {user.username}")
        return Response({"detail": "Password updated."})

    # ── set-active ────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="set-active")
    def set_active(self, request, pk=None):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        user = self.get_object()
        is_active = request.data.get("is_active")
        if is_active is None:
            return Response({"detail": "is_active required."}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = bool(is_active)
        user.save()
        action_desc = "activated" if user.is_active else "deactivated"
        _log(request, _AL.Action.UPDATE,
             resource_type="User", resource_id=user.id,
             resource_label=user.username,
             description=f"User account {action_desc}: {user.username}")
        ctx = self.get_serializer_context()
        ctx.update(_axes_lockout_context(usernames=[user.username]))
        out = UserProfileSerializer(user, context=ctx)
        return Response(out.data)

    # ── unlock (reset axes lockout for one user) ──────────────────────────────
    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, pk=None):
        """
        POST /users/{id}/unlock/
        Clear all django-axes AccessAttempt records for this user, immediately
        allowing them to log in again regardless of cooloff period.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        user = self.get_object()
        try:
            from axes.models import AccessAttempt
            deleted, _ = AccessAttempt.objects.filter(username=user.username).delete()
        except Exception as exc:
            return Response({"detail": f"Could not clear lockout: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        _security_log.info(
            "USER_UNLOCKED | username=%s | by=%s | cleared=%d",
            user.username, request.user.username, deleted,
        )
        _log(request, _AL.Action.UNLOCK,
             resource_type="User", resource_id=user.id,
             resource_label=user.username,
             description=f"Account lockout cleared for: {user.username} ({deleted} record(s) removed)")
        return Response({
            "detail": f"Account unlocked for '{user.username}'. {deleted} lockout record(s) cleared.",
            "username": user.username,
            "cleared_records": deleted,
        })

    # ── reset-all-lockouts ────────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="reset-all-lockouts")
    def reset_all_lockouts(self, request):
        """
        POST /users/reset-all-lockouts/
        Clear ALL axes AccessAttempt records — unlocks every locked account at once.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        try:
            from axes.models import AccessAttempt
            deleted, _ = AccessAttempt.objects.all().delete()
        except Exception as exc:
            return Response({"detail": f"Could not clear lockouts: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        _security_log.warning(
            "ALL_LOCKOUTS_RESET | by=%s | cleared=%d", request.user.username, deleted
        )
        _log(request, _AL.Action.UNLOCK,
             resource_type="User",
             description=f"All account lockouts reset ({deleted} record(s) cleared)")
        return Response({
            "detail": f"All lockouts cleared. {deleted} record(s) removed.",
            "cleared_records": deleted,
        })

    # ── lockout-stats ─────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="lockout-stats")
    def lockout_stats(self, request):
        """
        GET /users/lockout-stats/
        Returns current security thresholds and a count of locked accounts.
        """
        from django.conf import settings as _settings
        try:
            from axes.models import AccessAttempt
            from django.db.models import Max as _Max
            limit = getattr(_settings, "AXES_FAILURE_LIMIT", 5)
            rows = (
                AccessAttempt.objects
                .values("username")
                .annotate(max_f=_Max("failures_since_start"))
                .filter(max_f__gte=limit)
            )
            locked_count = rows.count()
            total_attempts = AccessAttempt.objects.count()
        except Exception:
            locked_count = 0
            total_attempts = 0

        return Response({
            "failure_limit": getattr(_settings, "AXES_FAILURE_LIMIT", 5),
            "cooloff_hours": int(getattr(_settings, "AXES_COOLOFF_TIME", timedelta(hours=1)).total_seconds() // 3600),
            "locked_accounts": locked_count,
            "total_attempt_records": total_attempts,
        })


class SystemPermissionViewSet(viewsets.ModelViewSet):
    """CRUD for system permissions — manage_roles / staff / superuser / PSC Admin."""
    permission_classes = [permissions.IsAuthenticated, HasManageRoles]
    queryset = SystemPermission.objects.all()
    serializer_class = SystemPermissionSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_builtin:
            return Response(
                {"detail": "Built-in permissions cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class RoleDefinitionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Read and update role definitions — PSC Admins only.
    Built-in roles cannot be deleted but their description and
    permission set can always be modified.
    """
    permission_classes = [permissions.IsAuthenticated, HasManageRoles]
    queryset = RoleDefinition.objects.prefetch_related("permissions").all()

    def get_serializer_class(self):
        if self.action in {"update", "partial_update"}:
            return RoleDefinitionWriteSerializer
        return RoleDefinitionSerializer

    def update(self, request, *args, **kwargs):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        ser = RoleDefinitionWriteSerializer(instance, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        ser.save()
        _log(request, _AL.Action.PERMISSION,
             resource_type="RoleDefinition", resource_id=instance.id,
             resource_label=instance.role,
             description=f"Role permissions updated: {instance.role}")
        return Response(RoleDefinitionSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_builtin:
            return Response(
                {"detail": "Built-in role definitions cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class RegisterView(APIView):
    """Open registration for bootstrap — restrict in production via settings."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.conf import settings

        if not getattr(settings, "ALLOW_OPEN_REGISTRATION", False):
            return Response({"detail": "Registration disabled."}, status=status.HTTP_403_FORBIDDEN)
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({"detail": "Account created."}, status=status.HTTP_201_CREATED)


import logging as _logging
_security_log = _logging.getLogger("scdms.security")

from rest_framework_simplejwt.views import TokenObtainPairView as SimpleJWTTokenObtainPairView
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator

@method_decorator(
    ratelimit(key="ip", rate=os.getenv("LOGIN_RATE_LIMIT", "5/m"), method="POST", block=True),
    name="dispatch",
)
class TokenObtainPairView(SimpleJWTTokenObtainPairView):
    """
    Rate-limited (5 req/min per IP) login view with 2FA support and security audit logging.
    Wraps SimpleJWT's TokenObtainPairView to enforce NCSS 2030 access-control requirements.
    """
    def post(self, request, *args, **kwargs):
        from django.conf import settings
        import os as _os

        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR", "unknown")
        )

        # Standard credential validation
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            username = request.data.get("username", "<unknown>")
            _security_log.warning(
                "LOGIN_FAILED | username=%s | ip=%s", username, ip
            )
            from .audit import log_action as _log
            from .models import AuditLog as _AL
            _log(request, _AL.Action.LOGIN_FAILED,
                 resource_type="User", resource_label=username,
                 description=f"Failed login attempt for username: {username}")
            return Response(
                {"detail": "No active account found with the given credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = serializer.user
        profile = getattr(user, "psc_profile", None)

        # Check for valid trusted session → PIN-based re-auth (skip TOTP)
        if profile and profile.session_pin:
            ts = TrustedSession.valid_for(user, ip_address=ip,
                user_agent=request.META.get("HTTP_USER_AGENT", ""))
            if ts:
                _security_log.info("LOGIN_TRUSTED_SESSION | username=%s | ip=%s", user.username, ip)
                return Response(
                    {
                        "pin_required": True,
                        "username": user.username,
                        "detail": "Enter your session PIN to continue.",
                    },
                    status=status.HTTP_200_OK,
                )

        if getattr(settings, "TWO_FACTOR_REQUIRED", False) or (profile and profile.two_factor_enabled):
            # If user hasn't set up TOTP yet, we might need to force setup
            if not profile or not profile.totp_secret:
                _security_log.info("LOGIN_2FA_SETUP_REQUIRED | username=%s | ip=%s", user.username, ip)
                return Response(
                    {
                        "two_factor_required": True,
                        "setup_required": True,
                        "username": user.username,
                        "detail": "Two-factor authentication setup is required.",
                    },
                    status=status.HTTP_200_OK,
                )

            log_msg = f"[2FA] Login attempt for {user.username}. Awaiting TOTP."
            _logging.getLogger("django").info(log_msg)
            _security_log.info("LOGIN_2FA_REQUIRED | username=%s | ip=%s", user.username, ip)
            return Response(
                {
                    "two_factor_required": True,
                    "username": user.username,
                    "detail": "Please enter the 6-digit code from your authenticator app.",
                },
                status=status.HTTP_200_OK,
            )

        # Create a trusted session for PIN-based re-auth (if 2FA was skipped or not required)
        # Complies with NCSS 2030 CSP-4 Session Security
        TrustedSession.objects.filter(user=user, is_active=True).update(is_active=False)
        TrustedSession.objects.create(
            user=user,
            expires_at=TrustedSession.compute_expiry(),
            ip_address=ip,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:512] or "",
        )

        _security_log.info("LOGIN_SUCCESS | username=%s | ip=%s", user.username, ip)
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        _log(request, _AL.Action.LOGIN,
             resource_type="User", resource_id=user.id,
             resource_label=user.username,
             description=f"Successful login: {user.username}")
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Blacklist the submitted refresh token so it cannot be reused after logout.
    Complies with NCSS 2030 session management requirements.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError

        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"detail": "refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            _security_log.info(
                "LOGOUT | username=%s | ip=%s",
                request.user.username,
                request.META.get("REMOTE_ADDR", "unknown"),
            )
            from .audit import log_action as _log
            from .models import AuditLog as _AL
            _log(request, _AL.Action.LOGOUT,
                 resource_type="User", resource_id=request.user.id,
                 resource_label=request.user.username,
                 description=f"User logged out: {request.user.username}")
        except TokenError:
            # Already expired/blacklisted — treat as success
            pass
        return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)


# ── Two-Factor Authentication (TOTP / Microsoft Authenticator) ────────────────
# Not enforced in the login flow unless settings.TWO_FACTOR_REQUIRED = True 
# or profile.two_factor_enabled = True.

class TOTPSetupView(APIView):
    """Generate a TOTP secret and QR code for the authenticated user or during login."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # Can be authenticated or provide username/password
        user = request.user
        if not user.is_authenticated:
            username = request.data.get("username")
            password = request.data.get("password")
            
            if not username or not password:
                return Response({"detail": "Username and password are required."}, status=status.HTTP_401_UNAUTHORIZED)
                
            _logging.getLogger("django").info(f"TOTP_SETUP | Attempting authentication for: {username}")
            from django.contrib.auth import authenticate
            user = authenticate(request, username=username, password=password)
            if not user:
                _logging.getLogger("django").warning(f"TOTP_SETUP | Authentication failed for: {username}")
                return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            profile = _profile(user)
        except Exception as e:
            _logging.getLogger("django").error(f"TOTP_SETUP | Profile retrieval failed for {user.username}: {e}")
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
            
        if profile.totp_secret and profile.two_factor_enabled:
            return Response({"detail": "2FA is already enabled."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate a temporary secret if not already present
        if not profile.totp_secret:
            profile.totp_secret = generate_totp_secret()
            profile.save(update_fields=["totp_secret"])
            
        uri = get_totp_uri(user.username, profile.totp_secret)
        qr_code = get_totp_qr_base64(uri)
        
        _logging.getLogger("django").info(f"TOTP_SETUP | Secret generated for: {user.username}")
        return Response({
            "secret": profile.totp_secret,
            "qr_code": f"data:image/png;base64,{qr_code}",
            "provisioning_uri": uri
        })

class TOTPVerifySetupView(APIView):
    """Verify the first TOTP code to finalize setup."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        code = request.data.get("code")
        user = request.user
        if not user.is_authenticated:
            username = request.data.get("username")
            password = request.data.get("password")
            
            if not username or not password:
                return Response({"detail": "Username and password are required."}, status=status.HTTP_401_UNAUTHORIZED)

            from django.contrib.auth import authenticate
            user = authenticate(request, username=username, password=password)
            if not user:
                return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        profile = _profile(user)
        if not profile.totp_secret:
            return Response({"detail": "TOTP setup not initiated."}, status=status.HTTP_400_BAD_REQUEST)
            
        if verify_totp_code(profile.totp_secret, code):
            profile.two_factor_enabled = True
            profile.save(update_fields=["two_factor_enabled"])
            
            from .audit import log_action as _log
            from .models import AuditLog as _AL
            _log(request, _AL.Action.TWO_FA,
                 resource_type="User", resource_id=user.id,
                 resource_label=user.username,
                 description=f"TOTP 2FA enabled for user: {user.username}")
                 
            # If this was during login setup, we should probably return tokens now
            if not request.user.is_authenticated:
                from rest_framework_simplejwt.tokens import RefreshToken
                refresh = RefreshToken.for_user(user)
                return Response({
                    "detail": "2FA has been enabled successfully.",
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                })
                
            return Response({"detail": "2FA has been enabled successfully."})
        else:
            return Response({"detail": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)

class VerifyOTPView(APIView):
    """Verify a 6-digit TOTP code during login; on success return JWT tokens
    and create a TrustedSession for PIN-based re-authentication."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = TOTPVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.validated_data["user"]

        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)

        # Deactivate any existing active sessions for this user
        TrustedSession.objects.filter(user=user, is_active=True).update(is_active=False)

        # Create new trusted session
        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR", "unknown")
        )
        TrustedSession.objects.create(
            user=user,
            expires_at=TrustedSession.compute_expiry(),
            ip_address=ip,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:512] or "",
        )

        _security_log.info("LOGIN_2FA_SUCCESS | username=%s | ip=%s", user.username, ip)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        })

class DisableTOTPView(APIView):
    """Disable TOTP 2FA for the authenticated user."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = _profile(request.user)
        profile.two_factor_enabled = False
        profile.totp_secret = None
        profile.save(update_fields=["two_factor_enabled", "totp_secret"])
        
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        _log(request, _AL.Action.TWO_FA,
             resource_type="User", resource_id=request.user.id,
             resource_label=request.user.username,
             description=f"TOTP 2FA disabled for user: {request.user.username}")
             
        return Response({"detail": "2FA has been disabled."})


# ── Session PIN (Trusted Device Re-authentication) ────────────────────────────

class SessionPinSetupView(APIView):
    """Set or change the session PIN for trusted-device re-authentication.
    Requires authentication. When changing an existing PIN, current_password
    is required for verification."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = SessionPinSetupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        profile = _profile(request.user)
        new_pin = ser.validated_data["pin"]

        # If changing an existing PIN, verify current password
        if profile.session_pin:
            current_password = ser.validated_data.get("current_password", "")
            if not request.user.check_password(current_password):
                return Response(
                    {"detail": "Current password is required to change the session PIN."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        from django.contrib.auth.hashers import make_password
        profile.session_pin = make_password(new_pin)
        profile.session_pin_set_at = timezone.now()
        profile.save(update_fields=["session_pin", "session_pin_set_at"])

        _security_log.info("SESSION_PIN_SET | username=%s", request.user.username)
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        _log(request, _AL.Action.SETTINGS,
             resource_type="User", resource_id=request.user.id,
             resource_label=request.user.username,
             description=f"Session PIN {'set' if not profile.session_pin_set_at else 'changed'} for {request.user.username}")

        return Response({"detail": "Session PIN has been set successfully."})


class SessionPinVerifyView(APIView):
    """Verify the session PIN and return JWT tokens (within trusted session window)."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [SessionPinVerifyThrottle]

    def post(self, request):
        ser = SessionPinVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.validated_data["user"]
        ts = ser.validated_data["trusted_session"]

        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)

        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR", "unknown")
        )
        _security_log.info("LOGIN_PIN_SUCCESS | username=%s | ip=%s", user.username, ip)
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        _log(request, _AL.Action.LOGIN,
             resource_type="User", resource_id=user.id,
             resource_label=user.username,
             description=f"Trusted session login via PIN for {user.username}")

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        })


# ── Password Reset ────────────────────────────────────────────────────────────

class PasswordResetRequestView(APIView):
    """Request a password reset token (logged to console in dev, emailed in prod)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"]
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
            token = PasswordResetToken.generate_for(user)
            
            # Use the origin from request headers if available (for frontend link)
            origin = request.headers.get("Origin") or f"{request.scheme}://{request.get_host()}"
            reset_url = f"{origin}/auth/reset-password/confirm?token={token.token}"
            
            from django.core.mail import send_mail
            from django.conf import settings
            
            subject = "Reset Your Password - Commission Decision App"
            message = (
                f"Hello {user.username},\n\n"
                "You requested a password reset for your Commission Decision App account.\n"
                "Please click the link below to set a new password:\n\n"
                f"{reset_url}\n\n"
                "This link will expire in 1 hour.\n\n"
                "If you did not request a password reset, you can safely ignore this email."
            )
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=True,
            )

            import logging
            logging.getLogger("django").info(
                f"[PASSWORD RESET] Reset link for {email}: {reset_url}"
            )
        except User.DoesNotExist:
            pass  # Silent — do not reveal whether email exists
        # Always return success to avoid user enumeration
        return Response({"detail": "If that email is registered, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    """Validate reset token and set new password."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({"detail": "Password updated successfully. You may now sign in."})


class MeetingViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    queryset = Meeting.objects.prefetch_related("agenda_items__submission").all()
    serializer_class = MeetingSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        ordering = self.request.query_params.get("ordering")
        if ordering:
            # Support simple field ordering via query param (e.g. 'date' or '-date')
            qs = qs.order_by(ordering)
        return qs

    def perform_create(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            raise PermissionDenied("Only PSC Secretary, Senior Admin Officer, or Admins can schedule meetings.")
        serializer.save()

    @action(detail=False, methods=["post"], url_path="upload")
    def upload_meeting_recording(self, request):
        from django.conf import settings

        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(file.name)[1].lower() if file.name else ''
        allowed = {'.mp3', '.m4a', '.mp4', '.webm', '.wav', '.ogg'}
        if ext not in allowed:
            return Response(
                {"detail": f"File type '{ext}' is not supported. Allowed: {', '.join(allowed)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        meeting_id = request.data.get("meeting_id")
        meeting_ref = ""
        if meeting_id:
            try:
                meeting = Meeting.objects.get(id=meeting_id)
                meeting_ref = meeting.reference_number
            except Meeting.DoesNotExist:
                return Response(
                    {"detail": f"Meeting with id {meeting_id} not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        recordings_dir = os.path.join(settings.MEDIA_ROOT, 'recordings')
        os.makedirs(recordings_dir, exist_ok=True)

        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        safe_name = f"recording_{timestamp}{ext}"
        filepath = os.path.join(recordings_dir, safe_name)

        with open(filepath, 'wb+') as dest:
            for chunk in file.chunks():
                dest.write(chunk)

        from .audit import log_action as _log
        from .models import AuditLog as _AL
        label = meeting_ref or safe_name
        desc = f"Recording uploaded for {meeting_ref}: {safe_name}" if meeting_ref else f"Recording uploaded: {safe_name}"
        _log(request, _AL.Action.CREATE,
             resource_type="MeetingRecording", resource_label=label,
             description=desc)

        return Response({
            "detail": "Recording uploaded successfully.",
            "filename": safe_name,
            "url": f"{settings.MEDIA_URL}recordings/{safe_name}",
            "size": file.size,
            "meeting_id": int(meeting_id) if meeting_id else None,
        })

    @action(detail=True, methods=["post"], url_path="submit-agenda")
    def submit_agenda_to_chairman(self, request, pk=None):
        """Senior Admin Officer / Secretary submits the draft agenda to the Chairperson for approval."""
        meeting = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.SENIOR_ADMIN_OFFICER, Role.PSC_SECRETARY, Role.PSC_ADMIN}:
            raise PermissionDenied("Only the Senior Admin Officer, Secretary, or Admin can submit the agenda.")
        if meeting.type == MeetingType.FLYING_MINUTE:
            meeting.agenda_status = AgendaStatus.WITH_CHAIRMAN
        else:
            meeting.agenda_status = AgendaStatus.WITH_CHAIRMAN
        meeting.save(update_fields=["agenda_status"])
        return Response({"detail": "Agenda submitted to Chairperson for approval."})

    @action(detail=True, methods=["post"], url_path="approve-agenda")
    def approve_agenda(self, request, pk=None):
        """Chairperson approves the agenda for circulation."""
        meeting = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.CHAIRPERSON, Role.PSC_ADMIN}:
            raise PermissionDenied("Only the Chairperson can approve the agenda.")
        if meeting.agenda_status != AgendaStatus.WITH_CHAIRMAN:
            return Response({"detail": "Agenda must first be submitted by the Senior Admin Officer."}, status=400)
        meeting.agenda_status = AgendaStatus.CHAIRMAN_APPROVED
        meeting.agenda_approved_by = request.user
        meeting.agenda_approved_at = timezone.now()
        meeting.save(update_fields=["agenda_status", "agenda_approved_by", "agenda_approved_at"])
        return Response({"detail": "Agenda approved by Chairperson."})

    @action(detail=True, methods=["post"], url_path="circulate-agenda")
    def circulate_agenda(self, request, pk=None):
        """Senior Admin Officer circulates the approved agenda to members."""
        meeting = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.SENIOR_ADMIN_OFFICER, Role.PSC_SECRETARY, Role.PSC_ADMIN}:
            raise PermissionDenied("Only the Senior Admin Officer or Secretary can circulate the agenda.")
        if meeting.agenda_status != AgendaStatus.CHAIRMAN_APPROVED:
            return Response({"detail": "Agenda must be approved by the Chairperson first."}, status=400)
        meeting.agenda_status = AgendaStatus.CIRCULATED
        meeting.save(update_fields=["agenda_status"])
        return Response({"detail": "Agenda circulated to Commission members."})

    @action(detail=True, methods=["post"], url_path="flying-minute/sign")
    def flying_minute_sign(self, request, pk=None):
        """Commission member signs a Flying Minute (SOP Section 8)."""
        meeting = self.get_object()
        if meeting.type != MeetingType.FLYING_MINUTE:
            return Response({"detail": "This is not a Flying Minute."}, status=400)

        decision = request.data.get("decision")
        remarks = request.data.get("remarks", "")
        if decision not in ("approve", "reject", "abstain"):
            return Response({"detail": "Decision must be 'approve', 'reject', or 'abstain'."}, status=400)

        sig, created = FlyingMinuteSignature.objects.update_or_create(
            meeting=meeting,
            member=request.user,
            defaults={"decision": decision, "remarks": remarks},
        )
        return Response({
            "detail": f"Flying Minute signed as '{decision}'.",
            "signature": FlyingMinuteSignatureSerializer(sig).data,
        })

    @action(detail=True, methods=["get"], url_path="flying-minute/status")
    def flying_minute_status(self, request, pk=None):
        """Get the current sign-off status of a Flying Minute."""
        meeting = self.get_object()
        if meeting.type != MeetingType.FLYING_MINUTE:
            return Response({"detail": "This is not a Flying Minute."}, status=400)
        sigs = meeting.flying_minute_signatures.select_related("member").all()
        return Response({
            "total_members": meeting.agenda_approved_by.count() if False else 0,
            "signatures": FlyingMinuteSignatureSerializer(sigs, many=True).data,
        })


class AgendaItemViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    queryset = AgendaItem.objects.select_related(
        "meeting", "submission", "submission__form_category", "submission__ministry",
    ).all()
    serializer_class = AgendaItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        meeting_id = self.request.query_params.get("meeting")
        if meeting_id:
            qs = qs.filter(meeting_id=meeting_id)
        return qs.order_by("sequence", "id")

    def perform_create(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            raise PermissionDenied("Only PSC Secretary, Senior Admin Officer, or Admins can manage agenda items.")

        meeting    = serializer.validated_data["meeting"]
        submission = serializer.validated_data["submission"]
        category   = serializer.validated_data.get("category", "other")

        # Auto-derive agenda category from the submission's form type when the
        # caller did not provide an explicit non-'other' value.
        if category == "other" and submission.form_type_code:
            try:
                ft = PSCFormType.objects.get(code=submission.form_type_code)
                if ft.agenda_category and ft.agenda_category != "other":
                    category = ft.agenda_category
            except PSCFormType.DoesNotExist:
                pass

        # Enforce effective cutoff (manual submission_cutoff or auto 3-day rule)
        if submission.received_at:
            effective_cutoff = meeting.effective_cutoff
            if submission.received_at > effective_cutoff:
                next_meeting = Meeting.objects.filter(
                    date__gt=meeting.date, status=MeetingStatus.SCHEDULED
                ).order_by("date").first()
                hint = (
                    f" Next available meeting: {next_meeting.reference_number} on {next_meeting.date}."
                    if next_meeting else ""
                )
                raise PermissionDenied(
                    f"Submission received after the cutoff ({effective_cutoff.strftime('%d %b %Y %H:%M')})."
                    f" It cannot be added to {meeting.reference_number}.{hint}"
                )

        # Sequence = last sequence within the same category + 1 (append to end of category group)
        last_in_cat = (
            AgendaItem.objects.filter(meeting=meeting, category=category)
            .order_by("-sequence")
            .first()
        )
        next_seq = (last_in_cat.sequence + 1) if last_in_cat else 1

        serializer.save(category=category, sequence=next_seq)

    @action(detail=True, methods=["post"], url_path="push-to-next")
    def push_to_next_meeting(self, request, pk=None):
        """Move this agenda item to the next scheduled meeting."""
        item = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            raise PermissionDenied("Only PSC Secretary, Senior Admin Officer, or Admins can defer agenda items.")

        current_meeting = item.meeting
        next_meeting = Meeting.objects.filter(
            date__gt=current_meeting.date,
            status=MeetingStatus.SCHEDULED,
        ).order_by("date").first()

        if not next_meeting:
            return Response(
                {"detail": "No next scheduled meeting found. Create the next meeting first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Guard: same submission already on the next meeting
        if AgendaItem.objects.filter(meeting=next_meeting, submission=item.submission).exists():
            return Response(
                {"detail": f"This submission is already on {next_meeting.reference_number}'s agenda."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Append to the end of the same category in the next meeting
        last_in_cat = (
            AgendaItem.objects.filter(meeting=next_meeting, category=item.category)
            .order_by("-sequence")
            .first()
        )
        new_seq = (last_in_cat.sequence + 1) if last_in_cat else 1

        item.meeting  = next_meeting
        item.sequence = new_seq
        item.save(update_fields=["meeting", "sequence"])

        return Response({
            "detail": (
                f"Item deferred to {next_meeting.reference_number} "
                f"({next_meeting.date.strftime('%d %b %Y')})."
            ),
            "next_meeting": {
                "id":               next_meeting.id,
                "reference_number": next_meeting.reference_number,
                "date":             str(next_meeting.date),
                "title":            next_meeting.title,
            },
        })

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder_agenda(self, request):
        """Batch-reorder agenda items. Accepts: { "items": [{ "id": 1, "sequence": 1 }, ...] }"""
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            raise PermissionDenied("Only Senior Admin Officer, Secretary, or Admin can reorder the agenda.")

        items_data = request.data.get("items", [])
        if not items_data:
            return Response({"detail": "No items provided."}, status=400)

        updated = []
        for item in items_data:
            row_id = item.get("id")
            new_seq = item.get("sequence")
            if row_id and new_seq is not None:
                AgendaItem.objects.filter(id=row_id).update(sequence=new_seq)
                updated.append({"id": row_id, "sequence": new_seq})

        return Response({"detail": f"{len(updated)} agenda items reordered.", "items": updated})


class APIKeyViewSet(viewsets.ModelViewSet):
    """CRUD for API keys — manage_roles / staff / superuser / PSC Admin."""
    permission_classes = [permissions.IsAuthenticated, HasManageRoles]
    queryset = APIKey.objects.select_related("user").all()
    serializer_class = APIKeySerializer

    def perform_create(self, serializer):
        import secrets
        name = serializer.validated_data.get("name")
        user = serializer.validated_data.get("user")
        raw_key = f"psc_{secrets.token_urlsafe(32)}"
        serializer.save(key=raw_key)


class SystemSettingViewSet(viewsets.ModelViewSet):
    """CRUD for system settings — staff / superuser / PSC Admin."""
    permission_classes = [permissions.IsAuthenticated, HasManageRoles]
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    lookup_field = "key"

    @action(detail=False, methods=["post"], url_path="batch-update")
    def batch_update(self, request):
        """Update multiple settings at once. Expects {key: value} dict."""
        settings_dict = request.data
        if not isinstance(settings_dict, dict):
            return Response({"detail": "Expected a JSON object."}, status=400)

        from .audit import log_action as _log
        from .models import AuditLog as _AL
        updated = []
        for key, value in settings_dict.items():
            setting, _ = SystemSetting.objects.get_or_create(key=key)
            setting.value = str(value)
            setting.save()
            updated.append(SystemSettingSerializer(setting).data)

        _log(request, _AL.Action.SETTINGS,
             resource_type="SystemSetting",
             description=f"Settings updated: {', '.join(settings_dict.keys())}",
             extra_data={"keys": list(settings_dict.keys())})
        return Response(updated)


# ── Backup & Restore ──────────────────────────────────────────────────────────

import os as _os
import tempfile

_BACKUP_DIR = _os.getenv("BACKUP_DIR", "/var/backups/scdms")


class BackupViewSet(viewsets.ViewSet):
    """
    Database backup and restore management.
    All actions require manage_roles (PSC Admin / staff / superuser).
    """
    permission_classes = [permissions.IsAuthenticated, HasManageRoles]

    # ── list backups ──────────────────────────────────────────────────────────
    def list(self, request):
        """GET /backup/ — list all backup files with size and timestamp."""
        _os.makedirs(_BACKUP_DIR, exist_ok=True)
        files = []
        for fn in sorted(_os.listdir(_BACKUP_DIR), reverse=True):
            if fn.startswith("scdms_backup_") and fn.endswith(".json"):
                fp = _os.path.join(_BACKUP_DIR, fn)
                stat = _os.stat(fp)
                files.append({
                    "filename": fn,
                    "size_kb": round(stat.st_size / 1024, 1),
                    "created_at": timezone.datetime.fromtimestamp(
                        stat.st_mtime, tz=timezone.get_current_timezone()
                    ).isoformat(),
                })
        return Response(files)

    # ── create (manual trigger) ───────────────────────────────────────────────
    def create(self, request):
        """POST /backup/ — trigger a manual backup immediately."""
        from django.core.management import call_command
        from io import StringIO

        _os.makedirs(_BACKUP_DIR, exist_ok=True)
        out = StringIO()
        try:
            call_command("backup_db", "--dir", _BACKUP_DIR, stdout=out, stderr=out)
            _security_log.info(
                "BACKUP_MANUAL | triggered by %s", request.user.username
            )
            from .audit import log_action as _log
            from .models import AuditLog as _AL
            _log(request, _AL.Action.BACKUP,
                 resource_type="Database",
                 description="Manual database backup created")
        except Exception as exc:
            return Response({"detail": f"Backup failed: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "Backup created successfully.", "log": out.getvalue()})

    # ── download ──────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="download")
    def download(self, request):
        """GET /backup/download/?filename=scdms_backup_....json — stream a backup file."""
        from django.http import FileResponse

        filename = request.query_params.get("filename", "")
        if not filename or not filename.startswith("scdms_backup_") or ".." in filename:
            return Response({"detail": "Invalid filename."}, status=status.HTTP_400_BAD_REQUEST)
        filepath = _os.path.join(_BACKUP_DIR, filename)
        if not _os.path.isfile(filepath):
            return Response({"detail": "File not found."}, status=status.HTTP_404_NOT_FOUND)

        _security_log.info(
            "BACKUP_DOWNLOAD | file=%s | user=%s", filename, request.user.username
        )
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        _log(request, _AL.Action.DOWNLOAD,
             resource_type="BackupFile", resource_label=filename,
             description=f"Backup file downloaded: {filename}")
        f = open(filepath, "rb")  # FileResponse closes it
        resp = FileResponse(f, content_type="application/json")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    # ── delete ────────────────────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="delete-file")
    def delete_backup(self, request):
        """POST /backup/delete-file/  body: {filename} — remove a backup file."""
        filename = (request.data.get("filename") or "").strip()
        if not filename or not filename.startswith("scdms_backup_") or ".." in filename:
            return Response({"detail": "Invalid filename."}, status=status.HTTP_400_BAD_REQUEST)
        filepath = _os.path.join(_BACKUP_DIR, filename)
        if not _os.path.isfile(filepath):
            return Response({"detail": "File not found."}, status=status.HTTP_404_NOT_FOUND)
        _os.remove(filepath)
        _security_log.info(
            "BACKUP_DELETE | file=%s | user=%s", filename, request.user.username
        )
        return Response({"detail": "Backup deleted."})

    # ── restore ───────────────────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="restore")
    def restore(self, request):
        """
        POST /backup/restore/
        Accepts either:
          - multipart file upload (field: 'file')
          - JSON body {"filename": "scdms_backup_....json"} to restore from stored file
        WARNING: This overwrites existing data.
        """
        from django.core.management import call_command

        uploaded = request.FILES.get("file")
        stored_fn = request.data.get("filename")

        if uploaded:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
                for chunk in uploaded.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name
            restore_path = tmp_path
            cleanup = True
        elif stored_fn:
            if ".." in stored_fn or not stored_fn.startswith("scdms_backup_"):
                return Response({"detail": "Invalid filename."}, status=status.HTTP_400_BAD_REQUEST)
            restore_path = _os.path.join(_BACKUP_DIR, stored_fn)
            if not _os.path.isfile(restore_path):
                return Response({"detail": "Backup file not found."}, status=status.HTTP_404_NOT_FOUND)
            cleanup = False
        else:
            return Response(
                {"detail": "Provide 'file' upload or 'filename' to restore."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            call_command("loaddata", restore_path)
            restore_name = uploaded.name if uploaded else stored_fn
            _security_log.info(
                "BACKUP_RESTORE | file=%s | user=%s",
                restore_name,
                request.user.username,
            )
            from .audit import log_action as _log
            from .models import AuditLog as _AL
            _log(request, _AL.Action.RESTORE,
                 resource_type="Database", resource_label=restore_name,
                 description=f"Database restored from backup: {restore_name}")
            return Response({"detail": "Database restored successfully."})
        except Exception as exc:
            return Response({"detail": f"Restore failed: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            if cleanup and _os.path.exists(restore_path):
                _os.unlink(restore_path)

    # ── schedule ──────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get", "post"], url_path="schedule")
    def schedule(self, request):
        """
        GET  /backup/schedule/ — return current cron expression + next run.
        POST /backup/schedule/ — set schedule {cron_expr, retention_days}.
                                 Send cron_expr='' to disable.
        """
        from .scheduler import get_next_run, update_schedule

        if request.method == "GET":
            expr = ""
            retention = "30"
            try:
                s = SystemSetting.objects.filter(key="BACKUP_SCHEDULE").first()
                if s:
                    expr = s.value
                r = SystemSetting.objects.filter(key="BACKUP_RETENTION_DAYS").first()
                if r:
                    retention = r.value
            except Exception:
                pass
            return Response({
                "cron_expr": expr,
                "retention_days": retention,
                "next_run": get_next_run(),
            })

        # POST — update
        cron_expr = (request.data.get("cron_expr") or "").strip()
        retention_days = str(request.data.get("retention_days") or "30")

        # Validate cron expression
        if cron_expr:
            parts = cron_expr.split()
            if len(parts) != 5:
                return Response(
                    {"detail": "cron_expr must have exactly 5 fields (min hour day month weekday)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Persist to SystemSetting
        for key, val in [("BACKUP_SCHEDULE", cron_expr), ("BACKUP_RETENTION_DAYS", retention_days)]:
            setting, _ = SystemSetting.objects.get_or_create(key=key)
            setting.value = val
            setting.save()

        # Update live scheduler
        try:
            update_schedule(cron_expr or None)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        _security_log.info(
            "BACKUP_SCHEDULE_UPDATED | cron=%r | retention=%s | user=%s",
            cron_expr, retention_days, request.user.username,
        )
        return Response({
            "detail": "Schedule updated.",
            "cron_expr": cron_expr,
            "retention_days": retention_days,
            "next_run": get_next_run(),
        })


# ── Security Feature ViewSets (NCSS 2030 / ISO 27001) ────────────────────────

from .models import AuditLog, SecurityIncident, SecurityScan
from .serializers import (
    AuditLogSerializer,
    SecurityIncidentSerializer,
    SecurityNoticeSerializer,
    SecurityScanSerializer,
)
from .audit import log_action


class IsAdminUser(permissions.BasePermission):
    """Staff, superuser, or PSC Admin role."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        try:
            return request.user.psc_profile.role == Role.PSC_ADMIN
        except Exception:
            return False


class CanViewAuditLog(permissions.BasePermission):
    """Admin users OR any user whose role has the view_audit_trail RBAC permission."""

    message = "You do not have permission to view the audit log."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return rbac_user_can_view_audit_log(request.user)


class AuditLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET  /audit-logs/          — paginated list with optional filters
    GET  /audit-logs/{id}/     — single record

    Admin or any user with view_audit_trail permission.
    Supports query params:
      actor    — username contains
      action   — AuditLog.Action value
      resource — resource_type contains
      from     — ISO date (timestamp >= )
      to       — ISO date (timestamp <= )
    """
    permission_classes = [permissions.IsAuthenticated, CanViewAuditLog]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.all()
        p = self.request.query_params

        actor = p.get("actor", "").strip()
        if actor:
            qs = qs.filter(actor_username__icontains=actor)

        action = p.get("action", "").strip().upper()
        if action:
            qs = qs.filter(action=action)

        resource = p.get("resource", "").strip()
        if resource:
            qs = qs.filter(resource_type__icontains=resource)

        from_date = p.get("from", "").strip()
        if from_date:
            qs = qs.filter(timestamp__date__gte=from_date)

        to_date = p.get("to", "").strip()
        if to_date:
            qs = qs.filter(timestamp__date__lte=to_date)

        return qs.order_by("-timestamp")


class SecurityIncidentViewSet(viewsets.ModelViewSet):
    """
    GET    /incidents/        — admin sees all; regular user sees own
    POST   /incidents/        — any authenticated user can report
    PATCH  /incidents/{id}/   — admin can update status, assign, resolution_notes
    DELETE /incidents/{id}/   — admin only
    """
    serializer_class = SecurityIncidentSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = SecurityIncident.objects.select_related("reported_by", "assigned_to")
        # Admin sees everything; regular user sees only their own reports
        if not (user.is_superuser or user.is_staff or
                getattr(getattr(user, "psc_profile", None), "role", None) == Role.PSC_ADMIN):
            qs = qs.filter(reported_by=user)
        status_f = self.request.query_params.get("status", "").strip()
        if status_f:
            qs = qs.filter(status=status_f)
        severity_f = self.request.query_params.get("severity", "").strip()
        if severity_f:
            qs = qs.filter(severity=severity_f)
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        incident = serializer.save(reported_by=self.request.user)
        log_action(
            self.request,
            AuditLog.Action.CREATE,
            resource_type="SecurityIncident",
            resource_id=incident.id,
            resource_label=incident.title,
            description=f"Incident reported: [{incident.severity}] {incident.title}",
        )

    def perform_update(self, serializer):
        incident = serializer.save()
        # Auto-stamp resolved_at when status flips to resolved
        if incident.status in (SecurityIncident.Status.RESOLVED, SecurityIncident.Status.CLOSED):
            if not incident.resolved_at:
                incident.resolved_at = timezone.now()
                incident.save(update_fields=["resolved_at"])
        log_action(
            self.request,
            AuditLog.Action.UPDATE,
            resource_type="SecurityIncident",
            resource_id=incident.id,
            resource_label=incident.title,
            description=f"Incident updated: status={incident.status}",
        )


class SecurityScanViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET  /security-scans/            — list all scans (most recent first)
    GET  /security-scans/latest/     — single latest scan record
    POST /security-scans/run/        — trigger a new scan (admin only)
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = SecurityScanSerializer

    def get_queryset(self):
        return SecurityScan.objects.all().order_by("-started_at")

    @action(detail=False, methods=["get"], url_path="latest")
    def latest(self, request):
        """Return the single most recent scan, or 204 if none exist."""
        try:
            scan = SecurityScan.objects.latest()
        except SecurityScan.DoesNotExist:
            return Response(None, status=status.HTTP_204_NO_CONTENT)
        return Response(SecurityScanSerializer(scan).data)

    @action(detail=False, methods=["post"], url_path="run")
    def run_scan(self, request):
        """
        POST /security-scans/run/
        Optionally accepts body: {"scan_type": "dependency"|"sast"|"full"}
        Runs pip-audit and/or bandit synchronously and saves the result.
        Typically takes 10-60s.
        """
        import subprocess, json as _json, sys

        scan_type = (request.data.get("scan_type") or "full").strip().lower()
        if scan_type not in ("dependency", "sast", "full"):
            scan_type = "full"

        scan = SecurityScan.objects.create(
            scan_type=scan_type,
            triggered_by=request.user,
            status="running",
        )

        dep_results = []
        sast_results = {}
        error_parts = []

        # ── Dependency audit (pip-audit) ──────────────────────────────────────
        if scan_type in ("dependency", "full"):
            try:
                proc = subprocess.run(
                    [sys.executable, "-m", "pip_audit", "--format=json", "-q"],
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
                raw = proc.stdout.strip()
                if raw:
                    parsed = _json.loads(raw)
                    # pip-audit JSON: {"dependencies": [...], "vulnerabilities": [...]}
                    # Normalise to a flat list of vulnerability objects
                    if isinstance(parsed, dict):
                        vulns = parsed.get("vulnerabilities") or []
                        # pip-audit < 2.7: list at top level
                        if not vulns and isinstance(parsed.get("dependencies"), list):
                            for dep in parsed["dependencies"]:
                                for v in dep.get("vulns", []):
                                    v["package"] = dep.get("name", "")
                                    v["installed_version"] = dep.get("version", "")
                                    vulns.append(v)
                        dep_results = vulns
                    elif isinstance(parsed, list):
                        dep_results = parsed
                elif proc.returncode == 0:
                    dep_results = []   # No output = no vulnerabilities
                else:
                    error_parts.append(f"pip-audit stderr: {proc.stderr[:500]}")
            except subprocess.TimeoutExpired:
                error_parts.append("pip-audit timed out after 120s.")
            except Exception as exc:
                error_parts.append(f"pip-audit error: {exc}")

        # ── SAST (bandit) ─────────────────────────────────────────────────────
        if scan_type in ("sast", "full"):
            try:
                backend_dir = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
                proc = subprocess.run(
                    [sys.executable, "-m", "bandit", "-r", backend_dir,
                     "-f", "json", "-q", "--exit-zero"],
                    capture_output=True,
                    text=True,
                    timeout=180,
                )
                raw = proc.stdout.strip()
                if raw:
                    sast_results = _json.loads(raw)
                else:
                    sast_results = {"results": [], "metrics": {}}
            except subprocess.TimeoutExpired:
                error_parts.append("bandit timed out after 180s.")
            except Exception as exc:
                error_parts.append(f"bandit error: {exc}")

        # ── Summary ───────────────────────────────────────────────────────────
        sast_issues = sast_results.get("results", [])
        high_sev = sum(1 for i in sast_issues if i.get("issue_severity") == "HIGH")
        med_sev  = sum(1 for i in sast_issues if i.get("issue_severity") == "MEDIUM")
        low_sev  = sum(1 for i in sast_issues if i.get("issue_severity") == "LOW")

        summary = {
            "dependency_vulnerabilities": len(dep_results),
            "sast_issues_total": len(sast_issues),
            "sast_high": high_sev,
            "sast_medium": med_sev,
            "sast_low": low_sev,
        }

        scan.dependency_results = dep_results
        scan.sast_results = sast_results
        scan.summary = summary
        scan.status = "failed" if error_parts else "completed"
        scan.error_message = "\n".join(error_parts)
        scan.completed_at = timezone.now()
        scan.save()

        log_action(
            request,
            AuditLog.Action.READ,
            resource_type="SecurityScan",
            resource_id=scan.id,
            description=f"Security scan ({scan_type}) completed. "
                        f"Deps: {len(dep_results)} vulns | SAST: {len(sast_issues)} issues",
        )

        _security_log.info(
            "SECURITY_SCAN | type=%s | status=%s | user=%s",
            scan_type, scan.status, request.user.username,
        )

        return Response(SecurityScanSerializer(scan).data, status=status.HTTP_201_CREATED)


class SecurityNoticeViewSet(viewsets.ModelViewSet):
    """
    GET    /security-notices/        — all authenticated users see live notices
    GET    /security-notices/all/    — admin sees every notice (incl. inactive)
    POST   /security-notices/        — admin creates a notice
    PATCH  /security-notices/{id}/   — admin edits / toggles active
    DELETE /security-notices/{id}/   — admin deletes
    """

    serializer_class = SecurityNoticeSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS and self.action != "all_notices":
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdminUser()]

    def get_queryset(self):
        # Unauthenticated guard (shouldn't reach here but be safe)
        if not self.request.user or not self.request.user.is_authenticated:
            return SecurityNotice.objects.none()
        # Default list: only live notices for regular users
        qs = SecurityNotice.objects.select_related("created_by")
        if self.action == "list":
            now = timezone.now()
            qs = qs.filter(is_active=True).filter(
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
            )
        return qs

    def perform_create(self, serializer):
        notice = serializer.save(created_by=self.request.user)
        log_action(
            self.request,
            AuditLog.Action.CREATE,
            resource_type="SecurityNotice",
            resource_id=notice.id,
            resource_label=notice.title,
            description=f"Created security notice [{notice.notice_type}]: {notice.title}",
        )

    def perform_update(self, serializer):
        notice = serializer.save()
        log_action(
            self.request,
            AuditLog.Action.UPDATE,
            resource_type="SecurityNotice",
            resource_id=notice.id,
            resource_label=notice.title,
            description=f"Updated security notice: {notice.title}",
        )

    def perform_destroy(self, instance):
        log_action(
            self.request,
            AuditLog.Action.DELETE,
            resource_type="SecurityNotice",
            resource_id=instance.id,
            resource_label=instance.title,
            description=f"Deleted security notice: {instance.title}",
        )
        instance.delete()

    @action(detail=False, methods=["get"], url_path="all",
            permission_classes=[permissions.IsAuthenticated, IsAdminUser])
    def all_notices(self, request):
        """Admin view — all notices regardless of active/expiry status."""
        qs = SecurityNotice.objects.select_related("created_by").order_by("-created_at")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# ── Notification ViewSet ─────────────────────────────────────────────────────


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                           viewsets.GenericViewSet):
    """List / read notifications for the currently authenticated user."""

    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response({"status": "ok"})

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"status": "ok"})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread_count": count})


# ── User Feedback Permissions ────────────────────────────────────────────────

class CanViewFeedback(permissions.BasePermission):
    def has_permission(self, request, view):
        return rbac_user_has_permission(request.user, "feedback_view")


class CanManageFeedback(permissions.BasePermission):
    def has_permission(self, request, view):
        return rbac_user_has_permission(request.user, "feedback_manage")


# ── User Feedback ViewSets ───────────────────────────────────────────────────

class FeedbackViewSet(viewsets.ModelViewSet):
    """
    Submit and manage user feedback. 
    Users can create; staff with permission can list/update.
    """
    queryset = FeedbackReport.objects.all().select_related("created_by", "assigned_to")
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return FeedbackReportDetailSerializer
        return FeedbackReportSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated()]
        if self.action == 'destroy':
            return [CanManageFeedback()]
        return [CanViewFeedback()]

    def get_throttles(self):
        if self.action == 'create':
            from .throttles import FeedbackCreateThrottle
            return [FeedbackCreateThrottle()]
        return super().get_throttles()

    def perform_create(self, serializer):
        # check global toggle
        if not SystemSetting.get_bool("ENABLE_USER_FEEDBACK", default=True):
            raise exceptions.PermissionDenied("User feedback is currently disabled.")
        
        report = serializer.save(created_by=self.request.user)
        
        # audit log
        log_action(
            self.request,
            AuditLog.Action.FEEDBACK,
            resource_type="FeedbackReport",
            resource_id=report.id,
            resource_label=report.title,
            description=f"User {self.request.user.username} submitted feedback: {report.feedback_type}"
        )

    def get_queryset(self):
        qs = super().get_queryset()
        if not rbac_user_has_permission(self.request.user, "feedback_view"):
            return qs.filter(created_by=self.request.user)
        return qs


class FeedbackCommentViewSet(viewsets.ModelViewSet):
    queryset = FeedbackComment.objects.all().select_related("author")
    serializer_class = FeedbackCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        report_id = self.request.query_params.get('report')
        qs = super().get_queryset()
        if report_id:
            qs = qs.filter(report_id=report_id)
        
        # Filter internal notes if user lacks manage permission
        if not rbac_user_has_permission(self.request.user, "feedback_manage"):
            qs = qs.filter(is_internal=False)
            
        return qs

    def perform_create(self, serializer):
        report = serializer.validated_data['report']
        is_internal = serializer.validated_data.get('is_internal', False)
        
        if is_internal and not rbac_user_has_permission(self.request.user, "feedback_manage"):
            raise PermissionDenied("You do not have permission to post internal notes.")
            
        serializer.save(author=self.request.user)


class FeedbackStatusView(APIView):
    """Check if feedback is enabled globally."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        enabled = SystemSetting.get_bool("ENABLE_USER_FEEDBACK", default=True)
        return Response({"enabled": enabled})


# ── Minutes & Transcript ──────────────────────────────────────────────────────


class MinutesViewSet(viewsets.ModelViewSet):
    """CRUD for meeting minutes documents, plus AI generation actions."""

    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    queryset = Minutes.objects.select_related(
        "meeting", "created_by", "signed_by"
    ).all()
    serializer_class = MinutesSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        meeting_id = self.request.query_params.get("meeting")
        if meeting_id:
            qs = qs.filter(meeting_id=meeting_id)
        return qs

    def perform_create(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.PSC_COMMISSIONER}:
            raise PermissionDenied("Only PSC Secretary, Admin, or Commissioners can create minutes.")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.PSC_COMMISSIONER}:
            raise PermissionDenied("Only PSC Secretary, Admin, or Commissioners can edit minutes.")
        serializer.save()

    @action(detail=False, methods=["post"], url_path="generate-from-transcript")
    def generate_from_transcript(self, request):
        """AI: draft structured minutes from an existing transcript."""
        from .tasks import draft_minutes_from_transcript
        serializer = MinutesGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting_id = serializer.validated_data["meeting_id"]
        try:
            meeting = Meeting.objects.get(id=meeting_id)
        except Meeting.DoesNotExist:
            return Response({"detail": "Meeting not found."}, status=404)

        if not hasattr(meeting, "transcript") or not meeting.transcript.ai_processed:
            return Response(
                {"detail": "No processed transcript found for this meeting. Run transcription first."},
                status=400,
            )

        draft_minutes_from_transcript.delay(meeting_id, user_id=request.user.id)
        return Response({"detail": "Minutes generation started. Check back shortly."})

    @action(detail=False, methods=["post"], url_path="transcribe")
    def transcribe(self, request):
        """AI: transcribe the uploaded recording for a meeting."""
        from .tasks import transcribe_meeting_recording
        serializer = TranscriptGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting_id = serializer.validated_data["meeting_id"]
        try:
            meeting = Meeting.objects.get(id=meeting_id)
        except Meeting.DoesNotExist:
            return Response({"detail": "Meeting not found."}, status=404)

        import glob as _glob
        recordings_dir = os.path.join(settings.MEDIA_ROOT, "recordings")
        pattern = os.path.join(recordings_dir, f"*{meeting_id}*")
        matches = _glob.glob(pattern)
        if not matches:
            return Response(
                {"detail": "No recording file found for this meeting. Upload one first via POST /meetings/upload/."},
                status=400,
            )
        audio_path = matches[0]
        transcribe_meeting_recording.delay(meeting_id, audio_path)
        return Response({"detail": "Transcription started. Check back shortly."})

    @action(detail=False, methods=["post"], url_path="extract-decisions")
    def extract_decisions(self, request):
        """AI: extract decision outcomes from minutes content and suggest transitions."""
        from .tasks import extract_decisions_from_minutes
        serializer = DecisionExtractSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting_id = serializer.validated_data["meeting_id"]
        try:
            meeting = Meeting.objects.get(id=meeting_id)
        except Meeting.DoesNotExist:
            return Response({"detail": "Meeting not found."}, status=404)

        if not hasattr(meeting, "minutes") or not meeting.minutes.content:
            return Response(
                {"detail": "No minutes content found for this meeting. Draft minutes first."},
                status=400,
            )

        extract_decisions_from_minutes.delay(meeting_id)
        return Response({"detail": "Decision extraction started. Check back shortly."})

    @action(detail=True, methods=["post"], url_path="sign")
    def sign(self, request, pk=None):
        """Mark minutes as signed by the current user and generate a signed PDF.
        Requires the user's session PIN for confirmation."""
        minutes = self.get_object()
        signer_profile = _profile(self.request.user)
        if signer_profile.role not in {Role.CHAIRPERSON, Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.PSC_COMMISSIONER}:
            raise PermissionDenied("Only PSC Secretary, Admin, Commissioners, or the Chairperson can sign minutes.")
        if minutes.status == MinutesStatus.SIGNED:
            return Response({"detail": "Minutes are already signed."}, status=400)

        # Require session PIN for signature confirmation
        pin = request.data.get("pin", "")
        if not signer_profile.session_pin:
            return Response(
                {"detail": "You must set up a session PIN in Account Settings before you can sign documents."},
                status=400,
            )
        from django.contrib.auth.hashers import check_password
        if not pin or not check_password(pin, signer_profile.session_pin):
            return Response({"detail": "Invalid PIN. Signing cancelled."}, status=400)

        minutes.status = MinutesStatus.SIGNED
        minutes.signed_by = request.user
        minutes.signed_at = timezone.now()
        minutes.save()

        # Generate signed PDF with signature image
        from io import BytesIO
        from django.template.loader import render_to_string
        from weasyprint import HTML
        import base64

        content = minutes.content or {}
        agenda_items = content.get("agenda_items", [])

        # Embed signature as base64 data URI if available
        signature_data_uri = None
        if signer_profile.signature and signer_profile.signature.storage.exists(signer_profile.signature.name):
            try:
                with signer_profile.signature.open("rb") as f:
                    sig_bytes = f.read()
                ext = signer_profile.signature.name.rsplit(".", 1)[-1].lower()
                mime = "image/png" if ext == "png" else "image/jpeg"
                b64 = base64.b64encode(sig_bytes).decode("ascii")
                signature_data_uri = f"data:{mime};base64,{b64}"
            except Exception:
                pass

        html = render_to_string("tracker/minutes_pdf.html", {
            "meeting": minutes.meeting,
            "minutes": minutes,
            "content": content,
            "agenda_items": agenda_items,
            "status_label": minutes.get_status_display(),
            "signature_data_uri": signature_data_uri,
        })

        buf = BytesIO()
        HTML(string=html).write_pdf(buf)
        buf.seek(0)

        # Persist the signed PDF
        from django.core.files.base import ContentFile
        filename = f"minutes_{minutes.meeting.reference_number}_signed.pdf"
        minutes.pdf_version.save(filename, ContentFile(buf.read()), save=True)

        return Response(MinutesSerializer(minutes).data)

    @action(detail=True, methods=["post"], url_path="mark-reviewed")
    def mark_reviewed(self, request, pk=None):
        """Mark minutes as reviewed (ready for signing)."""
        minutes = self.get_object()
        profile = _profile(self.request.user)
        if profile.role not in {Role.CHAIRPERSON, Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.PSC_COMMISSIONER, Role.SENIOR_ADMIN_OFFICER}:
            raise PermissionDenied("Only PSC Secretary, Admin, Commissioners, Chairperson, or Senior Admin can review minutes.")
        if minutes.status == MinutesStatus.SIGNED:
            return Response({"detail": "Cannot review signed minutes."}, status=400)
        minutes.status = MinutesStatus.REVIEWED
        minutes.save()
        return Response(MinutesSerializer(minutes).data)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """Generate a PDF version of the minutes."""
        minutes = self.get_object()
        from io import BytesIO
        from django.template.loader import render_to_string
        from weasyprint import HTML
        import base64

        content = minutes.content or {}
        agenda_items = content.get("agenda_items", [])

        # Embed signature as base64 data URI if signed and image exists
        signature_data_uri = None
        if minutes.signed_by:
            sig_profile = getattr(minutes.signed_by, 'psc_profile', None)
            if sig_profile and sig_profile.signature and sig_profile.signature.storage.exists(sig_profile.signature.name):
                try:
                    with sig_profile.signature.open("rb") as f:
                        sig_bytes = f.read()
                    ext = sig_profile.signature.name.rsplit(".", 1)[-1].lower()
                    mime = "image/png" if ext == "png" else "image/jpeg"
                    b64 = base64.b64encode(sig_bytes).decode("ascii")
                    signature_data_uri = f"data:{mime};base64,{b64}"
                except Exception:
                    pass

        html = render_to_string("tracker/minutes_pdf.html", {
            "meeting": minutes.meeting,
            "minutes": minutes,
            "content": content,
            "agenda_items": agenda_items,
            "status_label": minutes.get_status_display(),
            "signature_data_uri": signature_data_uri,
        })

        buf = BytesIO()
        HTML(string=html).write_pdf(buf)
        buf.seek(0)

        from django.http import HttpResponse
        filename = f"minutes_{minutes.meeting.reference_number}.pdf"
        resp = HttpResponse(buf, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="{filename}"'
        return resp


class TranscriptViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to meeting transcripts."""

    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    queryset = MeetingTranscript.objects.select_related("meeting").all()
    serializer_class = MeetingTranscriptSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        meeting_id = self.request.query_params.get("meeting")
        if meeting_id:
            qs = qs.filter(meeting_id=meeting_id)
        return qs


class DocumentAnnotationViewSet(viewsets.ModelViewSet):
    """CRUD for per-page document annotations (PDF assessment notes)."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DocumentAnnotationSerializer

    def get_queryset(self):
        qs = DocumentAnnotation.objects.select_related('annotated_by', 'document').all()
        doc_id = self.request.query_params.get('document')
        sub_id = self.request.query_params.get('submission')
        if doc_id:
            qs = qs.filter(document_id=doc_id)
        if sub_id:
            qs = qs.filter(document__submission_id=sub_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(annotated_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """Upsert: if an annotation for (document, user, page) already exists, update it."""
        doc_id = request.data.get('document')
        page = request.data.get('page_number', 1)
        existing = DocumentAnnotation.objects.filter(
            document_id=doc_id,
            annotated_by=request.user,
            page_number=page,
        ).first()
        if existing:
            serializer = self.get_serializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            snapshot = request.FILES.get('snapshot')
            if snapshot:
                existing.snapshot = snapshot
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)


class DocumentSignatureViewSet(viewsets.ModelViewSet):
    """CRUD for document signatures (pre-stored signature image placed on a PDF page)."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    serializer_class = DocumentSignatureSerializer

    def get_queryset(self):
        qs = DocumentSignature.objects.select_related('signed_by', 'document').all()
        doc_id = self.request.query_params.get('document')
        sub_id = self.request.query_params.get('submission')
        if doc_id:
            qs = qs.filter(document_id=doc_id)
        if sub_id:
            qs = qs.filter(document__submission_id=sub_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(signed_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """Upsert: a user can update their own signature placement on a document."""
        doc_id = request.data.get('document')
        existing = DocumentSignature.objects.filter(
            document_id=doc_id,
            signed_by=request.user,
        ).first()
        if existing:
            serializer = self.get_serializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            snapshot = request.FILES.get('snapshot')
            if snapshot:
                existing.snapshot = snapshot
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)


class MySignatureView(APIView):
    """GET / POST / DELETE the authenticated user's stored signature image."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get(self, request):
        try:
            sig = request.user.stored_signature
            return Response(UserSignatureSerializer(sig).data)
        except UserSignature.DoesNotExist:
            return Response(None, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        image = request.FILES.get('image')
        if not image:
            return Response({'detail': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)
        sig, _ = UserSignature.objects.get_or_create(user=request.user)
        if sig.image:
            sig.image.delete(save=False)
        sig.image = image
        sig.save()
        return Response(UserSignatureSerializer(sig).data)

    def delete(self, request):
        try:
            sig = request.user.stored_signature
            sig.image.delete(save=False)
            sig.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except UserSignature.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)


class VerifyPinView(APIView):
    """Quick in-app PIN check — confirms identity without issuing new tokens."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [SessionPinVerifyThrottle]

    def post(self, request):
        from django.contrib.auth.hashers import check_password
        pin = str(request.data.get('pin', ''))
        try:
            profile = _profile(request.user)
        except Exception:
            return Response(
                {'detail': 'User profile not found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not profile.session_pin:
            return Response(
                {'detail': 'No Session PIN configured. Please set one up in Account Settings first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not pin or not check_password(pin, profile.session_pin):
            return Response({'detail': 'Incorrect PIN. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'ok': True})


# ── ODU Restructure Checklist ─────────────────────────────────────────────────

class ODUChecklistViewSet(viewsets.ModelViewSet):
    """
    CRUD + submit for the ODU Restructure Checklist.

    Accessible by ODU_PRINCIPAL (create / edit draft) and ODU_MANAGER (approve).
    Also readable by PSC secretariat / admin roles.

    Filtering:  GET /odu-checklists/?submission=<id>
    """

    serializer_class   = ODUChecklistSerializer
    permission_classes = [permissions.IsAuthenticated]

    ODU_ROLES = {
        Role.ODU_PRINCIPAL,
        Role.ODU_MANAGER,
        Role.PSC_SECRETARY,
        Role.PSC_ADMIN,
        Role.PSC_MANAGER,
    }

    def get_queryset(self):
        qs = ODURestructureChecklist.objects.select_related(
            "submission", "created_by",
        ).all()
        sub_id = self.request.query_params.get("submission")
        if sub_id:
            qs = qs.filter(submission_id=sub_id)
        return qs

    def perform_create(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in self.ODU_ROLES:
            raise PermissionDenied("Only ODU officers can create checklists.")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in self.ODU_ROLES:
            raise PermissionDenied("Only ODU officers can edit checklists.")
        serializer.save()

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """
        Transition checklist from Draft → Submitted.
        Must be ODU_PRINCIPAL or above. All 20 items must be answered.
        """
        checklist = self.get_object()
        profile = _profile(request.user)
        if profile.role not in self.ODU_ROLES:
            raise PermissionDenied("Only ODU officers can submit checklists.")
        if checklist.status != ODUChecklistStatus.DRAFT:
            return Response(
                {"detail": "Only Draft checklists can be submitted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if checklist.items_answered < 20:
            return Response(
                {"detail": f"All 20 checklist items must be answered before submitting. ({checklist.items_answered}/20 answered)"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        checklist.status = ODUChecklistStatus.SUBMITTED
        checklist.submitted_at = timezone.now()
        checklist.save(update_fields=["status", "submitted_at"])
        return Response(ODUChecklistSerializer(checklist).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """
        Transition checklist from Submitted → Approved.
        Restricted to ODU_MANAGER.
        """
        checklist = self.get_object()
        profile = _profile(request.user)
        if profile.role != Role.ODU_MANAGER:
            raise PermissionDenied("Only the ODU Manager can approve checklists.")
        if checklist.status != ODUChecklistStatus.SUBMITTED:
            return Response(
                {"detail": "Only Submitted checklists can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        checklist.status = ODUChecklistStatus.APPROVED
        # Auto-fill manager verifier name if not already set
        if not checklist.manager_verifier_name:
            u = request.user
            checklist.manager_verifier_name = f"{u.first_name} {u.last_name}".strip() or u.username
        if not checklist.manager_verifier_date:
            checklist.manager_verifier_date = timezone.now().date()
        checklist.save(update_fields=["status", "manager_verifier_name", "manager_verifier_date"])
        return Response(ODUChecklistSerializer(checklist).data)
