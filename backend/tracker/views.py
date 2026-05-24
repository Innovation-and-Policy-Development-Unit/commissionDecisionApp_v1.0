import os
from django.contrib.auth.models import User
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
    EmailTemplate,
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
    MeetingBriefingPackSerializer,
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
    EmailTemplateSerializer,
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
from .throttles import PasswordResetThrottle, SessionPinVerifyThrottle
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
    from .profile_utils import ensure_psc_profile

    return ensure_psc_profile(user)


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
        "scheduled_meeting",
        "assigned_to",
        "dg_endorsed_by",
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
    """PSC Tracker expects a Profile for role-scoped users; staff/superuser get one auto-created."""

    message = (
        "This account has no PSC profile. Open Django Admin → PSC profiles → Add, "
        "link this user, and set a role (e.g. PSC Admin)."
    )

    def has_permission(self, request, view):
        from .profile_utils import user_has_psc_profile

        return user_has_psc_profile(request.user)


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

    recipient_list = list(recipients)
    for user in recipient_list:
        NotificationModel.objects.create(
            recipient=user,
            submission=submission,
            channel=NotificationModel.Channel.BOTH,
            title=title,
            body=body,
        )

    if recipient_list and title:
        from .email_notify import send_transition_emails

        label = ""
        if target in (WorkflowStage.APPROVED, WorkflowStage.REJECTED):
            label = "approved" if target == WorkflowStage.APPROVED else "rejected"
        send_transition_emails(
            submission, prev, target, recipient_list, decision_label=label
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
        from .tasks import (
            QUALITY_SCORE_STAGES,
            queue_submission_brief,
            queue_submission_quality_score,
            submission_brief_needs_refresh,
            submission_quality_needs_refresh,
        )

        submission = self.get_object()
        profile = _profile(request.user)
        if profile.role in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            if submission_brief_needs_refresh(submission):
                queue_submission_brief(submission.id, sync_fallback=False)
        if (
            submission.current_stage in QUALITY_SCORE_STAGES
            and submission_quality_needs_refresh(submission)
        ):
            queue_submission_quality_score(submission.id, force=False)

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
        acknowledge_gaps = bool(ser.validated_data.get("acknowledge_gaps"))
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

        # ── A3: pre-submit package validation (draft → submitted) ───────────────
        if (
            prev == WorkflowStage.DRAFT
            and target == WorkflowStage.SUBMITTED
            and not acknowledge_gaps
        ):
            from django.conf import settings as django_settings

            if getattr(django_settings, "AI_PACKAGE_BLOCK_SUBMIT", True):
                if not submission.ai_package_processed:
                    return Response(
                        {
                            "detail": (
                                "Run “Validate package” and wait for results before submitting, "
                                "or submit with acknowledge_gaps if you must proceed."
                            ),
                            "package_ready": False,
                            "package_summary": submission.ai_package_summary or "",
                            "package_gaps": submission.ai_package_gaps or [],
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                critical = [
                    g for g in (submission.ai_package_gaps or [])
                    if g.get("severity") == "critical"
                ]
                if critical:
                    return Response(
                        {
                            "detail": (
                                "Cannot submit: critical package gaps were found. "
                                "Run “Validate package”, fix items, or submit with "
                                "acknowledge_gaps if you must proceed."
                            ),
                            "package_ready": submission.ai_package_ready,
                            "package_summary": submission.ai_package_summary,
                            "package_gaps": submission.ai_package_gaps,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
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

        from .decision_proof import create_decision_proof, is_decision_stage

        proof_hash = ""
        proof_payload = {}

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

            if is_decision_stage(target):
                proof_hash, proof_payload = create_decision_proof(
                    submission=submission,
                    previous_stage=prev,
                    new_stage=target,
                    actor=request.user,
                    remarks=remarks,
                )

            WorkflowEvent.objects.create(
                submission=submission,
                actor=request.user,
                previous_stage=prev,
                new_stage=target,
                remarks=remarks,
                content_hash=proof_hash,
                proof_payload=proof_payload,
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

        from .tasks import SUBMISSION_BRIEF_STAGES, queue_submission_brief
        if target in SUBMISSION_BRIEF_STAGES:
            sid = submission.id
            transaction.on_commit(lambda: queue_submission_brief(sid, force=False))

        from .tasks import queue_submission_quality_score

        _quality_triggers = (
            target == WorkflowStage.SUBMITTED
            or (
                prev == WorkflowStage.DEFERRED_BACK_TO_HR
                and submission.current_stage == WorkflowStage.MANAGER_CHECKLIST_REVIEW
            )
            or target == WorkflowStage.SECRETARY_REVIEW
        )
        if _quality_triggers and submission.current_stage != WorkflowStage.DRAFT:
            sid = submission.id
            transaction.on_commit(lambda: queue_submission_quality_score(sid, force=False))

        # ── Legacy: dispatch to CMS only when portal created submission without CMS link ──
        if target == WorkflowStage.COMPLIANCE_UNDER_REVIEW and not submission.cms_case_id:
            from .cms_bridge import dispatch_submission_to_cms
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

        if is_decision_stage(target) and proof_hash:
            _log(
                request,
                _AL.Action.DECISION,
                resource_type="Submission",
                resource_id=submission.id,
                resource_label=submission.reference_number,
                description=f"Decision proof recorded: {prev} → {target}",
                extra_data={
                    "content_hash": proof_hash,
                    "previous_stage": prev,
                    "new_stage": target,
                    "proof_version": proof_payload.get("v"),
                },
            )

        if target == WorkflowStage.RETURNED_FOR_CLARIFICATION and remarks.strip():
            from .tasks import queue_clarification_bilingual

            sid = submission.id
            rem = remarks.strip()
            transaction.on_commit(lambda: queue_clarification_bilingual(sid, remarks=rem))

        from .tasks import queue_transition_guidance

        transaction.on_commit(
            lambda: queue_transition_guidance(
                submission.id, role=profile.role, force=True
            )
        )

        return Response(SubmissionDetailSerializer(submission).data)

    @action(detail=True, methods=["post"], url_path="validate-package")
    def validate_package(self, request, pk=None):
        """A3 — queue pre-submit package validation (Haiku, async)."""
        from .tasks import queue_submission_package_validation

        submission = self.get_object()
        profile = _profile(request.user)
        _submit_roles = {
            Role.MINISTRY_HR,
            Role.DEPT_ADMIN,
            Role.HEAD_OF_AGENCY,
            Role.PSC_OFFICER,
            Role.PSC_ADMIN,
            Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER,
        }
        if profile.role not in _submit_roles and not request.user.is_staff:
            raise PermissionDenied("You do not have permission to validate this submission package.")

        if submission.current_stage != WorkflowStage.DRAFT:
            return Response(
                {"detail": "Package validation is only available while the submission is in Draft."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission.ai_package_processed = False
        submission.save(update_fields=["ai_package_processed", "updated_at"])
        queue_submission_package_validation(submission.id, force=True)
        submission.refresh_from_db()
        return Response(
            SubmissionDetailSerializer(submission).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"], url_path="scan-policy")
    def scan_policy(self, request, pk=None):
        """A6 — queue pre-submit policy guardrail scan (Sonnet + decision register)."""
        from .ai.policy_guardrail import policy_guardrail_applies
        from .tasks import queue_submission_policy_guardrail

        submission = self.get_object()
        profile = _profile(request.user)
        _submit_roles = {
            Role.MINISTRY_HR,
            Role.DEPT_ADMIN,
            Role.HEAD_OF_AGENCY,
            Role.PSC_OFFICER,
            Role.PSC_ADMIN,
            Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER,
        }
        if profile.role not in _submit_roles and not request.user.is_staff:
            raise PermissionDenied("You do not have permission to run a policy scan.")

        if submission.current_stage != WorkflowStage.DRAFT:
            return Response(
                {"detail": "Policy guardrail is only available while the submission is in Draft."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not policy_guardrail_applies(submission):
            return Response(
                {
                    "detail": "Policy guardrail applies to salary, appointment, and related submission types.",
                    "skipped": True,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission.ai_policy_processed = False
        submission.save(update_fields=["ai_policy_processed", "updated_at"])
        queue_submission_policy_guardrail(submission.id, force=True)
        submission.refresh_from_db()
        return Response(
            SubmissionDetailSerializer(submission).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"], url_path="score-quality")
    def score_quality(self, request, pk=None):
        """Re-run AI submission quality score (compliance / unit review triage)."""
        from .tasks import queue_submission_quality_score

        submission = self.get_object()
        profile = _profile(request.user)
        _review_roles = {
            Role.PSC_OFFICER,
            Role.PSC_ADMIN,
            Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER,
            Role.PSC_MANAGER,
            Role.ODU_MANAGER,
            Role.HR_UNIT_MANAGER,
            Role.VIPAM_MANAGER,
            Role.COMPLIANCE_MANAGER,
            Role.COMPLIANCE_SENIOR,
            Role.COMPLIANCE_PRINCIPAL,
        }
        if profile.role not in _review_roles and not request.user.is_staff:
            raise PermissionDenied("You do not have permission to request a quality score.")

        submission.ai_quality_processed = False
        submission.ai_quality_score = None
        submission.save(update_fields=["ai_quality_processed", "ai_quality_score", "updated_at"])
        queue_submission_quality_score(submission.id, force=True)
        submission.refresh_from_db()
        return Response(SubmissionDetailSerializer(submission).data)

    @action(detail=True, methods=["post"], url_path="generate-brief")
    def generate_brief(self, request, pk=None):
        """Queue AI executive brief generation for Secretariat review."""
        from .tasks import queue_submission_brief

        submission = self.get_object()
        profile = _profile(request.user)
        from .sitting_pack import BRIEF_REQUEST_ROLES

        if profile.role not in BRIEF_REQUEST_ROLES and not (
            request.user.is_superuser or request.user.is_staff
        ):
            raise PermissionDenied(
                "Only Commission members and Secretariat staff can request an executive brief."
            )

        submission.ai_brief_processed = False
        submission.ai_brief_summary = ""
        submission.save(update_fields=["ai_brief_processed", "ai_brief_summary", "updated_at"])
        queue_submission_brief(submission.id, force=True, sync_fallback=False)
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
        allowed = iter_allowed_targets(
            profile.role, submission.current_stage, is_internal=submission.is_internal
        )
        guidance = submission.ai_transition_guidance or {}
        stale = (
            not guidance.get("processed")
            or guidance.get("current_stage") != submission.current_stage
        )
        if stale:
            from .tasks import queue_transition_guidance

            queue_transition_guidance(submission.id, role=profile.role, force=True)
        return Response({
            "allowed": allowed,
            "transition_guidance": guidance,
            "transition_guidance_pending": stale,
        })

    @action(detail=True, methods=["get", "post"], url_path="transition-guidance")
    def transition_guidance(self, request, pk=None):
        """F1 — poll or refresh AI transition suggestions (async)."""
        submission = self.get_object()
        profile = _profile(request.user)
        if request.method == "POST":
            from .tasks import queue_transition_guidance

            queue_transition_guidance(submission.id, role=profile.role, force=True)
            submission.ai_transition_guidance = {}
            submission.save(update_fields=["ai_transition_guidance", "updated_at"])
        submission.refresh_from_db()
        guidance = submission.ai_transition_guidance or {}
        return Response({
            "transition_guidance": guidance,
            "transition_guidance_pending": not guidance.get("processed"),
        })

    @action(detail=True, methods=["get"], url_path="visual-audit-trail")
    def visual_audit_trail(self, request, pk=None):
        """Readable merged timeline: workflow events + audit log entries."""
        from .decision_proof import build_visual_audit_trail

        submission = self.get_object()
        return Response({
            "submission_id": submission.id,
            "reference_number": submission.reference_number,
            "entries": build_visual_audit_trail(submission),
        })

    @action(detail=True, methods=["get"], url_path="decision-proof")
    def decision_proof(self, request, pk=None):
        """Verify cryptographic decision proof for a workflow event."""
        from .decision_proof import verify_stored_proof
        from .models import WorkflowEvent

        submission = self.get_object()
        event_id = request.query_params.get("event_id")
        if not event_id:
            return Response({"detail": "event_id query parameter is required."}, status=400)
        try:
            event = WorkflowEvent.objects.get(pk=int(event_id), submission=submission)
        except (WorkflowEvent.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Workflow event not found."}, status=404)

        verification = verify_stored_proof(event.content_hash, event.proof_payload or None)
        actor_username = event.actor.username if event.actor_id else (event.actor_label or "System")
        return Response({
            "workflow_event_id": event.id,
            "reference_number": submission.reference_number,
            "previous_stage": event.previous_stage,
            "new_stage": event.new_stage,
            "actor_username": actor_username,
            "recorded_at": event.created_at.isoformat(),
            "remarks": event.remarks or "",
            "content_hash": event.content_hash,
            "proof_payload": event.proof_payload or {},
            "verification": verification,
        })

    @action(detail=True, methods=["post"], url_path="presence/heartbeat")
    def presence_heartbeat(self, request, pk=None):
        """Register active viewing; returns other users on this submission."""
        from .submission_presence import serialize_viewers, touch_presence

        submission = self.get_object()
        touch_presence(submission_id=submission.id, user=request.user)
        viewers = serialize_viewers(
            submission_id=submission.id,
            current_user_id=request.user.id,
        )
        others = [v for v in viewers if not v["is_self"]]
        return Response({
            "viewers": viewers,
            "others": others,
            "other_count": len(others),
        })

    @action(detail=True, methods=["get"], url_path="presence")
    def presence_list(self, request, pk=None):
        """List users currently viewing this submission (no heartbeat)."""
        from .submission_presence import serialize_viewers

        submission = self.get_object()
        viewers = serialize_viewers(
            submission_id=submission.id,
            current_user_id=request.user.id,
        )
        others = [v for v in viewers if not v["is_self"]]
        return Response({
            "viewers": viewers,
            "others": others,
            "other_count": len(others),
        })

    @action(detail=True, methods=["post"], url_path="presence/leave")
    def presence_leave(self, request, pk=None):
        """Remove presence when leaving the submission detail page."""
        from .submission_presence import clear_presence

        submission = self.get_object()
        clear_presence(submission_id=submission.id, user_id=request.user.id)
        return Response({"detail": "Presence cleared."})

    @action(detail=False, methods=["post"], url_path="nl-search")
    def nl_search(self, request):
        """Smart search — natural language → filter JSON + matching submission ids."""
        from .ai.smart_search import apply_smart_filters, parse_nl_search_query

        query = (request.data.get("query") or "").strip()
        profile = _profile(request.user)
        parsed, err = parse_nl_search_query(query, role=profile.role)
        if not parsed:
            return Response({"detail": err or "Could not parse query."}, status=400)
        qs = _submission_queryset_for(request.user).filter(is_attachment=False)
        qs = apply_smart_filters(qs, parsed.get("filters") or {})
        ids = list(qs.values_list("id", flat=True)[:200])
        return Response({
            **parsed,
            "submission_ids": ids,
            "count": len(ids),
        })

    @action(detail=True, methods=["get"])
    def checklist(self, request, pk=None):
        """Return checklist items for a submission, auto-creating from RequiredDocuments.

        Matching priority (most specific first):
          1. form_type-specific docs (form_type matches submission.form_type_code)
          2. form_category-scoped docs (form_category matches, form_type is null)
          3. Global docs (both form_category and form_type are null)
        """
        submission = self.get_object()

        if submission.is_attachment or submission.is_internal:
            return Response([])

        from .submission_checklist import ensure_submission_checklist_items

        ensure_submission_checklist_items(submission)
        items = SubmissionChecklistItem.objects.filter(
            submission=submission
        ).select_related("document", "checked_by")
        return Response(ChecklistItemSerializer(items, many=True).data)

    @action(detail=True, methods=["patch"], url_path="checklist/(?P<item_id>[0-9]+)")
    def checklist_toggle(self, request, pk=None, item_id=None):
        """Toggle is_present on a checklist item; optionally persist notes."""
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
        if "notes" in request.data:
            item.notes = str(request.data["notes"])[:1000]
        item.save()
        return Response(ChecklistItemSerializer(item).data)

    @action(detail=True, methods=["post"], url_path="checklist/autofill")
    def checklist_autofill(self, request, pk=None):
        """A1 — AI suggestions for checklist items based on OCR'd document text."""
        from .ai.checklist_autofill import suggest_checklist_items
        from .submission_checklist import ensure_submission_checklist_items

        submission = self.get_object()

        if submission.is_attachment or submission.is_internal:
            return Response({"suggestions": {}, "items": [], "error": None})

        _autofill_roles = {
            Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY,
            Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER,
            Role.VIPAM_MANAGER, Role.HR_UNIT_MANAGER,
            Role.COMPLIANCE_MANAGER, Role.COMPLIANCE_SENIOR,
        }
        profile = _profile(request.user)
        if profile.role not in _autofill_roles and not request.user.is_staff:
            raise PermissionDenied("You do not have permission to use AI checklist autofill.")

        ensure_submission_checklist_items(submission)
        items = list(
            SubmissionChecklistItem.objects.filter(submission=submission).select_related(
                "document", "checked_by"
            )
        )

        suggestions, err = suggest_checklist_items(submission, items)

        return Response({
            "disclaimer": "AI draft — verify before marking checklist items present.",
            "suggestions": suggestions,
            "items": ChecklistItemSerializer(items, many=True).data,
            "error": err,
        })

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
            from .tasks import queue_document_classification, queue_document_extraction

            queue_document_extraction(doc.id)
            queue_document_classification(doc.id)

        if submission.current_stage != WorkflowStage.DRAFT:
            from .tasks import queue_submission_quality_score

            sid = submission.id
            transaction.on_commit(lambda: queue_submission_quality_score(sid))

        if len(created_docs) == 1:
            return Response(SubmissionDocumentSerializer(created_docs[0]).data, status=status.HTTP_201_CREATED)
        return Response(SubmissionDocumentSerializer(created_docs, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="documents/(?P<doc_id>[0-9]+)/extract-facts")
    def extract_document_facts(self, request, pk=None, doc_id=None):
        """Re-run OCR / key-facts extraction on a document (E1)."""
        submission = self.get_object()
        doc = get_object_or_404(SubmissionDocument, id=doc_id, submission=submission)
        profile = _profile(request.user)
        if profile.role not in {
            Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER, Role.COMPLIANCE_MANAGER,
            Role.COMPLIANCE_SENIOR, Role.COMPLIANCE_PRINCIPAL,
        }:
            raise PermissionDenied("Only PSC staff may run document extraction.")

        from .tasks import queue_document_extraction

        queue_document_extraction(doc.id)
        return Response({"detail": "Document extraction queued.", "document_id": doc.id})

    @action(detail=True, methods=["post"], url_path="documents/(?P<doc_id>[0-9]+)/annotation-assist")
    def document_annotation_assist(self, request, pk=None, doc_id=None):
        submission = self.get_object()
        doc = get_object_or_404(SubmissionDocument, id=doc_id, submission=submission)
        profile = _profile(request.user)
        if profile.role not in {
            Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER, Role.PSC_MANAGER,
        }:
            raise PermissionDenied("Only PSC reviewers may request annotation suggestions.")
        from .tasks import queue_document_annotation_assist

        doc.ai_annotation_suggestions = {}
        doc.save(update_fields=["ai_annotation_suggestions"])
        queue_document_annotation_assist(doc.id)
        doc.refresh_from_db()
        return Response(SubmissionDocumentSerializer(doc).data)

    @action(detail=True, methods=["post"], url_path="documents/(?P<doc_id>[0-9]+)/redaction-preview")
    def document_redaction_preview(self, request, pk=None, doc_id=None):
        submission = self.get_object()
        doc = get_object_or_404(SubmissionDocument, id=doc_id, submission=submission)
        profile = _profile(request.user)
        if profile.role not in {
            Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER,
        }:
            raise PermissionDenied("Only PSC staff may request redaction preview.")
        from .tasks import queue_document_redaction_preview

        doc.ai_redaction_spans = {}
        doc.save(update_fields=["ai_redaction_spans"])
        queue_document_redaction_preview(doc.id)
        doc.refresh_from_db()
        return Response(SubmissionDocumentSerializer(doc).data)

    @action(detail=True, methods=["get"], url_path="deadline-reminder-drafts")
    def deadline_reminder_drafts(self, request, pk=None):
        """List AI-drafted deadline reminders for this submission."""
        submission = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {
            Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.PSC_OFFICER,
            Role.SENIOR_ADMIN_OFFICER, Role.PSC_MANAGER,
        }:
            raise PermissionDenied("Only PSC staff may view deadline reminder drafts.")

        from .models import DeadlineReminderDraft
        from .serializers import DeadlineReminderDraftSerializer

        drafts = DeadlineReminderDraft.objects.filter(submission=submission).order_by("-drafted_at")
        return Response(DeadlineReminderDraftSerializer(drafts, many=True).data)

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
            resp = instance
        else:
            try:
                form_type = PSCFormType.objects.get(pk=form_type_id)
            except (PSCFormType.DoesNotExist, TypeError):
                return Response({'detail': 'form_type is required.'}, status=400)
            resp = PSCFormResponse.objects.create(
                submission=submission, form_type=form_type, data=data_payload)

        if submission.current_stage == WorkflowStage.DRAFT:
            from .ai.policy_guardrail import policy_guardrail_applies
            from .tasks import queue_submission_policy_guardrail

            if policy_guardrail_applies(submission):
                submission.ai_policy_processed = False
                submission.save(update_fields=["ai_policy_processed", "updated_at"])
                queue_submission_policy_guardrail(submission.id, force=True)

        code = status.HTTP_200_OK if instance else status.HTTP_201_CREATED
        return Response(PSCFormResponseSerializer(resp).data, status=code)

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
        task = serializer.save(created_by=self.request.user)
        from .email_notify import notify_task_assigned, task_assignees

        notify_task_assigned(task, task_assignees(task))

    def perform_update(self, serializer):
        task = serializer.instance
        user = self.request.user
        old_manager_id = task.assigned_manager_id
        old_staff_id = task.assigned_staff_id
        old_m2m_ids = set(task.assigned_staff_m2m.values_list("id", flat=True))

        def _notify_new_assignees(updated_task):
            from .email_notify import notify_task_assigned

            new_users = []
            if updated_task.assigned_manager_id and updated_task.assigned_manager_id != old_manager_id:
                new_users.append(updated_task.assigned_manager)
            if updated_task.assigned_staff_id and updated_task.assigned_staff_id != old_staff_id:
                new_users.append(updated_task.assigned_staff)
            new_m2m = set(updated_task.assigned_staff_m2m.values_list("id", flat=True))
            for uid in new_m2m - old_m2m_ids:
                u = User.objects.filter(pk=uid, is_active=True).first()
                if u:
                    new_users.append(u)
            if new_users:
                notify_task_assigned(updated_task, new_users)

        if user.is_superuser or user.is_staff:
            updated = serializer.save()
            _notify_new_assignees(updated)
            self._maybe_close_cms_for_task(updated)
            return

        vd = serializer.validated_data
        keys = set(vd.keys())

        if rbac_user_has_permission(user, "allocate_decision"):
            if "submission" in vd:
                raise PermissionDenied("Cannot move a task to another submission.")
            updated = serializer.save()
            _notify_new_assignees(updated)
            self._maybe_close_cms_for_task(updated)
            return

        is_manager = task.assigned_manager_id == user.id and rbac_user_has_permission(user, "assign_task")
        is_staff = (
            task.assigned_staff_id == user.id
            or task.assigned_staff_m2m.filter(id=user.id).exists()
        ) and rbac_user_has_permission(user, "update_implementation")

        if is_manager:
            if "submission" in keys or "assigned_manager" in keys:
                raise PermissionDenied("You cannot reassign the submission or manager for this task.")
            updated = serializer.save()
            _notify_new_assignees(updated)
            self._maybe_close_cms_for_task(updated)
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

    return Response({
        "summary": {
            "total_submissions": total,
            "active_submissions": active_count,
            "overdue_assessments": overdue_count,
            "avg_turnaround_days": 14, # Static placeholder or calculated
        },
        "distributions": {
            "by_stage": list(qs.values("current_stage").annotate(count=Count("id"))),
            "by_ministry": list(qs.values("ministry__name").annotate(count=Count("id"))[:10]),
            "by_category": list(qs.values("form_category__name").annotate(count=Count("id"))),
        },
        "trends": list(qs.annotate(month=TruncMonth("received_at")).values("month").annotate(count=Count("id")).order_by("month"))
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, HasProfilePermission])
def ai_smart_report_view(request):
    """
    POST /reports/ai-smart-query/
    { "query": "human language request" }
    
    Translates Natural Language to data filters + visualization using Claude.
    """
    from .ai.claude_client import call_claude
    import json

    query = request.data.get("query", "")
    if not query:
        return Response({"detail": "Query is required."}, status=400)

    profile = _profile(request.user)
    
    # 1. System Prompt to guide Claude in generating a JSON filter/response
    system_prompt = f"""
    You are the SCDMS Intelligence Analyst for the Vanuatu Public Service Commission.
    Your task is to translate the user's Natural Language query into structured data for a report.
    
    Role of user: {profile.role}
    Current Time: {timezone.now().isoformat()}

    Available Models:
    - Submissions: count, ministry, stage, category, received_at
    - Meetings: count, date, status, type

    Return ONLY a JSON object with this structure:
    {{
      "summary": "A 2-sentence executive summary of what was found.",
      "chartTitle": "Clear title for the chart",
      "chartType": "bar" | "line",
      "chartData": [ {{ "name": "Label", "value": 123 }} ],
      "kpis": [ {{ "label": "Total Cases", "value": 45 }} ]
    }}
    
    Handle Bislama and English. If the query is about "Health", use "MOH". If "Finance", use "MFEM".
    """

    try:
        response_text = call_claude(prompt=query, system_prompt=system_prompt)
        
        # Extract JSON from response
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        data = json.loads(response_text[json_start:json_end])
        
        return Response(data)
    except Exception as e:
        return Response({
            "summary": "I encountered an error while analyzing the data. Please try rephrasing your request.",
            "error": str(e)
        }, status=500)
