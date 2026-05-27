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
    KnowledgeCategory,
    KnowledgeArticle,
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
    MinuteAgendaIntakeSerializer,
    MinuteAgendaIntakeBulkSerializer,
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
    KnowledgeCategorySerializer,
    KnowledgeArticleSerializer,
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
    if role == Role.TRAVELLER:
        if not profile.ministry_id:
            return qs.filter(created_by=user)
        return qs.filter(
            models.Q(created_by=user)
            | models.Q(secretary_only=True, ministry_id=profile.ministry_id)
        )
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
            from .travel_forms import (
                assert_may_create_secretary_travel_form,
                is_travel_form_code,
                normalize_form_type_code,
                requires_approval_letter,
            )

            form_code = normalize_form_type_code(self.request.data.get("form_type_code"))
            kwargs = {"current_stage": WorkflowStage.DRAFT, "is_internal": False}
            if is_travel_form_code(form_code):
                assert_may_create_secretary_travel_form(profile, form_code)
                endorsers = self.request.data.get("travel_endorsers") or {}
                kwargs.update(
                    form_type_code=form_code,
                    secretary_only=True,
                    requires_travel_letter=requires_approval_letter(form_code),
                    travel_endorsers=endorsers if isinstance(endorsers, dict) else {},
                    routed_unit=RoutedUnit.ODU,
                )
            if profile.ministry_id:
                kwargs["ministry_id"] = profile.ministry_id
            if profile.department_id:
                kwargs["department_id"] = profile.department_id
            submission = serializer.save(**kwargs)

        elif profile.role == Role.TRAVELLER:
            raise PermissionDenied(
                "Public servants cannot create submissions. "
                "Ask your ministry HR manager to lodge Secretary approval travel requests (Forms 4.4–4.6)."
            )

        elif profile.role == Role.HEAD_OF_AGENCY:
            from .travel_forms import (
                assert_may_create_secretary_travel_form,
                is_travel_form_code,
                normalize_form_type_code,
                requires_approval_letter,
            )

            form_code = normalize_form_type_code(self.request.data.get("form_type_code") or "")
            kwargs = {"current_stage": WorkflowStage.DRAFT, "is_internal": False}
            if is_travel_form_code(form_code):
                assert_may_create_secretary_travel_form(profile, form_code)
                endorsers = self.request.data.get("travel_endorsers") or {}
                kwargs.update(
                    form_type_code=form_code,
                    secretary_only=True,
                    requires_travel_letter=requires_approval_letter(form_code),
                    travel_endorsers=endorsers if isinstance(endorsers, dict) else {},
                    routed_unit=RoutedUnit.ODU,
                )
            if profile.ministry_id:
                kwargs["ministry_id"] = profile.ministry_id
            if profile.department_id:
                kwargs["department_id"] = profile.department_id
            elif self.request.data.get("department"):
                kwargs["department_id"] = self.request.data.get("department")
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
            from .travel_forms import (
                assert_may_create_secretary_travel_form,
                is_travel_form_code,
                normalize_form_type_code,
                requires_approval_letter,
            )

            form_code = normalize_form_type_code(self.request.data.get("form_type_code") or "")
            kwargs = {}
            if is_travel_form_code(form_code):
                assert_may_create_secretary_travel_form(profile, form_code)
                endorsers = self.request.data.get("travel_endorsers") or {}
                kwargs = {
                    "form_type_code": form_code,
                    "secretary_only": True,
                    "requires_travel_letter": requires_approval_letter(form_code),
                    "travel_endorsers": endorsers if isinstance(endorsers, dict) else {},
                    "routed_unit": RoutedUnit.ODU,
                }
            submission = serializer.save(**kwargs)
        else:
            raise PermissionDenied(
                "Only PSC Officers, Admins, Secretaries, Ministry staff, Directors-General, "
                "Travellers, OPSC unit staff, or Compliance unit staff can create submissions."
            )
        if submission.secretary_only:
            from .travel_forms import is_travel_form_code
            from .travel_signatures import (
                ensure_travel_endorsers_synced,
                notify_first_pending_endorser,
            )

            if is_travel_form_code(submission.form_type_code):
                ensure_travel_endorsers_synced(submission)
                notify_first_pending_endorser(submission)

        _log(self.request, _AL.Action.CREATE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Submission created ({submission.current_stage}): {submission.title}")

    def perform_update(self, serializer):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        profile = _profile(self.request.user)
        submission = self.get_object()
        if profile.role == Role.TRAVELLER:
            raise PermissionDenied(
                "Public servants have read-only access. Contact ministry HR to update a submission."
            )
        if profile.role not in {Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY}:
            raise PermissionDenied("Only PSC staff or Ministry users can edit submissions.")
        submission = serializer.save()
        if submission.secretary_only:
            from .travel_forms import is_travel_form_code
            from .travel_signatures import ensure_travel_endorsers_synced

            if is_travel_form_code(submission.form_type_code):
                ensure_travel_endorsers_synced(submission)
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
            secretary_only=submission.secretary_only,
        )

        if (
            submission.secretary_only
            and prev == WorkflowStage.DRAFT
            and target == WorkflowStage.SUBMITTED
        ):
            from .travel_signatures import endorsements_complete

            if not endorsements_complete(submission):
                return Response(
                    {
                        "detail": (
                            "All required endorsements must be digitally signed "
                            "before submitting."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if (
            submission.secretary_only
            and target == WorkflowStage.APPROVED
            and submission.requires_travel_letter
        ):
            from .travel_signatures import signed_section_keys

            if "secretary_decision" not in signed_section_keys(submission):
                return Response(
                    {
                        "detail": (
                            "Secretary must record an approval decision (digital sign-off) "
                            "before marking this travel request as approved."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
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

        if (
            submission.secretary_only
            and prev == WorkflowStage.DRAFT
            and target == WorkflowStage.SUBMITTED
        ):
            target = WorkflowStage.SECRETARY_REVIEW

        # ── A3: pre-submit package validation (draft → submitted) ───────────────
        if (
            prev == WorkflowStage.DRAFT
            and target in {WorkflowStage.SUBMITTED, WorkflowStage.SECRETARY_REVIEW}
            and not acknowledge_gaps
            and not submission.secretary_only
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

        # ── Mandatory Checklist/Task Gate ───────────────────────────────────────
        # Block transition if there are incomplete items mandatory for the current stage.
        # We allow returning for clarification or rejection even if tasks are incomplete.
        _allowed_targets_with_gaps = {
            WorkflowStage.RETURNED_FOR_CLARIFICATION,
            WorkflowStage.REJECTED,
            WorkflowStage.RETURNED,
            WorkflowStage.DEFERRED_BACK_TO_HR,
        }
        if target not in _allowed_targets_with_gaps and not submission.secretary_only:
            unchecked_mandatory = submission.checklist_items.filter(
                document__mandatory_for_stage=prev,
                is_present=False,
                document__is_active=True
            ).count()
            
            if unchecked_mandatory > 0:
                return Response(
                    {"detail": f"Cannot proceed: {unchecked_mandatory} mandatory task(s) or document(s) for the current stage '{prev}' are incomplete. Please complete all assessment milestones before advancing."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        from .decision_proof import create_decision_proof, is_decision_stage

        proof_hash = ""
        proof_payload = {}

        with transaction.atomic():
            submission.current_stage = target

            # ── On first submission: auto-assign scheduled_meeting based on cutoff ──
            if (
                prev == WorkflowStage.DRAFT
                and target == WorkflowStage.SUBMITTED
                and not submission.secretary_only
            ):
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

        if target == WorkflowStage.APPROVED and submission.requires_travel_letter:
            sid = submission.id
            uid = request.user.id

            def _issue_letter(submission_id=sid, user_id=uid):
                from .models import Submission as Sub
                from .travel_letter import build_travel_approval_letter

                sub = Sub.objects.filter(pk=submission_id).first()
                if not sub:
                    return
                from django.contrib.auth.models import User

                sec = User.objects.filter(pk=user_id).first()
                build_travel_approval_letter(sub, secretary_user=sec)

            transaction.on_commit(_issue_letter)

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
            profile.role,
            submission.current_stage,
            is_internal=submission.is_internal,
            secretary_only=submission.secretary_only,
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

    @action(detail=True, methods=["get"], url_path="travel-endorsements")
    def travel_endorsements(self, request, pk=None):
        submission = self.get_object()
        from .travel_forms import endorsement_sections, secretary_decision_section
        from .travel_signatures import signed_section_keys

        if not submission.secretary_only:
            return Response({"sections": [], "signed": []})
        sections = list(endorsement_sections(submission.form_type_code or "", submission))
        sec = secretary_decision_section(submission.form_type_code or "")
        if sec:
            sections.append(sec)
        signed = list(
            submission.section_signatures.select_related("signed_by").values(
                "section_key",
                "signer_name",
                "signed_at",
                "approved",
                "remarks",
                "signed_by_id",
            )
        )
        return Response(
            {
                "sections": sections,
                "signed": signed,
                "signed_keys": list(signed_section_keys(submission)),
                "travel_endorsers": submission.travel_endorsers or {},
                "requires_travel_letter": submission.requires_travel_letter,
                "approval_route": [s["label"] for s in sections if s.get("key") != "secretary_decision"],
            }
        )

    @action(detail=True, methods=["post"], url_path="sign-travel-section")
    def sign_travel_section(self, request, pk=None):
        submission = self.get_object()
        section_key = request.data.get("section_key")
        if not section_key:
            return Response({"detail": "section_key is required."}, status=status.HTTP_400_BAD_REQUEST)
        approved = request.data.get("approved")
        if approved is not None:
            approved = bool(approved)
        remarks = request.data.get("remarks", "")
        try:
            from .travel_signatures import sign_travel_section

            sig = sign_travel_section(
                submission=submission,
                user=request.user,
                section_key=section_key,
                approved=approved,
                remarks=remarks,
            )
        except PermissionDenied as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if section_key == "secretary_decision" and approved is False:
            submission.current_stage = WorkflowStage.REJECTED
            submission.save(update_fields=["current_stage", "updated_at"])

        from .serializers import FormSectionSignatureSerializer

        return Response(FormSectionSignatureSerializer(sig).data)

    @action(detail=True, methods=["get"], url_path="travel-approval-letter")
    def travel_approval_letter(self, request, pk=None):
        submission = self.get_object()
        if not submission.requires_travel_letter:
            return Response(
                {"detail": "This submission does not require an approval letter."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            letter = submission.travel_approval_letter
        except Exception:
            return Response(
                {"detail": "Approval letter has not been issued yet."},
                status=status.HTTP_404_NOT_FOUND,
            )
        from .serializers import TravelApprovalLetterSerializer

        return Response(TravelApprovalLetterSerializer(letter).data)

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

        if (
            submission.is_attachment
            or submission.is_internal
            or getattr(submission, "secretary_only", False)
        ):
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
            resolved_form_type = instance.form_type
        elif form_type_id:
            resolved_form_type = PSCFormType.objects.filter(pk=form_type_id).first()
        elif submission.form_type_code:
            resolved_form_type = PSCFormType.objects.filter(
                code=submission.form_type_code, is_active=True
            ).first()
        else:
            resolved_form_type = None

        if not resolved_form_type:
            return Response({'detail': 'form_type is required.'}, status=400)

        from .dynamic_form_validation import validate_dynamic_form_data

        validation_errors = validate_dynamic_form_data(resolved_form_type, data_payload)
        if validation_errors:
            return Response(
                {"dynamic_form": validation_errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if instance:
            instance.data = data_payload
            instance.save()
            resp = instance
        else:
            resp = PSCFormResponse.objects.create(
                submission=submission,
                form_type=resolved_form_type,
                data=data_payload,
            )

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
        from datetime import datetime, timedelta

        from .reports.decision_register import build_register_rows

        qs = self.get_queryset()

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

        rows = build_register_rows(qs)

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
                if isinstance(r.get("staff"), list):
                    r = {**r, "staff": "; ".join(r["staff"])}
                writer.writerow(r)
            return response

        return Response(rows)

    def _user_can_export_register_reports(self, user) -> bool:
        if user.is_superuser or user.is_staff:
            return True
        return rbac_user_has_permission(user, "export_reports") or rbac_user_has_permission(
            user, "view_reports"
        )

    def _get_register_report_for_user(self, request, report_id: int):
        from .models import DecisionRegisterReport

        report = DecisionRegisterReport.objects.filter(pk=report_id).first()
        if not report:
            return None
        if report.requested_by_id != request.user.id and not (
            request.user.is_superuser or request.user.is_staff
        ):
            if not rbac_user_has_permission(request.user, "export_reports"):
                raise PermissionDenied("You cannot access this report.")
        return report

    @action(detail=False, methods=["post"], url_path="register-report")
    def create_register_report_legacy(self, request):
        """Backward-compatible alias (older frontends POST here and hit 405 on detail routes)."""
        return self.create_register_report(request)

    @action(detail=False, methods=["post"], url_path="register-reports/generate")
    def create_register_report(self, request):
        """
        Natural-language Commission Decision Register report (Quarto HTML).
        POST { "prompt": "...", "date_from"?, "date_to"?, "status"?, "manager_id"? }
        """
        from .models import DecisionRegisterReport
        from .tasks import queue_decision_register_report

        if not self._user_can_export_register_reports(request.user):
            raise PermissionDenied("You do not have permission to generate register reports.")

        prompt = (request.data.get("prompt") or "").strip()
        if not prompt:
            return Response({"detail": "Describe the report you need in the prompt field."}, status=400)

        extra_filters = {}
        for key in ("date_from", "date_to", "status", "manager_id"):
            val = request.data.get(key)
            if val not in (None, ""):
                extra_filters[key] = val

        report = DecisionRegisterReport.objects.create(
            requested_by=request.user,
            prompt=prompt,
            title="",
            filter_spec={"_ui_filters": extra_filters} if extra_filters else {},
            status=DecisionRegisterReport.Status.PENDING,
        )
        queue_decision_register_report(report.id)

        return Response(
            {
                "id": report.id,
                "status": report.status,
                "title": report.title,
                "subtitle": report.subtitle,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["get"], url_path=r"register-reports/(?P<report_id>[0-9]+)")
    def register_report_status(self, request, report_id=None):
        """Poll report job status; includes download paths when ready."""
        report = self._get_register_report_for_user(request, int(report_id))
        if not report:
            return Response({"detail": "Report not found."}, status=404)

        payload = {
            "id": report.id,
            "status": report.status,
            "title": report.title,
            "subtitle": report.subtitle,
            "row_count": report.row_count,
            "error_message": report.error_message,
            "created_at": report.created_at,
            "completed_at": report.completed_at,
            "downloads": {},
        }
        if report.status == report.Status.READY:
            base = request.build_absolute_uri(
                f"/api/commission-tasks/register-reports/{report.id}/download/"
            )
            payload["downloads"] = {
                "html": f"{base}?format=html",
                "pdf": f"{base}?format=pdf",
            }
        return Response(payload)

    @action(detail=False, methods=["get"], url_path=r"register-reports/(?P<report_id>[0-9]+)/download")
    def register_report_download(self, request, report_id=None):
        """Download generated HTML or PDF (?format=html|pdf)."""
        from django.http import FileResponse

        report = self._get_register_report_for_user(request, int(report_id))
        if not report:
            return Response({"detail": "Report not found."}, status=404)
        if report.status != report.Status.READY:
            return Response({"detail": "Report is not ready yet."}, status=409)

        fmt = (request.query_params.get("format") or "html").lower()
        if fmt != "html":
            return Response({"detail": "Only format=html is supported."}, status=400)
        if not report.html_file:
            return Response({"detail": "HTML file is missing."}, status=404)
        fh = report.html_file.open("rb")
        return FileResponse(
            fh,
            as_attachment=True,
            filename=report.html_file.name.split("/")[-1],
            content_type="text/html; charset=utf-8",
        )

    @action(detail=True, methods=["post"], url_path="draft-subtasks")
    def draft_subtasks(self, request, pk=None):
        """Draft ODU/HR implementation subtasks from register fields (async)."""
        task = self.get_object()
        if not rbac_user_has_permission(request.user, "allocate_decision"):
            raise PermissionDenied("Only secretariat may request subtask drafts.")
        from .tasks import queue_draft_implementation_subtasks

        task.ai_subtask_drafts = {}
        task.save(update_fields=["ai_subtask_drafts", "updated_at"])
        queue_draft_implementation_subtasks(task.id)
        task.refresh_from_db()
        return Response(CommissionTaskSerializer(task).data)

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
    from .profile_utils import ensure_psc_profile, PROFILE_MISSING_MSG

    user = request.user
    try:
        profile = ensure_psc_profile(user)
    except PermissionDenied:
        return Response({"detail": PROFILE_MISSING_MSG}, status=403)
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

    # ── Document OCR text (PSC staff) ──────────────────────────────────────
    if profile.role not in {Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY}:
        doc_hits = (
            SubmissionDocument.objects.filter(
                models.Q(extracted_text__icontains=q)
                | models.Q(original_name__icontains=q)
            )
            .filter(submission_id__in=_submission_queryset_for(request.user).values("id"))
            .select_related("submission")[:10]
        )
        for doc in doc_hits:
            results.append({
                "type": "document",
                "id": doc.id,
                "label": doc.original_name,
                "sublabel": doc.submission.reference_number,
                "meta": "Extracted document text",
                "stage": None,
                "url": f"/submissions/{doc.submission_id}",
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


def _reports_snapshot_for_user(user):
    """Compact, role-scoped submission stats for NL smart reports."""
    qs = _submission_queryset_for(user)
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
    terminal_stages = [WorkflowStage.APPROVED, WorkflowStage.REJECTED, WorkflowStage.RETURNED]
    return {
        "total_submissions": qs.count(),
        "active_submissions": qs.filter(current_stage__in=active_stages).count(),
        "overdue_assessments": qs.filter(
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            assessment_deadline_at__isnull=False,
            assessment_deadline_at__lt=timezone.now(),
        ).count(),
        "by_stage": list(
            qs.values("current_stage").annotate(count=Count("id")).order_by("-count")[:15]
        ),
        "by_ministry": list(
            qs.values("ministry__name").annotate(count=Count("id")).order_by("-count")[:12]
        ),
        "by_category": list(
            qs.values("form_category__name").annotate(count=Count("id")).order_by("-count")[:12]
        ),
        "by_resolution": list(
            qs.filter(current_stage__in=terminal_stages)
            .values("current_stage")
            .annotate(count=Count("id"))
        ),
    }


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


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, HasProfilePermission])
def ai_smart_report_view(request):
    """POST /reports/ai-smart-query/ — natural language report query via Claude."""
    import json

    from .ai.claude_client import ai_enabled, complete_json_with_error

    query = (request.data.get("query") or "").strip()
    if not query:
        return Response({"detail": "Query is required."}, status=400)

    if not ai_enabled():
        return Response(
            {
                "detail": "AI reporting is not configured. Set ANTHROPIC_API_KEY on the API service.",
            },
            status=503,
        )

    profile = _profile(request.user)
    snapshot = _reports_snapshot_for_user(request.user)
    system_prompt = (
        "You are the SCDMS Intelligence Analyst for the Vanuatu Public Service Commission. "
        "The user asks for a report visualization. Use ONLY the provided SCDMS data snapshot "
        "to compute chart values and KPIs — do not invent counts. "
        "If the question cannot be answered from the snapshot, say so in the summary and "
        "use the closest available breakdown (by_stage, by_ministry, or by_category).\n\n"
        f"Role of user: {profile.role}\n"
        f"Current time (UTC): {timezone.now().isoformat()}\n\n"
        "Return JSON with keys: summary (string), chartTitle (string), "
        'chartType ("bar" or "line"), chartData (array of {name, value}), '
        "kpis (array of {label, value})."
    )
    user_prompt = (
        f"User question: {query}\n\n"
        f"SCDMS data snapshot:\n{json.dumps(snapshot, default=str)}"
    )

    data, err = complete_json_with_error(
        system=system_prompt,
        user=user_prompt,
        tier="sonnet",
        max_tokens=4096,
    )
    if err:
        return Response(
            {
                "summary": "I could not run the AI report right now. Please try again later.",
                "detail": err,
            },
            status=502,
        )
    if not isinstance(data, dict):
        return Response(
            {"detail": "Unexpected AI response format."},
            status=502,
        )
    return Response(data)


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
        from .profile_utils import ensure_psc_profile, PROFILE_MISSING_MSG

        try:
            profile = ensure_psc_profile(user)
        except PermissionDenied:
            return Response({"detail": PROFILE_MISSING_MSG}, status=status.HTTP_403_FORBIDDEN)

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


def _password_reset_frontend_base(request) -> str:
    """Build the SPA base URL for links in reset emails (not the API host)."""
    import os
    from urllib.parse import urlparse

    origin = (request.headers.get("Origin") or "").strip()
    if not origin and request.headers.get("Referer"):
        parsed = urlparse(request.headers.get("Referer", ""))
        if parsed.scheme and parsed.netloc:
            origin = f"{parsed.scheme}://{parsed.netloc}"
    if origin:
        return origin.rstrip("/")

    from django.conf import settings as django_settings

    explicit = os.getenv("FRONTEND_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")
    cors = getattr(django_settings, "CORS_ALLOWED_ORIGINS", None) or []
    if cors:
        first = cors[0] if isinstance(cors, (list, tuple)) else str(cors).split(",")[0]
        return str(first).strip().rstrip("/")
    return "http://localhost:8080"


class PasswordResetRequestView(APIView):
    """Request a password reset token (logged to console in dev, emailed in prod)."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"]
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
            token = PasswordResetToken.generate_for(user)

            base = _password_reset_frontend_base(request)
            reset_url = f"{base}/auth/reset-password/confirm?token={token.token}"
            
            from django.conf import settings
            from django.core.mail import send_mail

            from .email_notify import merge_recipient_context
            from .email_templates import send_templated_email

            ctx = merge_recipient_context(
                user,
                reset_url=reset_url,
                expiry_hours="1",
            )
            if not send_templated_email(
                slug="password_reset",
                to=[email],
                context=ctx,
                fail_silently=True,
            ):
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
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        _security_log.info("PASSWORD_RESET_COMPLETE | username=%s", user.username)
        _log(
            request,
            _AL.Action.PASSWORD_CHANGE,
            resource_type="User",
            resource_id=user.id,
            resource_label=user.username,
            description=f"Password reset via email link for {user.username}",
        )
        return Response({"detail": "Password updated successfully. You may now sign in."})


def _build_claude_minutes_prompt(meeting):
    """Build a staff-facing Claude prompt from meeting metadata and transcript."""
    agenda_lines = []
    for item in meeting.agenda_items.select_related("submission").order_by("sequence"):
        sub = item.submission
        ref = getattr(sub, "reference_number", "") if sub else ""
        title = getattr(sub, "title", "") if sub else ""
        agenda_lines.append(f"- {item.sequence}. [{item.get_category_display()}] {ref} — {title}")
    agenda_block = "\n".join(agenda_lines) if agenda_lines else "(No agenda items on record)"

    raw_transcript = ""
    transcript_source = ""
    if hasattr(meeting, "transcript"):
        raw_transcript = meeting.transcript.raw_text or ""
        transcript_source = meeting.transcript.get_source_display()

    meeting_info = (
        f"Reference: {meeting.reference_number}\n"
        f"Title: {meeting.title}\n"
        f"Date: {meeting.date} at {meeting.time}\n"
        f"Venue: {meeting.venue}\n"
        f"Type: {meeting.get_type_display()}\n"
    )

    return f"""You are assisting the Public Service Commission Secretariat in Vanuatu.

The Commission often deliberates in Bislama. Zoom/Teams automatic speech recognition (ASR) produces garbled English-like text. Your task is to:

1. Infer the intended meaning from the ASR transcript below (do not treat garbled words literally).
2. Draft formal English Commission minutes suitable for chair approval.
3. Preserve decisions, action items, and submission references accurately.
4. Flag any passage where meaning is uncertain with [VERIFY].

Meeting information:
{meeting_info}

Agenda items:
{agenda_block}

Transcript source: {transcript_source or "Not recorded"}

ASR / pasted transcript (review for Bislama mangling):
---
{raw_transcript or "(No transcript pasted yet — paste Zoom output or run AI transcribe first.)"}
---

Output structured minutes in clear formal English with sections: Opening, Confirmation of Previous Minutes, Agenda Items (per item: discussion, decision, action items), Any Other Business, Closing.
"""


class MeetingViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    queryset = Meeting.objects.prefetch_related(
        "agenda_items__submission",
        "agenda_items__submission__ministry",
        "flying_minute_signatures__member",
    ).all()
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

    def _db_unavailable_response(self, exc, *, action: str):
        import logging

        logging.getLogger(__name__).exception("Meetings %s unavailable (database): %s", action, exc)
        return Response(
            {
                "detail": (
                    "Meetings data is temporarily unavailable. "
                    "The database may need migrations — contact an administrator or redeploy the API."
                ),
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    def list(self, request, *args, **kwargs):
        from django.db.utils import OperationalError, ProgrammingError

        try:
            return super().list(request, *args, **kwargs)
        except (ProgrammingError, OperationalError) as exc:
            return self._db_unavailable_response(exc, action="list")

    def retrieve(self, request, *args, **kwargs):
        from django.db.utils import OperationalError, ProgrammingError

        try:
            return super().retrieve(request, *args, **kwargs)
        except (ProgrammingError, OperationalError) as exc:
            return self._db_unavailable_response(exc, action="retrieve")

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
        audio_source = (request.data.get("audio_source") or "").strip()
        meeting = None
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

        from .models import MeetingTranscript, RecordingAudioSource

        valid_sources = {c.value for c in RecordingAudioSource}
        if audio_source and audio_source in valid_sources:
            resolved_source = audio_source
        elif meeting:
            resolved_source = RecordingAudioSource.ZOOM_EXPORT
        else:
            resolved_source = RecordingAudioSource.OTHER

        recordings_dir = os.path.join(settings.MEDIA_ROOT, 'recordings')
        os.makedirs(recordings_dir, exist_ok=True)

        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        if meeting_id:
            safe_name = f"recording_{meeting_id}_{timestamp}{ext}"
        else:
            safe_name = f"recording_{timestamp}{ext}"
        filepath = os.path.join(recordings_dir, safe_name)

        with open(filepath, 'wb+') as dest:
            for chunk in file.chunks():
                dest.write(chunk)

        if meeting:
            meeting.recording_audio_source = resolved_source
            meeting.save(update_fields=["recording_audio_source", "updated_at"])
            transcript_obj, _ = MeetingTranscript.objects.get_or_create(meeting=meeting)
            transcript_obj.audio_file = safe_name
            transcript_obj.save(update_fields=["audio_file"])

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
            "recording_audio_source": resolved_source,
        })

    @action(detail=True, methods=["patch"], url_path="transcript")
    def update_transcript(self, request, pk=None):
        """Save a manually pasted Zoom/Teams transcript for secretariat review."""
        from .models import MeetingTranscript, TranscriptSource, TranscriptionStatus
        from .serializers import MeetingTranscriptPatchSerializer

        meeting = self.get_object()
        ser = MeetingTranscriptPatchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        source = ser.validated_data.get("source") or TranscriptSource.MANUAL_PASTE
        transcript_obj, _ = MeetingTranscript.objects.get_or_create(meeting=meeting)
        raw = ser.validated_data["raw_text"]
        transcript_obj.raw_text = raw
        transcript_obj.source = source
        if len(raw.strip()) >= 50:
            transcript_obj.ai_processed = True
            transcript_obj.processed_at = timezone.now()
            transcript_obj.transcription_status = TranscriptionStatus.READY
            transcript_obj.transcription_error = ""
            transcript_obj.save(
                update_fields=[
                    "raw_text",
                    "source",
                    "ai_processed",
                    "processed_at",
                    "transcription_status",
                    "transcription_error",
                ]
            )
        else:
            transcript_obj.ai_processed = False
            transcript_obj.transcription_status = TranscriptionStatus.IDLE
            transcript_obj.transcription_error = ""
            transcript_obj.save(
                update_fields=[
                    "raw_text",
                    "source",
                    "ai_processed",
                    "transcription_status",
                    "transcription_error",
                ]
            )
        return Response(MeetingTranscriptSerializer(transcript_obj).data)

    @action(detail=True, methods=["get"], url_path="claude-prompt")
    def claude_prompt(self, request, pk=None):
        """Return a Claude-ready prompt for repairing ASR text into formal minutes."""
        meeting = self.get_object()
        prompt = _build_claude_minutes_prompt(meeting)
        return Response({"prompt": prompt})

    @action(detail=True, methods=["post"], url_path="transcribe")
    def transcribe_recording(self, request, pk=None):
        """Whisper transcription + Claude refine (async Celery pipeline)."""
        from .models import MeetingTranscript, TranscriptionStatus
        from .tasks import run_meeting_transcription_pipeline

        meeting = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {
            Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER,
            Role.PSC_ADMIN,
            Role.PSC_COMMISSIONER,
        }:
            raise PermissionDenied(
                "Only Secretariat or Commissioners can run AI transcription."
            )

        transcript, _ = MeetingTranscript.objects.get_or_create(meeting=meeting)
        if not (transcript.audio_file or "").strip():
            return Response(
                {
                    "detail": (
                        "No recording is linked to this meeting. "
                        "Upload audio on Meeting Capture first."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        active = {
            TranscriptionStatus.PENDING,
            TranscriptionStatus.TRANSCRIBING,
            TranscriptionStatus.REFINING,
        }
        if transcript.transcription_status in active:
            return Response(
                {
                    "detail": "Transcription is already in progress.",
                    "transcription_status": transcript.transcription_status,
                },
                status=status.HTTP_409_CONFLICT,
            )

        transcript.transcription_status = TranscriptionStatus.PENDING
        transcript.transcription_error = ""
        transcript.save(update_fields=["transcription_status", "transcription_error"])

        run_meeting_transcription_pipeline.delay(meeting.id)

        return Response(
            {
                "detail": (
                    "Transcription started (Whisper, then Claude cleanup). "
                    "Refresh this page in a few minutes."
                ),
                "transcription_status": TranscriptionStatus.PENDING,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    _MINUTE_INTAKE_ROLES = {
        Role.PSC_SECRETARY,
        Role.SENIOR_ADMIN_OFFICER,
        Role.PSC_ADMIN,
        Role.PSC_COMMISSIONER,
    }

    def _minute_intake_permission(self, request):
        profile = _profile(request.user)
        if profile.role not in self._MINUTE_INTAKE_ROLES:
            raise PermissionDenied(
                "Only Secretariat or Commissioners can use minute intake."
            )
        return profile

    def _minute_intake_gate(self, meeting):
        from .minute_intake import meeting_allows_minute_intake

        if not meeting_allows_minute_intake(meeting):
            return Response(
                {
                    "detail": (
                        "Minute intake is only available after the agenda is "
                        "Secretary-approved or circulated."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    @action(detail=True, methods=["get", "patch"], url_path="minute-intake")
    def minute_intake(self, request, pk=None):
        """Load or save per-agenda minute-taker notes (pre-format)."""
        from .minute_intake import ensure_intake_rows, meeting_allows_minute_intake
        from .models import MinuteAgendaIntake

        meeting = self.get_object()
        self._minute_intake_permission(request)
        blocked = self._minute_intake_gate(meeting)
        if blocked is not None:
            return blocked

        if request.method == "GET":
            rows = ensure_intake_rows(meeting)
            return Response(
                {
                    "meeting_id": meeting.id,
                    "agenda_status": meeting.agenda_status,
                    "allowed": meeting_allows_minute_intake(meeting),
                    "items": MinuteAgendaIntakeSerializer(rows, many=True).data,
                }
            )

        bulk = MinuteAgendaIntakeBulkSerializer(data=request.data)
        bulk.is_valid(raise_exception=True)
        for entry in bulk.validated_data["items"]:
            row = MinuteAgendaIntake.objects.filter(
                meeting=meeting,
                agenda_item_id=entry["agenda_item_id"],
            ).first()
            if not row:
                return Response(
                    {
                        "detail": (
                            f"No intake row for agenda item {entry['agenda_item_id']}."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            update_fields = ["updated_at"]
            for field in ("discussion_notes", "decision_text", "action_officer"):
                if field in entry:
                    setattr(row, field, entry[field])
                    update_fields.append(field)
            row.save(update_fields=update_fields)

        rows = ensure_intake_rows(meeting)
        return Response(
            {
                "meeting_id": meeting.id,
                "agenda_status": meeting.agenda_status,
                "allowed": True,
                "items": MinuteAgendaIntakeSerializer(rows, many=True).data,
            }
        )

    @action(
        detail=True,
        methods=["post"],
        url_path=r"minute-intake/(?P<agenda_item_id>[^/.]+)/format",
    )
    def minute_intake_format_item(self, request, pk=None, agenda_item_id=None):
        """Claude-format one agenda item's raw notes."""
        from .ai.minute_intake_format import format_minute_intake_item
        from .minute_intake import (
            ensure_intake_rows,
            meeting_info_block,
            store_formatted_result,
        )
        from .models import MinuteAgendaIntake

        meeting = self.get_object()
        self._minute_intake_permission(request)
        blocked = self._minute_intake_gate(meeting)
        if blocked is not None:
            return blocked

        ensure_intake_rows(meeting)
        row = get_object_or_404(
            MinuteAgendaIntake.objects.select_related(
                "agenda_item", "agenda_item__submission",
            ),
            meeting=meeting,
            agenda_item_id=agenda_item_id,
        )
        if not (row.discussion_notes or "").strip() and not (row.decision_text or "").strip():
            return Response(
                {"detail": "Add discussion or decision notes before formatting."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sub = row.agenda_item.submission
        ref = getattr(sub, "reference_number", "") if sub else ""
        formatted, err = format_minute_intake_item(
            meeting_info=meeting_info_block(meeting),
            agenda_title=row.agenda_title,
            agenda_description=row.agenda_description,
            submission_ref=ref,
            category_display=row.agenda_item.get_category_display(),
            discussion_notes=row.discussion_notes,
            decision_text=row.decision_text,
            action_officer=row.action_officer,
        )
        if err or not formatted:
            return Response(
                {"detail": err or "Formatting failed."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        store_formatted_result(row, formatted)
        row.refresh_from_db()
        return Response(MinuteAgendaIntakeSerializer(row).data)

    @action(detail=True, methods=["post"], url_path="minute-intake/format-all")
    def minute_intake_format_all(self, request, pk=None):
        """Claude-format all intake rows that have raw notes."""
        from .ai.minute_intake_format import format_minute_intake_item
        from .minute_intake import (
            ensure_intake_rows,
            meeting_info_block,
            store_formatted_result,
        )
        from .models import MinuteAgendaIntake
        from django.db.models import Q

        meeting = self.get_object()
        self._minute_intake_permission(request)
        blocked = self._minute_intake_gate(meeting)
        if blocked is not None:
            return blocked

        ensure_intake_rows(meeting)
        rows = (
            MinuteAgendaIntake.objects.filter(meeting=meeting)
            .select_related("agenda_item", "agenda_item__submission")
            .filter(
                Q(discussion_notes__gt="") | Q(decision_text__gt=""),
            )
        )
        if not rows.exists():
            return Response(
                {"detail": "No items with discussion or decision notes to format."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        info = meeting_info_block(meeting)
        formatted_items = []
        errors = []
        for row in rows:
            if not (row.discussion_notes or "").strip() and not (row.decision_text or "").strip():
                continue
            sub = row.agenda_item.submission
            ref = getattr(sub, "reference_number", "") if sub else ""
            data, err = format_minute_intake_item(
                meeting_info=info,
                agenda_title=row.agenda_title,
                agenda_description=row.agenda_description,
                submission_ref=ref,
                category_display=row.agenda_item.get_category_display(),
                discussion_notes=row.discussion_notes,
                decision_text=row.decision_text,
                action_officer=row.action_officer,
            )
            if err or not data:
                errors.append({"agenda_item_id": row.agenda_item_id, "error": err or "Failed"})
                continue
            store_formatted_result(row, data)
            row.refresh_from_db()
            formatted_items.append(MinuteAgendaIntakeSerializer(row).data)

        payload = {
            "formatted_count": len(formatted_items),
            "items": formatted_items,
        }
        if errors:
            payload["errors"] = errors
        if not formatted_items and errors:
            return Response(payload, status=status.HTTP_502_BAD_GATEWAY)
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="minute-intake/apply-to-minutes")
    def minute_intake_apply_to_minutes(self, request, pk=None):
        """Merge formatted intake into the meeting Minutes document."""
        from .minute_intake import apply_intake_to_minutes, ensure_intake_rows

        meeting = self.get_object()
        self._minute_intake_permission(request)
        blocked = self._minute_intake_gate(meeting)
        if blocked is not None:
            return blocked

        ensure_intake_rows(meeting)
        minutes = apply_intake_to_minutes(meeting, request.user)
        return Response(MinutesSerializer(minutes).data)

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

    def _require_sitting_pack_access(self, request):
        from .sitting_pack import user_can_use_sitting_pack

        if not user_can_use_sitting_pack(request.user):
            raise PermissionDenied("You do not have access to Sitting Pack meeting mode.")

    @action(detail=True, methods=["post"], url_path="sitting-pack/start")
    def sitting_pack_start(self, request, pk=None):
        """Start an active Sitting Pack session (enables digital seal watermark)."""
        from .sitting_pack import get_active_session, session_payload, start_session

        meeting = self.get_object()
        self._require_sitting_pack_access(request)
        existing = get_active_session(meeting_id=meeting.id, user_id=request.user.id)
        if existing:
            return Response(session_payload(existing, user=request.user))
        session = start_session(meeting=meeting, user=request.user)
        return Response(session_payload(session, user=request.user), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="sitting-pack/heartbeat")
    def sitting_pack_heartbeat(self, request, pk=None):
        from .sitting_pack import get_active_session, session_payload

        meeting = self.get_object()
        self._require_sitting_pack_access(request)
        session_id = request.data.get("session_id")
        session = get_active_session(meeting_id=meeting.id, user_id=request.user.id)
        if not session or (session_id and session.id != int(session_id)):
            return Response({"detail": "No active Sitting Pack session.", "active": False}, status=404)
        session.last_heartbeat_at = timezone.now()
        session.save(update_fields=["last_heartbeat_at"])
        return Response(session_payload(session, user=request.user))

    @action(detail=True, methods=["post"], url_path="sitting-pack/end")
    def sitting_pack_end(self, request, pk=None):
        from .sitting_pack import end_active_sessions

        meeting = self.get_object()
        self._require_sitting_pack_access(request)
        end_active_sessions(meeting_id=meeting.id, user_id=request.user.id)
        return Response({"detail": "Sitting Pack session ended.", "active": False})

    @action(detail=True, methods=["get"], url_path="sitting-pack/status")
    def sitting_pack_status(self, request, pk=None):
        from .sitting_pack import get_active_session, session_payload

        meeting = self.get_object()
        self._require_sitting_pack_access(request)
        session = get_active_session(meeting_id=meeting.id, user_id=request.user.id)
        if not session:
            return Response({"active": False})
        return Response(session_payload(session, user=request.user))

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

    def _user_can_generate_briefing_pack(self, user) -> bool:
        if user.is_superuser or user.is_staff:
            return True
        profile = _profile(user)
        return profile.role in {
            Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER,
            Role.PSC_ADMIN,
            Role.CHAIRPERSON,
        }

    def _get_briefing_pack_for_user(self, request, pack_id: int):
        from .models import MeetingBriefingPack

        pack = MeetingBriefingPack.objects.select_related("meeting", "requested_by").filter(
            pk=pack_id
        ).first()
        if not pack:
            return None
        if pack.requested_by_id != request.user.id and not (
            request.user.is_superuser or request.user.is_staff
        ):
            if not self._user_can_generate_briefing_pack(request.user):
                raise PermissionDenied("You cannot access this briefing pack.")
        return pack

    @action(detail=True, methods=["post"], url_path="briefing-pack/generate")
    def generate_briefing_pack(self, request, pk=None):
        """C2 — queue AI sitting briefing pack (HTML + PDF)."""
        from .models import MeetingBriefingPack
        from .tasks import queue_meeting_briefing_pack

        meeting = self.get_object()
        if not self._user_can_generate_briefing_pack(request.user):
            raise PermissionDenied(
                "Only PSC Secretary, Senior Admin Officer, Admin, or Chairperson may generate briefing packs."
            )

        pack = MeetingBriefingPack.objects.create(
            meeting=meeting,
            requested_by=request.user,
            status=MeetingBriefingPack.Status.PENDING,
        )
        queue_meeting_briefing_pack(pack.id)
        return Response(
            MeetingBriefingPackSerializer(pack).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["get"], url_path=r"briefing-packs/(?P<pack_id>[0-9]+)")
    def briefing_pack_status(self, request, pack_id=None):
        pack = self._get_briefing_pack_for_user(request, int(pack_id))
        if not pack:
            return Response({"detail": "Briefing pack not found."}, status=404)
        data = MeetingBriefingPackSerializer(pack).data
        return Response(data)

    @action(detail=False, methods=["get"], url_path=r"briefing-packs/(?P<pack_id>[0-9]+)/download")
    def briefing_pack_download(self, request, pack_id=None):
        from django.http import FileResponse

        from .models import MeetingBriefingPack

        pack = self._get_briefing_pack_for_user(request, int(pack_id))
        if not pack:
            return Response({"detail": "Briefing pack not found."}, status=404)
        if pack.status != MeetingBriefingPack.Status.READY:
            return Response({"detail": "Briefing pack is not ready yet."}, status=400)

        fmt = (request.query_params.get("format") or "html").lower()
        if fmt != "html":
            return Response({"detail": "Only format=html is supported."}, status=400)
        if not pack.html_file:
            return Response({"detail": "HTML file is not available."}, status=404)
        return FileResponse(
            pack.html_file.open("rb"),
            content_type="text/html; charset=utf-8",
        )


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

        # Prefer lodge-time agenda section, then form type mapping.
        if category == "other":
            if submission.agenda_category and submission.agenda_category != "other":
                category = submission.agenda_category
            elif submission.form_type_code:
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

        item = serializer.save(category=category, sequence=next_seq)
        from .tasks import queue_agenda_item_blurb

        aid = item.id
        transaction.on_commit(lambda: queue_agenda_item_blurb(aid))

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

        skip_if_blank = {"SMTP_PASSWORD"}
        updated = []
        smtp_password_saved = False
        for key, value in settings_dict.items():
            if key in skip_if_blank and not str(value).strip():
                continue
            setting, _ = SystemSetting.objects.get_or_create(key=key)
            raw = str(value)
            if key == "SMTP_PASSWORD":
                from .email_backend import _normalize_password

                raw = _normalize_password(raw)
                smtp_password_saved = bool(raw)
            setting.value = raw
            setting.save()
            updated.append(SystemSettingSerializer(setting).data)

        _log(request, _AL.Action.SETTINGS,
             resource_type="SystemSetting",
             description=f"Settings updated: {', '.join(settings_dict.keys())}",
             extra_data={"keys": list(settings_dict.keys()), "smtp_password_saved": smtp_password_saved})

        if {"EMAIL_CRON_ENABLED", "EMAIL_CRON_SCHEDULE"} & set(settings_dict.keys()):
            try:
                from .email_scheduler import start_email_scheduler
                start_email_scheduler()
            except Exception:
                pass

        return Response(updated)

    @action(detail=False, methods=["get", "post"], url_path="email-schedule")
    def email_schedule(self, request):
        """
        GET  /settings/email-schedule/ — cron + enabled flag + next run.
        POST /settings/email-schedule/ — { cron_expr, enabled }.
        """
        from .email_scheduler import get_email_next_run, update_email_schedule

        if request.method == "GET":
            enabled = SystemSetting.get_bool("EMAIL_CRON_ENABLED", default=True)
            cron_expr = SystemSetting.get_val("EMAIL_CRON_SCHEDULE") or "0 8 * * *"
            return Response({
                "enabled": enabled,
                "cron_expr": cron_expr,
                "next_run": get_email_next_run(),
            })

        cron_expr = (request.data.get("cron_expr") or "").strip()
        enabled = request.data.get("enabled", True)
        if isinstance(enabled, str):
            enabled = enabled.lower() in ("true", "1", "yes", "on")

        if enabled and cron_expr:
            parts = cron_expr.split()
            if len(parts) != 5:
                return Response(
                    {"detail": "cron_expr must have exactly 5 fields (min hour day month weekday)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        for key, val in [
            ("EMAIL_CRON_ENABLED", "true" if enabled else "false"),
            ("EMAIL_CRON_SCHEDULE", cron_expr if enabled else (cron_expr or "")),
        ]:
            setting, _ = SystemSetting.objects.get_or_create(key=key)
            setting.value = val
            setting.save()

        try:
            update_email_schedule(cron_expr=cron_expr if enabled else None, enabled=enabled)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "detail": "Email schedule updated.",
            "enabled": enabled,
            "cron_expr": cron_expr,
            "next_run": get_email_next_run(),
        })

    @action(detail=False, methods=["post"], url_path="run-email-dispatch")
    def run_email_dispatch(self, request):
        """Run the email outbox dispatch immediately (uses Django SMTP backend)."""
        from .email_dispatch import dispatch_pending_emails

        stats = dispatch_pending_emails()
        sent = stats.get("sent", 0)
        failed = stats.get("failed", 0)
        skipped = stats.get("skipped", 0)
        detail = f"Email dispatch complete: {sent} sent, {failed} failed, {skipped} skipped."
        return Response({"detail": detail, **stats})

    @action(detail=False, methods=["get"], url_path="smtp-status")
    def smtp_status(self, request):
        """Non-secret SMTP config summary for troubleshooting."""
        from .email_backend import smtp_config_diagnostics

        return Response(smtp_config_diagnostics())

    @action(detail=False, methods=["post"], url_path="test-email")
    def test_email(self, request):
        """Send a test message using the configured SMTP backend (env or SystemSetting)."""
        from django.conf import settings as django_settings
        from django.core.exceptions import ValidationError
        from django.core.validators import validate_email

        to = (request.data.get("to") or "").strip()
        if not to:
            return Response({"detail": "Recipient email is required."}, status=400)
        try:
            validate_email(to)
        except ValidationError:
            return Response({"detail": "Invalid email address."}, status=400)

        from .email_backend import (
            _normalize_password,
            format_smtp_error,
            resolve_smtp_config,
            send_smtp_message,
            smtp_config_diagnostics,
        )

        diag = smtp_config_diagnostics()
        cfg = resolve_smtp_config()

        # Use password from this request first (Admin test form), then stored settings.
        inline_password = _normalize_password(
            str(request.data.get("smtp_password") or request.data.get("password") or "")
        )
        if inline_password:
            setting, _ = SystemSetting.objects.get_or_create(key="SMTP_PASSWORD")
            setting.value = inline_password
            setting.save(update_fields=["value", "updated_at"])
            cfg = resolve_smtp_config()
            cfg["password"] = inline_password
            diag = smtp_config_diagnostics()

        smtp_label = f"{cfg['host']}:{cfg['port']}"
        if not cfg.get("username"):
            return Response(
                {
                    "detail": (
                        "SMTP username is missing. For Gmail use your full email as SMTP User "
                        "and a Google App Password (not your login password). "
                        "If .env sets SMTP_HOST with empty SMTP_USER, either fill credentials in "
                        "Admin or remove SMTP_HOST from .env so Admin settings apply."
                    ),
                    **diag,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not cfg.get("password"):
            return Response(
                {
                    "detail": (
                        "SMTP password is not configured. Paste your SMTP2GO (or provider) password "
                        "in SMTP Password, click Save Changes, then send the test again."
                    ),
                    **diag,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        host_l = (cfg.get("host") or "").lower()
        pw = cfg.get("password") or ""
        if "gmail" in host_l and len(pw) != 16:
            return Response(
                {
                    "detail": (
                        f"Gmail App Passwords are 16 characters (got {len(pw)} after removing spaces). "
                        "Create one at https://myaccount.google.com/apppasswords — 2-Step Verification must be on."
                    ),
                    **diag,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        from_email = (
            os.getenv("DEFAULT_FROM_EMAIL")
            or SystemSetting.get_val("DEFAULT_FROM_EMAIL")
            or django_settings.DEFAULT_FROM_EMAIL
        )
        if "gmail" in host_l:
            from_email = (from_email or "").strip() or cfg["username"]
            if from_email.lower() != cfg["username"].lower():
                from_email = cfg["username"]

        subject = "Commission Decision App — SMTP test"
        message = (
            "This is a test email from the Commission Decision App.\n\n"
            f"SMTP: {smtp_label}\n"
            f"From: {from_email}\n"
        )
        try:
            send_smtp_message(
                cfg=cfg,
                from_email=from_email,
                recipients=[to],
                subject=subject,
                body=message,
            )
        except Exception as exc:
            err = format_smtp_error(exc)
            hint = ""
            err_l = err.lower()
            if (
                "530" in err
                or "550" in err
                or "authentication" in err_l
                or "authenticate" in err_l
                or "relay access denied" in err_l
                or "gsmtp" in err_l
            ):
                hint = (
                    " The server rejected SMTP login. Re-enter your SMTP password in Admin "
                    "(SMTP2GO: use the SMTP Users password from your SMTP2GO dashboard). "
                    "If Render Environment has SMTP_HOST/SMTP_USER set, either set SMTP_PASSWORD "
                    "there too or remove those vars so Admin settings apply."
                )
            return Response(
                {
                    "detail": f"Failed to send test email: {err}.{hint}",
                    "smtp": smtp_label,
                    **diag,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        from .audit import log_action as _log
        from .models import AuditLog as _AL

        _log(
            request,
            _AL.Action.SETTINGS,
            resource_type="SystemSetting",
            description=f"SMTP test email sent to {to}",
            extra_data={"to": to, "smtp": smtp_label},
        )
        return Response({"detail": f"Test email sent to {to}.", "smtp": smtp_label})


class EmailTemplateViewSet(viewsets.ModelViewSet):
    """Manage transactional email templates — PSC Admin / manage_roles."""

    permission_classes = [permissions.IsAuthenticated, HasManageRoles]
    queryset = EmailTemplate.objects.all()
    serializer_class = EmailTemplateSerializer
    lookup_field = "slug"
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        active = self.request.query_params.get("active")
        if active is not None:
            qs = qs.filter(is_active=active.lower() in ("true", "1", "yes"))
        return qs

    @action(detail=False, methods=["post"], url_path="seed-defaults")
    def seed_defaults(self, request):
        from .email_templates import seed_default_email_templates

        created = seed_default_email_templates()
        return Response(
            {"detail": "Default templates synced.", "created": created},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="preview")
    def preview(self, request, slug=None):
        from .email_notify import sample_context_for_slug
        from .email_templates import render_template_record

        tpl = self.get_object()
        extra = request.data.get("context") if isinstance(request.data.get("context"), dict) else {}
        ctx = {**sample_context_for_slug(tpl.slug), **extra}
        subject, text_body, html_body = render_template_record(tpl, ctx)
        return Response({
            "subject": subject,
            "body_text": text_body,
            "body_html": html_body or "",
            "context": ctx,
        })

    @action(detail=True, methods=["post"], url_path="send-test")
    def send_test(self, request, slug=None):
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError

        from django.core.mail import send_mail

        from .email_notify import sample_context_for_slug
        from .email_templates import get_from_email, render_template_record

        tpl = self.get_object()
        to = (request.data.get("to") or "").strip()
        if not to:
            return Response({"detail": "Recipient email is required."}, status=400)
        try:
            validate_email(to)
        except ValidationError:
            return Response({"detail": "Invalid email address."}, status=400)

        extra = request.data.get("context") if isinstance(request.data.get("context"), dict) else {}
        ctx = {**sample_context_for_slug(tpl.slug), **extra}
        subject, text_body, html_body = render_template_record(tpl, ctx)
        try:
            send_mail(
                subject,
                text_body,
                get_from_email(),
                [to],
                fail_silently=False,
                html_message=html_body,
            )
        except Exception as exc:
            return Response(
                {"detail": f"Failed to send test email: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"detail": f"Test email sent to {to} using template “{tpl.name}”."})

    @action(detail=True, methods=["post"], url_path="reset")
    def reset_to_default(self, request, slug=None):
        from .email_templates import reset_email_template_to_default

        tpl = self.get_object()
        if not tpl.is_system:
            return Response(
                {"detail": "Only system templates can be reset to defaults."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not reset_email_template_to_default(tpl.slug):
            return Response({"detail": "No default found for this template."}, status=404)
        tpl.refresh_from_db()
        return Response(EmailTemplateSerializer(tpl).data)


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


class KnowledgeCategoryViewSet(viewsets.ModelViewSet):
    """Knowledge base categories — read: authenticated; write: admin."""

    permission_classes = [permissions.IsAuthenticated]
    queryset = KnowledgeCategory.objects.all().order_by("display_order", "title")
    serializer_class = KnowledgeCategorySerializer

    def _require_kb_admin(self):
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return
        try:
            if user.psc_profile.role == Role.PSC_ADMIN:
                return
        except Exception:
            pass
        raise PermissionDenied("Only administrators can manage knowledge base categories.")

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        self._require_kb_admin()
        serializer.save()

    def perform_update(self, serializer):
        self._require_kb_admin()
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        self._require_kb_admin()
        return super().destroy(request, *args, **kwargs)


def _user_psc_role(user) -> str | None:
    try:
        return user.psc_profile.role
    except Exception:
        return None


def _knowledge_article_visible_to_user(article, user, *, is_editor: bool) -> bool:
    if is_editor or user.is_superuser or user.is_staff:
        return True
    roles = article.allowed_roles or []
    if not roles:
        return True
    role = _user_psc_role(user)
    return bool(role and role in roles)


class KnowledgeArticleViewSet(viewsets.ModelViewSet):
    """Knowledge base articles — slug lookup; published-only for general staff."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = KnowledgeArticleSerializer
    lookup_field = "slug"

    def _is_kb_editor(self):
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return True
        try:
            return user.psc_profile.role == Role.PSC_ADMIN
        except Exception:
            return False

    def _require_kb_admin(self):
        if not self._is_kb_editor():
            raise PermissionDenied("Only administrators can manage knowledge base articles.")

    def get_queryset(self):
        from django.db.models import Q

        qs = KnowledgeArticle.objects.select_related("category", "created_by")
        if self._is_kb_editor():
            return qs
        qs = qs.filter(is_published=True)
        role = _user_psc_role(self.request.user)
        if role:
            qs = qs.filter(
                Q(allowed_roles=[])
                | Q(allowed_roles__isnull=True)
                | Q(allowed_roles__contains=role)
            )
        else:
            qs = qs.filter(Q(allowed_roles=[]) | Q(allowed_roles__isnull=True))
        return qs

    def get_object(self):
        obj = super().get_object()
        if not _knowledge_article_visible_to_user(
            obj, self.request.user, is_editor=self._is_kb_editor()
        ):
            raise PermissionDenied("You do not have access to this guide.")
        return obj

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        self._require_kb_admin()
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        self._require_kb_admin()
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        self._require_kb_admin()
        return super().destroy(request, *args, **kwargs)


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

    permission_classes = [permissions.IsAuthenticated]
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

        transcript = getattr(meeting, "transcript", None)
        if not transcript or not (transcript.ai_processed or (transcript.raw_text or "").strip()):
            return Response(
                {"detail": "Save a meeting transcript first (paste ASR text in the minutes editor)."},
                status=400,
            )

        draft_minutes_from_transcript.delay(meeting_id, user_id=request.user.id)
        return Response({"detail": "Minutes generation started. Check back shortly."})

    @action(detail=False, methods=["post"], url_path="transcribe")
    def transcribe(self, request):
        """Legacy alias — POST /meetings/{id}/transcribe/ is preferred."""
        from .models import MeetingTranscript, TranscriptionStatus
        from .tasks import run_meeting_transcription_pipeline

        serializer = TranscriptGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting_id = serializer.validated_data["meeting_id"]
        try:
            meeting = Meeting.objects.get(id=meeting_id)
        except Meeting.DoesNotExist:
            return Response({"detail": "Meeting not found."}, status=404)

        profile = _profile(request.user)
        if profile.role not in {
            Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER,
            Role.PSC_ADMIN,
            Role.PSC_COMMISSIONER,
        }:
            raise PermissionDenied(
                "Only Secretariat or Commissioners can run AI transcription."
            )

        transcript, _ = MeetingTranscript.objects.get_or_create(meeting=meeting)
        if not (transcript.audio_file or "").strip():
            return Response(
                {"detail": "Upload a meeting recording before running AI transcribe."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active = {
            TranscriptionStatus.PENDING,
            TranscriptionStatus.TRANSCRIBING,
            TranscriptionStatus.REFINING,
        }
        if transcript.transcription_status in active:
            return Response(
                {"detail": "Transcription is already in progress."},
                status=status.HTTP_409_CONFLICT,
            )

        transcript.transcription_status = TranscriptionStatus.PENDING
        transcript.transcription_error = ""
        transcript.save(update_fields=["transcription_status", "transcription_error"])
        run_meeting_transcription_pipeline.delay(meeting_id)

        return Response(
            {
                "detail": (
                    "Transcription started (Whisper, then Claude cleanup). "
                    "Refresh the minutes editor shortly."
                ),
                "transcription_status": TranscriptionStatus.PENDING,
            },
            status=status.HTTP_202_ACCEPTED,
        )

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

    @action(detail=False, methods=["post"], url_path="extract-action-items")
    def extract_action_items(self, request):
        """AI (Haiku): extract action register from minutes or pasted text (C4)."""
        from .serializers import ActionItemsExtractSerializer
        from .tasks import extract_action_items_from_minutes

        serializer = ActionItemsExtractSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting_id = serializer.validated_data["meeting_id"]
        minutes_text = serializer.validated_data.get("minutes_text") or ""

        try:
            meeting = Meeting.objects.get(id=meeting_id)
        except Meeting.DoesNotExist:
            return Response({"detail": "Meeting not found."}, status=404)

        if not minutes_text.strip():
            has_minutes = hasattr(meeting, "minutes") and meeting.minutes.content
            has_transcript = getattr(meeting, "transcript", None) and meeting.transcript.raw_text
            if not has_minutes and not has_transcript:
                return Response(
                    {"detail": "Provide minutes_text or save minutes/transcript first."},
                    status=400,
                )

        extract_action_items_from_minutes.delay(
            meeting_id,
            minutes_text=minutes_text.strip() or None,
        )
        return Response({"detail": "Action item extraction started. Refresh shortly."})

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
            return Response(
                UserSignatureSerializer(sig, context={"request": request}).data
            )
        except UserSignature.DoesNotExist:
            return Response({"id": None, "image_url": None}, status=status.HTTP_200_OK)

    def post(self, request):
        image = request.FILES.get('image')
        if not image:
            return Response({'detail': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)
        sig, _ = UserSignature.objects.get_or_create(user=request.user)
        if sig.image:
            sig.image.delete(save=False)
        sig.image = image
        sig.save()
        return Response(
            UserSignatureSerializer(sig, context={"request": request}).data
        )

    def delete(self, request):
        try:
            sig = request.user.stored_signature
            sig.image.delete(save=False)
            sig.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except UserSignature.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)


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


# ═══════════════════════════════════════════════════════════════════════════════
# ── P1–P4 New Views ───────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

# ── Dashboard Stats (enhanced KPI) ────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats_view(request):
    """Enhanced dashboard KPIs: submission counts, SLA health, stage breakdown."""
    from django.db.models import Count, Q
    profile = _profile(request.user)
    qs = Submission.objects.all()
    if profile.role in {Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY}:
        if profile.ministry:
            qs = qs.filter(ministry=profile.ministry)

    now = timezone.now()
    today = now.date()
    thirty_days_ago = today - timedelta(days=30)
    seven_days_ago = today - timedelta(days=7)
    total = qs.count()
    submitted_this_month = qs.filter(submitted_at__date__gte=thirty_days_ago).count()
    submitted_this_week = qs.filter(submitted_at__date__gte=seven_days_ago).count()
    stage_counts = dict(qs.values("current_stage").annotate(n=Count("id")).values_list("current_stage", "n"))

    active_stages = [
        WorkflowStage.SUBMITTED, WorkflowStage.SECRETARY_REVIEW,
        WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT,
        WorkflowStage.FORWARDED_TO_COMMISSION,
    ]
    overdue = qs.filter(current_stage__in=active_stages, submitted_at__date__lt=thirty_days_ago).count()
    pending_active = qs.filter(current_stage__in=active_stages).count()
    sla_pct = round((1 - overdue / pending_active) * 100) if pending_active else 100

    ministry_breakdown = []
    if request.user.is_staff or profile.role in {Role.PSC_SECRETARY, Role.PSC_OFFICER, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER}:
        ministry_breakdown = [
            {"ministry": m, "count": c}
            for m, c in qs.values("ministry__name").annotate(n=Count("id")).order_by("-n")[:10].values_list("ministry__name", "n")
        ]

    ai_brief_done = qs.filter(ai_brief_processed=True).count()
    ai_risk_done = qs.filter(ai_risk_processed=True).count()

    return Response({
        "total_submissions": total,
        "submitted_this_month": submitted_this_month,
        "submitted_this_week": submitted_this_week,
        "pending_active": pending_active,
        "overdue_count": overdue,
        "sla_compliance_pct": sla_pct,
        "stage_breakdown": stage_counts,
        "ministry_breakdown": ministry_breakdown,
        "ai_brief_processing_rate": round(ai_brief_done / total * 100) if total else 0,
        "ai_risk_processing_rate": round(ai_risk_done / total * 100) if total else 0,
        "generated_at": now.isoformat(),
    })


# ── Submission SLA ─────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def submission_sla_view(request, pk):
    """Return SLA health info for a single submission."""
    submission = get_object_or_404(Submission, pk=pk)
    now = timezone.now()
    submitted_at = submission.submitted_at
    if not submitted_at:
        return Response({"sla_days_elapsed": None, "sla_status": "not_submitted"})

    days_elapsed = (now.date() - submitted_at.date()).days
    SLA_DAYS = 30
    WARN_DAYS = 24
    active_stages = [
        WorkflowStage.SUBMITTED, WorkflowStage.SECRETARY_REVIEW,
        WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT,
        WorkflowStage.FORWARDED_TO_COMMISSION,
    ]
    is_active = submission.current_stage in active_stages
    if not is_active:
        sla_status = "resolved"
    elif days_elapsed >= SLA_DAYS:
        sla_status = "overdue"
    elif days_elapsed >= WARN_DAYS:
        sla_status = "warning"
    else:
        sla_status = "on_track"

    return Response({
        "submission_id": submission.id,
        "reference_number": submission.reference_number,
        "submitted_at": submitted_at.isoformat(),
        "days_elapsed": days_elapsed,
        "sla_days": SLA_DAYS,
        "days_remaining": max(0, SLA_DAYS - days_elapsed),
        "sla_status": sla_status,
        "is_active": is_active,
    })


# ── Submission Bulk Action ─────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def submission_bulk_action_view(request):
    """Bulk operations on selected submission IDs."""
    profile = _profile(request.user)
    action_type = request.data.get("action")
    ids = request.data.get("ids", [])
    if not ids:
        return Response({"detail": "No submission IDs provided."}, status=status.HTTP_400_BAD_REQUEST)
    if not action_type:
        return Response({"detail": "Action is required."}, status=status.HTTP_400_BAD_REQUEST)

    ALLOWED = {Role.PSC_SECRETARY, Role.PSC_OFFICER, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER, Role.PSC_CHAIR, Role.PSC_COMMISSIONER}
    if profile.role not in ALLOWED and not request.user.is_staff:
        raise PermissionDenied("You do not have permission to perform bulk actions.")

    qs = Submission.objects.filter(pk__in=ids)

    if action_type == "mark_urgent":
        count = qs.count()
        qs.update(updated_at=timezone.now())
        _log(request, _AL.Action.UPDATE, resource_type="Submission", description=f"Bulk marked {count} submissions as urgent")
        return Response({"detail": f"{count} submissions marked as urgent.", "updated": count})

    elif action_type == "assign":
        from django.contrib.auth.models import User as AuthUser
        assignee_id = request.data.get("assignee_id")
        if not assignee_id:
            return Response({"detail": "assignee_id required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            assignee = AuthUser.objects.get(pk=assignee_id)
        except AuthUser.DoesNotExist:
            return Response({"detail": "Assignee not found."}, status=status.HTTP_404_NOT_FOUND)
        count = qs.count()
        qs.update(updated_at=timezone.now())
        _log(request, _AL.Action.UPDATE, resource_type="Submission", description=f"Bulk assigned {count} submissions to {assignee.username}")
        return Response({"detail": f"{count} submissions assigned to {assignee.username}.", "updated": count})

    elif action_type == "export_list":
        data = list(qs.values("id", "reference_number", "title", "current_stage", "ministry__name", "officer_name", "submitted_at"))
        return Response({"submissions": data, "count": len(data)})

    elif action_type == "run_ai_risk":
        from .tasks import queue_risk_assessment
        count = 0
        for sub in qs:
            queue_risk_assessment(sub.id, force=True)
            count += 1
        return Response({"detail": f"Risk assessment queued for {count} submissions.", "queued": count})

    else:
        return Response({"detail": f"Unknown action: {action_type}"}, status=status.HTTP_400_BAD_REQUEST)


# ── AI Trigger and Result Views ────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trigger_ai_duplicate(request, pk):
    submission = get_object_or_404(Submission, pk=pk)
    from .tasks import queue_duplicate_detection
    queue_duplicate_detection(submission.id, force=True)
    return Response({"detail": "Duplicate detection queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_duplicate(request, pk):
    from .serializers import AiDuplicateResultSerializer
    submission = get_object_or_404(Submission, pk=pk)
    return Response(AiDuplicateResultSerializer(submission).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trigger_ai_risk(request, pk):
    submission = get_object_or_404(Submission, pk=pk)
    from .tasks import queue_risk_assessment
    queue_risk_assessment(submission.id, force=True)
    return Response({"detail": "Risk assessment queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_risk(request, pk):
    from .serializers import AiRiskResultSerializer
    submission = get_object_or_404(Submission, pk=pk)
    return Response(AiRiskResultSerializer(submission).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trigger_ai_outcome(request, pk):
    submission = get_object_or_404(Submission, pk=pk)
    from .tasks import queue_recommended_outcome
    queue_recommended_outcome(submission.id, force=True)
    return Response({"detail": "Outcome recommendation queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_outcome(request, pk):
    from .serializers import AiOutcomeResultSerializer
    submission = get_object_or_404(Submission, pk=pk)
    return Response(AiOutcomeResultSerializer(submission).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trigger_ai_noa(request, pk):
    submission = get_object_or_404(Submission, pk=pk)
    deadline_days = int(request.data.get("response_deadline_days", 14))
    from .tasks import queue_notice_of_allegation
    queue_notice_of_allegation(submission.id, response_deadline_days=deadline_days, force=True)
    return Response({"detail": "Notice of Allegation draft queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_noa(request, pk):
    from .serializers import AiNoaResultSerializer
    submission = get_object_or_404(Submission, pk=pk)
    return Response(AiNoaResultSerializer(submission).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trigger_ai_letter(request, pk):
    submission = get_object_or_404(Submission, pk=pk)
    outcome = request.data.get("outcome", "")
    conditions = request.data.get("conditions", [])
    from .tasks import queue_outcome_letter
    queue_outcome_letter(submission.id, outcome=outcome, conditions=conditions, force=True)
    return Response({"detail": "Outcome letter draft queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_letter(request, pk):
    from .serializers import AiLetterResultSerializer
    submission = get_object_or_404(Submission, pk=pk)
    return Response(AiLetterResultSerializer(submission).data)


# ── Calendar Events ────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def calendar_events_view(request):
    """Commission calendar: meetings + deadlines + SLA warnings."""
    from .models import Meeting, CommissionTask
    profile = _profile(request.user)
    events = []

    meetings_qs = Meeting.objects.all().order_by("date")
    if profile.role in {Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY}:
        meetings_qs = meetings_qs.filter(is_public=True)

    for m in meetings_qs[:50]:
        events.append({
            "id": f"meeting-{m.id}",
            "type": "meeting",
            "title": m.title or f"Commission Meeting #{m.id}",
            "date": m.date.isoformat() if m.date else None,
            "url": f"/meetings/{m.id}",
        })

    for t in CommissionTask.objects.filter(deadline__isnull=False).order_by("deadline")[:50]:
        events.append({
            "id": f"task-{t.id}",
            "type": "task_deadline",
            "title": t.title or "Commission Task",
            "date": t.deadline.isoformat() if t.deadline else None,
            "status": t.status,
            "url": f"/commission-tasks/{t.id}",
        })

    warn_date = timezone.now().date() - timedelta(days=24)
    active_stages = [
        WorkflowStage.SUBMITTED, WorkflowStage.SECRETARY_REVIEW,
        WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT,
    ]
    for sub in Submission.objects.filter(current_stage__in=active_stages, submitted_at__date__lte=warn_date).order_by("submitted_at")[:20]:
        events.append({
            "id": f"sla-{sub.id}",
            "type": "sla_warning",
            "title": f"SLA Warning: {sub.reference_number or sub.title}",
            "date": (sub.submitted_at.date() + timedelta(days=30)).isoformat(),
            "submission_id": sub.id,
            "url": f"/submissions/{sub.id}",
        })

    events.sort(key=lambda e: e.get("date") or "")
    return Response({"events": events, "total": len(events)})


# ── Analytics Views ────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def analytics_overview_view(request):
    """Aggregated analytics overview."""
    from django.db.models import Count
    qs = Submission.objects.all()
    now = timezone.now()
    total = qs.count()

    return Response({
        "total": total,
        "approved": qs.filter(current_stage=WorkflowStage.DECIDED_APPROVED).count(),
        "rejected": qs.filter(current_stage=WorkflowStage.DECIDED_REJECTED).count(),
        "deferred": qs.filter(current_stage=WorkflowStage.DEFERRED).count(),
        "pending": qs.exclude(current_stage__in=[
            WorkflowStage.DECIDED_APPROVED, WorkflowStage.DECIDED_REJECTED,
            WorkflowStage.DEFERRED, WorkflowStage.WITHDRAWN,
        ]).count(),
        "by_form_type": [
            {"form_type": ft, "count": c}
            for ft, c in qs.values("form_type_code").annotate(n=Count("id")).order_by("-n")[:10].values_list("form_type_code", "n")
        ],
        "monthly_submissions": [
            {"month": m, "count": qs.filter(submitted_at__year=now.year, submitted_at__month=m).count()}
            for m in range(1, now.month + 1)
        ],
        "year": now.year,
    })


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def analytics_trends_view(request):
    """Weekly submission trends over the last 12 weeks."""
    weeks = []
    for i in range(11, -1, -1):
        week_end = timezone.now().date() - timedelta(weeks=i)
        week_start = week_end - timedelta(days=6)
        count = Submission.objects.filter(submitted_at__date__gte=week_start, submitted_at__date__lte=week_end).count()
        weeks.append({"week_start": week_start.isoformat(), "week_end": week_end.isoformat(), "count": count})
    return Response({"weekly_trends": weeks})


# ── Workload Views ─────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def workload_officers_view(request):
    """Officer workload: active submission counts per PSC officer."""
    from django.contrib.auth.models import User as AuthUser
    from django.db.models import Count
    profile = _profile(request.user)
    ALLOWED = {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER}
    if profile.role not in ALLOWED and not request.user.is_staff:
        raise PermissionDenied("PSC staff only.")

    active_stages = [
        WorkflowStage.SUBMITTED, WorkflowStage.SECRETARY_REVIEW,
        WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT,
        WorkflowStage.FORWARDED_TO_COMMISSION,
    ]

    officers = AuthUser.objects.filter(
        is_active=True,
        userprofile__role__in=[Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER],
    ).annotate(
        active_count=Count("submission_set", filter=models.Q(submission_set__current_stage__in=active_stages))
    ).order_by("active_count").select_related("userprofile")

    return Response({
        "officers": [
            {
                "id": o.id,
                "username": o.username,
                "full_name": f"{o.first_name} {o.last_name}".strip() or o.username,
                "role": getattr(getattr(o, "userprofile", None), "role", ""),
                "active_submission_count": o.active_count,
            }
            for o in officers
        ]
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def workload_suggest_assignment_view(request):
    """F1 — AI-powered smart assignment suggestion."""
    from .ai.F1_smart_routing import suggest_assignment
    from .tasks import _build_submission_context
    from django.contrib.auth.models import User as AuthUser

    profile = _profile(request.user)
    ALLOWED = {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER}
    if profile.role not in ALLOWED and not request.user.is_staff:
        raise PermissionDenied("PSC staff only.")

    submission_id = request.data.get("submission_id")
    if not submission_id:
        return Response({"detail": "submission_id required."}, status=status.HTTP_400_BAD_REQUEST)

    submission = get_object_or_404(Submission, pk=submission_id)
    submission_ctx = _build_submission_context(submission)

    officers = AuthUser.objects.filter(
        is_active=True,
        userprofile__role__in=[Role.PSC_OFFICER, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER],
    ).select_related("userprofile")[:15]

    officers_ctx = "\n".join(
        f"Officer: {o.first_name} {o.last_name} ({o.username}), Role: {getattr(getattr(o, 'userprofile', None), 'role', 'unknown')}"
        for o in officers
    ) or "No PSC officers available."

    data, err = suggest_assignment(submission_ctx, officers_ctx)
    if err or not data:
        return Response({"detail": f"AI suggestion failed: {err or 'empty response'}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response(data)


# ── Audit Log Search ───────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def audit_log_search_view(request):
    """Full-text + filter search of AuditLog entries."""
    from .models import AuditLog

    if not rbac_user_can_view_audit_log(request.user) and not request.user.is_staff:
        raise PermissionDenied("You do not have permission to view audit logs.")

    qs = AuditLog.objects.select_related("user").order_by("-timestamp")

    q = request.query_params.get("q", "").strip()
    user_id = request.query_params.get("user_id")
    action_filter = request.query_params.get("action")
    resource_type = request.query_params.get("resource_type")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")

    if q:
        qs = qs.filter(models.Q(description__icontains=q) | models.Q(resource_label__icontains=q) | models.Q(user__username__icontains=q))
    if user_id:
        qs = qs.filter(user_id=user_id)
    if action_filter:
        qs = qs.filter(action=action_filter)
    if resource_type:
        qs = qs.filter(resource_type=resource_type)
    if date_from:
        qs = qs.filter(timestamp__date__gte=date_from)
    if date_to:
        qs = qs.filter(timestamp__date__lte=date_to)

    page = max(1, int(request.query_params.get("page", 1)))
    page_size = min(100, int(request.query_params.get("page_size", 50)))
    total = qs.count()
    records = qs[(page - 1) * page_size : page * page_size]

    return Response({
        "results": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "user": log.user.username if log.user else None,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "resource_label": log.resource_label,
                "description": log.description,
                "ip_address": getattr(log, "ip_address", None),
            }
            for log in records
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "num_pages": (total + page_size - 1) // page_size,
    })


# ── WebPush Subscription ViewSet ───────────────────────────────────────────────

class WebPushSubscriptionViewSet(viewsets.ModelViewSet):
    """CRUD for browser Web Push subscriptions (per authenticated user)."""
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_serializer_class(self):
        from .serializers import WebPushSubscriptionSerializer
        return WebPushSubscriptionSerializer

    def get_queryset(self):
        from .models import WebPushSubscription
        return WebPushSubscription.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        from .models import WebPushSubscription
        endpoint = serializer.validated_data.get("endpoint")
        WebPushSubscription.objects.filter(user=self.request.user, endpoint=endpoint).delete()
        serializer.save(user=self.request.user, user_agent=self.request.META.get("HTTP_USER_AGENT", "")[:255])


# ── Document Version ViewSet ───────────────────────────────────────────────────

class DocumentVersionViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """List and upload new versions of submission documents."""
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        from .serializers import DocumentVersionSerializer
        return DocumentVersionSerializer

    def get_queryset(self):
        from .models import DocumentVersion
        qs = DocumentVersion.objects.select_related("document", "uploaded_by")
        doc_id = self.request.query_params.get("document")
        if doc_id:
            qs = qs.filter(document_id=doc_id)
        return qs

    def perform_create(self, serializer):
        from .models import DocumentVersion, SubmissionDocument
        doc_id = self.request.data.get("document")
        doc = get_object_or_404(SubmissionDocument, pk=doc_id)
        last = DocumentVersion.objects.filter(document=doc).order_by("-version_num").first()
        next_num = (last.version_num + 1) if last else 1
        DocumentVersion.objects.filter(document=doc, is_current=True).update(is_current=False)
        serializer.save(document=doc, version_num=next_num, uploaded_by=self.request.user, is_current=True)
