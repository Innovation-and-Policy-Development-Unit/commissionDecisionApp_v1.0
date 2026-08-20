import os
from pathlib import Path
from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import Count, Prefetch
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import get_resolver
from django.urls.resolvers import URLPattern, URLResolver
from django.utils import timezone
from datetime import timedelta
from rest_framework import mixins, parsers, permissions, status, viewsets, exceptions
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AgendaStatus,
    APIKey,
    Classification,
    CommissionTask,
    CommissionSubTask,
    CommissionTaskStatus,
    CommissionTaskUpdate,
    FeedbackChecklistResponse,
    Department,
    FlyingMinuteSignature,
    AgendaSection,
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
    RemarksImage,
    Role,
    RoleDefinition,
    SecurityNotice,
    Submission,
    SubmissionCoAssignment,
    SystemPermission,
    SystemSetting,
    EmailTemplate,
    LetterTemplate,
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
    Unit,
)
from .models import PasswordResetToken
from .opsc_access import (
    COMMISSION_TASK_MANAGER_ROLES,
    COMMISSION_TASK_STAFF_ROLES,
    MANAGER_ROLE_TO_ROUTED_UNIT,
    OPSC_UNIT_MANAGER_ROLES,
    manager_allowed_staff_roles,
    user_can_view_all_commission_tasks,
    user_can_view_commission_minutes,
    user_can_work_commission_task,
)
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
    UnitSerializer,
    AgendaSectionSerializer,
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
    SubmissionPrivateNoteSerializer,
    SubmissionWriteSerializer,
    SystemPermissionSerializer,
    TransitionSerializer,
    UserAdminUpdateSerializer,
    UserProfileSerializer,
    APIKeySerializer,
    SystemSettingSerializer,
    EmailTemplateSerializer,
    LetterTemplateSerializer,
    FeedbackReportSerializer,
    FeedbackReportDetailSerializer,
    FeedbackCommentSerializer,
    FeedbackChecklistResponseSerializer,
    NotificationSerializer,
    MinutesSerializer,
    MinuteAgendaIntakeSerializer,
    MinuteAgendaIntakeBulkSerializer,
    MeetingTranscriptSerializer,
    MinutesGenerateSerializer,
    TranscriptGenerateSerializer,
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
    ODUBoardPaperSerializer,
    IPDUBoardPaperSerializer,
    RestructureSubmissionDataSerializer,
    KnowledgeCategorySerializer,
    KnowledgeArticleSerializer,
    SubmissionChecklistResponseSerializer,
    ChecklistFormTypeSerializer,
)
from .api_cache import (
    CachedReferenceViewSetMixin,
    CachedRoleDefinitionViewSetMixin,
    ORG_REF_NAMESPACES,
    get_cached_response,
    invalidate_password_policy_cache,
    invalidate_ref_groups,
    invalidate_submission,
    password_policy_cache_key,
    set_cached_response,
    submission_bootstrap_cache_key,
)
from .transitions import assert_transition_allowed, iter_allowed_targets
from .totp import generate_totp_secret, get_totp_uri, get_totp_qr_base64, verify_totp_code
from .throttles import AiAnalysisTriggerThrottle, PasswordResetThrottle, SessionPinVerifyThrottle
from .auth import LenientJWTAuthentication
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
    ODURestructureBoardPaper,
    IPDUBoardPaper,
    BoardPaperStatus,
    PSCFormField,
    PSCFormType,
    RestructureSubmissionData,
    SubmissionChecklistResponse,
)


def _profile(user):
    from .profile_utils import ensure_psc_profile

    return ensure_psc_profile(user)


def mfa_globally_enabled():
    """Super-admin master switch for TOTP-based 2FA (Settings > Security).

    Reads the live SystemSetting row so the Admin Panel toggle takes effect
    immediately; falls back to the env-configured Django setting when no row
    exists yet. While disabled, login enforcement and new enrollment are
    paused system-wide — see LoginView, TOTPSetupView, TOTPVerifySetupView,
    and UserViewSet.force_mfa_setup. Per-user totp_secret / two_factor_enabled
    values are left untouched so re-enabling resumes prior enrollments as-is.
    """
    from django.conf import settings as django_settings
    from .models import SystemSetting

    default = getattr(django_settings, "TWO_FACTOR_REQUIRED", False)
    val = SystemSetting.get_val("TWO_FACTOR_REQUIRED")
    # A blank stored value (e.g. an unrelated Settings-page save that wrote
    # every field, including one never explicitly toggled) means "not set by
    # an admin", not "explicitly false" — treat it the same as no row at all.
    if val is None or val == "":
        return default
    return val.lower() in ("true", "1", "yes", "on")


def _resolve_submission_ministry_id(profile, request, validated_data):
    """Resolve ministry for external (Commission) submissions."""
    ministry = validated_data.get("ministry")
    if ministry is not None:
        return ministry.pk
    raw = request.data.get("ministry")
    if raw not in (None, ""):
        return int(raw)
    if profile.ministry_id:
        return profile.ministry_id
    return None


def _resolve_opsc_ministry(profile):
    """Return the line ministry PK for OPSC internal submissions (Ministry of the Prime Minister)."""
    from .org_structure import resolve_opsc_ministry_id

    try:
        return resolve_opsc_ministry_id(profile)
    except ValueError as exc:
        raise PermissionDenied(str(exc)) from exc


def _resolve_opsc_submission_org(profile):
    """Ministry (OPM), department (OPSC), and optional unit for OPSC internal submissions."""
    from .org_structure import resolve_opsc_submission_org

    try:
        return resolve_opsc_submission_org(profile)
    except ValueError as exc:
        raise PermissionDenied(str(exc)) from exc


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
    ).prefetch_related(
        "events__actor",
        "attached_submissions",
        Prefetch(
            "co_assignments",
            queryset=SubmissionCoAssignment.objects.select_related("principal"),
        ),
    )
    if user.is_superuser or user.is_staff:
        return qs
    profile = _profile(user)
    role = profile.role
    # Ministry-side roles must never see OPSC-internal submissions (compliance
    # matters, internal OPSC papers). The is_internal=False guard is the firewall.
    if role in {Role.MINISTRY_HR, Role.HEAD_OF_AGENCY}:
        if not profile.ministry_id:
            return qs.none()
        return qs.filter(ministry_id=profile.ministry_id, is_internal=False)
    if role == Role.TRAVELLER:
        if not profile.ministry_id:
            return qs.filter(created_by=user, is_internal=False)
        return qs.filter(
            models.Q(created_by=user)
            | models.Q(secretary_only=True, ministry_id=profile.ministry_id),
            is_internal=False,
        )
    if role == Role.DEPT_ADMIN:
        if not profile.department_id:
            return qs.none()
        return qs.filter(department_id=profile.department_id, is_internal=False)
    _UNIT_PRINCIPAL_ROLES = {
        Role.ODU_PRINCIPAL,
        Role.HR_UNIT_PRINCIPAL,
        Role.VIPAM_PRINCIPAL,
        Role.COMPLIANCE_PRINCIPAL,
        Role.ODU_SENIOR,
        Role.HR_UNIT_SENIOR,
        Role.VIPAM_SENIOR,
    }
    if role in {Role.COMPLIANCE_SENIOR, Role.COMPLIANCE_MANAGER, Role.COMPLIANCE_PRINCIPAL}:
        # Compliance staff see all OPSC-internal compliance submissions (created
        # natively in SCDMS — no external case link required).
        return qs.filter(
            form_category__code__in=["COMPLIANCE", "discipline_compliance"],
            is_internal=True,
        )
    if role in _UNIT_PRINCIPAL_ROLES:
        # Principals see only submissions explicitly assigned to them
        return qs.filter(assigned_to=user)
    if role == Role.SENIOR_OFFICER:
        # Senior Officer has two unrelated capacities (see _UNIT_PRINCIPAL_ROLES
        # in transitions.py): a per-unit checklist-review assignee — scoped like
        # the other unit seniors, assigned_to=user only — and a post-decision
        # execution role (_STAFF_STAGES) that's unrestricted like the other PSC
        # roles below. Was previously falling all the way through to the
        # unrestricted bucket, exposing every unit's in-review submission
        # content during the checklist-review/assessment phase specifically.
        _review_stages = {WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT}
        return qs.exclude(current_stage__in=_review_stages) | qs.filter(
            current_stage__in=_review_stages, assigned_to=user,
        )
    # CSU Manager sees only internal submissions
    if role == Role.CSU_MANAGER:
        return qs.filter(is_internal=True)
    # Unit managers (the checklist-review gate) must only see submissions the
    # PSC receptionist/officer has already routed to their own unit — never
    # unrouted submissions still with PSC intake, and never another unit's
    # queue. Keep this mapping in sync with _unit_role_to_routed used for the
    # transition-permission check further below.
    _unit_manager_to_routed = {
        Role.VIPAM_MANAGER: "vipam",
        Role.HR_UNIT_MANAGER: "hr",
        Role.ODU_MANAGER: "odu",
    }
    if role in _unit_manager_to_routed:
        return qs.filter(routed_unit=_unit_manager_to_routed[role])
    # Manager IPDU: like the unit managers above once a submission is routed
    # to "ipdu", but — like CSU Manager's own branch — must also see their
    # own drafts before routed_unit is set (it's blank until auto-derived on
    # submit, same mechanism CSU uses). Scoped to their own drafts via
    # created_by rather than CSU's broader "any is_internal submission", so
    # Manager IPDU doesn't incidentally see another unit's blank-routed_unit
    # drafts (e.g. CSU's, which also goes through DRAFT with routed_unit="").
    if role == Role.IPDU_MANAGER:
        return qs.filter(routed_unit="ipdu") | qs.filter(
            is_internal=True, routed_unit="", created_by=user,
        )
    if role in {
        Role.RECEPTIONIST,
        Role.PSC_OFFICER,
        Role.PSC_SECRETARY,
        Role.PSC_COMMISSIONER,
        Role.CHAIRPERSON,
        Role.PSC_ADMIN,
        Role.SENIOR_ADMIN_OFFICER,
        Role.PSC_MANAGER,
        Role.PRINCIPAL_OFFICER,
        Role.SENIOR_OFFICER,
        Role.COMPLIANCE_MANAGER,
        Role.CSU_MANAGER,
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
    # OPSC unit managers/principals and post-decision staff: see full register;
    # perform_update enforces write only on allocated rows.
    if user_can_view_all_commission_tasks(user):
        return qs
    if rbac_user_has_permission(user, "assign_task"):
        return qs.filter(assigned_manager=user)
    if rbac_user_has_permission(user, "update_implementation"):
        return qs.filter(
            models.Q(assigned_staff=user) | models.Q(assigned_staff_m2m=user)
        ).distinct()
    return qs.none()


def _user_can_add_commission_task_update(user, task):
    return user_can_work_commission_task(user, task)


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
    if (
        prev in (WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT)
        and submission.ready_for_manager_at is None
    ):
        fields.add("ready_for_manager_at")
    if target == WorkflowStage.UNDER_ASSESSMENT and submission.assessment_started_at is not None:
        fields.add("assessment_started_at")
        fields.add("assessment_deadline_at")
    if submission.scheduled_meeting_id:
        fields.add("scheduled_meeting")
    if prev == WorkflowStage.PENDING_DG_ENDORSEMENT and target == WorkflowStage.SUBMITTED:
        fields.add("dg_endorsed_by")
        fields.add("dg_endorsed_at")
    if target == WorkflowStage.MANAGER_CHECKLIST_REVIEW:
        # Auto-derived from form type whenever routed_unit was still blank
        # (see the transition() body above) — not just on the DRAFT ->
        # Manager Checklist Review (Receptionist intake) path. Missing the
        # SUBMITTED -> Manager Checklist Review path here (the ministry
        # HR -> DG -> PSC route added by the Aug 5 auto-routing change) meant
        # the computed unit was silently dropped on save — the in-memory
        # object had it, the database never did.
        fields.add("routed_unit")
    if target == WorkflowStage.MANAGER_CHECKLIST_REVIEW and submission.checklist_review_started_at is not None:
        fields.add("checklist_review_started_at")
        fields.add("checklist_review_deadline_at")
    if target == WorkflowStage.RECALLED:
        fields.add("recalled_at")
        fields.add("recalled_by_id")
        fields.add("recalled_reason")
    return fields


def _dg_recipients_for_submission(submission):
    """Resolve the Head of Agency (DG) who endorses this submission.

    For a department-scoped submission, prefer the department director; otherwise
    fall back to the ministry-level DG (head of agency without a department).
    """
    from .models import Profile

    if not submission or not submission.ministry_id:
        return []
    base = Profile.objects.filter(
        role=Role.HEAD_OF_AGENCY,
        ministry_id=submission.ministry_id,
        user__is_active=True,
    ).select_related("user")
    if submission.department_id:
        dept = base.filter(department_id=submission.department_id)
        if dept.exists():
            return [p.user for p in dept]
    return [p.user for p in base.filter(department__isnull=True)]


def _hr_recipients_for_submission(submission):
    """Resolve ministry HR contacts for this submission (ministry-scoped)."""
    from .models import Profile

    if not submission or not submission.ministry_id:
        return []
    profiles = Profile.objects.filter(
        role=Role.MINISTRY_HR,
        ministry_id=submission.ministry_id,
        user__is_active=True,
    ).select_related("user")
    return [p.user for p in profiles]


def _get_submission_chain(submission):
    """Return the approval_chain governing this submission, or [].

    Attachment submissions (is_attachment=True) are governed by their own
    PSCFormType.approval_chain — e.g. PSC Form 2-2 requires ODU Manager then
    Director sign-off before it counts as satisfied on the parent's checklist.
    Internal (CSU/ODU) submissions are governed by their AgendaSection.approval_chain.
    """
    if submission.is_attachment:
        if not submission.form_type_code:
            return []
        try:
            ft = PSCFormType.objects.filter(code=submission.form_type_code).first()
            return ft.approval_chain if ft and ft.approval_chain else []
        except Exception:
            return []
    if not submission.agenda_category:
        return []
    try:
        sec = AgendaSection.objects.filter(code=submission.agenda_category).first()
        return sec.approval_chain if sec and sec.approval_chain else []
    except Exception:
        return []


def _chain_stage_index(chain, stage):
    """Return index of stage in chain, or -1."""
    for i, step in enumerate(chain):
        if step.get("stage") == stage:
            return i
    return -1


def _chain_targets_for_role(submission, role, user=None):
    """
    If the submission has a non-empty approval_chain and this role participates
    in it, return the list of allowed target stages. Returns None if the chain
    does not apply (use default logic).
    """
    if not (submission.is_internal or submission.is_attachment):
        return None
    chain = _get_submission_chain(submission)
    if not chain:
        return None

    current = submission.current_stage
    from .transitions import INTERNAL_SUBMITTER_ROLES

    # DRAFT: internal submitters send to first chain step. For an attachment
    # submission (e.g. PSC Form 2-2), there's no fixed submitter role — the
    # attachment's own creator sends it in, whatever role they hold.
    if current == WorkflowStage.DRAFT:
        if submission.is_internal and role in INTERNAL_SUBMITTER_ROLES:
            return [chain[0]["stage"]]
        if submission.is_attachment and user is not None and submission.created_by_id == user.id:
            return [chain[0]["stage"]]

    # Chain steps: the role listed in a step approves it
    idx = _chain_stage_index(chain, current)
    if idx >= 0:
        step_roles = chain[idx].get("roles", [])
        if role in step_roles:
            targets = [WorkflowStage.DRAFT]   # can always return for changes
            if idx + 1 < len(chain):
                targets.append(chain[idx + 1]["stage"])   # next step
            elif submission.is_internal:
                targets.append(WorkflowStage.SUBMITTED)   # last step → Secretary
            else:
                # Attachment forms terminate at Approved — they don't go to
                # Commission on their own; the parent submission carries them.
                targets.append(WorkflowStage.APPROVED)
            return targets
        # PSC admin bypass handled by caller
        return None

    return None


def _chain_transition_allowed(submission, role, target, user=None):
    """
    Returns True  → chain explicitly allows this transition.
    Returns False → chain explicitly denies it.
    Returns None  → chain doesn't apply; use default logic.
    """
    from .models import Role as _Role
    if role == _Role.PSC_ADMIN:
        return None   # admin always uses default logic
    targets = _chain_targets_for_role(submission, role, user=user)
    if targets is None:
        return None
    return target in targets


def _dispatch_transition_notifications(submission, prev, target, actor, remarks=""):
    """Create in-app Notification records for the relevant parties."""
    from .models import Meeting, Notification as NotificationModel

    recipients = []
    title = ""
    body = ""

    def _resolve_receiver_roles():
        agenda_code = (submission.agenda_category or "").strip().lower()
        if not agenda_code and submission.form_type_code:
            ft = (
                PSCFormType.objects.filter(code__iexact=submission.form_type_code)
                .values("agenda_category")
                .first()
            )
            if ft:
                agenda_code = (ft.get("agenda_category") or "").strip().lower()
        section_roles = []
        if agenda_code:
            section = (
                AgendaSection.objects.filter(code=agenda_code, is_active=True)
                .values("receiver_roles")
                .first()
            )
            if section:
                section_roles = list(section.get("receiver_roles") or [])
        if section_roles:
            return section_roles
        unit_to_role = {
            "odu": Role.ODU_MANAGER,
            "hr": Role.HR_UNIT_MANAGER,
            "vipam": Role.VIPAM_MANAGER,
            "compliance": Role.COMPLIANCE_MANAGER,
            "csu": Role.CSU_MANAGER,
            "ipdu": Role.IPDU_MANAGER,
        }
        return [unit_to_role.get(submission.routed_unit, Role.PSC_OFFICER)]

    # ── Approval chain notifications ─────────────────────────────────────────
    _chain = _get_submission_chain(submission)
    _chain_stages = {step["stage"] for step in _chain}
    if target in _chain_stages:
        # Moving into a chain step — notify the roles defined in that step
        _step = next((s for s in _chain if s["stage"] == target), None)
        if _step:
            _step_roles = _step.get("roles", [])
            _step_label = _step.get("label", "Approval")
            recipients = User.objects.filter(
                psc_profile__role__in=_step_roles, is_active=True
            )
            actor_name = (actor.get_full_name() or actor.username) if actor else "Staff"
            title = f"{_step_label} required: {submission.reference_number}"
            body = (
                f"'{submission.title}' submitted by {actor_name} is awaiting your "
                f"{_step_label.lower()} before it is sent to the Secretary."
            )
    elif prev in _chain_stages and target == WorkflowStage.DRAFT:
        # Chain approver returned for changes — notify the creator
        recipients = User.objects.filter(pk=submission.created_by_id, is_active=True)
        approver_name = (actor.get_full_name() or actor.username) if actor else "Approver"
        title = f"Returned for changes: {submission.reference_number}"
        reason = (remarks or "").strip()
        body = (
            f"'{submission.title}' was returned by {approver_name} for changes."
            + (f"\n\nReason: {reason}" if reason else "")
        )
    elif prev in _chain_stages and target == WorkflowStage.SUBMITTED:
        # Last chain step approved — notify Secretary
        recipients = User.objects.filter(
            psc_profile__role__in=[Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER],
            is_active=True,
        )
        title = f"New internal submission: {submission.reference_number}"
        body = f"'{submission.title}' has completed all approvals and is ready for your review."

    # ── Compliance Manager approval gate (Principal/Senior-created submissions) ──
    elif target == WorkflowStage.PENDING_MANAGER_APPROVAL and submission.routed_unit == RoutedUnit.COMPLIANCE:
        recipients = User.objects.filter(
            psc_profile__role=Role.COMPLIANCE_MANAGER, is_active=True,
        )
        actor_name = (actor.get_full_name() or actor.username) if actor else "Compliance staff"
        title = f"Approval required: {submission.reference_number}"
        body = (
            f"'{submission.title}' submitted by {actor_name} is awaiting your approval "
            f"before it is sent to the Secretary."
        )
    elif (
        prev == WorkflowStage.PENDING_MANAGER_APPROVAL
        and target == WorkflowStage.DRAFT
        and submission.routed_unit == RoutedUnit.COMPLIANCE
    ):
        recipients = User.objects.filter(pk=submission.created_by_id, is_active=True)
        approver_name = (actor.get_full_name() or actor.username) if actor else "Compliance Manager"
        title = f"Returned for changes: {submission.reference_number}"
        reason = (remarks or "").strip()
        body = (
            f"'{submission.title}' was returned by {approver_name} for changes."
            + (f"\n\nReason: {reason}" if reason else "")
        )
    elif (
        prev == WorkflowStage.PENDING_MANAGER_APPROVAL
        and target == WorkflowStage.SUBMITTED
        and submission.routed_unit == RoutedUnit.COMPLIANCE
    ):
        recipients = User.objects.filter(
            psc_profile__role__in=[Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER],
            is_active=True,
        )
        title = f"New internal submission: {submission.reference_number}"
        body = f"'{submission.title}' has been approved by the Compliance Manager and is ready for your review."

    elif (
        prev in (WorkflowStage.DRAFT, WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.DG_APPROVED)
        and target == WorkflowStage.SUBMITTED
    ):
        receiver_roles = _resolve_receiver_roles()
        recipients = User.objects.filter(
            psc_profile__role__in=receiver_roles, is_active=True
        )
        title = f"New submission: {submission.reference_number}"
        body = f"{submission.title} has been submitted and needs your checklist review."

    elif prev == WorkflowStage.PENDING_DG_ENDORSEMENT and target == WorkflowStage.DG_APPROVED:
        # DG endorsed — notify the HR who created the submission to now forward to PSC
        recipients = User.objects.filter(pk=submission.created_by_id, is_active=True)
        dg_name = (actor.get_full_name() or actor.username) if actor else "Director-General"
        title = f"Endorsed — please submit to PSC: {submission.reference_number}"
        body = (
            f"'{submission.title}' has been endorsed by {dg_name}. "
            f"Please review and submit the submission to the Public Service Commission."
        )

    elif prev == WorkflowStage.DRAFT and target == WorkflowStage.PENDING_DG_ENDORSEMENT:
        recipients = _dg_recipients_for_submission(submission)
        actor_name = (actor.get_full_name() or actor.username) if actor else "Ministry HR"
        title = f"Endorsement required: {submission.reference_number}"
        body = (
            f"{submission.title} has been submitted by {actor_name} and is awaiting your "
            f"endorsement before it is sent to the Public Service Commission."
        )

    elif prev == WorkflowStage.PENDING_DG_ENDORSEMENT and target == WorkflowStage.DRAFT:
        recipients = User.objects.filter(
            pk=submission.created_by_id, is_active=True
        )
        reason = (remarks or "").strip()
        title = f"Returned for changes: {submission.reference_number}"
        if reason:
            body = (
                f"The Director-General returned '{submission.title}' to you for changes.\n\n"
                f"Reason: {reason}"
            )
        else:
            body = (
                f"The Director-General returned '{submission.title}' to you for changes. "
                f"Please review the submission."
            )

    elif target == WorkflowStage.RETURNED_FOR_CLARIFICATION:
        recipients = User.objects.filter(
            pk=submission.created_by_id, is_active=True
        )
        title = f"Submission returned: {submission.reference_number}"
        body = f"Your submission '{submission.title}' was returned. Please check the remarks."
        # Restructure/variance + PSC 2-2: the assigned Principal sends this
        # straight to Ministry HR without the Manager ODU's sign-off — still
        # let the Manager know it happened (see the carve-out in transitions.py).
        from .odu_checklist_rules import ODU_PRINCIPAL_DIRECT_CLARIFICATION_FORM_CODES

        if (
            actor is not None
            and submission.assigned_to_id == actor.id
            and (submission.form_type_code or "") in ODU_PRINCIPAL_DIRECT_CLARIFICATION_FORM_CODES
        ):
            actor_profile = _profile(actor)
            _managers = User.objects.filter(
                psc_profile__role=Role.ODU_MANAGER, is_active=True,
            )
            if actor_profile and actor_profile.unit_id:
                _managers = _managers.filter(psc_profile__unit_id=actor_profile.unit_id)
            actor_name = actor.get_full_name() or actor.username
            reason = (remarks or "").strip()
            for _u in _managers:
                NotificationModel.objects.create(
                    recipient=_u,
                    submission=submission,
                    channel=NotificationModel.Channel.BOTH,
                    title=f"Principal returned for clarification: {submission.reference_number}",
                    body=(
                        f"{actor_name} sent '{submission.title}' back to the ministry for "
                        f"clarification."
                        + (f"\n\nReason: {reason}" if reason else "")
                    ),
                )

    elif prev == WorkflowStage.RETURNED_FOR_CLARIFICATION and target == WorkflowStage.SUBMITTED:
        unit_to_role = {
            "odu": Role.ODU_MANAGER,
            "hr": Role.HR_UNIT_MANAGER,
            "vipam": Role.VIPAM_MANAGER,
            "compliance": Role.COMPLIANCE_MANAGER,
            "ipdu": Role.IPDU_MANAGER,
        }
        manager_role = unit_to_role.get(submission.routed_unit, Role.PSC_OFFICER)
        recipients = User.objects.filter(
            psc_profile__role=manager_role, is_active=True
        )
        title = f"Resubmitted: {submission.reference_number}"
        body = f"{submission.title} has been resubmitted after clarification."

    elif target == WorkflowStage.PENDING_SECRETARY_APPROVAL:
        recipients = User.objects.filter(
            psc_profile__role=Role.PSC_SECRETARY,
            is_active=True,
        )
        title = f"Secretary Approval Required: {submission.reference_number}"
        body = (
            f"{submission.title} has completed assessment and is awaiting your approval "
            f"before being forwarded to the Commission."
        )

    elif target == WorkflowStage.FORWARDED_TO_COMMISSION:
        recipients = User.objects.filter(
            psc_profile__role__in=[
                Role.PSC_SECRETARY, Role.PSC_COMMISSIONER,
            ],
            is_active=True,
        )
        title = f"Ready for Commission: {submission.reference_number}"
        body = f"{submission.title} has been forwarded to the Commission."
        # Also notify ministry HR so they know their matter is being decided
        _ministry_hr = User.objects.filter(
            pk=submission.created_by_id, is_active=True,
        )
        for _u in _ministry_hr:
            NotificationModel.objects.create(
                recipient=_u,
                submission=submission,
                channel=NotificationModel.Channel.BOTH,
                title=f"Submitted to Commission: {submission.reference_number}",
                body=(
                    f"Your submission '{submission.title}' has been forwarded to the "
                    f"Public Service Commission and will be considered at an upcoming sitting."
                ),
            )

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
            "ipdu": Role.IPDU_MANAGER,
        }
        manager_role = unit_to_role.get(submission.routed_unit, Role.PSC_OFFICER)
        label = "approved" if target == WorkflowStage.APPROVED else "rejected"
        title = f"Submission {label}: {submission.reference_number}"
        body = f"'{submission.title}' has been {label} by the Commission."
        recipients = User.objects.filter(
            psc_profile__role__in=[manager_role, Role.PSC_MANAGER],
            is_active=True,
        ).union(
            User.objects.filter(pk=submission.created_by_id, is_active=True)
        )
        # Also notify the assigned principal who carried out the assessment
        if submission.assigned_to_id:
            _assigned = User.objects.filter(pk=submission.assigned_to_id, is_active=True)
            for _u in _assigned:
                NotificationModel.objects.create(
                    recipient=_u,
                    submission=submission,
                    channel=NotificationModel.Channel.BOTH,
                    title=title,
                    body=(
                        f"'{submission.title}' that you assessed has been {label} by the Commission."
                    ),
                )

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
        from .tasks import queue_transition_emails

        label = ""
        if target in (WorkflowStage.APPROVED, WorkflowStage.REJECTED):
            label = "approved" if target == WorkflowStage.APPROVED else "rejected"
        queue_transition_emails(
            submission.id, prev, target, [u.id for u in recipient_list],
            decision_label=label, remarks=remarks,
        )

    if target == WorkflowStage.SUBMITTED:
        from .tasks import queue_external_submission_confirmation_emails

        confirm_recipients = _dg_recipients_for_submission(submission) + _hr_recipients_for_submission(submission)
        queue_external_submission_confirmation_emails(
            submission.id, [u.id for u in confirm_recipients],
        )


# Stages counted as "active" by the dashboard quick-filter. Kept in sync with the
# ACTIVE_STAGES set in frontend/src/pages/psc/SubmissionLog.jsx and dashboard_stats_view.
_ACTIVE_DASHBOARD_STAGES = [
    "draft", "pending_dg_endorsement", "dg_approved",
    "pending_manager_approval", "pending_second_approval",
    "submitted", "received_by_psc", "registered_routed",
    "returned_for_clarification", "manager_checklist_review",
    "under_assessment", "pending_secretary_approval", "forwarded_to_commission",
    "commission_sitting", "secretary_review",
]

_SUBMISSION_ORDERING_WHITELIST = {
    "received_at", "-received_at", "reference_number", "-reference_number",
}


def _mark_required_form_checklist_present(child, *, actor):
    """If `child` is an attachment whose form type satisfies a required_form
    checklist item on its parent (e.g. PSC 2-2 on PSC 2-1, or a Corporate
    Plan copy on a Business Plan), and `child` is Approved, mark that item
    present. Called both when the attachment reaches Approved via a live
    transition, and when an already-Approved submission is linked as an
    attachment after the fact (see `link_as_attachment` action) — the
    checklist item should reflect reality either way, not just the live-
    transition case."""
    if not (child.is_attachment and child.parent_submission_id and child.form_type_code):
        return
    if child.current_stage != WorkflowStage.APPROVED:
        return

    from .models import RequiredDocument, SubmissionChecklistItem

    doc = RequiredDocument.objects.filter(
        form_type__code=child.parent_submission.form_type_code,
        required_form__code=child.form_type_code,
        is_active=True,
    ).first()
    if not doc:
        return
    item, _ = SubmissionChecklistItem.objects.get_or_create(
        submission=child.parent_submission, document=doc,
    )
    item.is_present = True
    item.checked_by = actor
    item.checked_at = timezone.now()
    item.notes = f"Auto-checked — {child.reference_number} approved."
    item.save(update_fields=["is_present", "checked_by", "checked_at", "notes"])


def _compute_type_grouped_sequence(meeting, category, form_type_code):
    """
    Compute the `sequence` for a new AgendaItem so that items of the same
    submission type (form_type_code) stay contiguous within `category`.

    Inserts the new item immediately after the last existing item of the
    same type in this category; if this is the first item of that type,
    appends it to the end of the category's block. Shifts the sequence of
    any items after the insertion point up by one to make room, so the
    caller only needs to create the new AgendaItem with the returned value.

    Runs inside a transaction so the shift and the new row are atomic.
    """
    with transaction.atomic():
        items = list(
            AgendaItem.objects.select_for_update()
            .filter(meeting=meeting, category=category)
            .order_by("sequence", "added_at")
        )
        if not items:
            return 1

        insert_after_index = None
        for idx, item in enumerate(items):
            if item.form_type_code == (form_type_code or ""):
                insert_after_index = idx

        if insert_after_index is None:
            return items[-1].sequence + 1

        insert_seq = items[insert_after_index].sequence + 1
        to_shift = [it for it in items[insert_after_index + 1:] if it.sequence >= insert_seq]
        for it in to_shift:
            it.sequence += 1
        if to_shift:
            AgendaItem.objects.bulk_update(to_shift, ["sequence"])

        return insert_seq


class SubmissionPagination(PageNumberPagination):
    """Lets the client choose the page size (the list view uses 15; the kanban
    view requests a large cap to group every matching card by stage)."""
    page_size = 15
    page_size_query_param = "page_size"
    max_page_size = 500


class SubmissionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    pagination_class = SubmissionPagination

    def get_throttles(self):
        if self.action == 'create':
            from .throttles import SubmissionCreateThrottle
            return [SubmissionCreateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = _submission_queryset_for(self.request.user)
        if self.action != 'list':
            return qs

        # ── List: attached submissions are nested under their parent ──────────
        qs = qs.filter(is_attachment=False)
        params = self.request.query_params

        stage = params.get('current_stage')
        if stage == '__all__':
            pass  # explicit "All statuses" — bypass the default narrowing below
        elif stage:
            qs = qs.filter(current_stage=stage)
        else:
            # Unit managers/principals/seniors are scoped to their whole unit's
            # queryset (routed_unit for ODU/HR/VIPAM, form_category for
            # Compliance — see _submission_queryset_for), which never shrinks —
            # a submission they've forwarded on (to the Secretary, Commission,
            # etc.) stays in that queryset forever and clutters their default
            # list. With no explicit stage requested, narrow to the stages
            # still actually in their court; everything else is still one
            # click away via the Stage filter's "All statuses" option.
            profile = _profile(self.request.user)
            _unit_scoped_roles = {
                Role.ODU_MANAGER, Role.ODU_PRINCIPAL, Role.ODU_SENIOR,
                Role.HR_UNIT_MANAGER, Role.HR_UNIT_PRINCIPAL, Role.HR_UNIT_SENIOR,
                Role.VIPAM_MANAGER, Role.VIPAM_PRINCIPAL, Role.VIPAM_SENIOR,
                Role.COMPLIANCE_MANAGER, Role.COMPLIANCE_PRINCIPAL, Role.COMPLIANCE_SENIOR,
            }
            if profile and profile.role in _unit_scoped_roles:
                qs = qs.filter(current_stage__in={
                    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
                    WorkflowStage.UNDER_ASSESSMENT,
                    WorkflowStage.DEFERRED_BACK_TO_HR,
                    WorkflowStage.DEFERRED_BACK_TO_UNIT,
                })

        ministry = params.get('ministry')
        if ministry:
            qs = qs.filter(ministry__name=ministry)

        unit = params.get('unit')
        if unit:
            qs = qs.filter(routed_unit=unit)

        # Scope to specific form types — used by the "attach to a parent
        # submission" picker (e.g. PSC 2-2 searching for its parent PSC 2-1 /
        # ORG-3.1 restructure) so results aren't polluted by unrelated types.
        form_type_codes = (params.get('form_type_code') or '').strip()
        if form_type_codes:
            codes = [c.strip() for c in form_type_codes.split(',') if c.strip()]
            if codes:
                qs = qs.filter(form_type_code__in=codes)

        # NL-search returns a set of submission ids to scope the list to.
        ids = params.get('ids')
        if ids is not None:
            id_list = [int(x) for x in ids.split(',') if x.strip().isdigit()]
            qs = qs.filter(id__in=id_list) if id_list else qs.none()

        search = (params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                models.Q(reference_number__icontains=search)
                | models.Q(title__icontains=search)
                | models.Q(ministry__name__icontains=search)
            )

        # Dashboard quick-filter — mirrors SubmissionLog.jsx and dashboard_stats_view.
        dashboard = params.get('dashboard')
        if dashboard and dashboard != 'all':
            now = timezone.now()
            if dashboard == 'active':
                qs = qs.filter(current_stage__in=_ACTIVE_DASHBOARD_STAGES)
            elif dashboard == 'this_week':
                qs = qs.filter(received_at__gte=now - timedelta(days=7))
            elif dashboard == 'this_month':
                qs = qs.filter(received_at__gte=now - timedelta(days=30))
            elif dashboard == 'overdue':
                # Matches Submission.is_assessment_overdue (models.py).
                qs = qs.filter(
                    current_stage=WorkflowStage.UNDER_ASSESSMENT,
                    assessment_deadline_at__lt=now,
                )

        ordering = params.get('ordering')
        return qs.order_by(
            ordering if ordering in _SUBMISSION_ORDERING_WHITELIST else '-received_at'
        )

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
        from .intake_routing import hr_intake_enabled, receptionist_intake_enabled
        from rest_framework.exceptions import ValidationError

        profile = _profile(self.request.user)
        validated = serializer.validated_data

        # ── Attachment submission (e.g. PSC Form 2-2 proposed on a PSC 2-1) ──────
        # Creation intent here is "attach a required form to a submission I can
        # already see" — independent of the creator's own role/unit, so this is
        # handled before (and instead of) the per-role branches below, which
        # assume the submission is a fresh, standalone submission of that role's
        # own type.
        if bool(self.request.data.get("is_attachment")):
            parent_id = self.request.data.get("parent_submission")
            if not parent_id:
                raise ValidationError({
                    "parent_submission": "parent_submission is required for an attachment submission.",
                })
            parent = _submission_queryset_for(self.request.user).filter(
                pk=parent_id, is_attachment=False,
            ).first()
            if not parent:
                raise ValidationError({
                    "parent_submission": "Parent submission not found or you don't have access to it.",
                })
            submission = serializer.save(
                current_stage=WorkflowStage.DRAFT,
                is_internal=False,
                is_attachment=True,
                parent_submission=parent,
                ministry_id=parent.ministry_id,
                department_id=parent.department_id,
                unit_id=parent.unit_id,
                routed_unit=parent.routed_unit,
                received_at=validated.get("received_at") or timezone.now(),
            )
            _log(self.request, _AL.Action.CREATE, resource_type="Submission",
                 resource_id=submission.id, resource_label=submission.reference_number,
                 description=f"Attachment submission created: {submission.title} "
                             f"(attached to {parent.reference_number})")
            invalidate_submission(parent.id)
            return

        if profile.role in {Role.MINISTRY_HR, Role.DEPT_ADMIN}:
            from .travel_forms import (
                assert_may_create_secretary_travel_form,
                is_travel_form_code,
                normalize_form_type_code,
                requires_approval_letter,
            )

            form_code = normalize_form_type_code(self.request.data.get("form_type_code"))
            if not is_travel_form_code(form_code) and not hr_intake_enabled():
                raise PermissionDenied(
                    "Direct ministry submission is currently disabled. Please deliver the signed "
                    "submission to the PSC registry — the Receptionist will lodge it on your behalf."
                )
            ministry_id = _resolve_submission_ministry_id(profile, self.request, validated)
            if not ministry_id:
                raise ValidationError({
                    "ministry": (
                        "Ministry is required. Your profile is not linked to a ministry — "
                        "contact PSC IT or select a ministry if lodging on behalf of a line ministry."
                    ),
                })
            if validated.get("notify_emails"):
                from .serializers import assert_notify_emails_match_ministry
                assert_notify_emails_match_ministry(ministry_id, validated["notify_emails"])
            kwargs = {
                "current_stage": WorkflowStage.DRAFT,
                "is_internal": False,
                "ministry_id": ministry_id,
            }
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
            if profile.department_id:
                kwargs["department_id"] = profile.department_id
            elif self.request.data.get("department"):
                kwargs["department_id"] = self.request.data.get("department")
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
            if not is_travel_form_code(form_code) and not hr_intake_enabled():
                raise PermissionDenied(
                    "Direct ministry submission is currently disabled. Please deliver the signed "
                    "submission to the PSC registry — the Receptionist will lodge it on your behalf."
                )
            ministry_id = _resolve_submission_ministry_id(profile, self.request, validated)
            if not ministry_id:
                raise ValidationError({"ministry": "Please select the ministry for this submission."})
            kwargs = {
                "current_stage": WorkflowStage.DRAFT,
                "is_internal": False,
                "ministry_id": ministry_id,
            }
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
            if profile.department_id:
                kwargs["department_id"] = profile.department_id
            elif self.request.data.get("department"):
                kwargs["department_id"] = self.request.data.get("department")
            submission = serializer.save(**kwargs)

        elif profile.role == Role.CSU_MANAGER:
            # OPSC CSU internal submission (e.g. appointment of OPSC staff) —
            # PSC-staff-only visible (is_internal=True), but still follows the
            # normal PSC route: responsible unit checklist, assessment, Secretary
            # approval gate, Commission. routed_unit is intentionally left unset
            # here so the existing form-type-based auto-routing (on entering
            # Manager Checklist Review) assigns the correct responsible unit,
            # exactly as it does for a ministry-origin submission.
            from .travel_forms import normalize_form_type_code
            from .intake_routing import routed_unit_for_form_type

            form_code = normalize_form_type_code(self.request.data.get("form_type_code") or "")
            if not form_code:
                raise ValidationError({"form_type_code": "Please select a form type."})
            # CSU Manager uses the same submission-type catalog as the HR Unit —
            # only the workflow differs (is_internal=True, PSC-staff-only visible).
            if routed_unit_for_form_type(form_code) != RoutedUnit.HR:
                raise ValidationError({
                    "form_type_code": "CSU Manager can only use HR Unit submission types."
                })
            org = _resolve_opsc_submission_org(profile)
            kwargs = {
                "current_stage": WorkflowStage.DRAFT,
                "is_internal": True,
                "follows_normal_route": True,
                "form_type_code": form_code,
                "ministry_id": org["ministry_id"],
                "department_id": org["department_id"],
                "unit_id": org.get("unit_id"),
            }
            submission = serializer.save(**kwargs)

        elif profile.role == Role.IPDU_MANAGER:
            # OPSC IPDU internal submission (Task Force / Allowance Payment
            # board paper) — is_internal=True, follows the normal PSC route
            # like CSU above (checklist review, assessment, Secretary gate,
            # Commission). Unlike CSU, IPDU has its own dedicated PSCFormType
            # catalog (routed_unit="ipdu" set directly on IPDU-TASKFORCE /
            # IPDU-ALLOWANCE), so no HR-catalog-reuse check is needed —
            # routed_unit is still left blank here and auto-derived on
            # submit, same mechanism CSU uses.
            from .travel_forms import normalize_form_type_code

            form_code = normalize_form_type_code(self.request.data.get("form_type_code") or "")
            if not form_code:
                raise ValidationError({"form_type_code": "Please select a form type."})
            org = _resolve_opsc_submission_org(profile)
            kwargs = {
                "current_stage": WorkflowStage.DRAFT,
                "is_internal": True,
                "follows_normal_route": True,
                "form_type_code": form_code,
                "ministry_id": org["ministry_id"],
                "department_id": org["department_id"],
                "unit_id": org.get("unit_id"),
            }
            submission = serializer.save(**kwargs)

        elif profile.role in {Role.VIPAM_PRINCIPAL, Role.VIPAM_SENIOR, Role.VIPAM_MANAGER}:
            # VIPAM internal submission — goes through approval chain before Secretary
            org = _resolve_opsc_submission_org(profile)
            kwargs = {
                "current_stage": WorkflowStage.DRAFT,
                "is_internal": True,
                "routed_unit": RoutedUnit.VIPAM,
                "ministry_id": org["ministry_id"],
                "department_id": org["department_id"],
                "unit_id": org.get("unit_id"),
            }
            submission = serializer.save(**kwargs)

        elif profile.role in {
            Role.COMPLIANCE_SENIOR,
            Role.COMPLIANCE_PRINCIPAL,
            Role.COMPLIANCE_MANAGER,
        }:
            # Compliance matters are created directly in SCDMS (OPSC-internal,
            # routed to the Compliance unit). Rich case data (subject, family,
            # statutory stages) is captured via the compliance case endpoint.
            from .compliance_forms import assert_compliance_may_use_form_type

            form_code = (self.request.data.get("form_type_code") or "").strip()
            assert_compliance_may_use_form_type(profile.role, form_code)
            org = _resolve_opsc_submission_org(profile)
            kwargs = {
                "current_stage": WorkflowStage.DRAFT,
                "is_internal": True,
                "routed_unit": RoutedUnit.COMPLIANCE,
                "ministry_id": org["ministry_id"],
                "department_id": org["department_id"],
                "unit_id": org.get("unit_id"),
            }
            submission = serializer.save(**kwargs)

        elif profile.role in {Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY, Role.RECEPTIONIST}:
            from .travel_forms import (
                assert_may_create_secretary_travel_form,
                is_travel_form_code,
                normalize_form_type_code,
                requires_approval_letter,
            )

            if profile.role == Role.RECEPTIONIST and not receptionist_intake_enabled():
                raise PermissionDenied(
                    "Receptionist intake is currently disabled. Contact a PSC administrator."
                )
            form_code = normalize_form_type_code(self.request.data.get("form_type_code") or "")
            ministry_id = _resolve_submission_ministry_id(profile, self.request, validated)
            if not ministry_id:
                raise ValidationError({"ministry": "Please select the ministry for this submission."})
            kwargs = {
                "current_stage": WorkflowStage.DRAFT,
                "is_internal": False,
                "ministry_id": ministry_id,
            }
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
            if self.request.data.get("department"):
                kwargs["department_id"] = self.request.data.get("department")
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
        _EDITOR_ROLES = {
            Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER,
            Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY, Role.CSU_MANAGER,
            # transitions.py's _DRAFT_ONLY_EDIT_ROLES has always included
            # IPDU_MANAGER alongside MINISTRY_HR/DEPT_ADMIN/CSU_MANAGER, but
            # this gate was never updated to match — IPDU managers could
            # never get past the role check below to reach that logic at all.
            Role.IPDU_MANAGER,
        }
        is_own_draft = (
            submission.created_by_id == self.request.user.id
            and submission.current_stage == WorkflowStage.DRAFT
        )
        if profile.role in _EDITOR_ROLES:
            from .transitions import assert_can_edit_submission
            assert_can_edit_submission(profile.role, submission)
        elif is_own_draft:
            # A draft's own creator may fix its title/type before submitting,
            # even without one of the roles above — but only those two
            # fields, not the full content-editing rights those roles get.
            allowed_fields = {"title", "form_type_code", "form_category"}
            extra = set(self.request.data.keys()) - allowed_fields
            if extra:
                raise PermissionDenied(
                    "You may only edit the title and submission type on your own draft."
                )
        else:
            raise PermissionDenied("Only PSC staff or Ministry users can edit submissions.")

        if "form_type_code" in serializer.validated_data:
            new_code = serializer.validated_data["form_type_code"]
            if new_code != submission.form_type_code and submission.current_stage != WorkflowStage.DRAFT:
                raise PermissionDenied("Submission type can only be changed while still in Draft.")

        submission = serializer.save()
        invalidate_submission(submission.id)
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
        """Move a submission to the trash bin (soft delete).

        Nothing is destroyed: the row is stamped deleted_at/by and hidden by
        the default manager; PSC Admin can restore it from Admin → Trash Bin.
        PSC Admin may trash anything; ministry-side roles may trash any draft
        in their own ministry/department; anyone may trash a draft they
        authored themselves, regardless of role.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        submission = self.get_object()
        profile = _profile(request.user)
        is_admin = profile.role == Role.PSC_ADMIN or request.user.is_staff or request.user.is_superuser
        is_own_draft = (
            submission.created_by_id == request.user.id
            and submission.current_stage == WorkflowStage.DRAFT
        )
        if not is_admin and not is_own_draft:
            if profile.role not in {Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY}:
                raise PermissionDenied("Only PSC Admin or the submitting ministry may delete submissions.")
            if submission.current_stage != WorkflowStage.DRAFT:
                raise PermissionDenied(
                    "A submission can only be deleted while it is a draft. "
                    "Ask the Secretariat if it must be withdrawn after submission."
                )

        reason = ""
        try:
            reason = (request.data.get("reason") or "").strip()
        except Exception:
            pass

        now = timezone.now()
        # Trash the submission together with its attached child submissions —
        # the same timestamp groups them for joint restore.
        ids = [submission.id] + list(
            submission.attached_submissions.values_list("id", flat=True)
        )
        Submission.all_objects.filter(id__in=ids).update(
            deleted_at=now, deleted_by=request.user, delete_reason=reason,
        )

        _log(request, _AL.Action.DELETE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Submission moved to trash: {submission.title}"
                         + (f" | {reason}" if reason else ""),
             extra_data={"trashed_ids": ids})

        invalidate_submission(submission.id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def retrieve(self, request, *args, **kwargs):
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        submission = self.get_object()
        self._submission_view_side_effects(request, submission)

        _log(request, _AL.Action.READ,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Submission viewed: {submission.title}")
        return Response(SubmissionDetailSerializer(submission, context={"request": request}).data)

    @action(detail=True, methods=["get", "put"], url_path="my-note")
    def my_note(self, request, pk=None):
        """The requesting user's own private prep note on this submission.

        Strictly personal — always scoped to request.user, both to read and
        to write, so there is no way for one Commission member to see
        another's notes (or for anyone else, PSC Admin included, to read
        them through this endpoint).
        """
        from .models import SubmissionPrivateNote

        submission = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_COMMISSIONER, Role.CHAIRPERSON, Role.PSC_ADMIN}:
            raise PermissionDenied("Private notes are only available to Commission members.")

        note, _ = SubmissionPrivateNote.objects.get_or_create(
            submission=submission, author=request.user,
        )
        if request.method == "PUT":
            serializer = SubmissionPrivateNoteSerializer(note, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(SubmissionPrivateNoteSerializer(note).data)

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

        # ── ODU restructure checklist must be Submitted before leaving Draft ────
        if prev == WorkflowStage.DRAFT:
            from .odu_checklist_rules import submission_uses_odu_restructure_checklist

            if submission_uses_odu_restructure_checklist(submission):
                checklist = getattr(submission, "odu_checklist", None)
                if checklist is None or checklist.status == ODUChecklistStatus.DRAFT:
                    return Response(
                        {
                            "detail": (
                                "Please complete and submit the ODU Restructure Submission "
                                "Checklist before submitting this submission."
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        # ── Rich-text remarks: sanitize, then derive the plain-text `remarks` ──
        # value that everything else in this view (blank-remarks guards, the
        # decision proof hash, email notifications, AI context) keeps reading
        # unchanged. `remarks_html` is stored purely for display.
        from .rich_text import extract_remarks_image_ids, html_to_plain_text, sanitize_remarks_html

        remarks_html = sanitize_remarks_html(ser.validated_data.get("remarks_html", ""))
        if remarks_html:
            remarks = html_to_plain_text(remarks_html)

        # ── Approval chain check (dynamic per-section config) ────────────────
        _chain_result = _chain_transition_allowed(submission, profile.role, target, user=request.user)
        if _chain_result is False:
            raise PermissionDenied(
                "This transition is not permitted by the submission's approval chain. "
                "Check the workflow configuration for this submission type."
            )
        elif _chain_result is None:
            # Chain doesn't apply — use standard transition rules
            assert_transition_allowed(
                role=profile.role,
                current_stage=prev,
                target_stage=target,
                # follows_normal_route submissions (e.g. CSU) stay is_internal=True
                # for visibility, but use the normal transition rules, not the
                # short internal-only path.
                is_internal=submission.is_internal and not submission.follows_normal_route,
                secretary_only=submission.secretary_only,
                remarks=remarks,
                form_type_code=submission.form_type_code or "",
            )
        # if _chain_result is True: chain explicitly allows — skip assert_transition_allowed

        # ── Intake route toggles: block submit/route via a disabled route ──────
        from .intake_routing import hr_intake_enabled, receptionist_intake_enabled

        if (
            profile.role in {Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY}
            and target in {WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.DG_APPROVED, WorkflowStage.SUBMITTED}
            and not submission.secretary_only
            and not hr_intake_enabled()
        ):
            raise PermissionDenied(
                "Direct ministry submission is currently disabled. Please deliver the signed "
                "submission to the PSC registry — the Receptionist will lodge it on your behalf."
            )
        if (
            profile.role == Role.RECEPTIONIST
            and target == WorkflowStage.MANAGER_CHECKLIST_REVIEW
            and not receptionist_intake_enabled()
        ):
            raise PermissionDenied(
                "Receptionist intake is currently disabled. Contact a PSC administrator."
            )

        # ── DG must explain why a submission is returned to HR ─────────────────
        if (
            prev == WorkflowStage.PENDING_DG_ENDORSEMENT
            and target == WorkflowStage.DRAFT
            and not (remarks or "").strip()
        ):
            return Response(
                {
                    "detail": (
                        "Please add a comment explaining why you are returning this "
                        "submission to HR."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Returning a submission for clarification requires a comment ────────
        # Any "return to the unit / originator" move must carry an explanation so
        # the recipient knows what to fix. Covers the Secretary returning an item
        # from the approval gate back to the assessing unit, and the generic
        # RETURNED_FOR_CLARIFICATION transitions used elsewhere in the workflow.
        _RETURN_TRANSITIONS = {
            (WorkflowStage.PENDING_SECRETARY_APPROVAL, WorkflowStage.UNDER_ASSESSMENT),
        }
        if (
            (
                target == WorkflowStage.RETURNED_FOR_CLARIFICATION
                or (prev, target) in _RETURN_TRANSITIONS
            )
            and not (remarks or "").strip()
        ):
            return Response(
                {
                    "detail": (
                        "Please add a comment explaining why you are returning this "
                        "submission to the unit."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Commission Sitting requires an actual agenda placement ─────────────
        # Only Meetings → Sitting Workspace (or the Agenda page) creates a real
        # AgendaItem tying the submission to a specific meeting. Without this
        # guard, this raw transition could flip the stage directly and the
        # submission would drop off the Sitting Workspace backlog (which filters
        # on current_stage=FORWARDED_TO_COMMISSION) without ever landing on a
        # real agenda — orphaned from the meeting it's supposedly sitting at.
        if (
            prev == WorkflowStage.FORWARDED_TO_COMMISSION
            and target == WorkflowStage.COMMISSION_SITTING
            and not submission.agenda_placements.exists()
        ):
            return Response(
                {
                    "detail": (
                        "This submission must be scheduled on a specific meeting's agenda "
                        "before it can move to Commission Sitting. Use Meetings → Sitting "
                        "Workspace (or the Agenda page) to place it on the agenda first."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Warn when a non-draft submission has no form type ─────────────────
        # Admins can override with acknowledge_no_form_type=true in the payload.
        if (
            prev == WorkflowStage.DRAFT
            and not submission.form_type_code
            and not submission.is_internal
            and not submission.secretary_only
            and not ser.validated_data.get("acknowledge_no_form_type")
        ):
            # Try to auto-resolve from the agenda section's digitized form
            _resolved_code = None
            if submission.agenda_category:
                try:
                    from .models import AgendaSection
                    _sec = AgendaSection.objects.filter(
                        code=submission.agenda_category
                    ).select_related("digitized_form").first()
                    if _sec and _sec.digitized_form:
                        _resolved_code = _sec.digitized_form.code
                except Exception:
                    pass

            if _resolved_code:
                # Auto-fill silently and continue — no blocking error
                submission.form_type_code = _resolved_code
            else:
                return Response(
                    {
                        "detail": (
                            "This submission has no form type selected. "
                            "Please set the form type before submitting, or re-submit with "
                            "acknowledge_no_form_type=true to proceed without one."
                        ),
                        "no_form_type": True,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
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
        # Exempts prev == DRAFT: CSU Manager and Manager IPDU are the roles here
        # that also author their own submissions (_CSU_MANAGER_ALLOWED /
        # _IPDU_MANAGER_ALLOWED permit DRAFT → SUBMITTED) — at DRAFT, routed_unit
        # is always still blank by design (it's set once the submission enters
        # Manager Checklist Review), so this gate would otherwise block them from
        # ever submitting their own internal draft. Unlike CSU, Manager IPDU
        # *does* keep acting after DRAFT (checklist review, assessment — no
        # separate principal tier), so this check runs for real for them at
        # those later stages and must resolve to "ipdu" correctly. The other
        # unit-manager roles never hold a DRAFT submission themselves (not in
        # any DRAFT-stage allowed-transition table), so this exemption doesn't
        # loosen anything for them.
        _unit_role_to_routed = {
            Role.ODU_MANAGER: "odu",
            Role.VIPAM_MANAGER: "vipam",
            Role.HR_UNIT_MANAGER: "hr",
            Role.COMPLIANCE_MANAGER: "compliance",
            Role.CSU_MANAGER: "csu",
            Role.IPDU_MANAGER: "ipdu",
        }
        if profile.role in _unit_role_to_routed and prev != WorkflowStage.DRAFT:
            expected = _unit_role_to_routed[profile.role]
            if submission.routed_unit != expected:
                raise PermissionDenied(
                    f"This submission is routed to {submission.routed_unit}, "
                    f"not your unit ({expected})."
                )

        # ── Unit managers must wait for the assigned principal's hand-back ──
        # If the manager has allocated this submission to a principal/senior
        # officer (assigned_to set), advancing the stage themselves before that
        # person has finished their review/assessment — signalled by
        # ready_for_manager_at via the "Submit to Manager" action — would
        # pre-empt the person actually doing the work. Mirrors the disabled
        # action buttons in WorkflowActionsPanel on the frontend.
        if (
            profile.role in OPSC_UNIT_MANAGER_ROLES
            and prev in (WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT)
            and submission.assigned_to_id
            and not submission.ready_for_manager_at
        ):
            return Response(
                {
                    "detail": (
                        "This submission is allocated to a principal whose review isn't "
                        "complete yet. Wait for them to submit it back to you before "
                        "advancing the stage."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Unit principals can only transition submissions assigned to them ──
        _unit_principal_to_routed = {
            Role.ODU_PRINCIPAL: "odu",
            Role.VIPAM_PRINCIPAL: "vipam",
            Role.HR_UNIT_PRINCIPAL: "hr",
            Role.COMPLIANCE_PRINCIPAL: "compliance",
            Role.ODU_SENIOR: "odu",
            Role.VIPAM_SENIOR: "vipam",
            Role.HR_UNIT_SENIOR: "hr",
        }
        # Self-created internal submissions (VIPAM/Compliance Principal or
        # Senior authoring and submitting their own COMP-*/VIPAM draft) were
        # never routed to them via unit-manager allocation, so there's no
        # assigned_to to check — this gate only applies to ministry-routed
        # cases a unit principal reviews.
        if profile.role in _unit_principal_to_routed and not submission.is_internal:
            expected_unit = _unit_principal_to_routed[profile.role]
            if submission.routed_unit != expected_unit:
                raise PermissionDenied(
                    f"This submission is routed to {submission.routed_unit}, not your unit ({expected_unit})."
                )
            is_primary    = submission.assigned_to_id == request.user.id
            is_co_assigned = submission.co_assignments.filter(principal=request.user).exists()
            if not is_primary and not is_co_assigned:
                raise PermissionDenied(
                    "This submission has not been assigned to you. "
                    "Contact your unit manager to be assigned as primary or co-analyst."
                )

        if (
            submission.secretary_only
            and prev == WorkflowStage.DRAFT
            and target == WorkflowStage.SUBMITTED
        ):
            target = WorkflowStage.SECRETARY_REVIEW

        # ── A3: pre-submit package validation (draft → submitted) ───────────────
        from .ai_settings import package_validation_enabled

        if (
            prev in {WorkflowStage.DRAFT, WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.DG_APPROVED}
            and target in {WorkflowStage.SUBMITTED, WorkflowStage.SECRETARY_REVIEW}
            and not acknowledge_gaps
            and not submission.secretary_only
            and package_validation_enabled()
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
            # Guarantee checklist rows exist for the submission's current required
            # documents before counting — a submission the ministry never opened
            # in the browser (e.g. created via API) would otherwise have zero
            # SubmissionChecklistItem rows and silently skip this gate.
            from .submission_checklist import ensure_submission_checklist_items

            ensure_submission_checklist_items(submission)
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

        # ── Manager Checklist Review → Submit to Secretary: require every
        # required document present, not just ones tagged mandatory_for_stage
        # exactly "manager_checklist_review" ──
        # The mandatory-doc items for a submission are tagged
        # mandatory_for_stage="draft" (they block ministry HR from submitting
        # an incomplete package in the first place — see the gate above), so
        # the generic check just
        # above is a no-op by the time a submission reaches this stage. This is
        # the Manager's own re-verification gate, backing the disabled "Submit
        # to Secretary" button in the UI: every checklist item that's actually
        # required (mandatory_for_stage set, i.e. not one of the
        # informational-only items) must be marked present before the Manager
        # can forward it — regardless of which specific stage it's tagged for.
        if (
            prev == WorkflowStage.MANAGER_CHECKLIST_REVIEW
            and target not in _allowed_targets_with_gaps
            and not submission.secretary_only
        ):
            unchecked_required = submission.checklist_items.exclude(
                document__mandatory_for_stage__in=["", None]
            ).filter(
                is_present=False,
                document__is_active=True,
            ).count()
            if unchecked_required > 0:
                return Response(
                    {"detail": f"Cannot submit to Secretary: {unchecked_required} required document(s) are not yet marked present. Complete the checklist first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ── Matters Arising must have a resolution note ──
        if prev == WorkflowStage.MATTERS_ARISING and not (remarks or "").strip():
            return Response(
                {"detail": "A resolution note is required when advancing a submission from Matters Arising. Please add remarks explaining the resolution."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .decision_proof import create_decision_proof, is_decision_stage

        proof_hash = ""
        proof_payload = {}

        with transaction.atomic():
            # Leaving checklist review/assessment via a real stage transition
            # means the manager has acted on the hand-back — clear the flag so
            # it doesn't linger into the next stage.
            if prev in (WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT) and submission.ready_for_manager_at:
                submission.ready_for_manager_at = None

            submission.current_stage = target

            # ── Attachment form approved: mark it present on the parent's checklist ──
            # e.g. PSC Form 2-2 reaching Approved satisfies the "PSC Form 2-2" required
            # item on its parent PSC Form 2-1, which the mandatory-checklist gate above
            # already enforces before the parent can leave Manager Checklist Review.
            if target == WorkflowStage.APPROVED and submission.is_attachment:
                _mark_required_form_checklist_present(submission, actor=request.user)

            # ── Auto-route to the responsible unit when entering checklist review ──
            # Covers both the Receptionist intake path (DRAFT → checklist review)
            # and the ministry HR → DG → PSC path (SUBMITTED → checklist review):
            # whenever a submission enters Manager Checklist Review without a unit,
            # derive it from the form type so the unit Manager/Principals (and the
            # ODU restructure checklist) can pick it up.
            if (
                target == WorkflowStage.MANAGER_CHECKLIST_REVIEW
                and not submission.routed_unit
            ):
                from .intake_routing import routed_unit_for_form_type

                routed = routed_unit_for_form_type(submission.form_type_code)
                if routed:
                    submission.routed_unit = routed

            # ── DG (Head of Agency) endorsement: stamp endorser when DG approves ──
            if prev == WorkflowStage.PENDING_DG_ENDORSEMENT and target == WorkflowStage.DG_APPROVED:
                submission.dg_endorsed_by = request.user
                submission.dg_endorsed_at = timezone.now()

            # ── On first submission to PSC: auto-assign scheduled_meeting based on cutoff ──
            if (
                prev in {WorkflowStage.DRAFT, WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.DG_APPROVED}
                and target == WorkflowStage.SUBMITTED
                and not submission.secretary_only
            ):
                self._assign_scheduled_meeting(submission)
                self._notify_if_late_carryover(submission, request.user)

            # ── On HR responding to deferral: route to manager queue ──
            if prev == WorkflowStage.DEFERRED_BACK_TO_HR and target == WorkflowStage.SUBMITTED:
                submission.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW

            # ── Start assessment timer when entering UNDER_ASSESSMENT ──
            if target == WorkflowStage.UNDER_ASSESSMENT:
                if submission.assessment_started_at is None:
                    submission.assessment_started_at = timezone.now()
                submission._set_assessment_deadline_from_start()
                # Safety net: if deadline is still null (e.g. holiday table issue),
                # fall back to 30 calendar days so the submission is never untracked.
                if submission.assessment_deadline_at is None:
                    import logging as _log_mod
                    from datetime import timedelta
                    submission.assessment_deadline_at = timezone.now() + timedelta(days=30)
                    _log_mod.getLogger("scdms.app").warning(
                        "DEADLINE_FALLBACK | Submission %s | assessment_deadline_at was null "
                        "after _set_assessment_deadline_from_start(); using 30-day calendar fallback.",
                        submission.reference_number,
                    )

            # ── Start checklist review timer when entering MANAGER_CHECKLIST_REVIEW ──
            if target == WorkflowStage.MANAGER_CHECKLIST_REVIEW and submission.checklist_review_started_at is None:
                submission.checklist_review_started_at = timezone.now()
                submission._set_checklist_review_deadline_from_start()

            # ── Stamp recall metadata ──
            if target == WorkflowStage.RECALLED:
                submission.recalled_at = timezone.now()
                submission.recalled_by = request.user
                submission.recalled_reason = remarks

            # ── Defer to next meeting: carry onto the next sitting's Matters Arising ──
            if prev == WorkflowStage.COMMISSION_SITTING and target == WorkflowStage.MATTERS_ARISING:
                self._carry_to_matters_arising(submission, actor=request.user, reason=remarks)

            # ── Record other deferral types in the Deferred Agenda register ──────
            from .deferral_tracking import record_deferral, resolve_open_deferrals
            from .models import DeferralType

            _DEFER_TARGET_TO_TYPE = {
                WorkflowStage.DEFERRED_BACK_TO_UNIT: DeferralType.BACK_TO_UNIT,
                WorkflowStage.DEFERRED_BACK_TO_HR:   DeferralType.BACK_TO_HR,
                WorkflowStage.DEFERRED:              DeferralType.ON_HOLD,
            }
            if target in _DEFER_TARGET_TO_TYPE:
                _source_item = (
                    submission.agenda_placements.select_related("meeting")
                    .order_by("-meeting__date", "-added_at")
                    .first()
                )
                record_deferral(
                    submission,
                    deferral_type=_DEFER_TARGET_TO_TYPE[target],
                    deferred_by=request.user,
                    from_meeting=_source_item.meeting if _source_item else None,
                    agenda_item=_source_item,
                    reason=remarks,
                )

            # ── Resolve open deferrals once the item reaches a concluding decision ──
            if target in {
                WorkflowStage.APPROVED, WorkflowStage.REJECTED,
                WorkflowStage.NOTED, WorkflowStage.NOT_APPROVED,
            }:
                resolve_open_deferrals(submission)

            submission.save(update_fields=_updated_fields(submission, prev, target))

            # ── Secretary approval: auto-place directly onto the correct agenda ──
            if target == WorkflowStage.FORWARDED_TO_COMMISSION:
                self._auto_place_on_agenda(submission)

            if is_decision_stage(target):
                proof_hash, proof_payload = create_decision_proof(
                    submission=submission,
                    previous_stage=prev,
                    new_stage=target,
                    actor=request.user,
                    remarks=remarks,
                )

            _event = WorkflowEvent.objects.create(
                submission=submission,
                actor=request.user,
                previous_stage=prev,
                new_stage=target,
                remarks=remarks,
                remarks_html=remarks_html,
                content_hash=proof_hash,
                proof_payload=proof_payload,
            )
            _image_ids = extract_remarks_image_ids(remarks_html)
            if _image_ids:
                RemarksImage.objects.filter(
                    submission=submission, id__in=_image_ids, workflow_event__isnull=True,
                ).update(workflow_event=_event)

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

        # Must run BEFORE the notification dispatch below (same reasoning as
        # endorse()'s identical ordering): _resolve_receiver_roles() reads
        # submission.routed_unit to pick the right unit's manager, and a plain
        # SUBMITTED transition through this generic action (e.g. a CSU Manager
        # submitting their own internal draft) doesn't set routed_unit until
        # this call runs — dispatching notifications first silently fell back
        # to PSC_OFFICER instead of the actual responsible unit's manager.
        self._auto_advance_submitted_to_checklist_review(submission)

        # ── Fire notifications after commit ──
        transaction.on_commit(
            lambda: _dispatch_transition_notifications(
                submission, prev, target, request.user, remarks
            )
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

        invalidate_submission(submission.id)
        return Response(SubmissionDetailSerializer(submission).data)

    @action(detail=True, methods=["post"], url_path="endorse")
    def endorse(self, request, pk=None):
        """DG endorsement — Option A: atomically chains PENDING_DG_ENDORSEMENT
        → DG_APPROVED (stamps dg_endorsed_by/at) → SUBMITTED in one transaction.
        HR never has to click "Submit to PSC" after the DG endorses."""
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        submission = self.get_object()
        profile = _profile(request.user)

        if submission.current_stage != WorkflowStage.PENDING_DG_ENDORSEMENT:
            return Response(
                {"detail": "Endorsement is only available when the submission is awaiting DG endorsement."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_roles = {Role.HEAD_OF_AGENCY}
        if profile.role not in allowed_roles and not request.user.is_staff and not request.user.is_superuser:
            raise PermissionDenied(
                "Only the Director-General (Head of Agency) may endorse this submission."
            )

        prev = WorkflowStage.PENDING_DG_ENDORSEMENT
        now = timezone.now()

        with transaction.atomic():
            # Step 1: record DG approval and stamp endorser
            submission.current_stage = WorkflowStage.DG_APPROVED
            submission.dg_endorsed_by = request.user
            submission.dg_endorsed_at = now
            submission.save(update_fields=["current_stage", "dg_endorsed_by", "dg_endorsed_at", "updated_at"])
            WorkflowEvent.objects.create(
                submission=submission,
                actor=request.user,
                previous_stage=prev,
                new_stage=WorkflowStage.DG_APPROVED,
                remarks="Endorsed by DG — forwarding directly to PSC.",
            )

            # Step 2: auto-forward to SUBMITTED (skip HR "submit to PSC" click)
            self._assign_scheduled_meeting(submission)
            submission.current_stage = WorkflowStage.SUBMITTED
            submission.save(update_fields=["current_stage", "scheduled_meeting_id", "updated_at"])
            WorkflowEvent.objects.create(
                submission=submission,
                actor=request.user,
                previous_stage=WorkflowStage.DG_APPROVED,
                new_stage=WorkflowStage.SUBMITTED,
                remarks="Automatically submitted to PSC following DG endorsement.",
            )

        _log(
            request,
            _AL.Action.UPDATE,
            resource_type="Submission",
            resource_id=submission.id,
            resource_label=submission.reference_number,
            description=f"DG endorsed and auto-submitted to PSC: {submission.title}",
        )

        # transition() already does this after every transition (line 1837) —
        # endorse() is a separate code path (auto-chains straight to SUBMITTED)
        # and was missing it, so DG-endorsed submissions never left SUBMITTED /
        # never got a routed_unit until someone manually registered & routed them.
        # Must run BEFORE the notification dispatch below: _resolve_receiver_roles()
        # reads submission.routed_unit to pick the right unit's manager, and this
        # is what sets it — dispatching first silently fell back to PSC_OFFICER.
        self._auto_advance_submitted_to_checklist_review(submission)

        try:
            _dispatch_transition_notifications(
                submission, WorkflowStage.DG_APPROVED, WorkflowStage.SUBMITTED, request.user,
            )
        except Exception:
            pass

        invalidate_submission(submission.id)
        return Response(
            SubmissionDetailSerializer(submission, context={"request": request}).data
        )

    @action(detail=True, methods=["post"], url_path="validate-package")
    def validate_package(self, request, pk=None):
        """A3 — queue pre-submit package validation (Haiku, async)."""
        from .tasks import queue_submission_package_validation

        submission = self.get_object()
        profile = _profile(request.user)

        from .ai_settings import package_validation_enabled

        if not package_validation_enabled():
            return Response(
                {"detail": "AI package validation is currently disabled by the administrator."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _submit_roles = {
            Role.MINISTRY_HR,
            Role.DEPT_ADMIN,
            Role.HEAD_OF_AGENCY,
            Role.PSC_OFFICER,
            Role.PSC_ADMIN,
            Role.PSC_SECRETARY,
            Role.SENIOR_ADMIN_OFFICER,
            Role.CSU_MANAGER,
            Role.VIPAM_PRINCIPAL,
            Role.VIPAM_SENIOR,
            Role.COMPLIANCE_MANAGER,
            Role.COMPLIANCE_SENIOR,
            Role.COMPLIANCE_PRINCIPAL,
        }
        if profile.role not in _submit_roles and not request.user.is_staff:
            raise PermissionDenied("You do not have permission to validate this submission package.")

        if submission.current_stage not in {
            WorkflowStage.DRAFT,
            WorkflowStage.PENDING_DG_ENDORSEMENT,
            WorkflowStage.DG_APPROVED,
        }:
            return Response(
                {
                    "detail": (
                        "Package validation is only available while the submission is in "
                        "Draft, pending DG endorsement, or pending HR submission to PSC."
                    )
                },
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
        from .rbac import rbac_user_can_regenerate_ai_brief

        submission = self.get_object()

        if not rbac_user_can_regenerate_ai_brief(request.user):
            raise PermissionDenied(
                "Only users with the Regenerate AI Brief permission can request an executive brief."
            )

        submission.ai_brief_processed = False
        submission.ai_brief_summary = ""
        submission.save(update_fields=["ai_brief_processed", "ai_brief_summary", "updated_at"])
        queue_submission_brief(submission.id, force=True, sync_fallback=False)
        return Response(SubmissionDetailSerializer(submission).data)

    @action(detail=True, methods=["get"], url_path="assignable-officers")
    def assignable_officers(self, request, pk=None):
        """List officers the current unit manager may allocate this submission to."""
        from django.contrib.auth.models import User

        submission = self.get_object()
        profile = _profile(request.user)
        is_admin = profile.role == Role.PSC_ADMIN or request.user.is_superuser or request.user.is_staff
        is_unit_manager = profile.role in OPSC_UNIT_MANAGER_ROLES
        if not (is_admin or is_unit_manager):
            raise PermissionDenied("Only unit managers can allocate submissions.")
        if submission.current_stage not in (
            WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT,
        ):
            raise PermissionDenied("Allocation is only available while a submission is under assessment.")

        allowed_roles = manager_allowed_staff_roles(
            profile.role if is_unit_manager else None
        )
        officers_qs = User.objects.filter(
            is_active=True,
            psc_profile__role__in=allowed_roles,
        )
        # Some staff roles (e.g. Senior Officer) are shared across multiple OPSC
        # units, so role alone doesn't guarantee the candidate is in *this*
        # manager's unit — also require a matching Profile.unit.
        if is_unit_manager and profile.unit_id:
            officers_qs = officers_qs.filter(psc_profile__unit_id=profile.unit_id)
        officers = list(
            officers_qs.select_related("psc_profile").order_by("first_name", "username")
        )

        # Surface each candidate's current load so the allocation decision is
        # made with the numbers in view; lightest plate first.
        from .reports.workload import officer_load_index
        loads = officer_load_index(user_ids={u.id for u in officers})

        data = [
            {
                "id": u.id,
                "full_name": (u.get_full_name() or u.username),
                "username": u.username,
                "role": getattr(u.psc_profile, "role", ""),
                "active_count": loads.get(u.id, {}).get("active_count", 0),
                "co_assigned_count": loads.get(u.id, {}).get("co_assigned_count", 0),
                "weighted_load": loads.get(u.id, {}).get("weighted_load", 0.0),
                "open_tasks": loads.get(u.id, {}).get("open_tasks", 0),
                "overdue_tasks": loads.get(u.id, {}).get("overdue_tasks", 0),
            }
            for u in officers
        ]
        data.sort(key=lambda o: (o["weighted_load"], o["active_count"], o["full_name"]))
        return Response(data)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """
        Unit manager assigns a submission to one of their unit's principals.
        POST { "assigned_to": <user_id> }  — pass null to unassign.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL, Notification
        from django.contrib.auth.models import User

        submission = self.get_object()
        profile = _profile(request.user)

        _manager_to_unit = MANAGER_ROLE_TO_ROUTED_UNIT
        is_admin = profile.role == Role.PSC_ADMIN or request.user.is_superuser or request.user.is_staff
        is_unit_manager = profile.role in OPSC_UNIT_MANAGER_ROLES

        if not (is_admin or is_unit_manager):
            raise PermissionDenied("Only unit managers can assign submissions to principals.")
        if submission.current_stage not in (
            WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT,
        ):
            raise PermissionDenied("Allocation is only available while a submission is under assessment.")

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
            submission.ready_for_manager_at = None
            submission.save(update_fields=["assigned_to", "assigned_at", "ready_for_manager_at"])
            invalidate_submission(submission.id)
            _log(request, _AL.Action.UPDATE, resource_type="Submission",
                 resource_id=submission.id, resource_label=submission.reference_number,
                 description="Submission unassigned from principal")
            return Response(SubmissionDetailSerializer(submission).data)

        try:
            assignee = User.objects.get(pk=assignee_id, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found or inactive."}, status=status.HTTP_400_BAD_REQUEST)

        # Verify the assignee is an allowed officer in the manager's unit
        assignee_profile = getattr(assignee, "psc_profile", None)
        if assignee_profile is None:
            return Response({"detail": "That user has no PSC profile."}, status=status.HTTP_400_BAD_REQUEST)

        if is_unit_manager:
            allowed_roles = manager_allowed_staff_roles(profile.role)
            if assignee_profile.role not in allowed_roles:
                return Response(
                    {"detail": "Assignee must be one of your unit's principals or senior officers."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Roles like Senior Officer are shared across units — role alone
            # doesn't prove unit membership, so also require a matching unit.
            if profile.unit_id and assignee_profile.unit_id != profile.unit_id:
                return Response(
                    {"detail": "Assignee must belong to your own OPSC unit."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        submission.assigned_to = assignee
        submission.assigned_at = timezone.now()
        submission.ready_for_manager_at = None
        submission.save(update_fields=["assigned_to", "assigned_at", "ready_for_manager_at"])
        invalidate_submission(submission.id)

        _log(request, _AL.Action.UPDATE, resource_type="Submission",
             resource_id=submission.id, resource_label=submission.reference_number,
             description=f"Submission assigned to {assignee.username}")

        # ── Notify the assignee (in-app + desktop alert + email) ──────────────
        manager_name = request.user.get_full_name() or request.user.username
        Notification.objects.create(
            recipient=assignee,
            submission=submission,
            channel=Notification.Channel.BOTH,
            title=f"Assigned to you: {submission.reference_number}",
            body=(
                f"{manager_name} has allocated '{submission.title}' to you for assessment."
            ),
        )
        from .tasks import queue_assignment_email

        queue_assignment_email(submission.id, assignee.id, manager_name=manager_name)

        return Response(SubmissionDetailSerializer(submission).data)

    @action(detail=True, methods=["post"], url_path="co-assign")
    def co_assign(self, request, pk=None):
        """
        POST /submissions/{id}/co-assign/
        Add or remove a secondary analyst co-assignment.

        Payload:
          { "user_id": <int>, "action": "add"|"remove", "role": "secondary"|"specialist", "notes": "" }
        """
        from .models import AuditLog as _AL, SubmissionCoAssignment, Notification
        from django.contrib.auth.models import User
        from .audit import log_action as _log

        submission = self.get_object()
        profile = _profile(request.user)

        is_admin = profile.role == Role.PSC_ADMIN or request.user.is_superuser
        is_unit_manager = profile.role in OPSC_UNIT_MANAGER_ROLES

        if not (is_admin or is_unit_manager):
            raise PermissionDenied("Only unit managers can manage co-assignments.")

        if is_unit_manager:
            expected_unit = MANAGER_ROLE_TO_ROUTED_UNIT.get(profile.role)
            if expected_unit and submission.routed_unit != expected_unit:
                raise PermissionDenied(
                    f"This submission is routed to {submission.routed_unit}, not your unit."
                )

        user_id    = request.data.get("user_id")
        action_    = request.data.get("action", "add")
        role_      = request.data.get("role", "secondary")
        notes      = request.data.get("notes", "")

        if not user_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            principal = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found or inactive."}, status=status.HTTP_400_BAD_REQUEST)

        if action_ == "remove":
            SubmissionCoAssignment.objects.filter(submission=submission, principal=principal).delete()
            _log(request, _AL.Action.UPDATE, resource_type="Submission",
                 resource_id=submission.id, resource_label=submission.reference_number,
                 description=f"Co-assignment removed for {principal.username}")
            invalidate_submission(submission.id)
            return Response(SubmissionDetailSerializer(submission).data)

        # Verify eligibility
        p_profile = getattr(principal, "psc_profile", None)
        if p_profile is None:
            return Response({"detail": "User has no PSC profile."}, status=status.HTTP_400_BAD_REQUEST)

        if is_unit_manager:
            allowed_roles = manager_allowed_staff_roles(profile.role)
            if p_profile.role not in allowed_roles:
                return Response(
                    {"detail": "Co-assignee must be one of your unit's principals or senior officers."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Cannot co-assign the same person as the primary assignee
        if submission.assigned_to_id == principal.id:
            return Response(
                {"detail": "This analyst is already the primary assignee."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        co, created = SubmissionCoAssignment.objects.update_or_create(
            submission=submission,
            principal=principal,
            defaults={"role": role_, "assigned_by": request.user, "notes": notes},
        )

        if created:
            manager_name = request.user.get_full_name() or request.user.username
            Notification.objects.create(
                recipient=principal,
                submission=submission,
                channel=Notification.Channel.BOTH,
                title=f"Co-assigned to you: {submission.reference_number}",
                body=(
                    f"{manager_name} has added you as a {role_} analyst on "
                    f"'{submission.title}'."
                ),
            )

        _log(request, _AL.Action.UPDATE, resource_type="Submission",
             resource_id=submission.id, resource_label=submission.reference_number,
             description=f"Co-assignment {'added' if created else 'updated'} for {principal.username}")

        invalidate_submission(submission.id)
        return Response(SubmissionDetailSerializer(submission).data)

    @action(detail=True, methods=["post"], url_path="submit-to-manager")
    def submit_to_manager(self, request, pk=None):
        """
        The assigned principal/senior officer hands their completed checklist
        review or assessment back to their unit manager — one action, mirroring
        the paper process (the principal sends the whole submission, checklist
        included, back to their manager; they don't submit the checklist to the
        manager separately). Only the manager can advance the workflow stage
        from here — this action doesn't move the stage itself, it just finalizes
        the checklist, flags the work ready, and notifies the manager.

        At Under Assessment, the officer's written assessment is the actual
        deliverable the manager is verifying — a PDF attachment is required.
        At Manager Checklist Review the deliverable is the checklist itself.
        Two different checklist systems exist: the ODU Restructure Submission
        Checklist (ORG-3.1/PSC 2-1 — real Yes/No judgment calls the principal
        must actually make, so an incomplete one blocks hand-back rather than
        being silently finalized) and the dynamic structured checklist used
        by every other ODU/HR/VIPAM/Compliance form type with a checklist
        configured (finalized here — Draft/Returned -> Submitted — as part of
        the hand-back, since there's no separate judgment call left to make).
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL, Notification, SubmissionDocument
        from django.contrib.auth.models import User

        submission = self.get_object()
        profile = _profile(request.user)

        is_admin = profile.role == Role.PSC_ADMIN or request.user.is_superuser
        if not is_admin and submission.assigned_to_id != request.user.id:
            raise PermissionDenied("Only the assigned principal/senior officer can submit this back to their manager.")
        if submission.current_stage not in (
            WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT,
        ):
            raise PermissionDenied("This can only be done during checklist review or assessment.")

        if submission.current_stage == WorkflowStage.MANAGER_CHECKLIST_REVIEW:
            from .odu_checklist_rules import (
                odu_checklist_principal_review_complete,
                submission_uses_odu_restructure_checklist,
            )

            if submission_uses_odu_restructure_checklist(submission):
                # Groups 6-7 are real judgment calls the principal makes while
                # reviewing — nothing to auto-finalize, so an incomplete
                # checklist blocks hand-back instead (unlike the dynamic
                # checklist branch below).
                from .models import ODURestructureChecklist

                odu_checklist = ODURestructureChecklist.objects.filter(submission=submission).first()
                if not odu_checklist_principal_review_complete(odu_checklist):
                    return Response(
                        {"detail": "Complete Groups 6-7 of the ODU checklist (your own review items) "
                                   "before handing this back to your manager."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                # Finalize the structured checklist as part of the same hand-back
                # (see the docstring above). Approved checklists are left
                # untouched, and submissions whose form type has no checklist
                # configured are a no-op.
                from .models import SubmissionChecklistResponse
                from .submission_checklist import resolve_checklist_form_type

                checklist_ft = resolve_checklist_form_type(submission)
                if checklist_ft:
                    checklist, _created = SubmissionChecklistResponse.objects.get_or_create(
                        submission=submission, checklist_form_type=checklist_ft,
                        defaults={"created_by": request.user, "data": {}},
                    )
                    if checklist.status in (
                        SubmissionChecklistResponse.Status.DRAFT,
                        SubmissionChecklistResponse.Status.RETURNED,
                    ):
                        checklist.status = SubmissionChecklistResponse.Status.SUBMITTED
                        checklist.submitted_at = timezone.now()
                        checklist.save(update_fields=["status", "submitted_at", "updated_at"])

        uploaded = request.FILES.get("file")
        if submission.current_stage == WorkflowStage.UNDER_ASSESSMENT:
            if not uploaded:
                return Response(
                    {"detail": "Please attach your assessment (PDF) before submitting to your manager."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not uploaded.name.lower().endswith(".pdf"):
                return Response(
                    {"detail": "Assessment must be a PDF file."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if uploaded:
            doc = SubmissionDocument.objects.create(
                submission=submission,
                file=uploaded,
                original_name=uploaded.name,
                description=f"Assessment — submitted by {request.user.get_full_name() or request.user.username}",
                uploaded_by=request.user,
            )
            from .tasks import queue_document_classification, queue_document_extraction

            queue_document_extraction(doc.id)
            queue_document_classification(doc.id)

        submission.ready_for_manager_at = timezone.now()
        submission.save(update_fields=["ready_for_manager_at"])
        invalidate_submission(submission.id)

        _log(request, _AL.Action.UPDATE, resource_type="Submission",
             resource_id=submission.id, resource_label=submission.reference_number,
             description=f"Submitted back to unit manager by {request.user.username}")

        # ── Notify the unit's manager(s) (in-app + email) ──────────────────────
        unit_manager_role = {v: k for k, v in MANAGER_ROLE_TO_ROUTED_UNIT.items()}.get(submission.routed_unit)
        managers = []
        if unit_manager_role:
            qs = User.objects.filter(
                is_active=True, psc_profile__role=unit_manager_role,
            ).select_related("psc_profile")
            if profile.unit_id:
                qs = qs.filter(psc_profile__unit_id=profile.unit_id)
            managers = list(qs)

        assignee_name = request.user.get_full_name() or request.user.username
        for manager in managers:
            Notification.objects.create(
                recipient=manager,
                submission=submission,
                channel=Notification.Channel.BOTH,
                title=f"Ready for your review: {submission.reference_number}",
                body=(
                    f"{assignee_name} has submitted '{submission.title}' back to you "
                    f"after completing their {'checklist review' if submission.current_stage == WorkflowStage.MANAGER_CHECKLIST_REVIEW else 'assessment'}."
                ),
            )
        if managers:
            from .tasks import queue_submission_ready_for_manager_email

            queue_submission_ready_for_manager_email(
                submission.id, request.user.id, [m.id for m in managers],
            )

        return Response(SubmissionDetailSerializer(submission).data)

    @action(detail=True, methods=["post"], url_path="link-as-attachment")
    def link_as_attachment(self, request, pk=None):
        """
        Attach an EXISTING standalone submission to a parent as a required_form
        checklist item — e.g. linking an already-Approved Corporate Plan
        submission as the "Copy of Signed Ministry Corporate Plan" evidence on
        a Business Plan, without re-submitting the whole Corporate Plan again.

        Distinct from the is_attachment create-time flow (perform_create),
        which always makes a brand-new submission. This instead re-parents a
        submission that already exists — `pk` is the child being attached;
        `parent_submission` in the body is the parent it's being attached to.
        """
        from rest_framework.exceptions import ValidationError

        child = self.get_object()
        parent_id = request.data.get("parent_submission")
        if not parent_id:
            raise ValidationError({"parent_submission": "parent_submission is required."})
        if child.is_attachment:
            raise ValidationError({"detail": "This submission is already attached elsewhere."})

        parent = _submission_queryset_for(request.user).filter(
            pk=parent_id, is_attachment=False,
        ).first()
        if not parent:
            raise ValidationError({
                "parent_submission": "Parent submission not found or you don't have access to it.",
            })

        doc = RequiredDocument.objects.filter(
            form_type__code=parent.form_type_code,
            required_form__code=child.form_type_code,
            is_active=True,
        ).first()
        if not doc:
            raise ValidationError({
                "detail": f"{parent.form_type_code} has no checklist requirement satisfied by "
                          f"attaching a {child.form_type_code} submission.",
            })

        child.is_attachment = True
        child.parent_submission = parent
        child.save(update_fields=["is_attachment", "parent_submission"])

        _mark_required_form_checklist_present(child, actor=request.user)

        from .audit import log_action as _log
        from .models import AuditLog as _AL

        _log(request, _AL.Action.UPDATE, resource_type="Submission",
             resource_id=child.id, resource_label=child.reference_number,
             description=f"Linked as attachment to {parent.reference_number}")
        invalidate_submission(parent.id)
        invalidate_submission(child.id)

        return Response(SubmissionDetailSerializer(parent).data)

    def _assign_scheduled_meeting(self, submission):
        """Queue the submission for the next eligible sitting (carry-over aware).

        Uses each sitting's *effective* cutoff (manual or the 3-day auto rule), so
        a submission that becomes ready after the cutoff is automatically rolled to
        the next sitting — it lands on that sitting's carry-over list.
        """
        from .agenda_carryover import compute_scheduled_meeting
        submission.scheduled_meeting = compute_scheduled_meeting(submission)

    def _auto_place_on_agenda(self, submission):
        """
        Once the Secretary forwards a submission to the Commission, place it
        directly onto its meeting's agenda — in its correct type-grouped
        position — instead of leaving it in the Sitting Workspace backlog for
        someone to manually "add item" or drag-and-drop into place.

        Reuses the exact meeting-selection (cutoff/carry-over aware, via
        compute_scheduled_meeting — same helper _assign_scheduled_meeting
        uses) and category-resolution logic AgendaItemViewSet.perform_create
        uses for a manually-added item, so an auto-placed item is
        indistinguishable from one added by hand — same category, and slotted
        in via _compute_type_grouped_sequence so items of the same submission
        type (e.g. all Voluntary Resignations) stay contiguous within that
        category for the sitting. The Secretary can still reorder/move it
        afterward via the Sitting Workspace for exceptions.

        No-ops (leaves it for manual placement) when there's no eligible
        upcoming meeting yet, or a placement already exists.
        """
        if AgendaItem.objects.filter(submission=submission).exists():
            return

        from .agenda_carryover import compute_scheduled_meeting

        meeting = compute_scheduled_meeting(submission)
        if not meeting:
            return

        category = "other"
        if submission.agenda_category and submission.agenda_category != "other":
            category = submission.agenda_category
        elif submission.form_type_code:
            try:
                ft = PSCFormType.objects.get(code=submission.form_type_code)
                if ft.agenda_category and ft.agenda_category != "other":
                    category = ft.agenda_category
            except PSCFormType.DoesNotExist:
                pass

        next_seq = _compute_type_grouped_sequence(meeting, category, submission.form_type_code)

        item = AgendaItem.objects.create(
            meeting=meeting, submission=submission, category=category, sequence=next_seq,
            form_type_code=submission.form_type_code or "",
        )
        if submission.scheduled_meeting_id != meeting.id:
            submission.scheduled_meeting = meeting
            submission.save(update_fields=["scheduled_meeting", "updated_at"])

        from .tasks import queue_agenda_item_blurb

        aid = item.id
        transaction.on_commit(lambda: queue_agenda_item_blurb(aid))

    def _auto_advance_submitted_to_checklist_review(self, submission):
        """
        Once a submission reaches Submitted, which unit reviews it is already
        100% determined by its form type — there's no human judgement left to
        apply, so a PSC Officer manually "registering and routing" it into
        Manager Checklist Review was a purely mechanical extra click. This
        advances it immediately instead, in its own workflow event
        (actor=None / actor_label="System") so the audit trail still shows
        exactly when and how it happened — same pattern already used for
        system-generated events like CMS callbacks.

        No-ops for internal short-path submissions (VIPAM/Compliance), which
        go to Secretary Review next by human judgement, not mechanical
        routing, and for anything without a form type to route by.

        IPDU Task Force / Allowance Payment submissions skip Manager
        Checklist Review entirely and land straight at Pending Secretary
        Approval: Manager IPDU is the sole author of the board paper (see
        IPDUBoardPaper's docstring in models.py) — there's no separate unit
        checklist review to do on their own already-finished paper, and the
        real-world process is literally "prepare, then hand to the
        Secretary" (confirmed with the user). This is the one case where the
        destination stage isn't Manager Checklist Review — everything else
        about this mechanical routing (routed_unit still set to "ipdu" for
        tracking/notifications, same System-actor WorkflowEvent pattern)
        stays the same.
        """
        if submission.current_stage != WorkflowStage.SUBMITTED:
            return
        if submission.is_internal and not submission.follows_normal_route:
            return
        if not submission.form_type_code:
            return

        from .intake_routing import routed_unit_for_form_type
        from .ipdu_rules import submission_uses_ipdu_board_paper
        routed = routed_unit_for_form_type(submission.form_type_code)
        if not routed:
            return

        target_stage = (
            WorkflowStage.PENDING_SECRETARY_APPROVAL
            if submission_uses_ipdu_board_paper(submission)
            else WorkflowStage.MANAGER_CHECKLIST_REVIEW
        )
        remarks = (
            "Automatically routed to the Secretary — Manager IPDU is the sole author "
            "of the board paper, so there's no separate unit checklist review."
            if target_stage == WorkflowStage.PENDING_SECRETARY_APPROVAL
            else "Automatically routed to the responsible unit — form type determines the unit, no manual routing needed."
        )

        with transaction.atomic():
            submission.routed_unit = routed
            submission.current_stage = target_stage
            update_fields = ["routed_unit", "current_stage"]
            if submission.checklist_review_started_at is None:
                submission.checklist_review_started_at = timezone.now()
                submission._set_checklist_review_deadline_from_start()
                update_fields += ["checklist_review_started_at", "checklist_review_deadline_at"]
            submission.save(update_fields=update_fields)
            WorkflowEvent.objects.create(
                submission=submission,
                actor=None,
                actor_label="System",
                previous_stage=WorkflowStage.SUBMITTED,
                new_stage=target_stage,
                remarks=remarks,
            )
        invalidate_submission(submission.id)

    def _notify_if_late_carryover(self, submission, actor):
        """Tell the originating HR when a submission missed the nearest sitting's
        due date and has been queued for a later one (still subject to the
        Chairman admitting it before he endorses the agenda)."""
        from .agenda_carryover import carryover_status
        from .models import Notification

        try:
            status_info = carryover_status(submission)
        except Exception:
            return
        if not status_info or not status_info.get("is_late"):
            return
        nearest = status_info.get("nearest_meeting") or {}
        target = status_info.get("target_meeting") or {}
        recipient = submission.created_by
        if not recipient or not recipient.is_active:
            return
        Notification.objects.create(
            recipient=recipient,
            submission=submission,
            channel=Notification.Channel.BOTH,
            push=True,
            title=f"Submitted after the due date: {submission.reference_number}",
            body=(
                f"\"{submission.title}\" was submitted after the due date "
                f"({nearest.get('due_date', '')[:10]}) for sitting {nearest.get('ref', '')}. "
                f"It has been queued for {target.get('ref', 'a later sitting')} "
                f"(sits {target.get('date', '')[:10]}). The Chairman may still admit it to "
                f"{nearest.get('ref', 'the nearer sitting')} before endorsing that agenda."
            ),
        )

    def _carry_to_matters_arising(self, submission, actor=None, reason=""):
        """Carry a 'deferred to next meeting' item onto the next sitting's agenda
        under Matters Arising, so it is automatically re-tabled. Idempotent.

        Also records an AgendaDeferral so the Deferred Agenda register is kept
        accurate."""
        from .agenda_carryover import compute_scheduled_meeting
        from .deferral_tracking import record_deferral
        from .models import AgendaCategory, AgendaItem, DeferralType, Submission

        # The sitting it was just deliberated in (most recent placement).
        source_item = (
            submission.agenda_placements.select_related("meeting")
            .order_by("-meeting__date", "-added_at")
            .first()
        )
        source_meeting = source_item.meeting if source_item else submission.scheduled_meeting
        target_meeting = compute_scheduled_meeting(submission, exclude_meeting=source_meeting)
        if not target_meeting or (source_meeting and target_meeting.id == source_meeting.id):
            return
        next_seq = (
            AgendaItem.objects.filter(
                meeting=target_meeting, category=AgendaCategory.MATTERS_ARISING,
            ).aggregate(models.Max("sequence")).get("sequence__max") or 0
        ) + 1
        new_item, _created = AgendaItem.objects.get_or_create(
            meeting=target_meeting,
            submission=submission,
            defaults={
                "category": AgendaCategory.MATTERS_ARISING,
                "sequence": next_seq,
                "matters_arising_meeting_ref": source_meeting.reference_number if source_meeting else "",
                "matters_arising_agenda_no": str(source_item.sequence) if source_item else "",
            },
        )
        submission.scheduled_meeting = target_meeting
        Submission.objects.filter(pk=submission.pk).update(scheduled_meeting=target_meeting)
        record_deferral(
            submission,
            deferral_type=DeferralType.TO_NEXT_MEETING,
            deferred_by=actor,
            from_meeting=source_meeting,
            to_meeting=target_meeting,
            agenda_item=source_item or new_item,
            reason=reason,
        )

    def _submission_view_side_effects(self, request, submission):
        """Queue async AI work when a submission is opened (retrieve / bootstrap)."""
        from .tasks import (
            QUALITY_SCORE_STAGES,
            queue_submission_brief,
            queue_submission_quality_score,
            submission_brief_needs_refresh,
            submission_quality_needs_refresh,
        )

        profile = _profile(request.user)
        if profile.role in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            if submission_brief_needs_refresh(submission):
                queue_submission_brief(submission.id, sync_fallback=False)
        if (
            submission.current_stage in QUALITY_SCORE_STAGES
            and submission_quality_needs_refresh(submission)
        ):
            queue_submission_quality_score(submission.id, force=False)

    def _allowed_transitions_payload(self, submission, profile):
        chain_targets = _chain_targets_for_role(submission, profile.role, user=self.request.user)
        if chain_targets is not None:
            allowed = chain_targets
        else:
            allowed = iter_allowed_targets(
                profile.role,
                submission.current_stage,
                is_internal=submission.is_internal and not submission.follows_normal_route,
                secretary_only=submission.secretary_only,
                form_type_code=submission.form_type_code or "",
            )
        guidance = submission.ai_transition_guidance or {}
        stale = (
            not guidance.get("processed")
            or guidance.get("current_stage") != submission.current_stage
        )
        if stale:
            from .tasks import queue_transition_guidance

            queue_transition_guidance(submission.id, role=profile.role, force=True)
        can_endorse = (
            submission.current_stage == WorkflowStage.PENDING_DG_ENDORSEMENT
            and (
                profile.role == Role.HEAD_OF_AGENCY
                or self.request.user.is_staff
                or self.request.user.is_superuser
            )
        )
        return {
            "allowed": allowed,
            "can_endorse": can_endorse,
            "transition_guidance": guidance,
            "transition_guidance_pending": stale,
        }

    def _checklist_payload(self, submission):
        if (
            submission.is_attachment
            or (submission.is_internal and not submission.follows_normal_route)
            or getattr(submission, "secretary_only", False)
        ):
            return []
        from .submission_checklist import ensure_submission_checklist_items

        ensure_submission_checklist_items(submission)
        items = SubmissionChecklistItem.objects.filter(
            submission=submission,
        ).select_related("document", "checked_by")
        return ChecklistItemSerializer(items, many=True).data

    def _document_meta_counts(self, submission):
        annotation_counts = {}
        for doc_id in DocumentAnnotation.objects.filter(
            document__submission=submission,
        ).values_list("document_id", flat=True):
            annotation_counts[doc_id] = annotation_counts.get(doc_id, 0) + 1
        signature_counts = {}
        for doc_id in DocumentSignature.objects.filter(
            document__submission=submission,
        ).values_list("document_id", flat=True):
            signature_counts[doc_id] = signature_counts.get(doc_id, 0) + 1
        return annotation_counts, signature_counts

    @action(detail=True, methods=["get"], url_path="bootstrap")
    def bootstrap(self, request, pk=None):
        """Single round-trip payload for the submission detail screen."""
        from django.conf import settings as django_settings
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        submission = self.get_object()
        profile = _profile(request.user)
        self._submission_view_side_effects(request, submission)

        cache_key = submission_bootstrap_cache_key(submission.id, request)
        cached = get_cached_response(cache_key)
        if cached is not None:
            return Response(cached)

        docs = SubmissionDocument.objects.filter(submission=submission)
        annotation_counts, signature_counts = self._document_meta_counts(submission)

        payload = {
            "submission": SubmissionDetailSerializer(submission, context={"request": request}).data,
            "documents": SubmissionDocumentSerializer(docs, many=True).data,
            "checklist": self._checklist_payload(submission),
            "allowed_transitions": self._allowed_transitions_payload(submission, profile),
            "annotation_counts": annotation_counts,
            "signature_counts": signature_counts,
        }
        set_cached_response(cache_key, payload, django_settings.CACHE_BOOTSTRAP_TTL)

        _log(
            request,
            _AL.Action.READ,
            resource_type="Submission",
            resource_id=submission.id,
            resource_label=submission.reference_number,
            description=f"Submission bootstrap: {submission.title}",
        )
        return Response(payload)

    @action(detail=True, methods=["get"])
    def allowed_transitions(self, request, pk=None):
        submission = self.get_object()
        profile = _profile(request.user)
        return Response(self._allowed_transitions_payload(submission, profile))

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
            from .audit import signing_provenance
            from .travel_signatures import sign_travel_section

            sig = sign_travel_section(
                submission=submission,
                user=request.user,
                section_key=section_key,
                approved=approved,
                remarks=remarks,
                provenance=signing_provenance(request),
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
        """Readable merged timeline: workflow events + audit log entries, for
        anyone who can already view this submission (access is enforced by
        get_object()/get_queryset(), same as every other submission action).

        Ministry-side roles (HR, DG) get the same accountability trail — who
        did what and when on *their own* submission — but with `ip_address`
        stripped from each entry: that's OPSC-internal infrastructure detail,
        not something external users need to see the full timeline of who-did-
        what-when. (Note this is a different concern from Commission minutes,
        which ministry-side roles never see at all — that restriction lives
        elsewhere, unaffected by this endpoint.)
        """
        from .decision_proof import build_visual_audit_trail
        from .opsc_access import MINISTRY_SIDE_ROLES

        profile = _profile(request.user)
        submission = self.get_object()
        entries = build_visual_audit_trail(submission)
        if profile.role in MINISTRY_SIDE_ROLES:
            for entry in entries:
                entry.pop("ip_address", None)
        return Response({
            "submission_id": submission.id,
            "reference_number": submission.reference_number,
            "entries": entries,
        })

    @action(detail=True, methods=["get"], url_path="audit-trail-pdf")
    def audit_trail_pdf(self, request, pk=None):
        """Printable/downloadable PDF snapshot of the audit trail — for offline
        or legal record-keeping when the submission needs to exist as a
        standalone exhibit outside the app. Same access and ip_address
        redaction rules as visual_audit_trail(); generated fresh on every
        request (point-in-time snapshot, not stored)."""
        from io import BytesIO

        from django.http import FileResponse
        from django.template.loader import render_to_string
        from weasyprint import HTML

        from .audit import log_action as _log
        from .decision_proof import build_visual_audit_trail
        from .models import AuditLog as _AL, WorkflowStage
        from .opsc_access import MINISTRY_SIDE_ROLES

        profile = _profile(request.user)
        submission = self.get_object()
        entries = build_visual_audit_trail(submission)
        if profile.role in MINISTRY_SIDE_ROLES:
            for entry in entries:
                entry.pop("ip_address", None)

        stage_labels = dict(WorkflowStage.choices)
        html = render_to_string("tracker/audit_trail_pdf.html", {
            "submission": submission,
            "stage_label": stage_labels.get(submission.current_stage, submission.current_stage),
            "entries": entries,
            "generated_at": timezone.now(),
            "generated_by": request.user.get_full_name() or request.user.username,
        })

        buf = BytesIO()
        HTML(string=html).write_pdf(buf)
        buf.seek(0)

        _log(request, _AL.Action.EXPORT,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Audit trail exported as PDF for {submission.reference_number}")

        filename = f"audit_trail_{submission.reference_number}.pdf".replace("/", "-")
        return FileResponse(buf, as_attachment=True, filename=filename, content_type="application/pdf")

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
        from .ai.reliability import FEATURE_NL_SEARCH, log_ai_call, timed_call
        from .ai.smart_search import apply_smart_filters, parse_nl_search_query
        from .models import AIGenerationLog

        query = (request.data.get("query") or "").strip()
        profile = _profile(request.user)
        with timed_call() as elapsed:
            parsed, err = parse_nl_search_query(query, role=profile.role)
        if not parsed:
            log_ai_call(feature=FEATURE_NL_SEARCH, status=AIGenerationLog.Status.FAILED,
                        error_detail=err or "Could not parse query.", latency_ms=elapsed())
            return Response({"detail": err or "Could not parse query."}, status=400)
        log_ai_call(feature=FEATURE_NL_SEARCH, status=AIGenerationLog.Status.SUCCESS, latency_ms=elapsed())
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
            or (submission.is_internal and not submission.follows_normal_route)
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
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        submission = self.get_object()
        profile = _profile(request.user)
        is_admin = profile.role == Role.PSC_ADMIN or request.user.is_superuser or request.user.is_staff
        if (
            not is_admin
            and profile.role in OPSC_UNIT_MANAGER_ROLES
            and submission.assigned_to_id
            and submission.assigned_to_id != request.user.id
        ):
            assignee_name = submission.assigned_to.get_full_name() or submission.assigned_to.username
            raise PermissionDenied(
                f"This submission is assigned to {assignee_name} for review — unassign it first "
                "if you need to update the checklist yourself."
            )
        item = get_object_or_404(SubmissionChecklistItem, id=item_id, submission=submission)
        is_present = bool(request.data.get("is_present", False))
        if is_present and item.document.item_type == RequiredDocument.ItemType.DOCUMENT:
            has_attached_file = SubmissionDocument.objects.filter(
                submission=submission, required_document=item.document,
            ).exists()
            if not has_attached_file:
                return Response(
                    {"detail": f'"{item.document.name}" can\'t be marked present without an attached '
                                'file — upload it first.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        item.is_present = is_present
        if is_present:
            item.checked_by = request.user
            item.checked_at = timezone.now()
        else:
            item.checked_by = None
            item.checked_at = None
        if "notes" in request.data:
            item.notes = str(request.data["notes"])[:1000]
        # A deliberate manual decision supersedes the automated content check —
        # clear the flag so a stale warning badge doesn't linger after review.
        item.content_mismatch = False
        item.save()
        _log(request, _AL.Action.UPDATE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Required-document checklist item marked "
                         f"{'present' if is_present else 'not present'} on {submission.reference_number}"
                         + (f" | {item.document.name}" if item.document_id else ""),
             extra_data={"checklist_item_id": item.id})
        invalidate_submission(submission.id)
        return Response(ChecklistItemSerializer(item).data)

    @action(detail=True, methods=["post"], url_path="checklist/autofill")
    def checklist_autofill(self, request, pk=None):
        """A1 — AI suggestions for checklist items based on OCR'd document text."""
        from .ai.checklist_autofill import suggest_checklist_items
        from .submission_checklist import ensure_submission_checklist_items

        submission = self.get_object()

        from .ai_settings import checklist_autofill_enabled

        if not checklist_autofill_enabled():
            return Response(
                {"detail": "AI checklist autofill is currently disabled by the administrator."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if submission.is_attachment or (submission.is_internal and not submission.follows_normal_route):
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

        from .ai.reliability import FEATURE_CHECKLIST_AUTOFILL, log_ai_call, timed_call
        from .models import AIGenerationLog

        with timed_call() as elapsed:
            suggestions, err = suggest_checklist_items(submission, items)
        log_ai_call(
            feature=FEATURE_CHECKLIST_AUTOFILL, submission_id=submission.id,
            status=AIGenerationLog.Status.FAILED if err else AIGenerationLog.Status.SUCCESS,
            error_detail=err or "", latency_ms=elapsed(),
        )

        return Response({
            "disclaimer": "AI draft — verify before marking checklist items present.",
            "suggestions": suggestions,
            "items": ChecklistItemSerializer(items, many=True).data,
            "error": err,
        })

    # Real government reports (scanned Corporate Plans etc.) routinely exceed
    # 20MB — matches nginx's client_max_body_size (frontend/app-locations.conf).
    MAX_UPLOAD_FILE_SIZE = 50 * 1024 * 1024

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
        from .transitions import assert_can_edit_submission
        assert_can_edit_submission(profile.role, submission)

        # Support multiple files in one request (for internal submissions free-form upload)
        files = request.FILES.getlist("files") or (
            [request.FILES["file"]] if "file" in request.FILES else []
        )
        if not files:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        created_docs = []
        for idx, uploaded in enumerate(files):
            if uploaded.size > self.MAX_UPLOAD_FILE_SIZE:
                return Response(
                    {"detail": f"File '{uploaded.name}' exceeds the {self.MAX_UPLOAD_FILE_SIZE // (1024*1024)} MB limit."},
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

            # Optional link to a specific required-document checklist slot — set
            # when this upload comes from the "attach for this requirement" UI
            # (e.g. ministry HR filling required attachments before submitting).
            # Accept required_document (single upload) or required_document_ids[idx].
            required_document_ids = request.data.getlist("required_document_ids")
            required_document_id = (
                required_document_ids[idx]
                if required_document_ids and idx < len(required_document_ids) and required_document_ids[idx]
                else request.data.get("required_document") or None
            )
            required_document = None
            if required_document_id:
                from .models import RequiredDocument as _RequiredDocument
                required_document = _RequiredDocument.objects.filter(
                    pk=required_document_id, is_active=True,
                ).first()

            doc = SubmissionDocument.objects.create(
                submission=submission,
                file=uploaded,
                original_name=document_name if document_name else uploaded.name,
                description=description,
                uploaded_by=request.user,
                required_document=required_document,
            )
            created_docs.append(doc)

            if required_document:
                from .submission_checklist import ensure_submission_checklist_items

                ensure_submission_checklist_items(submission)
                item, _ = SubmissionChecklistItem.objects.get_or_create(
                    submission=submission, document=required_document,
                )
                item.is_present = True
                item.checked_by = request.user
                item.checked_at = timezone.now()
                item.save(update_fields=["is_present", "checked_by", "checked_at"])

            from .tasks import queue_document_classification, queue_document_extraction

            queue_document_extraction(doc.id)
            queue_document_classification(doc.id)

        if submission.current_stage != WorkflowStage.DRAFT:
            from .tasks import queue_submission_quality_score

            sid = submission.id
            transaction.on_commit(lambda: queue_submission_quality_score(sid))

        from .audit import log_action as _log
        from .models import AuditLog as _AL
        for doc in created_docs:
            _log(request, _AL.Action.CREATE,
                 resource_type="Submission", resource_id=submission.id,
                 resource_label=submission.reference_number,
                 description=f"Document uploaded: {doc.original_name} on {submission.reference_number}",
                 extra_data={"document_id": doc.id})

        invalidate_submission(submission.id)
        if len(created_docs) == 1:
            return Response(SubmissionDocumentSerializer(created_docs[0]).data, status=status.HTTP_201_CREATED)
        return Response(SubmissionDocumentSerializer(created_docs, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="remarks-images")
    def upload_remarks_image(self, request, pk=None):
        """Upload a screenshot pasted/dropped into a workflow-remarks rich-text
        editor. Not linked to a WorkflowEvent yet — `transition()` links it once
        the transition it was composed for actually commits. Visibility scoping
        via get_object() is enough here; the transition itself is where role/stage
        authorization is enforced."""
        submission = self.get_object()

        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        allowed_types = {"image/png", "image/jpeg", "image/gif", "image/webp"}
        if file.content_type not in allowed_types:
            return Response(
                {"detail": f"Unsupported image type '{file.content_type}'. Allowed: PNG, JPEG, GIF, WEBP."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file.size > 8 * 1024 * 1024:
            return Response({"detail": "Image exceeds the 8 MB limit."}, status=status.HTTP_400_BAD_REQUEST)

        image = RemarksImage.objects.create(
            submission=submission, file=file, uploaded_by=request.user,
        )
        return Response(
            {"id": image.id, "url": image.file.url},
            status=status.HTTP_201_CREATED,
        )

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
            from .audit import log_action as _log
            from .models import AuditLog as _AL

            profile = _profile(request.user)
            if profile.role not in {Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY, Role.PSC_ADMIN}:
                raise PermissionDenied("Only the submitting ministry or PSC Admin may delete documents.")
            from .transitions import assert_can_edit_submission
            assert_can_edit_submission(profile.role, submission)

            # Evidence preservation: once the submission has entered the
            # workflow, documents are archived (hidden but recoverable),
            # never destroyed. True deletion is only allowed while the
            # paper is still a private draft.
            still_private_draft = (
                submission.current_stage == WorkflowStage.DRAFT
                and not submission.events.exists()
            )
            if still_private_draft:
                for version in doc.versions.all():
                    version.file.delete(save=False)
                doc.file.delete(save=False)
                doc.delete()
                _log(request, _AL.Action.DELETE,
                     resource_type="SubmissionDocument", resource_id=doc_id,
                     resource_label=doc.original_name,
                     description=f"Document deleted (draft): {doc.original_name} "
                                 f"on {submission.reference_number}")
            else:
                doc.archived_at = timezone.now()
                doc.archived_by = request.user
                doc.save(update_fields=["archived_at", "archived_by"])
                _log(request, _AL.Action.DELETE,
                     resource_type="SubmissionDocument", resource_id=doc.id,
                     resource_label=doc.original_name,
                     description=f"Document archived (soft-removed): {doc.original_name} "
                                 f"on {submission.reference_number}")
            invalidate_submission(submission.id)
            return Response(status=status.HTTP_204_NO_CONTENT)

        # GET — serve the file
        try:
            file_handle = doc.file.open('rb')
        except Exception:
            return Response({"detail": "File not found on server."}, status=status.HTTP_404_NOT_FOUND)

        # doc.original_name is a user-editable display title and may lack a
        # file extension (e.g. "Director Letter") — doc.file.name is the real
        # stored path, which always has one, so use that to detect format.
        content_type, _ = mimetypes.guess_type(doc.file.name)
        content_type = content_type or 'application/octet-stream'
        is_pdf = doc.file.name.lower().endswith('.pdf')

        download_name = doc.original_name
        real_ext = Path(doc.file.name).suffix
        if real_ext and not download_name.lower().endswith(real_ext.lower()):
            download_name = f"{download_name}{real_ext}"

        response = FileResponse(file_handle, content_type=content_type)
        disposition = 'inline' if is_pdf else 'attachment'
        response['Content-Disposition'] = f'{disposition}; filename="{download_name}"'
        return response

    @action(detail=True, methods=["post"], url_path="documents/(?P<doc_id>[0-9]+)/replace")
    def document_replace(self, request, pk=None, doc_id=None):
        """Upload a new version of a document.

        The superseded file is snapshotted into DocumentVersion before the
        replacement is saved — clarification rounds preserve exactly what the
        Commission saw at each pass.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL, DocumentOcrStatus, DocumentVersion

        submission = self.get_object()
        doc = get_object_or_404(SubmissionDocument, id=doc_id, submission=submission)
        profile = _profile(request.user)
        _replace_allowed_roles = {
            Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY,
            Role.PSC_ADMIN, Role.PSC_OFFICER, Role.PSC_SECRETARY,
            Role.CSU_MANAGER, Role.ODU_MANAGER,
        }
        if profile.role not in _replace_allowed_roles:
            raise PermissionDenied("Only ministry HR, PSC staff, or OPSC unit staff may replace documents.")
        from .transitions import assert_can_edit_submission
        assert_can_edit_submission(profile.role, submission)

        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded.size > self.MAX_UPLOAD_FILE_SIZE:
            return Response(
                {"detail": f"File '{uploaded.name}' exceeds the {self.MAX_UPLOAD_FILE_SIZE // (1024*1024)} MB limit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = (request.data.get("notes") or "").strip()
        superseded_version = doc.version_num

        with transaction.atomic():
            # Snapshot the current file: the version row takes over the
            # existing storage path — no copy, nothing destroyed.
            snapshot = DocumentVersion.objects.create(
                document=doc,
                version_num=doc.version_num,
                file=doc.file.name,
                filename=doc.original_name,
                uploaded_by=doc.uploaded_by,
                notes=notes,
                is_current=False,
            )
            # Preserve the original upload time (auto_now_add stamped "now").
            DocumentVersion.objects.filter(pk=snapshot.pk).update(uploaded_at=doc.uploaded_at)

            doc.file = uploaded  # saves to a fresh path; old blob stays with the snapshot
            doc.original_name = uploaded.name
            doc.uploaded_by = request.user
            doc.uploaded_at = timezone.now()
            doc.version_num += 1
            # The content changed — reset extraction state and requeue.
            doc.ocr_status = DocumentOcrStatus.PENDING
            doc.extracted_text = ""
            doc.extracted_facts = {}
            doc.ocr_error = ""
            doc.ocr_processed_at = None
            doc.save()

        from .tasks import queue_document_classification, queue_document_extraction
        queue_document_extraction(doc.id)
        queue_document_classification(doc.id)

        _log(request, _AL.Action.UPDATE,
             resource_type="SubmissionDocument", resource_id=doc.id,
             resource_label=doc.original_name,
             description=f"Document replaced (v{superseded_version} → v{doc.version_num}): "
                         f"{doc.original_name} on {submission.reference_number}"
                         + (f" | {notes}" if notes else ""))

        invalidate_submission(submission.id)
        return Response(SubmissionDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="documents/(?P<doc_id>[0-9]+)/versions")
    def document_versions(self, request, pk=None, doc_id=None):
        """Version history of a document (newest first). Works for archived
        documents too — the chain stays inspectable."""
        from .serializers import DocumentVersionSerializer

        submission = self.get_object()
        doc = get_object_or_404(SubmissionDocument.all_objects, id=doc_id, submission=submission)
        versions = doc.versions.select_related("uploaded_by").order_by("-version_num")
        return Response({
            "document_id": doc.id,
            "current_version": doc.version_num,
            "archived_at": doc.archived_at,
            "versions": DocumentVersionSerializer(versions, many=True).data,
        })

    @action(
        detail=True, methods=["get"],
        url_path="documents/(?P<doc_id>[0-9]+)/versions/(?P<version_id>[0-9]+)/download",
    )
    def document_version_download(self, request, pk=None, doc_id=None, version_id=None):
        """Download a superseded version exactly as it was filed."""
        import mimetypes

        from django.http import FileResponse

        from .models import DocumentVersion

        submission = self.get_object()
        doc = get_object_or_404(SubmissionDocument.all_objects, id=doc_id, submission=submission)
        version = get_object_or_404(DocumentVersion, id=version_id, document=doc)

        try:
            file_handle = version.file.open("rb")
        except Exception:
            return Response({"detail": "File not found on server."}, status=status.HTTP_404_NOT_FOUND)

        content_type, _ = mimetypes.guess_type(version.filename)
        response = FileResponse(file_handle, content_type=content_type or "application/octet-stream")
        response["Content-Disposition"] = (
            f'attachment; filename="v{version.version_num}_{version.filename}"'
        )
        return response

    # ── Formal decision service + acknowledgement ───────────────────────────

    def _assert_decision_service_viewer(self, request, submission):
        """Secretariat sees everything; ministry-side roles only their own
        ministry's services."""
        profile = _profile(request.user)
        secretariat = {
            Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER,
            Role.PSC_OFFICER, Role.PSC_MANAGER, Role.PSC_COMMISSIONER, Role.CHAIRPERSON,
        }
        if profile.role in secretariat or request.user.is_staff:
            return profile
        from .decision_service import MINISTRY_ACK_ROLES
        if profile.role in MINISTRY_ACK_ROLES and profile.ministry_id == submission.ministry_id:
            return profile
        raise PermissionDenied("You do not have access to this decision service record.")

    @action(detail=True, methods=["get"], url_path="decision-service")
    def decision_service_status(self, request, pk=None):
        """All service records for this submission, newest first."""
        from .serializers import DecisionServiceSerializer

        submission = self.get_object()
        self._assert_decision_service_viewer(request, submission)
        services = submission.decision_services.select_related(
            "served_by", "acknowledged_by",
        )
        return Response({
            "services": DecisionServiceSerializer(services, many=True).data,
        })

    @action(detail=True, methods=["post"], url_path="serve-decision")
    def serve_decision(self, request, pk=None):
        """Formally serve the Commission's decision on the ministry.

        Body: { letter_subject?, letter_body? } — defaults to the F3 outcome
        letter draft. Creates an immutable snapshot (text + PDF + SHA-256)
        and notifies the ministry's HR and Head of Agency.
        """
        from .audit import log_action as _log
        from .decision_service import SERVABLE_STAGES, serve_decision as _serve
        from .models import AuditLog as _AL
        from .serializers import DecisionServiceSerializer

        submission = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER} \
                and not request.user.is_staff:
            raise PermissionDenied("Only the Secretariat may serve decisions.")
        if submission.current_stage not in SERVABLE_STAGES:
            return Response(
                {"detail": "A decision can only be served after the Commission has decided "
                           "(approved/rejected and post-decision stages)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        letter_subject = (request.data.get("letter_subject") or "").strip() \
            or submission.ai_letter_subject
        letter_body = (request.data.get("letter_body") or "").strip() \
            or submission.ai_letter_content
        if not letter_body.strip():
            return Response(
                {"detail": "letter_body is required (no F3 outcome letter draft to fall back on). "
                           "Generate the outcome letter first or provide the text."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = _serve(
            submission, served_by=request.user,
            letter_subject=letter_subject, letter_body=letter_body,
        )

        _log(request, _AL.Action.DECISION,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Decision formally served on {submission.ministry.name} "
                         f"(service #{service.id})",
             extra_data={"content_hash": service.content_hash,
                         "decision_service_id": service.id})

        invalidate_submission(submission.id)
        return Response(DecisionServiceSerializer(service).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="acknowledge-decision")
    def acknowledge_decision(self, request, pk=None):
        """Ministry acknowledges receipt of the served decision.
        Body: { note? }. Timestamped and audited."""
        from .audit import log_action as _log
        from .decision_service import MINISTRY_ACK_ROLES, acknowledge_service
        from .models import AuditLog as _AL
        from .serializers import DecisionServiceSerializer

        submission = self.get_object()
        profile = _profile(request.user)
        if profile.role not in MINISTRY_ACK_ROLES or profile.ministry_id != submission.ministry_id:
            raise PermissionDenied(
                "Only the served ministry's HR officers or Head of Agency may acknowledge."
            )

        service = submission.decision_services.filter(
            acknowledged_at__isnull=True, superseded=False,
        ).first()
        if not service:
            return Response(
                {"detail": "No decision service is awaiting acknowledgement."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        note = (request.data.get("note") or "").strip()
        acknowledge_service(service, user=request.user, note=note)

        _log(request, _AL.Action.DECISION,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Decision service #{service.id} acknowledged by "
                         f"{request.user.get_full_name() or request.user.username} "
                         f"({submission.ministry.name})"
                         + (f" | {note}" if note else ""),
             extra_data={"decision_service_id": service.id})

        invalidate_submission(submission.id)
        return Response(DecisionServiceSerializer(service).data)

    @action(
        detail=True, methods=["get"],
        url_path="decision-service/(?P<service_id>[0-9]+)/letter",
    )
    def decision_service_letter(self, request, pk=None, service_id=None):
        """Download the served letter PDF exactly as filed."""
        from django.http import FileResponse

        submission = self.get_object()
        self._assert_decision_service_viewer(request, submission)
        service = get_object_or_404(submission.decision_services, pk=service_id)
        if not service.letter_pdf:
            return Response({"detail": "Letter PDF is missing."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            service.letter_pdf.open("rb"),
            as_attachment=True,
            filename=service.letter_pdf.name.split("/")[-1],
            content_type="application/pdf",
        )

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

        # POST / PUT — ministry HR, dept admin, CSU manager, PSC officer/admin/secretary may write
        allowed_write_roles = {
            Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY, Role.CSU_MANAGER,
            Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY,
        }
        if profile.role not in allowed_write_roles:
            raise PermissionDenied("You do not have permission to update PSC Form 3-7 data.")
        from .transitions import assert_can_edit_submission
        assert_can_edit_submission(profile.role, submission)

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
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        _log(request, _AL.Action.CREATE if instance is None else _AL.Action.UPDATE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"PSC Form 3-7 data {'created' if instance is None else 'updated'} "
                         f"on {submission.reference_number}")
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
        from .transitions import assert_can_edit_submission
        assert_can_edit_submission(profile.role, submission)

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
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        _log(request, _AL.Action.CREATE if instance is None else _AL.Action.UPDATE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Organisation Restructure form data "
                         f"{'created' if instance is None else 'updated'} on {submission.reference_number}")
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
            Role.CSU_MANAGER,
        }
        profile = _profile(request.user)
        if profile.role not in allowed_write_roles:
            raise PermissionDenied("You do not have permission to submit form data.")
        from .transitions import assert_can_edit_submission
        assert_can_edit_submission(profile.role, submission)

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

        was_create = instance is None
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

        from .audit import log_action as _log
        from .models import AuditLog as _AL
        _log(request, _AL.Action.CREATE if was_create else _AL.Action.UPDATE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"{resolved_form_type.name} form data "
                         f"{'created' if was_create else 'updated'} on {submission.reference_number}",
             extra_data={"form_response_id": resp.id})

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


class MinistryViewSet(CachedReferenceViewSetMixin, viewsets.ModelViewSet):
    cache_namespace = "ministries"
    cache_invalidate_groups = ("departments", "units")
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


class DepartmentViewSet(CachedReferenceViewSetMixin, viewsets.ModelViewSet):
    cache_namespace = "departments"
    cache_invalidate_groups = ("ministries", "units")
    """
    List/retrieve: any authenticated user with a PSC profile (optionally filter ?ministry=).
    Create/update/delete: PSC Administrators only.
    """
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "ensure_opsc"):
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

    @action(detail=False, methods=["post"], url_path="ensure-opsc")
    def ensure_opsc(self, request):
        """Create or update OPSC department under Ministry of the Prime Minister (idempotent)."""
        from .org_structure import (
            OPSC_DEPARTMENT_NAME,
            ensure_opsc_units,
            get_opm_ministry,
            get_opsc_department,
        )

        pm = get_opm_ministry()
        if not pm:
            return Response(
                {"detail": "Ministry of the Prime Minister is not configured."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dept = get_opsc_department(create=True)
        changed = False
        if dept.ministry_id != pm.pk:
            dept.ministry = pm
            changed = True
        if dept.code.upper() != "OPSC":
            dept.code = "OPSC"
            changed = True
        if dept.name != OPSC_DEPARTMENT_NAME:
            dept.name = OPSC_DEPARTMENT_NAME
            changed = True
        if changed:
            dept.save()
        ensure_opsc_units(dept)
        invalidate_ref_groups(*ORG_REF_NAMESPACES)
        return Response(self.get_serializer(dept).data)


class UnitViewSet(CachedReferenceViewSetMixin, viewsets.ModelViewSet):
    cache_namespace = "units"
    cache_invalidate_groups = ("ministries", "departments")
    """
    List/retrieve: authenticated users (filter ?ministry= and/or ?department=).
    Create/update/delete: PSC Administrators only.
    """

    serializer_class = UnitSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), CanMutateMinistryDepartment()]
        return [permissions.IsAuthenticated(), HasProfilePermission()]

    def get_queryset(self):
        user = self.request.user
        qs = Unit.objects.select_related("department", "department__ministry").order_by(
            "department__ministry__name", "department__name", "name",
        )
        if not (user.is_superuser or user.is_staff):
            profile = _profile(user)
            psc_roles = {
                Role.PSC_ADMIN, Role.PSC_OFFICER, Role.PSC_SECRETARY,
                Role.PSC_MANAGER, Role.CHAIRPERSON, Role.PSC_COMMISSIONER,
                Role.SENIOR_ADMIN_OFFICER, Role.PRINCIPAL_OFFICER, Role.SENIOR_OFFICER,
                Role.VIPAM_MANAGER, Role.HR_UNIT_MANAGER, Role.ODU_MANAGER, Role.COMPLIANCE_MANAGER,
                Role.CSU_MANAGER,
            }
            if profile.role not in psc_roles:
                if profile.ministry_id:
                    qs = qs.filter(department__ministry_id=profile.ministry_id)
                else:
                    qs = qs.none()

        mid = self.request.query_params.get("ministry")
        if mid:
            qs = qs.filter(department__ministry_id=mid)
        did = self.request.query_params.get("department")
        if did:
            qs = qs.filter(department_id=did)
        return qs


class AgendaSectionViewSet(CachedReferenceViewSetMixin, viewsets.ModelViewSet):
    cache_namespace = "agenda-sections"
    """
    CRUD for Commission agenda sections.
    Read: any authenticated user.
    Write / reorder: PSC Admins only.
    """

    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    serializer_class = AgendaSectionSerializer
    queryset = AgendaSection.objects.select_related("digitized_form").all().order_by(
        "display_order", "id",
    )

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("active_only") == "1":
            qs = qs.filter(is_active=True)
        if self.request.query_params.get("lodge_only") == "1":
            qs = qs.filter(is_special=False)
        return qs

    def _require_admin(self):
        if self.request.user.is_superuser or self.request.user.is_staff:
            return
        try:
            profile = self.request.user.psc_profile
        except Exception:
            raise PermissionDenied("Admin access required.")
        if profile.role != Role.PSC_ADMIN:
            raise PermissionDenied("Only PSC Administrators can manage agenda sections.")

    def perform_create(self, serializer):
        self._require_admin()
        if not serializer.validated_data.get("display_order"):
            max_order = (
                AgendaSection.objects.order_by("-display_order")
                .values_list("display_order", flat=True)
                .first()
            ) or 0
            serializer.save(display_order=max_order + 10)
        else:
            serializer.save()
        self._invalidate_reference_cache()

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()
        self._invalidate_reference_cache()

    def destroy(self, request, *args, **kwargs):
        self._require_admin()
        instance = self.get_object()
        from .agenda_sections import agenda_section_usage_counts

        usage = agenda_section_usage_counts(instance)
        total = sum(usage.values())
        if total > 0:
            raise PermissionDenied(
                f"Cannot delete: {usage['submissions']} submission(s), "
                f"{usage['agenda_items']} agenda item(s), and "
                f"{usage['form_types']} form type(s) use this section. "
                "Deactivate it instead."
            )
        instance.delete()
        self._invalidate_reference_cache()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        self._require_admin()
        order = request.data.get("order")
        if not isinstance(order, list) or not order:
            return Response(
                {"detail": "Provide order as a list of agenda section ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            for idx, pk in enumerate(order):
                AgendaSection.objects.filter(pk=pk).update(display_order=(idx + 1) * 10)
        self._invalidate_reference_cache()
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class FormCategoryViewSet(CachedReferenceViewSetMixin, viewsets.ModelViewSet):
    cache_namespace = "form-categories"
    cache_invalidate_groups = ("form-types", "form-fields", "required-documents")
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
        self._invalidate_reference_cache()

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()
        self._invalidate_reference_cache()

    def destroy(self, request, *args, **kwargs):
        self._require_admin()
        instance = self.get_object()
        instance.submissions.all().update(form_category=None)
        instance.delete()
        self._invalidate_reference_cache()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PSCFormTypeViewSet(CachedReferenceViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for PSC Form Types.
    Read: any authenticated user (drives submission dropdowns).
    Write: PSC Admins only.
    """
    cache_namespace = "form-types"
    cache_invalidate_groups = ("form-fields", "required-documents")
    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    serializer_class = PSCFormTypeSerializer
    # Reference/lookup data — every consumer (submission-type dropdowns, the
    # admin Form Types table) expects the complete list in one response, not
    # a paginated page 1. With DRF's default pagination active here, this
    # silently truncated to the first page (e.g. 50 of 78 rows), dropping
    # whichever types happened to sort onto later pages — including, at one
    # point, the entire RECRUIT-* family.
    pagination_class = None

    def get_queryset(self):
        qs = PSCFormType.objects.select_related('form_category').all()
        if self.request.query_params.get('active_only') == '1':
            qs = qs.filter(is_active=True)
        if self.request.query_params.get('digitized_only') == '1':
            qs = qs.filter(is_digitized=True)
        cat = self.request.query_params.get('form_category')
        if cat:
            qs = qs.filter(form_category_id=cat)
        agenda_cat = self.request.query_params.get('agenda_category')
        if agenda_cat:
            # Used by the ministry "specific submission type" picker only.
            # Exclude the 8 OPSC-internal-only placeholder types (INT-1..8 —
            # added by migration 0046 for the CSU/ODU/VIPAM internal-submission
            # flow). Their form_category was later genericized to 'other' by
            # migration 0051's reshuffle, so code prefix is the only reliable
            # way left to identify them; they carry an agenda_category from
            # that same reshuffle but were never meant to be ministry-selectable
            # and would otherwise show up as confusing near-duplicates of the
            # real digitized forms (e.g. "Voluntary Resignation" vs "Voluntary
            # Resignation Submission").
            qs = qs.filter(agenda_category=agenda_cat).exclude(code__startswith='INT-')
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
        self._invalidate_reference_cache()

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()
        self._invalidate_reference_cache()

    def destroy(self, request, *args, **kwargs):
        self._require_admin()
        return super().destroy(request, *args, **kwargs)


class PSCFormFieldViewSet(CachedReferenceViewSetMixin, viewsets.ModelViewSet):
    """
    Fields for a dynamic PSC form design.
    Read: any authenticated user.
    Write: PSC Admins (form designers) only.
    """
    cache_namespace = "form-fields"
    cache_invalidate_groups = ("form-types",)
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
        self._invalidate_reference_cache()

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()
        self._invalidate_reference_cache()

    def destroy(self, request, *args, **kwargs):
        self._require_admin()
        return super().destroy(request, *args, **kwargs)


class RequiredDocumentViewSet(CachedReferenceViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for RequiredDocument entries.
    Read: any authenticated user with a profile.
    Write: PSC Admins only.
    Supports ?form_type=<id> and ?form_category=<id> query filters.
    """
    cache_namespace = "required-documents"
    cache_invalidate_groups = ("form-types",)
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
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._require_admin()
        super().perform_update(serializer)

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

    @action(detail=False, methods=["get"], url_path="unallocated-decisions")
    def unallocated_decisions(self, request):
        """Decided items in signed minutes that have no task yet.

        Prefill data for the manual Allocate-task modal — covers decisions the
        post-signing automation could not allocate (e.g. no unit manager)."""
        if not rbac_user_has_permission(request.user, "allocate_decision"):
            raise PermissionDenied("You do not have permission to allocate commission tasks.")
        from .decision_allocation import pending_decision_allocations

        return Response(pending_decision_allocations())

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

        if sub is not None:
            from .decision_allocation import advance_to_decision_entered_assigned

            advance_to_decision_entered_assigned(
                sub, self.request.user,
                remarks="Decision manually allocated to unit manager by the Secretariat.",
            )

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

        if not user_can_work_commission_task(user, task):
            raise PermissionDenied("You cannot update this task.")

        vd = serializer.validated_data
        keys = set(vd.keys())

        if rbac_user_has_permission(user, "allocate_decision"):
            if "submission" in vd:
                raise PermissionDenied("Cannot move a task to another submission.")
            updated = serializer.save()
            _notify_new_assignees(updated)
            self._maybe_close_cms_for_task(updated)
            return

        is_manager = task.assigned_manager_id == user.id and rbac_user_has_permission(
            user, "assign_task"
        )
        is_staff = (
            task.assigned_staff_id == user.id
            or task.assigned_staff_m2m.filter(id=user.id).exists()
        ) and rbac_user_has_permission(user, "update_implementation")

        if is_manager:
            if "submission" in keys or "assigned_manager" in keys:
                raise PermissionDenied(
                    "You cannot reassign the submission or manager for this task."
                )
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
        # Compliance is merged into SCDMS — there is no external case to close.
        # Retained as a no-op for the post-decision task hooks; the legacy cms_*
        # fields and these call sites are removed in the Phase 6 cleanup.
        return

    @action(detail=True, methods=["get", "post", "patch", "delete"], url_path="subtasks")
    def subtasks(self, request, pk=None):
        """CRUD for subtasks within a commission task."""
        task = self.get_object()
        manager_role = getattr(getattr(task.assigned_manager, "psc_profile", None), "role", None)
        allowed_staff_roles = manager_allowed_staff_roles(manager_role)
        is_manager = (
            request.user.is_superuser
            or request.user.is_staff
            or rbac_user_has_permission(request.user, "allocate_decision")
            or (task.assigned_manager_id == request.user.id and rbac_user_has_permission(request.user, "assign_task"))
        )
        is_assigned_executor = (
            task.assigned_staff_id == request.user.id
            or task.assigned_staff_m2m.filter(id=request.user.id).exists()
        ) and rbac_user_has_permission(request.user, "update_implementation")

        if request.method == "GET":
            qs = task.subtasks.select_related("created_by").prefetch_related("assigned_staff").all()
            return Response(CommissionSubTaskSerializer(qs, many=True).data)

        if not (is_manager or is_assigned_executor):
            raise PermissionDenied("Only the task manager or assigned staff can manage subtasks.")

        if request.method == "POST":
            requested_staff = request.data.get("assigned_staff")
            if isinstance(requested_staff, list) and requested_staff:
                if User.objects.filter(
                    id__in=requested_staff,
                    psc_profile__role__in=allowed_staff_roles,
                    is_active=True,
                ).count() != len(set(requested_staff)):
                    raise PermissionDenied("Subtask assignees must be within the manager's unit roles.")
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
            requested_staff = request.data.get("assigned_staff")
            if isinstance(requested_staff, list) and requested_staff:
                if User.objects.filter(
                    id__in=requested_staff,
                    psc_profile__role__in=allowed_staff_roles,
                    is_active=True,
                ).count() != len(set(requested_staff)):
                    raise PermissionDenied("Subtask assignees must be within the manager's unit roles.")
            ser = CommissionSubTaskSerializer(subtask, data=request.data, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
            self._maybe_close_cms_for_task(task)
            self._sync_task_status_from_subtasks(task)
            return Response(CommissionSubTaskSerializer(subtask).data)

        if request.method == "DELETE":
            subtask.delete()
            self._sync_task_status_from_subtasks(task)
            return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _sync_task_status_from_subtasks(task):
        """A task with sub-tasks is complete iff every non-cancelled sub-task is
        completed — matches the "completing all sub-tasks completes the task"
        workflow. Reverts the parent out of 'completed' if a sub-task is reopened."""
        subs = list(task.subtasks.exclude(status=CommissionTaskStatus.CANCELLED))
        if not subs:
            return
        all_done = all(s.status == CommissionTaskStatus.COMPLETED for s in subs)
        if all_done and task.status != CommissionTaskStatus.COMPLETED:
            task.status = CommissionTaskStatus.COMPLETED
            task.save(update_fields=["status"])
        elif not all_done and task.status == CommissionTaskStatus.COMPLETED:
            task.status = CommissionTaskStatus.IN_PROGRESS
            task.save(update_fields=["status"])

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

        manager_profile = getattr(task.assigned_manager, "psc_profile", None)
        manager_role = getattr(manager_profile, "role", None)
        allowed_roles = manager_allowed_staff_roles(manager_role)
        from django.contrib.auth.models import User
        valid_staff = User.objects.filter(
            id__in=staff_ids,
            psc_profile__role__in=allowed_roles,
            is_active=True,
        )
        # Some staff roles (e.g. Senior Officer) are shared across multiple OPSC
        # units, so role alone doesn't guarantee the candidate is in *this*
        # manager's unit — also require a matching Profile.unit.
        manager_unit_id = getattr(manager_profile, "unit_id", None)
        if manager_unit_id:
            valid_staff = valid_staff.filter(psc_profile__unit_id=manager_unit_id)
        if valid_staff.count() != len(set(staff_ids)):
            return Response(
                {"detail": "One or more staff IDs are invalid or inactive."},
                status=400,
            )

        task.assigned_staff_m2m.set(valid_staff)
        task.assigned_staff = valid_staff.first()  # keep FK in sync
        task.save(update_fields=["assigned_staff"])

        from .audit import log_action as _log
        from .models import AuditLog as _AL
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
            User.objects.filter(psc_profile__role__in=COMMISSION_TASK_MANAGER_ROLES, is_active=True)
            .select_related("psc_profile")
            .order_by("username")
        )
        return Response([{"id": u.id, "username": u.username} for u in qs])

    @action(detail=False, methods=["get"], url_path="eligible-staff")
    def eligible_staff(self, request):
        if not rbac_user_has_permission(request.user, "assign_task"):
            raise PermissionDenied()
        # Scope to the requesting manager's own allowed staff roles (matches the
        # validation in reassign()) so coordinators still see the broad staff-role
        # set, but unit managers only see staff they're actually able to assign.
        manager_role = None
        try:
            prof = request.user.psc_profile
            manager_role = prof.role
        except Profile.DoesNotExist:
            prof = None
        allowed_roles = manager_allowed_staff_roles(manager_role)
        qs = User.objects.filter(
            psc_profile__role__in=allowed_roles,
            is_active=True,
        )
        if prof is not None and prof.ministry_id:
            qs = qs.filter(psc_profile__ministry_id=prof.ministry_id)
        # Some staff roles (e.g. Senior Officer) are shared across multiple OPSC
        # units, so role alone doesn't guarantee the candidate is in *this*
        # manager's unit — also require a matching Profile.unit.
        if prof is not None and prof.unit_id:
            qs = qs.filter(psc_profile__unit_id=prof.unit_id)
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
        # first_name/last_name live on User, not Profile — ProfileSerializer
        # below can't reach them, so they're handled directly here.
        name_fields = {}
        if "first_name" in request.data:
            name_fields["first_name"] = str(request.data.get("first_name") or "").strip()[:150]
        if "last_name" in request.data:
            name_fields["last_name"] = str(request.data.get("last_name") or "").strip()[:150]
        if name_fields:
            for field, value in name_fields.items():
                setattr(user, field, value)
            user.save(update_fields=list(name_fields.keys()))

        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        profile.refresh_from_db()
        return Response(MeSerializer(profile, context={"request": request}).data)
    return Response(MeSerializer(profile, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@authentication_classes([LenientJWTAuthentication])
def change_password_view(request):
    """POST /me/change-password/ — self-service password change.

    Also serves the forced first-login change (must_change_password) where no
    JWT exists yet: mirrors TOTPSetupView's pattern of re-authenticating with
    username + current password instead of requiring IsAuthenticated.
    """
    user = request.user
    if not user.is_authenticated:
        username = (request.data.get("username") or "").strip()
        probe_password = request.data.get("old_password", "").strip()
        if not username or not probe_password:
            return Response(
                {"detail": "Username and current password are required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        from django.contrib.auth import authenticate
        user = authenticate(request, username=username, password=probe_password)
        if not user:
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

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
    try:
        profile = user.psc_profile
        profile.force_password_change = False
        profile.password_changed_at = timezone.now()
        profile.save(update_fields=["force_password_change", "password_changed_at"])
    except Exception:
        pass
    _security_log.info("PASSWORD_CHANGED | username=%s", user.username)
    from .audit import log_action as _log
    from .models import AuditLog as _AL
    _log(request, _AL.Action.PASSWORD_CHANGE,
         resource_type="User", resource_id=user.id,
         resource_label=user.username,
         description=f"Self-service password change by: {user.username}")
    return Response({"detail": "Password changed successfully."})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def upcoming_sittings_view(request):
    """GET /meetings/upcoming/ — upcoming sittings and their submission due dates,
    for HR and unit managers to see deadlines (and which are still open)."""
    from django.utils import timezone
    from .models import Meeting, MeetingStatus

    now = timezone.now()
    meetings = (
        Meeting.objects.filter(
            status__in=(MeetingStatus.SCHEDULED, MeetingStatus.IN_PROGRESS),
            date__gte=now.date(),
        )
        .order_by("date", "time")[:12]
    )
    data = []
    for m in meetings:
        cutoff = m.effective_cutoff
        data.append({
            "id": m.id,
            "reference_number": m.reference_number,
            "title": m.title,
            "date": m.date,
            "time": m.time,
            "venue": m.venue,
            "type": m.type,
            "status": m.status,
            "agenda_status": m.agenda_status,
            "due_date": cutoff,
            "is_open": now <= cutoff,
        })
    return Response(data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def vapid_public_key_view(request):
    """GET /push/vapid-public-key/ — the VAPID application server key the browser
    needs to subscribe to web push. `enabled` is false when push is unconfigured."""
    from django.conf import settings as _s

    return Response({
        "public_key": _s.VAPID_PUBLIC_KEY,
        "enabled": bool(_s.VAPID_PUBLIC_KEY and _s.VAPID_PRIVATE_KEY),
    })


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def password_policy_view(request):
    """GET /auth/password-policy/ — live policy from SystemSetting."""
    from django.conf import settings as django_settings
    from .models import SystemSetting

    cache_key = password_policy_cache_key()
    cached = get_cached_response(cache_key)
    if cached is not None:
        return Response(cached)

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

    payload = {
        "min_length": _int("PASSWORD_MIN_LENGTH", 8),
        "require_uppercase": _bool("PASSWORD_REQUIRE_UPPERCASE", True),
        "require_lowercase": _bool("PASSWORD_REQUIRE_LOWERCASE", True),
        "require_digits": _bool("PASSWORD_REQUIRE_DIGITS", True),
        "require_special": _bool("PASSWORD_REQUIRE_SPECIAL", True),
        "history_count": _int("PASSWORD_HISTORY_COUNT", 5),
        "mfa_enabled": mfa_globally_enabled(),
    }
    set_cached_response(cache_key, payload, django_settings.CACHE_PASSWORD_POLICY_TTL)
    return Response(payload)


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
        WorkflowStage.PENDING_SECRETARY_APPROVAL,
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
        WorkflowStage.PENDING_SECRETARY_APPROVAL,
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
    """POST /reports/ai-smart-query/ — natural language report query via Gemini."""
    import json

    from .ai.claude_client import ai_enabled, complete_json_with_error

    query = (request.data.get("query") or "").strip()
    if not query:
        return Response({"detail": "Query is required."}, status=400)

    if not ai_enabled():
        return Response(
            {
                "detail": "AI reporting is not configured. Set GEMINI_API_KEY on the API service.",
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

    from .ai.reliability import FEATURE_SMART_REPORT, log_ai_call, timed_call
    from .models import AIGenerationLog

    with timed_call() as elapsed:
        data, err = complete_json_with_error(
            system=system_prompt,
            user=user_prompt,
            tier="sonnet",
            max_tokens=4096,
        )
    if err:
        log_ai_call(feature=FEATURE_SMART_REPORT, status=AIGenerationLog.Status.FAILED,
                    error_detail=err, model_tier="sonnet", latency_ms=elapsed())
        return Response(
            {
                "summary": "I could not run the AI report right now. Please try again later.",
                "detail": err,
            },
            status=502,
        )
    if not isinstance(data, dict):
        log_ai_call(feature=FEATURE_SMART_REPORT, status=AIGenerationLog.Status.FAILED,
                    error_detail="Unexpected AI response format.", model_tier="sonnet", latency_ms=elapsed())
        return Response(
            {"detail": "Unexpected AI response format."},
            status=502,
        )
    log_ai_call(feature=FEATURE_SMART_REPORT, status=AIGenerationLog.Status.SUCCESS,
                model_tier="sonnet", latency_ms=elapsed())
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
        from .axes_config import current_failure_limit

        limit = current_failure_limit()
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


def _axes_failures_for(username):
    """Max consecutive failed-login count django-axes has recorded for *username*."""
    if not username:
        return 0
    try:
        from axes.models import AccessAttempt
        from django.db.models import Max as _Max
        row = AccessAttempt.objects.filter(username=username).aggregate(m=_Max("failures_since_start"))
        return row["m"] or 0
    except Exception:
        return 0


def _enforce_password_expiry(profile):
    """
    Flag *profile* for a forced password change when its password is older than
    PASSWORD_MAX_AGE_DAYS. A value of 0 (default) disables expiry. Legacy users
    without a recorded change date have the clock started on this sign-in.
    """
    from .models import SystemSetting
    max_age = SystemSetting.get_int("PASSWORD_MAX_AGE_DAYS", 0)
    if max_age <= 0:
        return
    changed_at = profile.password_changed_at
    if changed_at is None:
        # Start the clock for accounts created before expiry tracking existed.
        profile.password_changed_at = timezone.now()
        profile.save(update_fields=["password_changed_at"])
        return
    if profile.force_password_change:
        return
    if timezone.now() - changed_at >= timedelta(days=max_age):
        profile.force_password_change = True
        profile.save(update_fields=["force_password_change"])
        _security_log.info(
            "PASSWORD_EXPIRED | username=%s | age_days>=%d", profile.user.username, max_age
        )


from .serializers import AgendaDeferralSerializer, DecisionLetterSerializer  # noqa: E402


class DecisionLetterViewSet(viewsets.ModelViewSet):
    """Decision/action letters prepared by the responsible unit for a Commission
    decision (e.g. a direct-appointment letter).

    Interim wet-ink flow: the assigned action officer prepares the letter →
    prints it → the Secretary signs on paper (recorded here) → the unit notifies
    the originating ministry HR that the signed letter is ready for pickup → HR
    confirms physical collection.
    """

    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    serializer_class = DecisionLetterSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        from .decision_service import MINISTRY_ACK_ROLES
        from .models import DecisionLetter

        user = self.request.user
        profile = _profile(user)
        qs = DecisionLetter.objects.select_related(
            "commission_task", "submission", "submission__ministry",
            "prepared_by", "signed_by", "picked_up_by",
        )
        if profile and profile.role in MINISTRY_ACK_ROLES:
            # Ministry side: only their own ministry's letters that have reached
            # at least the pickup stage.
            qs = qs.filter(
                submission__ministry_id=profile.ministry_id,
                status__in=["ready_for_pickup", "picked_up"],
            )
        elif not (user.is_staff or user.is_superuser):
            # OPSC side: letters for commission tasks the user can access.
            task_ids = _commission_task_queryset_for(user).values("id")
            qs = qs.filter(commission_task_id__in=task_ids)

        task_id = self.request.query_params.get("commission_task")
        if task_id:
            qs = qs.filter(commission_task_id=task_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @staticmethod
    def _can_prepare(user, task):
        profile = _profile(user)
        if user.is_staff or user.is_superuser or (profile and profile.role == Role.PSC_ADMIN):
            return True
        if task.assigned_manager_id == user.id or task.assigned_staff_id == user.id:
            return True
        return task.assigned_staff_m2m.filter(id=user.id).exists()

    def perform_create(self, serializer):
        task = serializer.validated_data.get("commission_task")
        if task is None:
            raise PermissionDenied("A commission task is required to prepare a letter.")
        if not self._can_prepare(self.request.user, task):
            raise PermissionDenied(
                "Only the assigned action officer or unit manager can prepare this letter."
            )
        from .models import DecisionLetterStatus

        serializer.save(
            created_by=self.request.user,
            prepared_by=self.request.user,
            prepared_at=timezone.now(),
            submission=task.submission,
            status=DecisionLetterStatus.PREPARED,
        )

    def perform_update(self, serializer):
        letter = serializer.instance
        if not self._can_prepare(self.request.user, letter.commission_task):
            raise PermissionDenied("Only the action officer or unit manager can edit this letter.")
        if letter.status not in ("draft", "prepared", "printed"):
            raise PermissionDenied("The letter can no longer be edited once it has been signed.")
        serializer.save()

    @action(detail=True, methods=["post"], url_path="mark-signed")
    def mark_signed(self, request, pk=None):
        """Secretary records that the printed letter has been signed (wet-ink).
        Optionally attach a scan of the signed letter."""
        from .models import DecisionLetterStatus

        letter = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN}:
            raise PermissionDenied("Only the Secretary can sign decision letters.")
        scan = request.FILES.get("signed_scan") or request.FILES.get("file")
        if scan:
            letter.signed_scan.save(
                f"letter_{letter.id}_signed.{scan.name.rsplit('.', 1)[-1].lower()}", scan, save=False
            )
        letter.status = DecisionLetterStatus.SIGNED
        letter.signed_by = request.user
        letter.signed_at = timezone.now()
        letter.save()
        return Response(DecisionLetterSerializer(letter, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="notify-pickup")
    def notify_pickup(self, request, pk=None):
        """Unit notifies the originating ministry HR that the signed letter is
        ready for physical pickup."""
        from .decision_service import ministry_recipients
        from .models import DecisionLetterStatus, Notification

        letter = self.get_object()
        if not self._can_prepare(request.user, letter.commission_task):
            raise PermissionDenied("Only the action officer or unit manager can notify HR for pickup.")
        if letter.status != DecisionLetterStatus.SIGNED:
            return Response(
                {"detail": "The letter must be signed by the Secretary before notifying HR for pickup."},
                status=400,
            )
        letter.status = DecisionLetterStatus.READY_FOR_PICKUP
        letter.pickup_notified_at = timezone.now()
        letter.save(update_fields=["status", "pickup_notified_at", "updated_at"])

        sub = letter.submission
        recipients = ministry_recipients(sub) if sub else []
        for recipient in recipients:
            Notification.objects.create(
                recipient=recipient,
                submission=sub,
                channel=Notification.Channel.BOTH,
                push=True,
                title=f"Decision letter ready for pickup: {sub.reference_number if sub else letter.subject}",
                body=(
                    f"The signed decision letter \"{letter.subject}\" is ready for collection "
                    f"from the responsible OPSC unit. Please arrange pickup."
                ),
            )
        return Response({
            **DecisionLetterSerializer(letter, context={"request": request}).data,
            "notified": len(recipients),
        })

    @action(detail=True, methods=["post"], url_path="mark-picked-up")
    def mark_picked_up(self, request, pk=None):
        """Ministry HR (or the Secretariat on their behalf) confirms the signed
        letter has been physically collected."""
        from .decision_service import MINISTRY_ACK_ROLES
        from .models import DecisionLetterStatus

        letter = self.get_object()
        profile = _profile(request.user)
        is_secretariat = profile.role in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}
        if profile.role not in MINISTRY_ACK_ROLES and not is_secretariat and not request.user.is_staff:
            raise PermissionDenied("Only ministry HR or the Secretariat can confirm pickup.")
        if letter.status != DecisionLetterStatus.READY_FOR_PICKUP:
            return Response(
                {"detail": "The letter is not marked ready for pickup."}, status=400,
            )
        letter.status = DecisionLetterStatus.PICKED_UP
        letter.picked_up_by = request.user
        letter.picked_up_at = timezone.now()
        letter.pickup_note = (request.data.get("note") or "").strip()
        letter.save()
        return Response(DecisionLetterSerializer(letter, context={"request": request}).data)


class AgendaDeferralViewSet(viewsets.ReadOnlyModelViewSet):
    """The Deferred Agenda register — every recorded deferral, filterable by
    status and type, so nothing falls off the agenda unnoticed."""

    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    serializer_class = AgendaDeferralSerializer

    def get_queryset(self):
        from .models import AgendaDeferral

        sub_ids = _submission_queryset_for(self.request.user).values("id")
        qs = AgendaDeferral.objects.select_related(
            "submission", "from_meeting", "to_meeting", "deferred_by",
        ).filter(submission_id__in=sub_ids)
        resolved = self.request.query_params.get("resolved")
        if resolved in ("true", "false"):
            qs = qs.filter(resolved=(resolved == "true"))
        dtype = self.request.query_params.get("deferral_type")
        if dtype:
            qs = qs.filter(deferral_type=dtype)
        to_meeting = self.request.query_params.get("to_meeting")
        if to_meeting:
            qs = qs.filter(to_meeting_id=to_meeting)
        return qs

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        """Secretariat marks a deferral resolved (item concluded or no longer carried)."""
        deferral = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            raise PermissionDenied("Only the Secretariat can resolve deferrals.")
        if not deferral.resolved:
            deferral.resolved = True
            deferral.resolved_at = timezone.now()
            deferral.save(update_fields=["resolved", "resolved_at"])
        return Response(AgendaDeferralSerializer(deferral).data)


class UserAdminViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
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
        initial_password = ser.validated_data.get("password", "")
        user = ser.save()
        _log(request, _AL.Action.CREATE,
             resource_type="User", resource_id=user.id,
             resource_label=user.username,
             description=f"User account created: {user.username} (role: {request.data.get('role', '')})")

        # Send onboarding credentials email for admin-created accounts.
        # Email delivery errors should never block user creation.
        user_email = (user.email or "").strip()
        if user_email and initial_password:
            try:
                from urllib.parse import urlparse

                from .email_notify import merge_recipient_context
                from .email_templates import get_frontend_base_url, send_templated_email

                base_url = get_frontend_base_url()
                send_templated_email(
                    slug="new_user_welcome",
                    to=[user_email],
                    context=merge_recipient_context(
                        user,
                        initial_password=initial_password,
                        login_url=f"{base_url}/auth/login",
                        portal_domain=urlparse(base_url).netloc or base_url,
                    ),
                    fail_silently=True,
                )
            except Exception:
                import logging
                logging.getLogger("django").exception(
                    "Failed to send new user welcome email for %s", user.username
                )
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

    def destroy(self, request, *args, **kwargs):
        """DELETE /users/{id}/ — remove user account (with safety guards)."""
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        user = self.get_object()
        if user.id == request.user.id:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser:
            return Response(
                {"detail": "Superuser accounts cannot be deleted from this endpoint."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = user.username
        user_id = user.id
        resp = super().destroy(request, *args, **kwargs)
        _log(
            request,
            _AL.Action.DELETE,
            resource_type="User",
            resource_id=user_id,
            resource_label=username,
            description=f"User account deleted: {username}",
        )
        return resp

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
        try:
            profile = user.psc_profile
            if not profile.force_password_change:
                profile.force_password_change = True
                profile.save(update_fields=["force_password_change"])
        except Exception:
            pass
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
        Clear all django-axes AccessAttempt records for this user and lift any
        permanent ("hard") lock, immediately allowing them to log in again
        regardless of cooloff period. Restricted to superusers.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        if not request.user.is_superuser:
            raise PermissionDenied("Only a super administrator can unlock accounts.")
        user = self.get_object()
        try:
            from axes.models import AccessAttempt
            deleted, _ = AccessAttempt.objects.filter(username=user.username).delete()
        except Exception as exc:
            return Response({"detail": f"Could not clear lockout: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Lift our two-tier escalation flags too.
        prof = getattr(user, "psc_profile", None)
        if prof and (prof.hard_locked or prof.temp_lock_count):
            prof.hard_locked = False
            prof.hard_locked_at = None
            prof.temp_lock_count = 0
            prof.save(update_fields=["hard_locked", "hard_locked_at", "temp_lock_count"])

        _security_log.info(
            "USER_UNLOCKED | username=%s | by=%s | cleared=%d",
            user.username, request.user.username, deleted,
        )
        _log(request, _AL.Action.UNLOCK,
             resource_type="User", resource_id=user.id,
             resource_label=user.username,
             description=f"Account lockout cleared for: {user.username} ({deleted} record(s) removed)")
        from .email_notify import notify_account_unlocked
        notify_account_unlocked(user)
        return Response({
            "detail": f"Account unlocked for '{user.username}'. {deleted} lockout record(s) cleared.",
            "username": user.username,
            "cleared_records": deleted,
        })

    # ── force-mfa-setup (require authenticator app re-enrollment) ────────────
    @action(detail=True, methods=["post"], url_path="force-mfa-setup")
    def force_mfa_setup(self, request, pk=None):
        """
        POST /users/{id}/force-mfa-setup/
        Enable two_factor_enabled and clear any existing TOTP secret, so the
        user is routed into the authenticator-app setup flow on their next
        login (see TokenObtainPairView's setup_required branch). Superuser-only,
        matching the `unlock` action's permission gate. A superuser may target
        their own account.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        if not request.user.is_superuser:
            raise PermissionDenied("Only a super administrator can force MFA setup.")
        if not mfa_globally_enabled():
            return Response(
                {"detail": "Two-factor authentication is currently disabled system-wide. Re-enable it in Settings > Security before forcing individual enrollment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = self.get_object()
        try:
            profile = user.psc_profile
            profile.two_factor_enabled = True
            profile.totp_secret = None
            profile.save(update_fields=["two_factor_enabled", "totp_secret"])
        except Exception:
            return Response({"detail": "This user has no profile to configure."}, status=status.HTTP_400_BAD_REQUEST)

        _security_log.info(
            "MFA_SETUP_FORCED | username=%s | by=%s",
            user.username, request.user.username,
        )
        _log(request, _AL.Action.TWO_FA,
             resource_type="User", resource_id=user.id,
             resource_label=user.username,
             description=f"Admin-forced authenticator app setup for user: {user.username}")
        return Response({
            "detail": f"'{user.username}' will be required to set up their authenticator app on next login.",
            "username": user.username,
            "two_factor_enabled": True,
        })

    # ── reset-all-lockouts ────────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="reset-all-lockouts")
    def reset_all_lockouts(self, request):
        """
        POST /users/reset-all-lockouts/
        Clear ALL axes AccessAttempt records and lift every hard lock — unlocks
        every locked account at once. Restricted to superusers.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        if not request.user.is_superuser:
            raise PermissionDenied("Only a super administrator can unlock accounts.")
        try:
            from axes.models import AccessAttempt
            deleted, _ = AccessAttempt.objects.all().delete()
        except Exception as exc:
            return Response({"detail": f"Could not clear lockouts: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        Profile.objects.filter(hard_locked=True).update(
            hard_locked=False, hard_locked_at=None, temp_lock_count=0
        )

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
        from .axes_config import current_failure_limit, current_cooloff
        limit = current_failure_limit()
        cooloff = current_cooloff()
        try:
            from axes.models import AccessAttempt
            from django.db.models import Max as _Max
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

        try:
            hard_locked_count = Profile.objects.filter(hard_locked=True).count()
        except Exception:
            hard_locked_count = 0

        cooloff_minutes = int(cooloff.total_seconds() // 60)
        return Response({
            "failure_limit": limit,
            "cooloff_minutes": cooloff_minutes,
            # Back-compat: keep hours (rounded) for older clients.
            "cooloff_hours": round(cooloff_minutes / 60, 2),
            "locked_accounts": locked_count,
            "hard_locked_accounts": hard_locked_count,
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
    CachedRoleDefinitionViewSetMixin,
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
        parts = ["permissions"]
        if "agenda_section_ids" in request.data:
            parts.append("agenda routing")
        _log(request, _AL.Action.PERMISSION,
             resource_type="RoleDefinition", resource_id=instance.id,
             resource_label=instance.role,
             description=f"Role updated ({', '.join(parts)}): {instance.role}")
        instance = self.get_queryset().get(pk=instance.pk)
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
    authentication_classes = [LenientJWTAuthentication]

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
    authentication_classes = [LenientJWTAuthentication]
    def post(self, request, *args, **kwargs):
        from django.conf import settings
        import os as _os

        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR", "unknown")
        )
        req_username = (request.data.get("username") or "").strip()

        from .audit import log_action as _log
        from .models import AuditLog as _AL

        # ── Two-tier lockout: pre-check + capture prior state ────────────────
        # We look the user up by username *before* validation so we can (a)
        # reject a permanently ("hard") locked account up-front and (b) know
        # whether a prior temporary lockout already happened, which means the
        # *next* failed attempt must escalate to a hard lock.
        precheck_profile = None
        prior_temp_locks = 0
        if req_username:
            _lu = (
                User.objects.filter(username=req_username)
                .select_related("psc_profile")
                .first()
            )
            if _lu is not None:
                precheck_profile = getattr(_lu, "psc_profile", None)
            if precheck_profile and precheck_profile.hard_locked:
                _security_log.warning(
                    "LOGIN_BLOCKED_HARD_LOCK | username=%s | ip=%s", req_username, ip
                )
                _log(request, _AL.Action.LOGIN_FAILED,
                     resource_type="User", resource_id=_lu.id, resource_label=req_username,
                     description=f"Login blocked — account permanently locked: {req_username}")
                return Response(
                    {
                        "detail": "This account is locked. Please contact a system "
                                  "administrator to have it unlocked.",
                        "hard_locked": True,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            if precheck_profile:
                prior_temp_locks = precheck_profile.temp_lock_count or 0

        failures_before = _axes_failures_for(req_username) if req_username else 0

        # Standard credential validation (django-axes enforces the temporary lock)
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            username = req_username or "<unknown>"
            _security_log.warning(
                "LOGIN_FAILED | username=%s | ip=%s", username, ip
            )

            from .axes_config import current_failure_limit, current_cooloff
            limit = current_failure_limit()
            failures_after = _axes_failures_for(req_username) if req_username else 0

            # (a) A prior temporary lock exists → escalate to a permanent lock.
            if precheck_profile and prior_temp_locks >= 1 and not precheck_profile.hard_locked:
                precheck_profile.hard_locked = True
                precheck_profile.hard_locked_at = timezone.now()
                precheck_profile.save(update_fields=["hard_locked", "hard_locked_at"])
                _security_log.warning(
                    "ACCOUNT_HARD_LOCKED | username=%s | ip=%s", username, ip
                )
                _log(request, _AL.Action.LOCKOUT,
                     resource_type="User", resource_id=precheck_profile.user_id,
                     resource_label=username,
                     description=f"Account permanently locked after repeat failures: {username}",
                     extra_data={"ip": ip, "lock_type": "hard"})
                try:
                    from .email_notify import notify_account_locked
                    notify_account_locked(precheck_profile.user, ip=ip, hard=True)
                except Exception:
                    _security_log.exception("Hard-lock notification failed for %s", username)
                return Response(
                    {
                        "detail": "This account has been locked after repeated failed "
                                  "sign-in attempts. Please contact a system administrator.",
                        "hard_locked": True,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # (b) This failure just crossed the limit → temporary lock (tier 1).
            if (
                precheck_profile
                and limit
                and failures_after >= limit > failures_before
            ):
                precheck_profile.temp_lock_count = (precheck_profile.temp_lock_count or 0) + 1
                precheck_profile.save(update_fields=["temp_lock_count"])
                cooloff_minutes = int(current_cooloff().total_seconds() // 60)
                _security_log.warning(
                    "ACCOUNT_TEMP_LOCKED | username=%s | ip=%s | minutes=%d",
                    username, ip, cooloff_minutes,
                )
                _log(request, _AL.Action.LOCKOUT,
                     resource_type="User", resource_id=precheck_profile.user_id,
                     resource_label=username,
                     description=f"Account temporarily locked ({cooloff_minutes} min) "
                                 f"after {failures_after} failed attempts: {username}",
                     extra_data={"ip": ip, "lock_type": "temporary", "minutes": cooloff_minutes})
                try:
                    from .email_notify import notify_account_locked
                    notify_account_locked(
                        precheck_profile.user, ip=ip, hard=False, minutes=cooloff_minutes
                    )
                except Exception:
                    _security_log.exception("Temp-lock notification failed for %s", username)

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

        # Valid credentials → clear our two-tier lockout counter (axes clears its
        # own AccessAttempt rows via AXES_RESET_ON_SUCCESS).
        if profile and (profile.temp_lock_count or profile.hard_locked):
            profile.temp_lock_count = 0
            profile.hard_locked = False
            profile.hard_locked_at = None
            profile.save(update_fields=["temp_lock_count", "hard_locked", "hard_locked_at"])

        # Password expiry / rotation (NCSS 2030). PASSWORD_MAX_AGE_DAYS = 0 disables.
        if profile:
            _enforce_password_expiry(profile)

        # Forced password change (new admin-created account, or expired password)
        # takes priority over everything else — including 2FA setup — so a fresh
        # account never establishes 2FA trust against a temporary password.
        if profile and profile.force_password_change:
            _security_log.info("LOGIN_PASSWORD_CHANGE_REQUIRED | username=%s | ip=%s", user.username, ip)
            return Response(
                {
                    "must_change_password": True,
                    "username": user.username,
                    "detail": "You must change your password before continuing.",
                },
                status=status.HTTP_200_OK,
            )

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

        # While the Settings > Security master switch is off, 2FA is fully paused —
        # even for users who previously enrolled — so pilot accounts aren't blocked
        # by an authenticator prompt. Their totp_secret/two_factor_enabled are left
        # intact and simply take effect again once the switch is re-enabled.
        if mfa_globally_enabled():
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
        ts = TrustedSession.objects.create(
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

        # Mint tokens ourselves (rather than returning serializer.validated_data)
        # so we can carry auth-provenance claims — signature legal defensibility
        # depends on later requests being able to prove which login produced them.
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        refresh["auth_method"] = "password_only"
        refresh["trusted_session_id"] = ts.id
        return Response(
            {"access": str(refresh.access_token), "refresh": str(refresh)},
            status=status.HTTP_200_OK,
        )


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
# Gated by mfa_globally_enabled() (Settings > Security > "Enforce Two-Factor
# Authentication"), a super-admin master switch. Off = fully paused: no login
# prompts, no new enrollment. See mfa_globally_enabled() for details.

class TOTPSetupView(APIView):
    """Generate a TOTP secret and QR code for the authenticated user or during login."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = [LenientJWTAuthentication]

    def post(self, request):
        if not mfa_globally_enabled():
            return Response(
                {"detail": "Two-factor authentication is currently disabled system-wide. Ask a super administrator to re-enable it in Settings before configuring an authenticator app."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
    authentication_classes = [LenientJWTAuthentication]

    def post(self, request):
        if not mfa_globally_enabled():
            return Response(
                {"detail": "Two-factor authentication is currently disabled system-wide. Ask a super administrator to re-enable it in Settings before configuring an authenticator app."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
    authentication_classes = [LenientJWTAuthentication]

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
        ts = TrustedSession.objects.create(
            user=user,
            expires_at=TrustedSession.compute_expiry(),
            ip_address=ip,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:512] or "",
        )

        _security_log.info("LOGIN_2FA_SUCCESS | username=%s | ip=%s", user.username, ip)

        refresh["auth_method"] = "push_demo" if ser.validated_data.get("via_push_demo") else "totp"
        refresh["trusted_session_id"] = ts.id
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
    """Session PIN feature is disabled system-wide — no one (existing or newly
    onboarded) may set one, so the trusted-session PIN shortcut in the login
    flow stays permanently inert."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response(
            {"detail": "Session PIN sign-in is disabled. Please use your full password to sign in."},
            status=status.HTTP_403_FORBIDDEN,
        )


class SessionPinVerifyView(APIView):
    """Verify the session PIN and return JWT tokens (within trusted session window)."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = [LenientJWTAuthentication]
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

        refresh["auth_method"] = "pin"
        refresh["trusted_session_id"] = ts.id
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
    authentication_classes = [LenientJWTAuthentication]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"]

        from .email_notify import find_active_user_by_email, send_password_reset_email

        user = find_active_user_by_email(email)
        if user:
            token = PasswordResetToken.generate_for(user)
            base = _password_reset_frontend_base(request)
            reset_url = f"{base}/auth/reset-password/confirm?token={token.token}"
            sent = send_password_reset_email(
                user=user,
                reset_url=reset_url,
                to_email=(user.email or email).strip(),
            )
            from .audit import log_action as _log
            from .models import AuditLog as _AL

            if sent:
                _log(
                    request,
                    _AL.Action.SETTINGS,
                    resource_type="PasswordResetEmail",
                    resource_id=user.id,
                    resource_label=user.username,
                    description=f"Password reset email sent to {user.email}",
                    extra_data={"email": user.email, "status": "sent"},
                )
            else:
                _log(
                    request,
                    _AL.Action.SETTINGS,
                    resource_type="PasswordResetEmail",
                    resource_id=user.id,
                    resource_label=user.username,
                    description=f"Password reset email failed for {user.email}",
                    extra_data={"email": user.email, "status": "failed"},
                )
        # Do not reveal whether the email is registered (anti-enumeration).
        return Response({"detail": "If that email is registered, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    """Validate reset token and set new password."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = [LenientJWTAuthentication]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        try:
            profile = user.psc_profile
            profile.force_password_change = False
            profile.password_changed_at = timezone.now()
            profile.save(update_fields=["force_password_change", "password_changed_at"])
        except Exception:
            pass
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
    from .agenda_sections import agenda_section_label

    agenda_lines = []
    for item in meeting.agenda_items.select_related("submission").order_by("category", "sequence"):
        sub = item.submission
        ref = getattr(sub, "reference_number", "") if sub else ""
        title = getattr(sub, "title", "") if sub else ""
        cat_label = agenda_section_label(item.category or "")
        agenda_lines.append(f"- {item.sequence}. [{cat_label}] {ref} — {title}")
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
        meeting = serializer.save()
        # Notify HR managers of the new sitting (async, best-effort). Flying
        # minutes are not physical sittings, so they're excluded.
        if meeting.type != MeetingType.FLYING_MINUTE:
            try:
                from .tasks import notify_meeting_scheduled_task
                notify_meeting_scheduled_task.delay(meeting.id)
            except Exception:
                import logging
                logging.getLogger("scdms.app").exception(
                    "Failed to enqueue HR notification for meeting %s", meeting.id
                )

    def perform_update(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            raise PermissionDenied("Only PSC Secretary, Senior Admin Officer, or Admins can edit meetings.")
        # ── Adoption gate: a sitting cannot begin until the Chairperson has
        # adopted the agenda. Admins may override.
        target_status = serializer.validated_data.get("status")
        if (
            target_status == MeetingStatus.IN_PROGRESS
            and serializer.instance.status != MeetingStatus.IN_PROGRESS
            and not serializer.instance.agenda_adopted_at
            and profile.role != Role.PSC_ADMIN
        ):
            raise PermissionDenied(
                "The agenda must be adopted by the Chairperson before the sitting can begin."
            )

        # ── Postponement: date/time change also moves the submission deadline
        # (effective_cutoff). Capture the pre-save values so HR can be told
        # both the old and new date and deadline once saved.
        instance = serializer.instance
        old_date, old_time, old_cutoff = instance.date, instance.time, instance.effective_cutoff
        new_date = serializer.validated_data.get("date", old_date)
        new_time = serializer.validated_data.get("time", old_time)
        is_postponed = new_date != old_date or new_time != old_time

        meeting = serializer.save()

        if is_postponed:
            from .tasks import notify_meeting_postponed_task
            try:
                notify_meeting_postponed_task.delay(
                    meeting.id,
                    old_date.isoformat() if old_date else None,
                    old_time.isoformat() if old_time else None,
                    old_cutoff.isoformat() if old_cutoff else None,
                )
            except Exception:
                import logging
                logging.getLogger("scdms.app").exception(
                    "Failed to enqueue postponement notification for meeting %s", meeting.id
                )

    def perform_destroy(self, instance):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            raise PermissionDenied("Only PSC Secretary, Senior Admin Officer, or Admins can delete meetings.")
        # A completed sitting (or one with minutes already drafted/signed) has
        # produced official records — Minutes, agenda items, flying-minute
        # signatures — that would be silently destroyed by the CASCADE delete.
        # Deleting is only safe before the sitting has actually produced those
        # records; use "Cancel" (status change) instead for anything past that.
        if instance.status == MeetingStatus.COMPLETED or Minutes.objects.filter(meeting=instance).exists():
            raise PermissionDenied(
                "This sitting has already convened or has minutes on record — deleting it "
                "would destroy that official record. Set its status to Cancelled instead."
            )
        instance.delete()

    @action(detail=True, methods=["get"], url_path="workspace")
    def workspace(self, request, pk=None):
        """
        Sitting Workspace (meeting-as-project) payload — drives SittingWorkspace.jsx.

        Bundles, for one sitting, the meeting header, its placed agenda items
        (the "tasks", grouped client-side by section), the backlog of
        commission-ready submissions not yet on this agenda (the "inbox"), the
        section list (milestone lanes), and a readiness/capacity summary.

        RBAC: the backlog honours the standard submission firewall via
        `_submission_queryset_for`, so users only ever see submissions they are
        already allowed to see.
        """
        from .agenda_sections import active_agenda_sections, agenda_section_label

        meeting = self.get_object()

        # ── Agenda items already placed on this meeting (the tasks) ──────────
        items = (
            AgendaItem.objects
            .filter(meeting=meeting)
            .select_related("submission", "submission__ministry")
            .order_by("category", "sequence", "added_at")
        )
        agenda = [
            {
                "id": it.id,
                "submission": it.submission_id,
                "ref": it.submission.reference_number,
                "title": it.submission.title,
                "ministry": it.submission.ministry.name if it.submission.ministry else "",
                "stage": it.submission.current_stage,
                "category": it.category or "",
                "category_display": agenda_section_label(it.category or ""),
                "sequence": it.sequence,
                "agenda_blurb": it.agenda_blurb,
                "agenda_blurb_processed": it.agenda_blurb_processed,
            }
            for it in items
        ]
        placed_submission_ids = {it.submission_id for it in items}

        # ── Backlog (on-time) vs carry-over list (late) ──────────────────────
        from .agenda_carryover import is_carryover

        pool_qs = (
            _submission_queryset_for(request.user)
            .filter(
                current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
                is_attachment=False,
            )
            .exclude(id__in=placed_submission_ids)
            .order_by("-received_at")
        )
        backlog, carryover = [], []
        for s in pool_qs:
            row = {
                "submission_id": s.id,
                "ref": s.reference_number,
                "title": s.title,
                "ministry": s.ministry.name if s.ministry else "",
                "stage": s.current_stage,
                "agenda_category": s.agenda_category or "",
                "scheduled_here": s.scheduled_meeting_id == meeting.id,
            }
            (carryover if is_carryover(s, meeting) else backlog).append(row)
        # Items already routed to this sitting float to the top of the backlog.
        backlog.sort(key=lambda r: not r["scheduled_here"])

        # ── Sections (milestone lanes), admin-ordered ───────────────────────
        sections = [
            {"code": sec.code, "label": sec.label}
            for sec in active_agenda_sections()
        ]

        placed = len(agenda)
        readiness = meeting.agenda_readiness(count=placed)

        return Response({
            "meeting": MeetingSerializer(meeting, context={"request": request}).data,
            "sections": sections,
            "agenda": agenda,
            "backlog": backlog,
            "carryover": carryover,
            "readiness": {
                "placed": placed,
                "capacity": meeting.max_items,
                "min_items": meeting.min_items,
                "backlog_ready": len(backlog),
                "is_ready": readiness["is_ready"],
                "level": readiness["level"],
                "shortfall": readiness["shortfall"],
            },
        })

    @action(detail=True, methods=["get"], url_path="my-notes")
    def my_notes(self, request, pk=None):
        """Every one of the requesting user's private prep notes for this
        meeting's agenda, in agenda order — the "read through all my notes
        before the sitting" view. Items with no note yet are still listed
        (empty body) so a Commissioner can see the whole agenda and jump
        straight into writing one."""
        from .agenda_sections import agenda_section_label
        from .models import SubmissionPrivateNote

        meeting = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_COMMISSIONER, Role.CHAIRPERSON, Role.PSC_ADMIN}:
            raise PermissionDenied("Private notes are only available to Commission members.")

        items = (
            meeting.agenda_items
            .select_related("submission")
            .order_by("category", "sequence", "added_at")
        )
        submission_ids = [it.submission_id for it in items if it.submission_id]
        notes_by_submission = {
            n.submission_id: n
            for n in SubmissionPrivateNote.objects.filter(
                submission_id__in=submission_ids, author=request.user,
            )
        }
        rows = []
        for it in items:
            note = notes_by_submission.get(it.submission_id)
            rows.append({
                "agenda_item_id": it.id,
                "submission_id": it.submission_id,
                "submission_reference": it.submission.reference_number if it.submission_id else "",
                "submission_title": it.submission.title if it.submission_id else "",
                "category": it.category or "",
                "category_display": agenda_section_label(it.category or ""),
                "sequence": it.sequence,
                "note_body": note.body if note else "",
                "note_updated_at": note.updated_at if note else None,
            })
        return Response({
            "meeting": {
                "id": meeting.id,
                "reference_number": meeting.reference_number,
                "date": meeting.date,
                "title": meeting.title,
            },
            "items": rows,
        })

    @action(detail=True, methods=["post"], url_path="admit-reserve")
    def admit_reserve(self, request, pk=None):
        """Chairman or Secretary admits a carry-over (late) submission into the draft agenda.

        The only sanctioned override of the submission cutoff: allowed for the
        Chairperson or PSC Secretary while the agenda is `with_chairman` for
        endorsement. Audited.
        """
        from .agenda_carryover import is_carryover

        meeting = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.CHAIRPERSON, Role.PSC_SECRETARY, Role.PSC_ADMIN}:
            raise PermissionDenied("Only the Chairperson or PSC Secretary can admit carry-over items.")
        if meeting.agenda_status != AgendaStatus.WITH_CHAIRMAN:
            return Response(
                {"detail": "Carry-over items can be admitted only while the agenda is with the Chairman for endorsement."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            submission = Submission.objects.get(pk=request.data.get("submission"))
        except Submission.DoesNotExist:
            raise exceptions.NotFound("Submission not found.")
        if submission.current_stage != WorkflowStage.FORWARDED_TO_COMMISSION:
            return Response({"detail": "Only commission-ready submissions can be admitted."}, status=400)
        if AgendaItem.objects.filter(meeting=meeting, submission=submission).exists():
            return Response({"detail": "Already on this agenda."}, status=400)
        current_count = AgendaItem.objects.filter(meeting=meeting).count()
        if (
            meeting.max_items
            and current_count >= meeting.max_items
            and profile.role != Role.PSC_ADMIN
        ):
            return Response(
                {
                    "detail": (
                        f"This meeting's agenda is already at capacity "
                        f"({current_count}/{meeting.max_items} items). "
                        "Admitting another item would overload the sitting — "
                        "defer it to a later meeting instead, or ask a PSC "
                        "Administrator to override."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Section: honour the requested (dropped-on) section, else auto-detect.
        from .agenda_sections import validate_agenda_section_code
        category = (request.data.get("category") or "").strip()
        if category:
            try:
                category = validate_agenda_section_code(category, allow_inactive=True)
            except ValueError:
                category = ""
        if not category:
            category = submission.agenda_category if (submission.agenda_category and submission.agenda_category != "other") else "other"
            if category == "other" and submission.form_type_code:
                try:
                    ft = PSCFormType.objects.get(code=submission.form_type_code)
                    if ft.agenda_category and ft.agenda_category != "other":
                        category = ft.agenda_category
                except PSCFormType.DoesNotExist:
                    pass

        next_seq = _compute_type_grouped_sequence(meeting, category, submission.form_type_code)
        item = AgendaItem.objects.create(
            meeting=meeting, submission=submission, category=category,
            sequence=next_seq, form_type_code=submission.form_type_code or "",
        )
        submission.scheduled_meeting = meeting
        submission.save(update_fields=["scheduled_meeting"])

        from .audit import log_action as _log
        from .models import AuditLog as _AL
        late = is_carryover(submission, meeting)
        admitted_by_label = "Chairman" if profile.role == Role.CHAIRPERSON else "Secretary" if profile.role == Role.PSC_SECRETARY else "Admin"
        _log(request, _AL.Action.UPDATE, resource_type="AgendaItem",
             resource_label=submission.reference_number,
             description=(f"{admitted_by_label} admitted {'late carry-over ' if late else ''}submission "
                         f"{submission.reference_number} to {meeting.reference_number} agenda (cutoff override)."))

        from .tasks import queue_agenda_item_blurb
        aid = item.id
        transaction.on_commit(lambda: queue_agenda_item_blurb(aid))
        return Response({"detail": "Admitted to the agenda.", "agenda_item": item.id, "category": category})

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
        from .agenda_sections import agenda_section_label
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
            category_display=agenda_section_label(row.agenda_item.category or ""),
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
        from .agenda_sections import agenda_section_label
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
                category_display=agenda_section_label(row.agenda_item.category or ""),
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
        return Response(MinutesSerializer(minutes, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="submit-to-chairman")
    def submit_agenda_to_chairman(self, request, pk=None):
        """PSC Secretary submits the agenda directly to the Chairperson for endorsement.

        First (and only) leg of the Stage-B chain: draft → with_chairman. The
        Senior Admin Officer (and the Secretary) can still build/edit the
        agenda's content beforehand — see canManageAgenda on the frontend —
        but only the Secretary advances its status.
        """
        meeting = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN}:
            raise PermissionDenied("Only the PSC Secretary can submit the agenda to the Chairperson.")
        meeting.agenda_status = AgendaStatus.WITH_CHAIRMAN
        meeting.save(update_fields=["agenda_status"])
        return Response({"detail": "Agenda submitted to the Chairperson for endorsement."})

    @action(detail=True, methods=["post"], url_path="approve-agenda")
    def approve_agenda(self, request, pk=None):
        """Chairperson endorses the agenda — this both records the endorsement
        and immediately circulates it to Commission members. There used to be
        a separate manual "Circulate to Members" step after endorsement; per
        the Secretary's request that's now automatic, so endorsing IS
        circulating (final leg of the chain, one action)."""
        meeting = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.CHAIRPERSON, Role.PSC_ADMIN}:
            raise PermissionDenied("Only the Chairperson can endorse the agenda.")
        if meeting.agenda_status != AgendaStatus.WITH_CHAIRMAN:
            return Response(
                {"detail": "Agenda must first be submitted by the Secretary for endorsement."},
                status=400,
            )
        meeting.agenda_status = AgendaStatus.CIRCULATED
        meeting.agenda_approved_by = request.user
        meeting.agenda_approved_at = timezone.now()
        meeting.save(update_fields=["agenda_status", "agenda_approved_by", "agenda_approved_at"])
        self._queue_agenda_briefs(meeting)
        self._ensure_meeting_briefing_pack_queued(meeting, request.user)

        def _notify_circulated():
            try:
                from .email_notify import notify_agenda_circulated
                notify_agenda_circulated(meeting)
            except Exception:
                _security_log.exception("AGENDA_CIRCULATE_NOTIFY_FAIL | meeting=%s", meeting.id)
        transaction.on_commit(_notify_circulated)
        return Response({"detail": "Agenda endorsed and circulated to Commission members."})

    @staticmethod
    def _queue_agenda_briefs(meeting):
        """Pre-generate executive briefs for all agenda submissions so the
        minute-intake split view is instant during the sitting. The task skips
        submissions whose brief is still fresh (context-key cache)."""
        from .tasks import queue_submission_brief

        for item in meeting.agenda_items.select_related("submission"):
            if item.submission_id:
                queue_submission_brief(item.submission_id)

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

    @action(detail=True, methods=["post"], url_path="adopt-agenda")
    def adopt_agenda(self, request, pk=None):
        """Chairperson adopts the (possibly amended) agenda at the start of the
        sitting. The meeting cannot begin until the agenda is adopted.

        The agenda may be amended right up to adoption — e.g. commissioners
        adding items under "Other Matters" via ``other-matters``.
        """
        meeting = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.CHAIRPERSON, Role.PSC_ADMIN}:
            raise PermissionDenied("Only the Chairperson can adopt the agenda.")
        if meeting.agenda_status != AgendaStatus.CIRCULATED and profile.role != Role.PSC_ADMIN:
            return Response(
                {"detail": "The agenda must be circulated to members before it can be adopted."},
                status=400,
            )
        meeting.agenda_adopted_by = request.user
        meeting.agenda_adopted_at = timezone.now()
        meeting.save(update_fields=["agenda_adopted_by", "agenda_adopted_at"])
        return Response({
            "detail": "Agenda adopted. The sitting can now begin.",
            "agenda_adopted_at": meeting.agenda_adopted_at,
        })

    @action(detail=True, methods=["get", "post"], url_path="other-matters")
    def other_matters(self, request, pk=None):
        """List, or add (live), ad-hoc 'Other Matters' items for a sitting.

        Commissioners and the Chairperson raise items under Other Matters when
        the agenda is amended at the start of, or during, the sitting; the
        Secretary / Senior Admin Officer may also record them on their behalf.
        """
        from .models import MeetingOtherMatter

        meeting = self.get_object()

        if request.method == "GET":
            items = meeting.other_matters.select_related("raised_by").all()
            return Response([self._other_matter_payload(m) for m in items])

        profile = _profile(request.user)
        allowed = {
            Role.CHAIRPERSON, Role.PSC_COMMISSIONER, Role.COMMISSION_MEMBER,
            Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN,
        }
        if profile.role not in allowed:
            raise PermissionDenied(
                "Only Commissioners, the Chairperson, or the Secretariat can add Other Matters."
            )
        title = (request.data.get("title") or "").strip()
        if not title:
            return Response({"detail": "A title is required for an Other Matters item."}, status=400)
        next_seq = (
            meeting.other_matters.aggregate(models.Max("sequence")).get("sequence__max") or 0
        ) + 1
        item = MeetingOtherMatter.objects.create(
            meeting=meeting,
            title=title,
            detail=(request.data.get("detail") or "").strip(),
            raised_by=request.user,
            sequence=next_seq,
        )
        return Response(self._other_matter_payload(item), status=status.HTTP_201_CREATED)

    @staticmethod
    def _other_matter_payload(item):
        return {
            "id": item.id,
            "title": item.title,
            "detail": item.detail,
            "sequence": item.sequence,
            "decision_text": item.decision_text,
            "raised_by": (item.raised_by.get_full_name() or item.raised_by.username) if item.raised_by else "",
            "created_at": item.created_at,
        }

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

        from .audit import signing_provenance

        sig, created = FlyingMinuteSignature.objects.update_or_create(
            meeting=meeting,
            member=request.user,
            defaults={"decision": decision, "remarks": remarks, **signing_provenance(request)},
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
        from .rbac import rbac_user_can_regenerate_ai_brief

        return rbac_user_can_regenerate_ai_brief(user)

    @staticmethod
    def _ensure_meeting_briefing_pack_queued(meeting, requested_by, *, force: bool = False):
        """Create + queue a MeetingBriefingPack, unless one is already
        pending/processing/ready and this isn't an explicit regenerate."""
        from .models import MeetingBriefingPack
        from .tasks import queue_meeting_briefing_pack

        if not force:
            existing = MeetingBriefingPack.objects.filter(
                meeting=meeting,
                status__in=[
                    MeetingBriefingPack.Status.PENDING,
                    MeetingBriefingPack.Status.PROCESSING,
                    MeetingBriefingPack.Status.READY,
                ],
            ).order_by("-id").first()
            if existing:
                return existing

        pack = MeetingBriefingPack.objects.create(
            meeting=meeting,
            requested_by=requested_by,
            status=MeetingBriefingPack.Status.PENDING,
        )
        queue_meeting_briefing_pack(pack.id)
        return pack

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
            from .opsc_access import is_opsc_internal

            if not is_opsc_internal(request.user):
                raise PermissionDenied("You cannot access this briefing pack.")
        return pack

    @action(detail=True, methods=["post"], url_path="briefing-pack/generate")
    def generate_briefing_pack(self, request, pk=None):
        """C2 — queue AI sitting briefing pack (HTML + PDF)."""
        meeting = self.get_object()
        if not self._user_can_generate_briefing_pack(request.user):
            raise PermissionDenied(
                "Only users with the Regenerate AI Brief permission may generate briefing packs."
            )

        pack = self._ensure_meeting_briefing_pack_queued(meeting, request.user, force=True)
        return Response(
            MeetingBriefingPackSerializer(pack).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get"], url_path="briefing-pack/latest")
    def briefing_pack_latest(self, request, pk=None):
        """Most recent briefing pack for this meeting, e.g. one auto-generated on
        agenda circulation — lets the UI show it without a manual Generate click."""
        from .models import MeetingBriefingPack
        from .opsc_access import is_opsc_internal

        meeting = self.get_object()
        if not is_opsc_internal(request.user):
            raise PermissionDenied("Only OPSC or Commission staff may view briefing packs.")
        pack = (
            MeetingBriefingPack.objects.filter(meeting=meeting)
            .order_by("-id")
            .first()
        )
        if not pack:
            return Response({"detail": "No briefing pack yet."}, status=404)
        return Response(MeetingBriefingPackSerializer(pack).data)

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

    _AGENDA_MANAGER_ROLES = {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}

    def _require_agenda_manager(self):
        profile = _profile(self.request.user)
        if profile.role not in self._AGENDA_MANAGER_ROLES:
            raise PermissionDenied(
                "Only PSC Secretary, Senior Admin Officer, or Admins can manage agenda items."
            )

    def get_queryset(self):
        qs = super().get_queryset()
        meeting_id = self.request.query_params.get("meeting")
        if meeting_id:
            qs = qs.filter(meeting_id=meeting_id)
        return qs.order_by("sequence", "id")

    def perform_update(self, serializer):
        self._require_agenda_manager()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_agenda_manager()
        instance.delete()

    def perform_create(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            raise PermissionDenied("Only PSC Secretary, Senior Admin Officer, or Admins can manage agenda items.")

        meeting    = serializer.validated_data["meeting"]
        submission = serializer.validated_data["submission"]
        category   = serializer.validated_data.get("category", "other")

        if AgendaItem.objects.filter(meeting=meeting, submission=submission).exists():
            raise exceptions.ValidationError({"submission": "This submission is already on this meeting's agenda."})

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

        # Sequence: slot in next to other items of the same submission type within
        # the category (see _compute_type_grouped_sequence), so a hand-added item
        # groups the same way an auto-placed one does.
        next_seq = _compute_type_grouped_sequence(meeting, category, submission.form_type_code)

        item = serializer.save(
            category=category, sequence=next_seq,
            form_type_code=submission.form_type_code or "",
        )
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

        # Slot into the same type-group within the same category in the next meeting
        new_seq = _compute_type_grouped_sequence(next_meeting, item.category, item.form_type_code)

        from_meeting = item.meeting
        item.meeting  = next_meeting
        item.sequence = new_seq
        item.save(update_fields=["meeting", "sequence"])

        from .deferral_tracking import record_deferral
        from .models import DeferralType
        record_deferral(
            item.submission,
            deferral_type=DeferralType.PUSH_TO_NEXT,
            deferred_by=request.user,
            from_meeting=from_meeting,
            to_meeting=next_meeting,
            agenda_item=item,
            reason=(request.data.get("reason") or "").strip(),
        )

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
        """
        Batch-reorder agenda items after a drag.

        Accepts: { "items": [{ "id": 1, "sequence": 1, "category": "rec" }, ...] }
        `category` is optional — when present (e.g. an item dragged into a
        different section in the Sitting Workspace) the item is also moved to
        that agenda section. Unknown/inactive section codes are rejected.
        """
        from .agenda_sections import validate_agenda_section_code

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
            if not row_id or new_seq is None:
                continue
            fields = {"sequence": new_seq}
            if "category" in item:
                try:
                    fields["category"] = validate_agenda_section_code(
                        (item.get("category") or "").strip(), allow_inactive=True
                    )
                except ValueError as exc:
                    return Response({"detail": str(exc)}, status=400)
            AgendaItem.objects.filter(id=row_id).update(**fields)
            updated.append({"id": row_id, **fields})

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


class SystemSettingViewSet(CachedReferenceViewSetMixin, viewsets.ModelViewSet):
    """CRUD for system settings — staff / superuser / PSC Admin."""
    cache_namespace = "settings"
    permission_classes = [permissions.IsAuthenticated, HasManageRoles]
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    lookup_field = "key"

    def _list_ttl(self):
        from django.conf import settings as django_settings
        return django_settings.CACHE_SETTINGS_TTL

    def _retrieve_ttl(self):
        return self._list_ttl()

    @action(detail=False, methods=["post"], url_path="batch-update")
    def batch_update(self, request):
        """Update multiple settings at once. Expects {key: value} dict."""
        settings_dict = request.data
        if not isinstance(settings_dict, dict):
            return Response({"detail": "Expected a JSON object."}, status=400)

        from .audit import log_action as _log
        from .models import AuditLog as _AL

        skip_if_blank = {"SMTP_PASSWORD", "GEMINI_API_KEY"}
        updated = []
        smtp_password_saved = False
        gemini_key_saved = False
        for key, value in settings_dict.items():
            if key in skip_if_blank and not str(value).strip():
                continue
            setting, _ = SystemSetting.objects.get_or_create(key=key)
            raw = str(value).strip()
            if key == "SMTP_PASSWORD":
                from .email_backend import _normalize_password

                raw = _normalize_password(raw)
                smtp_password_saved = bool(raw)
            elif key == "GEMINI_API_KEY":
                gemini_key_saved = bool(raw)
            setting.value = raw
            setting.save()
            updated.append(SystemSettingSerializer(setting).data)

        _log(request, _AL.Action.SETTINGS,
             resource_type="SystemSetting",
             description=f"Settings updated: {', '.join(settings_dict.keys())}",
             extra_data={
                 "keys": list(settings_dict.keys()),
                 "smtp_password_saved": smtp_password_saved,
                 "gemini_key_saved": gemini_key_saved,
             })

        if {"EMAIL_CRON_ENABLED", "EMAIL_CRON_SCHEDULE"} & set(settings_dict.keys()):
            try:
                from .email_scheduler import start_email_scheduler
                start_email_scheduler()
            except Exception:
                pass

        self._invalidate_reference_cache()
        if any(str(k).startswith("PASSWORD_") for k in settings_dict) or "TWO_FACTOR_REQUIRED" in settings_dict:
            invalidate_password_policy_cache()

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

        self._invalidate_reference_cache()

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
        """Non-secret email config summary (Resend or SMTP) for troubleshooting."""
        from .email_backend import email_config_diagnostics

        return Response(email_config_diagnostics())

    @action(detail=False, methods=["get"], url_path="ai-status")
    def ai_status(self, request):
        """Non-secret Gemini API config summary for Admin."""
        from .ai.claude_client import gemini_config_diagnostics

        return Response(gemini_config_diagnostics())

    @action(detail=False, methods=["post"], url_path="test-ai")
    def test_ai(self, request):
        """Verify Gemini API key with a minimal Gemini request."""
        from .ai.claude_client import gemini_config_diagnostics, resolve_gemini_api_key

        inline_key = (request.data.get("gemini_api_key") or request.data.get("api_key") or "").strip()
        if inline_key:
            setting, _ = SystemSetting.objects.get_or_create(key="GEMINI_API_KEY")
            setting.value = inline_key
            setting.save()

        api_key = resolve_gemini_api_key()
        if not api_key:
            return Response(
                {
                    "detail": (
                        "Gemini API key is not configured. Paste your key in Admin → "
                        "System Config, save, then run Test again."
                    ),
                    **gemini_config_diagnostics(),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=gemini_config_diagnostics()["model_haiku"],
                contents="Reply with exactly: OK",
                config=types.GenerateContentConfig(max_output_tokens=16),
            )
            snippet = (getattr(response, "text", None) or "").strip()[:80]
        except Exception as exc:
            return Response(
                {"detail": f"Gemini API test failed: {exc}", **gemini_config_diagnostics()},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        from .audit import log_action as _log
        from .models import AuditLog as _AL

        _log(
            request,
            _AL.Action.SETTINGS,
            resource_type="SystemSetting",
            description="Gemini API key verified (test message)",
        )
        return Response({
            "detail": "Gemini API key is valid. AI features (briefs, quality scores, etc.) can run.",
            "response_snippet": snippet,
            **gemini_config_diagnostics(),
        })

    @action(detail=False, methods=["post"], url_path="test-email")
    def test_email(self, request):
        """Send a test message using Resend or SMTP (whichever is configured)."""
        from django.conf import settings as django_settings
        from django.core.exceptions import ValidationError
        from django.core.mail import send_mail
        from django.core.validators import validate_email

        to = (request.data.get("to") or "").strip()
        if not to:
            return Response({"detail": "Recipient email is required."}, status=400)
        try:
            validate_email(to)
        except ValidationError:
            return Response({"detail": "Invalid email address."}, status=400)

        from .email_backend import email_config_diagnostics
        from .email_templates import get_from_email
        from .resend_backend import format_resend_error, uses_resend

        if uses_resend():
            diag = email_config_diagnostics()
            from_email = get_from_email()
            subject = "Commission Decision App — Resend test"
            html = (
                "<p>This is a test email from the <strong>Commission Decision App</strong> "
                "via <a href=\"https://resend.com\">Resend</a>.</p>"
                f"<p>From: {from_email}</p>"
            )
            try:
                send_mail(
                    subject,
                    "This is a test email from the Commission Decision App (Resend).",
                    from_email,
                    [to],
                    fail_silently=False,
                    html_message=html,
                )
            except Exception as exc:
                return Response(
                    {
                        "detail": f"Failed to send test email: {format_resend_error(exc)}",
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
                description=f"Resend test email sent to {to}",
                extra_data={"to": to, "provider": "resend"},
            )
            return Response({"detail": f"Test email sent to {to} via Resend.", **diag})

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


class LetterTemplateViewSet(viewsets.ModelViewSet):
    """Manage decision letter templates — PSC Admin / manage_roles."""

    permission_classes = [permissions.IsAuthenticated, HasManageRoles]
    queryset = LetterTemplate.objects.all()
    serializer_class = LetterTemplateSerializer
    lookup_field = "form_type_code"
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
        from .letter_templates import seed_default_letter_templates

        created = seed_default_letter_templates()
        return Response(
            {"detail": "Default letter templates synced.", "created": created},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="preview")
    def preview(self, request, form_type_code=None):
        from .letter_templates import render_letter_template_record, sample_context_for_form_type

        tpl = self.get_object()
        extra = request.data.get("context") if isinstance(request.data.get("context"), dict) else {}
        ctx = {**sample_context_for_form_type(tpl.form_type_code), **extra}
        result = render_letter_template_record(tpl, ctx)
        return Response({**result, "context": ctx})

    @action(detail=True, methods=["post"], url_path="reset")
    def reset_to_default(self, request, form_type_code=None):
        from .letter_templates import reset_letter_template_to_default

        tpl = self.get_object()
        if not tpl.is_system:
            return Response(
                {"detail": "Only system templates can be reset to defaults."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not reset_letter_template_to_default(tpl.form_type_code):
            return Response({"detail": "No default found for this template."}, status=404)
        tpl.refresh_from_db()
        return Response(LetterTemplateSerializer(tpl).data)


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


class FeedbackChecklistViewSet(viewsets.ViewSet):
    """
    Pre-pilot System Feedback Checklist: per-item ratings/comments/screenshots.
    - GET  mine/   → the current user's own responses
    - POST save/   → upsert one or more items (multipart: `items` JSON string,
                      `unit`, and optional files named `screenshot_<item_id>`)
    - GET  team/   → every user's responses (any authenticated staff member —
                      this is an internal review tool, not sensitive data)
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    @action(detail=False, methods=["get"])
    def mine(self, request):
        qs = FeedbackChecklistResponse.objects.filter(user=request.user)
        return Response(FeedbackChecklistResponseSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=False, methods=["get"])
    def team(self, request):
        qs = FeedbackChecklistResponse.objects.select_related("user").all()
        return Response(FeedbackChecklistResponseSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=False, methods=["post"])
    def save(self, request):
        import json as _json

        raw_items = request.data.get("items")
        if not raw_items:
            return Response({"detail": "Provide `items` as a JSON array."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            items = _json.loads(raw_items)
        except (TypeError, ValueError):
            return Response({"detail": "`items` must be valid JSON."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(items, list):
            return Response({"detail": "`items` must be a JSON array."}, status=status.HTTP_400_BAD_REQUEST)

        unit = request.data.get("unit", "")
        saved = []
        for entry in items:
            item_id = (entry or {}).get("item_id")
            if not item_id:
                continue
            obj, _created = FeedbackChecklistResponse.objects.update_or_create(
                user=request.user,
                item_id=item_id,
                defaults={
                    "unit": unit,
                    "section_id": entry.get("section_id", ""),
                    "section_title": entry.get("section_title", ""),
                    "item_text": entry.get("item_text", ""),
                    "rating": entry.get("rating") or "",
                    "comment": entry.get("comment") or "",
                },
            )
            screenshot_file = request.FILES.get(f"screenshot_{item_id}")
            if screenshot_file:
                obj.screenshot = screenshot_file
                obj.save(update_fields=["screenshot"])
            elif entry.get("remove_screenshot"):
                obj.screenshot.delete(save=False)
                obj.screenshot = None
                obj.save(update_fields=["screenshot"])
            saved.append(obj)

        return Response(
            FeedbackChecklistResponseSerializer(saved, many=True, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


# ── Minutes & Transcript ──────────────────────────────────────────────────────


class MinutesViewSet(viewsets.ModelViewSet):
    """CRUD for meeting minutes documents, plus AI generation actions.

    Visibility: the Secretariat and Commission see every status; all other
    OPSC-internal staff see endorsed (signed) minutes only — with locked agenda
    items redacted by the serializer; ministry-side users see none.
    """

    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    queryset = Minutes.objects.select_related(
        "meeting", "created_by", "signed_by"
    ).all()
    serializer_class = MinutesSerializer

    _FULL_ACCESS_ROLES = {
        Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.CHAIRPERSON,
        Role.PSC_COMMISSIONER, Role.SENIOR_ADMIN_OFFICER,
    }

    def get_queryset(self):
        from .opsc_access import MINISTRY_SIDE_ROLES

        qs = super().get_queryset()
        meeting_id = self.request.query_params.get("meeting")
        if meeting_id:
            qs = qs.filter(meeting_id=meeting_id)

        user = self.request.user
        if user.is_superuser or user.is_staff:
            return qs
        profile = _profile(user)
        if profile.role in self._FULL_ACCESS_ROLES:
            return qs
        if profile.role in MINISTRY_SIDE_ROLES:
            return qs.none()
        # All other OPSC-internal staff: endorsed minutes only.
        return qs.filter(status=MinutesStatus.SIGNED)

    def perform_create(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.CHAIRPERSON, Role.PSC_COMMISSIONER}:
            raise PermissionDenied("Only PSC Secretary, Admin, Chairperson, or Commissioners can create minutes.")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.CHAIRPERSON, Role.PSC_COMMISSIONER}:
            raise PermissionDenied("Only PSC Secretary, Admin, Chairperson, or Commissioners can edit minutes.")
        incoming = serializer.validated_data.get("content")
        if incoming is not None:
            # An editor not cleared on a locked item was sent a placeholder;
            # saving must restore the original block, never persist the redaction.
            from .minutes_access import merge_protected_content

            serializer.validated_data["content"] = merge_protected_content(
                serializer.instance, incoming, self.request.user
            )
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

        # Post-signing automation: allocate decisions to unit managers, run AI
        # decision extraction, and queue outcome-letter drafts for the Secretariat.
        self._run_post_signing_automation(minutes, request.user)

        return Response(MinutesSerializer(minutes, context={"request": request}).data)

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
        return Response(MinutesSerializer(minutes, context={"request": request}).data)

    @staticmethod
    def _run_post_signing_automation(minutes, user):
        """Advance decided submissions, allocate decisions to unit managers, run
        AI decision extraction, queue outcome-letter drafts, and notify Commission
        members that the signed minutes are on record. Shared by the digital
        ``sign`` path and the manual ``upload-signed`` path so both produce the
        same downstream effects. Runs once, on first signing."""
        from .decision_allocation import (
            advance_submissions_for_signed_minutes,
            allocate_decision_tasks,
            queue_post_signing_automation,
        )
        import logging as _logging_mod
        _log = _logging_mod.getLogger("scdms.app")

        # Advance each decided submission to its recorded outcome stage first, so
        # task allocation and outcome letters act on submissions already decided.
        try:
            advance_submissions_for_signed_minutes(minutes, user)
        except Exception:
            _log.exception("POST_SIGN_STAGE_ADVANCE_FAIL | minutes=%s", minutes.id)

        try:
            allocate_decision_tasks(minutes, user)
            queue_post_signing_automation(minutes)
        except Exception:
            _log.exception("POST_SIGN_AUTOMATION_FAIL | minutes=%s", minutes.id)

        # Notify Commission members the signed minutes are now the official record.
        try:
            from .email_notify import notify_minutes_signed
            notify_minutes_signed(minutes)
        except Exception:
            _log.exception("POST_SIGN_NOTIFY_FAIL | minutes=%s", minutes.id)

    @action(detail=True, methods=["post"], url_path="mark-for-signature")
    def mark_for_signature(self, request, pk=None):
        """Finalise reviewed minutes and mark them as printed/out for manual
        (wet-ink) signature at the next sitting.

        Interim flow until the DCDT digital-signature policy is in force.
        """
        minutes = self.get_object()
        profile = _profile(self.request.user)
        if profile.role not in {Role.SENIOR_ADMIN_OFFICER, Role.PSC_SECRETARY, Role.PSC_ADMIN}:
            raise PermissionDenied(
                "Only the Senior Admin Officer, Secretary, or an Admin can send minutes for signature."
            )
        if minutes.status == MinutesStatus.SIGNED:
            return Response({"detail": "Minutes are already signed."}, status=400)
        if minutes.status not in {MinutesStatus.REVIEWED, MinutesStatus.AWAITING_SIGNATURE} and profile.role != Role.PSC_ADMIN:
            return Response(
                {"detail": "Minutes must be reviewed before they can be sent for signature."},
                status=400,
            )
        minutes.status = MinutesStatus.AWAITING_SIGNATURE
        minutes.save(update_fields=["status", "updated_at"])
        return Response(MinutesSerializer(minutes, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="upload-signed")
    def upload_signed(self, request, pk=None):
        """Upload the scanned, manually-signed minutes and, in the same action,
        finalise them and dispatch the post-decision workflow.

        Per the interim manual-signature process: the minutes are printed,
        signed on paper by the Chairperson and Commissioners at the next sitting,
        then the Senior Admin Officer uploads the signed scan here. Uploading
        marks the minutes SIGNED and immediately runs decision allocation,
        minute-decision tasks, and task allocation.

        Minutes remain editable after signing (Secretary / Chairperson / Admin),
        and a corrected signed scan may be re-uploaded.
        """
        minutes = self.get_object()
        profile = _profile(self.request.user)
        if profile.role not in {Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN}:
            raise PermissionDenied(
                "Only the Senior Admin Officer can upload signed minutes and move them to the next steps."
            )
        signed_file = request.FILES.get("signed_document") or request.FILES.get("file")
        if not signed_file:
            return Response(
                {"detail": "Attach the scanned signed minutes (field 'signed_document')."},
                status=400,
            )

        already_signed = minutes.status == MinutesStatus.SIGNED
        minutes.signed_document.save(
            f"minutes_{minutes.meeting.reference_number}_signed_scan.{signed_file.name.rsplit('.', 1)[-1].lower()}",
            signed_file,
            save=False,
        )
        minutes.status = MinutesStatus.SIGNED
        minutes.signed_uploaded_by = request.user
        if not minutes.signed_at:
            minutes.signed_at = timezone.now()
        minutes.save()

        # Run downstream automation only on the first signing so re-uploading a
        # corrected scan does not duplicate decision tasks.
        if not already_signed:
            self._run_post_signing_automation(minutes, request.user)

        return Response(MinutesSerializer(minutes, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """Generate a PDF version of the minutes (locked items redacted per user)."""
        minutes = self.get_object()
        from io import BytesIO
        from django.template.loader import render_to_string
        from weasyprint import HTML
        import base64

        from .minutes_access import redact_content

        content, _fully_cleared = redact_content(minutes, request.user)
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
        from .audit import signing_provenance
        serializer.save(signed_by=self.request.user, **signing_provenance(self.request))

    def create(self, request, *args, **kwargs):
        """Upsert: a user can update their own signature placement on a document."""
        from .audit import signing_provenance

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
            serializer.save(**signing_provenance(request))
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
    """Quick in-app identity re-confirmation (document e-signing, signature
    management) — confirms the current password without issuing new tokens.
    Session PIN is disabled system-wide, so this checks the account password
    instead of a PIN."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [SessionPinVerifyThrottle]

    def post(self, request):
        password = str(request.data.get('password', '') or request.data.get('pin', ''))
        if not password or not request.user.check_password(password):
            return Response({'detail': 'Incorrect password. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'ok': True})


# ── ODU Restructure Checklist ─────────────────────────────────────────────────

class ODUChecklistViewSet(viewsets.ModelViewSet):
    """
    CRUD + submit for the ODU Restructure Checklist.

    Ministry (whoever drafts the submission — ministry_hr, dept_admin, csu_manager,
    etc., same roles that can edit the digitized ORG-3.1/PSC 2-1 form itself):
    create/edit/submit the 20-item checklist while their submission is still in
    Draft. This is their own self-certification, submitted alongside the rest
    of their package — confirmed with ODU (2026-08-06) that this is now their
    responsibility, not ODU's.

    ODU Principal/Manager: once the ministry has submitted it, review it during
    Manager Checklist Review — they can only add their own recommendation and
    sign-off (Section C/D), not touch the ministry's 20 answers. Manager approves.

    GET /odu-checklists/ensure/?submission=<id> — load or create pre-filled draft.
  """

    serializer_class   = ODUChecklistSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _require_ministry_role(self, profile):
        from .odu_checklist_rules import CHECKLIST_MINISTRY_ROLES

        if profile.role not in CHECKLIST_MINISTRY_ROLES:
            raise PermissionDenied(
                "Only the submitting ministry/unit can fill in this checklist."
            )

    def _require_odu_role(self, profile):
        from .odu_checklist_rules import ODU_CHECKLIST_ROLES

        if profile.role not in ODU_CHECKLIST_ROLES:
            raise PermissionDenied(
                "Only ODU Manager or ODU principal analysts can access this checklist."
            )

    def _require_view_role(self, profile):
        from .odu_checklist_rules import CHECKLIST_MINISTRY_ROLES, ODU_CHECKLIST_VIEW_ROLES

        if profile.role not in (CHECKLIST_MINISTRY_ROLES | ODU_CHECKLIST_VIEW_ROLES):
            raise PermissionDenied(
                "You do not have access to the ODU restructure checklist."
            )

    def get_queryset(self):
        from .odu_checklist_rules import user_can_view_odu_checklist

        profile = _profile(self.request.user)
        self._require_view_role(profile)
        qs = ODURestructureChecklist.objects.select_related(
            "submission", "created_by",
        ).all()
        if self.action != "list":
            # Detail lookups (retrieve/update/submit/approve/...) fetch by pk
            # via get_object(), which re-checks role+phase eligibility below —
            # don't require a submission filter here or those pk-based
            # lookups would 404.
            return qs
        from rest_framework.exceptions import ValidationError

        sub_id = self.request.query_params.get("submission")
        if not sub_id:
            raise ValidationError({"submission": "Query parameter submission is required."})
        submission = get_object_or_404(Submission, pk=sub_id)
        is_admin = profile.role == Role.PSC_ADMIN or self.request.user.is_superuser
        if not user_can_view_odu_checklist(submission, profile.role, is_admin=is_admin):
            raise PermissionDenied(
                "You do not have access to the ODU restructure checklist for this submission."
            )
        return qs.filter(submission_id=sub_id)

    def get_object(self):
        from .odu_checklist_rules import user_can_view_odu_checklist

        obj = super().get_object()
        profile = _profile(self.request.user)
        is_admin = profile.role == Role.PSC_ADMIN or self.request.user.is_superuser
        if not user_can_view_odu_checklist(obj.submission, profile.role, is_admin=is_admin):
            raise PermissionDenied(
                "You do not have access to the ODU restructure checklist for this submission."
            )
        return obj

    @action(detail=False, methods=["get"], url_path="ensure")
    def ensure(self, request):
        """Load checklist for a submission.

        The ministry gets a pre-filled draft created on demand while their
        submission is still in Draft. Once submitted, ODU reviews it read-only
        for the 20 items (their own recommendation/sign-off fields stay
        editable). After review, everyone with view access sees it read-only
        so the verification record stays visible downstream.
        """
        from rest_framework.exceptions import ValidationError

        from .odu_checklist_prefill import ensure_odu_checklist_for_submission
        from .odu_checklist_rules import (
            CHECKLIST_MINISTRY_ROLES,
            submission_eligible_for_checklist_draft,
            submission_in_odu_view_phase,
            submission_uses_odu_restructure_checklist,
            user_can_view_odu_checklist,
        )

        profile = _profile(request.user)
        self._require_view_role(profile)

        submission_id = request.query_params.get("submission")
        if not submission_id:
            raise ValidationError({"submission": "Query parameter submission is required."})

        submission = get_object_or_404(
            Submission.objects.select_related("ministry", "department"),
            pk=submission_id,
        )
        if not submission_uses_odu_restructure_checklist(submission):
            return Response(
                {
                    "detail": (
                        "Checklist is only shown for ORG-3.1 / PSC 2-1 submissions "
                        "routed to ODU."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_admin = profile.role == Role.PSC_ADMIN or request.user.is_superuser
        if not user_can_view_odu_checklist(submission, profile.role, is_admin=is_admin):
            raise PermissionDenied(
                "You do not have access to the ODU restructure checklist for this submission "
                "at its current stage."
            )

        # Only create a draft while the ministry is still drafting, and only
        # for ministry roles (or an admin/superuser, for oversight + testing).
        allow_create = submission_eligible_for_checklist_draft(submission) and (
            profile.role in CHECKLIST_MINISTRY_ROLES or is_admin
        )
        checklist = ensure_odu_checklist_for_submission(
            submission,
            user=request.user,
            allow_create=allow_create,
        )
        if not checklist:
            view_phase = submission_in_odu_view_phase(submission)
            detail = (
                "No checklist was completed for this submission."
                if view_phase
                else "The ministry has not started this checklist yet."
            )
            return Response({"detail": detail}, status=status.HTTP_404_NOT_FOUND)
        return Response(ODUChecklistSerializer(checklist).data)

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError

        from .audit import log_action as _log
        from .models import AuditLog as _AL
        from .odu_checklist_rules import CHECKLIST_MINISTRY_ALLOWED_FIELDS, submission_eligible_for_checklist_draft

        profile = _profile(self.request.user)
        self._require_ministry_role(profile)
        submission = serializer.validated_data["submission"]
        if not submission_eligible_for_checklist_draft(submission):
            raise ValidationError({
                "submission": (
                    "This checklist can only be started while the submission is "
                    "still in Draft."
                ),
            })
        # Ministry may only seed their own 16 items + submission_type — never
        # ODU-internal routing fields like odu_officer_assigned/manager_odu.
        for field in list(serializer.validated_data.keys()):
            if field not in CHECKLIST_MINISTRY_ALLOWED_FIELDS and field != "submission":
                serializer.validated_data.pop(field)
        checklist = serializer.save(created_by=self.request.user)
        _log(self.request, _AL.Action.CREATE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"ODU restructure checklist started on {submission.reference_number}",
             extra_data={"odu_checklist_id": checklist.id})

    def perform_update(self, serializer):
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        from .odu_checklist_rules import (
            CHECKLIST_MINISTRY_ALLOWED_FIELDS,
            CHECKLIST_MINISTRY_ROLES,
            CHECKLIST_ODU_MANAGER_ONLY_FIELDS,
            CHECKLIST_ODU_REVIEW_FIELDS,
            ODU_CHECKLIST_ROLES,
            submission_eligible_for_checklist_draft,
            submission_eligible_for_odu_checklist,
        )

        profile = _profile(self.request.user)
        instance = serializer.instance

        if profile.role in CHECKLIST_MINISTRY_ROLES:
            if instance.status != ODUChecklistStatus.DRAFT:
                raise PermissionDenied(
                    "This checklist has already been submitted and can no longer be edited."
                )
            if not submission_eligible_for_checklist_draft(instance.submission):
                raise PermissionDenied(
                    "This checklist can only be edited while the submission is still in Draft."
                )
            # Ministry may only edit their own 16 items + submission_type —
            # Ministry/Department is now derived from the Submission (never
            # stored here), and odu_officer_assigned/manager_odu are
            # ODU-internal routing info the ministry should never write.
            for field in list(serializer.validated_data.keys()):
                if field not in CHECKLIST_MINISTRY_ALLOWED_FIELDS:
                    serializer.validated_data.pop(field)
            edited_fields = sorted(serializer.validated_data.keys())
            serializer.save()
            _log(self.request, _AL.Action.UPDATE,
                 resource_type="Submission", resource_id=instance.submission_id,
                 resource_label=instance.submission.reference_number,
                 description=f"ODU restructure checklist edited by ministry on "
                             f"{instance.submission.reference_number}"
                             + (f" | fields: {', '.join(edited_fields)}" if edited_fields else ""),
                 extra_data={"odu_checklist_id": instance.id})
            return

        if profile.role in ODU_CHECKLIST_ROLES:
            if instance.status != ODUChecklistStatus.SUBMITTED:
                raise PermissionDenied(
                    "Only a checklist the ministry has submitted can be reviewed."
                )
            if not submission_eligible_for_odu_checklist(instance.submission):
                raise PermissionDenied(
                    "This checklist can only be reviewed while the submission is "
                    "with ODU for Manager Checklist Review."
                )
            _require_assigned_officer_or_manager(profile, instance.submission, self.request.user.id)
            # ODU may only add their own recommendation/sign-off — the
            # ministry's 20 answers are locked to them. Within that, the
            # Manager-only subset (final check + manager sign-off) is
            # further locked to the Manager ODU — a principal doing the
            # rest of the review can't write these via a direct API call.
            is_manager_odu = profile.role == Role.ODU_MANAGER or self.request.user.is_superuser
            for field in list(serializer.validated_data.keys()):
                if field not in CHECKLIST_ODU_REVIEW_FIELDS:
                    serializer.validated_data.pop(field)
                elif field in CHECKLIST_ODU_MANAGER_ONLY_FIELDS and not is_manager_odu:
                    serializer.validated_data.pop(field)
            edited_fields = sorted(serializer.validated_data.keys())
            serializer.save()
            _log(self.request, _AL.Action.UPDATE,
                 resource_type="Submission", resource_id=instance.submission_id,
                 resource_label=instance.submission.reference_number,
                 description=f"ODU restructure checklist reviewed by {profile.role} on "
                             f"{instance.submission.reference_number}"
                             + (f" | fields: {', '.join(edited_fields)}" if edited_fields else ""),
                 extra_data={"odu_checklist_id": instance.id})
            return

        raise PermissionDenied("You do not have access to edit this checklist.")

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """
        Transition checklist from Draft → Submitted.
        Ministry only, once their 16 items are answered — this locks it for
        ODU's review. Items 17-20 are ODU's own and never gate this.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        from .odu_checklist_rules import (
            CHECKLIST_MINISTRY_REQUIRED_FIELDS,
            submission_eligible_for_checklist_draft,
        )

        checklist = self.get_object()
        profile = _profile(request.user)
        self._require_ministry_role(profile)
        if not submission_eligible_for_checklist_draft(checklist.submission):
            raise PermissionDenied(
                "This checklist can only be submitted while the submission is still in Draft."
            )
        if checklist.status != ODUChecklistStatus.DRAFT:
            return Response(
                {"detail": "Only Draft checklists can be submitted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        answered = sum(
            1 for f in CHECKLIST_MINISTRY_REQUIRED_FIELDS
            if getattr(checklist, f) is not None
        )
        required = len(CHECKLIST_MINISTRY_REQUIRED_FIELDS)
        if answered < required:
            return Response(
                {"detail": f"All {required} checklist items must be answered before submitting. ({answered}/{required} answered)"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        checklist.status = ODUChecklistStatus.SUBMITTED
        checklist.submitted_at = timezone.now()
        checklist.save(update_fields=["status", "submitted_at"])
        _log(request, _AL.Action.UPDATE,
             resource_type="Submission", resource_id=checklist.submission_id,
             resource_label=checklist.submission.reference_number,
             description=f"ODU restructure checklist submitted to ODU for review on "
                         f"{checklist.submission.reference_number}",
             extra_data={"odu_checklist_id": checklist.id})
        return Response(ODUChecklistSerializer(checklist).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """
        Transition checklist from Submitted → Approved.
        Restricted to ODU_MANAGER.
        """
        from .audit import log_action as _log
        from .models import AuditLog as _AL

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
        _log(request, _AL.Action.UPDATE,
             resource_type="Submission", resource_id=checklist.submission_id,
             resource_label=checklist.submission.reference_number,
             description=f"ODU restructure checklist approved by ODU Manager "
                         f"({checklist.manager_verifier_name}) on {checklist.submission.reference_number}",
             extra_data={"odu_checklist_id": checklist.id})
        return Response(ODUChecklistSerializer(checklist).data)


# ── ODU Restructure Board Paper ────────────────────────────────────────────────

BOARD_PAPER_SECRETARY_ROLES = frozenset({Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.PSC_ADMIN})


def _require_assigned_officer_or_manager(profile, submission, user_id):
    """If the Manager ODU has assigned this case to a specific officer (via
    "Allocate to officer"), only that officer — or the Manager, who can
    always step in — may do the ODU-side work. If nobody's assigned yet,
    any eligible ODU role may act."""
    if profile.role == Role.ODU_MANAGER:
        return
    assigned_to_id = submission.assigned_to_id
    if assigned_to_id and assigned_to_id != user_id:
        raise PermissionDenied("This case is assigned to a different ODU officer.")


class ODUBoardPaperViewSet(viewsets.ModelViewSet):
    """
    CRUD + approval chain for the ODU Restructure Board Paper — the
    Commission-facing submission ODU prepares after their checklist review
    and assessment. This, not the ministry's original PSC 2-1 request, is
    what gets shown to the Commission.

    Approval chain: an ODU Principal drafts and submits it to the Manager
    ODU (or the Manager drafts it directly, skipping that step); the
    Manager approves it; the Secretary gives final sign-off.

    GET /odu-board-papers/ensure/?submission=<id> — load or create draft.
    POST .../submit/            — Principal: Draft -> Submitted.
    POST .../manager_approve/   — Manager: Draft or Submitted -> Manager Approved.
    POST .../secretary_approve/ — Secretary: Manager Approved -> Secretary Approved.
    """

    serializer_class   = ODUBoardPaperSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _require_odu_role(self, profile):
        from .odu_checklist_rules import ODU_CHECKLIST_ROLES

        if profile.role not in ODU_CHECKLIST_ROLES:
            raise PermissionDenied(
                "Only ODU Manager or ODU principal analysts can access the Commission paper."
            )

    def _require_view_role(self, profile):
        from .odu_checklist_rules import ODU_CHECKLIST_VIEW_ROLES

        if profile.role not in ODU_CHECKLIST_VIEW_ROLES:
            raise PermissionDenied(
                "You do not have access to the ODU restructure Commission paper."
            )

    def get_queryset(self):
        profile = _profile(self.request.user)
        self._require_view_role(profile)
        qs = ODURestructureBoardPaper.objects.select_related(
            "submission", "created_by", "submitted_for_review_by",
            "manager_approved_by", "secretary_approved_by",
        ).all()
        sub_id = self.request.query_params.get("submission")
        if sub_id:
            qs = qs.filter(submission_id=sub_id)
        return qs

    @action(detail=False, methods=["get"], url_path="ensure")
    def ensure(self, request):
        """Load the board paper for a submission, creating a blank draft on
        demand while ODU is actively working the case."""
        from rest_framework.exceptions import ValidationError

        from .odu_checklist_rules import (
            ODU_CHECKLIST_ROLES,
            submission_eligible_for_board_paper,
            submission_viewable_board_paper,
        )

        profile = _profile(request.user)
        self._require_view_role(profile)

        submission_id = request.query_params.get("submission")
        if not submission_id:
            raise ValidationError({"submission": "Query parameter submission is required."})

        submission = get_object_or_404(
            Submission.objects.select_related("ministry", "department"),
            pk=submission_id,
        )
        if not submission_viewable_board_paper(submission):
            return Response(
                {
                    "detail": (
                        "Commission paper is only shown for ORG-3.1 / PSC 2-1 submissions "
                        "routed to ODU."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        paper = ODURestructureBoardPaper.objects.filter(submission=submission).first()
        if paper:
            return Response(ODUBoardPaperSerializer(paper).data)

        if not submission_eligible_for_board_paper(submission) or profile.role not in ODU_CHECKLIST_ROLES:
            return Response(
                {"detail": "The Commission paper has not been started for this submission."},
                status=status.HTTP_404_NOT_FOUND,
            )

        paper = ODURestructureBoardPaper.objects.create(
            submission=submission,
            created_by=request.user,
            subject=submission.title or "",
            prepared_by=_odu_prepared_by_default(submission, request.user),
            action_officer=_odu_action_officer_default(),
        )
        return Response(ODUBoardPaperSerializer(paper).data)

    def perform_create(self, serializer):
        from .odu_checklist_rules import submission_eligible_for_board_paper

        profile = _profile(self.request.user)
        self._require_odu_role(profile)
        submission = serializer.validated_data["submission"]
        if not submission_eligible_for_board_paper(submission):
            raise PermissionDenied(
                "Commission paper can only be created while the submission is with ODU."
            )
        _require_assigned_officer_or_manager(profile, submission, self.request.user.id)
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        from .odu_checklist_rules import submission_eligible_for_board_paper

        profile = _profile(self.request.user)
        self._require_odu_role(profile)
        instance = serializer.instance
        if not submission_eligible_for_board_paper(instance.submission):
            raise PermissionDenied(
                "Commission paper can only be edited while the submission is with ODU."
            )
        if instance.status == BoardPaperStatus.DRAFT:
            # The assigned officer (or the manager) may draft it.
            _require_assigned_officer_or_manager(profile, instance.submission, self.request.user.id)
        elif instance.status == BoardPaperStatus.SUBMITTED:
            # Principal has submitted it — only the manager reviews/edits now.
            if profile.role != Role.ODU_MANAGER:
                raise PermissionDenied(
                    "This Commission paper has been submitted for manager review — only "
                    "the Manager ODU can edit it now."
                )
        else:
            raise PermissionDenied(
                "This Commission paper has already been approved and is locked for editing."
            )
        serializer.save()

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """Principal: Draft -> Submitted, for the Manager to review."""
        from .audit import log_action as _log
        from .models import AuditLog as _AL
        from .odu_checklist_rules import ODU_PRINCIPAL_WORKER_ROLES

        paper = self.get_object()
        profile = _profile(request.user)
        if profile.role not in ODU_PRINCIPAL_WORKER_ROLES:
            raise PermissionDenied("Only an ODU principal analyst can submit the Commission paper.")
        _require_assigned_officer_or_manager(profile, paper.submission, request.user.id)
        if paper.status != BoardPaperStatus.DRAFT:
            return Response(
                {"detail": "Only a Draft Commission paper can be submitted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        paper.status = BoardPaperStatus.SUBMITTED
        paper.submitted_for_review_at = timezone.now()
        paper.submitted_for_review_by = request.user
        paper.save(update_fields=["status", "submitted_for_review_at", "submitted_for_review_by"])
        _log(request, _AL.Action.UPDATE,
             resource_type="Submission", resource_id=paper.submission_id,
             resource_label=paper.submission.reference_number,
             description=f"Commission paper submitted to Manager ODU for review on "
                         f"{paper.submission.reference_number}",
             extra_data={"board_paper_id": paper.id})
        return Response(ODUBoardPaperSerializer(paper).data)

    @action(detail=True, methods=["post"], url_path="manager-approve")
    def manager_approve(self, request, pk=None):
        """Manager: Draft (self-authored) or Submitted -> Manager Approved."""
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        paper = self.get_object()
        profile = _profile(request.user)
        if profile.role != Role.ODU_MANAGER:
            raise PermissionDenied("Only the Manager ODU can approve the Commission paper.")
        if paper.status not in (BoardPaperStatus.DRAFT, BoardPaperStatus.SUBMITTED):
            return Response(
                {"detail": "Only a Draft or Submitted Commission paper can be approved by the manager."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        paper.status = BoardPaperStatus.MANAGER_APPROVED
        paper.manager_approved_at = timezone.now()
        paper.manager_approved_by = request.user
        paper.save(update_fields=["status", "manager_approved_at", "manager_approved_by"])
        _log(request, _AL.Action.UPDATE,
             resource_type="Submission", resource_id=paper.submission_id,
             resource_label=paper.submission.reference_number,
             description=f"Commission paper approved by ODU Manager "
                         f"({request.user.get_full_name() or request.user.username}) on "
                         f"{paper.submission.reference_number}",
             extra_data={"board_paper_id": paper.id})
        return Response(ODUBoardPaperSerializer(paper).data)

    @action(detail=True, methods=["post"], url_path="return-to-principal")
    def return_to_principal(self, request, pk=None):
        """Manager: Submitted -> Draft, with a note on what needs to change."""
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        paper = self.get_object()
        profile = _profile(request.user)
        if profile.role != Role.ODU_MANAGER:
            raise PermissionDenied("Only the Manager ODU can return the Commission paper for changes.")
        if paper.status != BoardPaperStatus.SUBMITTED:
            return Response(
                {"detail": "Only a Submitted Commission paper can be returned for changes."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        note = (request.data.get("note") or "").strip()
        if not note:
            return Response(
                {"detail": "Please describe what needs to change before returning it to the Principal."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        paper.status = BoardPaperStatus.DRAFT
        paper.returned_at = timezone.now()
        paper.returned_by = request.user
        paper.return_note = note
        paper.save(update_fields=["status", "returned_at", "returned_by", "return_note"])
        _log(request, _AL.Action.UPDATE,
             resource_type="Submission", resource_id=paper.submission_id,
             resource_label=paper.submission.reference_number,
             description=f"Commission paper returned to Principal by ODU Manager on "
                         f"{paper.submission.reference_number} | {note}",
             extra_data={"board_paper_id": paper.id})

        recipient = paper.submitted_for_review_by or paper.submission.assigned_to
        if recipient and recipient.is_active:
            manager_name = request.user.get_full_name() or request.user.username
            Notification.objects.create(
                recipient=recipient,
                submission=paper.submission,
                channel=Notification.Channel.BOTH,
                title=f"Commission paper returned for changes: {paper.submission.reference_number}",
                body=(
                    f"{manager_name} returned the ODU submission paper for '{paper.submission.title}' "
                    f"for changes.\n\nNote: {note}"
                ),
            )
        return Response(ODUBoardPaperSerializer(paper).data)

    @action(detail=True, methods=["post"], url_path="secretary-approve")
    def secretary_approve(self, request, pk=None):
        """Secretary: Manager Approved -> Secretary Approved (final sign-off)."""
        from .audit import log_action as _log
        from .models import AuditLog as _AL

        paper = self.get_object()
        profile = _profile(request.user)
        if profile.role not in BOARD_PAPER_SECRETARY_ROLES:
            raise PermissionDenied("Only the Secretary can give final sign-off on the Commission paper.")
        if paper.status != BoardPaperStatus.MANAGER_APPROVED:
            return Response(
                {"detail": "The Commission paper must be approved by the Manager ODU first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        paper.status = BoardPaperStatus.SECRETARY_APPROVED
        paper.secretary_approved_at = timezone.now()
        paper.secretary_approved_by = request.user
        paper.save(update_fields=["status", "secretary_approved_at", "secretary_approved_by"])
        _log(request, _AL.Action.UPDATE,
             resource_type="Submission", resource_id=paper.submission_id,
             resource_label=paper.submission.reference_number,
             description=f"Commission paper given final sign-off by Secretary "
                         f"({request.user.get_full_name() or request.user.username}) on "
                         f"{paper.submission.reference_number}",
             extra_data={"board_paper_id": paper.id})
        return Response(ODUBoardPaperSerializer(paper).data)


def _name_with_role_title(user) -> str:
    full = f"{user.first_name} {user.last_name}".strip() or user.username
    profile = _profile(user)
    title = dict(Role.choices).get(profile.role, profile.role) if profile else ""
    return f"{full}, {title}" if title else full


def _odu_prepared_by_default(submission, fallback_user) -> str:
    # Prefer whoever the Manager ODU has assigned via "Allocate to officer"
    # over whoever merely happens to be viewing the form right now.
    user = submission.assigned_to or fallback_user
    return _name_with_role_title(user)


def _odu_action_officer_default() -> str:
    manager = User.objects.filter(psc_profile__role=Role.ODU_MANAGER).order_by("id").first()
    return _name_with_role_title(manager) if manager else ""


# ── IPDU Board Paper ────────────────────────────────────────────────────────────
# No "assigned officer" concept here (unlike ODU's Principal/Manager tier) —
# Manager IPDU is the only role that drafts, submits, and is notified when
# returned, so every action below checks that role directly rather than the
# ODU pattern's _require_assigned_officer_or_manager.


def _ipdu_action_officer_default() -> str:
    manager = User.objects.filter(psc_profile__role=Role.IPDU_MANAGER).order_by("id").first()
    return _name_with_role_title(manager) if manager else ""


class IPDUBoardPaperViewSet(viewsets.ModelViewSet):
    """
    CRUD for the IPDU Board Paper — the content of the Commission-facing
    Task Force / Allowance Payment submission Manager IPDU prepares.

    Unlike ODU's board paper, this has no separate submit/approve chain of
    its own: the paper is just content, editable while the parent Submission
    is still in Draft. The actual hand-off to the Secretary — and the
    Secretary's approve/return decision — is the Submission's own single
    "Submit" action and the generic workflow-transition buttons on the
    Submission page (Pending Secretary Approval -> Forwarded to Commission,
    or back for changes), exactly like every other submission type. Having
    a second, disconnected "submit the paper" step here was confusing (two
    unrelated-looking submit buttons for what is really one action) and is
    what this replaced.

    GET /ipdu-board-papers/ensure/?submission=<id>  — load or create draft.
    PATCH /ipdu-board-papers/{id}/                  — save content (Draft only).
    """

    serializer_class   = IPDUBoardPaperSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _require_ipdu_role(self, profile):
        if profile.role != Role.IPDU_MANAGER:
            raise PermissionDenied("Only Manager IPDU can access the Commission paper.")

    def _require_view_role(self, profile):
        from .ipdu_rules import IPDU_BOARD_PAPER_VIEW_ROLES

        if profile.role not in IPDU_BOARD_PAPER_VIEW_ROLES:
            raise PermissionDenied("You do not have access to the IPDU Commission paper.")

    def get_queryset(self):
        profile = _profile(self.request.user)
        self._require_view_role(profile)
        qs = IPDUBoardPaper.objects.select_related("submission", "created_by").all()
        sub_id = self.request.query_params.get("submission")
        if sub_id:
            qs = qs.filter(submission_id=sub_id)
        return qs

    @action(detail=False, methods=["get"], url_path="ensure")
    def ensure(self, request):
        """Load the board paper for a submission, creating a blank draft on
        demand while Manager IPDU is actively working the case."""
        from rest_framework.exceptions import ValidationError

        from .ipdu_rules import submission_eligible_for_board_paper, submission_viewable_board_paper

        profile = _profile(request.user)
        self._require_view_role(profile)

        submission_id = request.query_params.get("submission")
        if not submission_id:
            raise ValidationError({"submission": "Query parameter submission is required."})

        submission = get_object_or_404(
            Submission.objects.select_related("ministry", "department"),
            pk=submission_id,
        )
        if not submission_viewable_board_paper(submission):
            return Response(
                {
                    "detail": (
                        "Commission paper is only shown for IPDU-TASKFORCE / IPDU-ALLOWANCE "
                        "submissions routed to IPDU."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        paper = IPDUBoardPaper.objects.filter(submission=submission).first()
        if paper:
            return Response(IPDUBoardPaperSerializer(paper).data)

        if not submission_eligible_for_board_paper(submission) or profile.role != Role.IPDU_MANAGER:
            return Response(
                {"detail": "The Commission paper has not been started for this submission."},
                status=status.HTTP_404_NOT_FOUND,
            )

        paper = IPDUBoardPaper.objects.create(
            submission=submission,
            created_by=request.user,
            subject=submission.title or "",
            prepared_by=_name_with_role_title(request.user),
            action_officer=_ipdu_action_officer_default(),
        )
        return Response(IPDUBoardPaperSerializer(paper).data)

    def perform_create(self, serializer):
        from .ipdu_rules import submission_eligible_for_board_paper

        profile = _profile(self.request.user)
        self._require_ipdu_role(profile)
        submission = serializer.validated_data["submission"]
        if not submission_eligible_for_board_paper(submission):
            raise PermissionDenied(
                "Commission paper can only be created while the submission is with IPDU."
            )
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        from .ipdu_rules import submission_eligible_for_board_paper

        profile = _profile(self.request.user)
        self._require_ipdu_role(profile)
        instance = serializer.instance
        if not submission_eligible_for_board_paper(instance.submission):
            raise PermissionDenied(
                "Commission paper can only be edited while the submission is still a Draft — "
                "use the Submit button on the submission itself to hand it to the Secretary."
            )
        serializer.save()


# ═══════════════════════════════════════════════════════════════════════════════
# ── P1–P4 New Views ───────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

# ── Dashboard Stats (enhanced KPI) ────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats_view(request):
    """Enhanced dashboard KPIs: submission counts, SLA health, stage breakdown."""
    from django.conf import settings as _settings
    from django.db.models import Count, Q

    from .api_cache import _user_scope, cache_enabled, get_cached_response, set_cached_response

    cache_key = f"scdms:dashboard-stats:v1:{_user_scope(request)}"
    if cache_enabled():
        hit = get_cached_response(cache_key)
        if hit is not None:
            return Response(hit)

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
    # Use received_at (when the submission was logged) — matches what the submission list shows
    submitted_this_month = qs.filter(received_at__date__gte=thirty_days_ago).count()
    submitted_this_week = qs.filter(received_at__date__gte=seven_days_ago).count()
    stage_counts = dict(qs.values("current_stage").annotate(n=Count("id")).values_list("current_stage", "n"))

    active_stages = [
        WorkflowStage.DRAFT,
        WorkflowStage.PENDING_DG_ENDORSEMENT,
        WorkflowStage.DG_APPROVED,
        WorkflowStage.PENDING_MANAGER_APPROVAL,
        WorkflowStage.PENDING_SECOND_APPROVAL,
        WorkflowStage.SUBMITTED,
        WorkflowStage.RECEIVED_BY_PSC,
        WorkflowStage.REGISTERED_ROUTED,
        WorkflowStage.RETURNED_FOR_CLARIFICATION,
        WorkflowStage.MANAGER_CHECKLIST_REVIEW,
        WorkflowStage.UNDER_ASSESSMENT,
        WorkflowStage.PENDING_SECRETARY_APPROVAL,
        WorkflowStage.FORWARDED_TO_COMMISSION,
        WorkflowStage.COMMISSION_SITTING,
        WorkflowStage.SECRETARY_REVIEW,
    ]
    overdue = qs.filter(
        current_stage=WorkflowStage.UNDER_ASSESSMENT,
        assessment_deadline_at__lt=now,
    ).count()
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

    data = {
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
    }
    set_cached_response(cache_key, data, _settings.CACHE_DASHBOARD_TTL)
    return Response(data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def system_stats_view(request):
    """Three system-wide, real (not decorative) numbers for the live-stats
    strip shown to every role — ministry HR/DG and OPSC staff alike. Same
    figures for everyone (not per-ministry): this is about showcasing the
    system's overall capability, not personal analytics, so nothing here is
    ministry-specific or otherwise sensitive to show externally.
    """
    from django.conf import settings as _settings

    from .api_cache import cache_enabled, get_cached_response, set_cached_response
    from .models import AIGenerationLog, WorkflowEvent

    # Flat cache key (not per-user) — the numbers are identical for every
    # viewer, so one cached copy serves the whole app instead of one per role.
    cache_key = "scdms:system-stats:v1"
    if cache_enabled():
        hit = get_cached_response(cache_key)
        if hit is not None:
            return Response(hit)

    now = timezone.now()
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    decisions_verified = (
        WorkflowEvent.objects.filter(created_at__gte=year_start)
        .exclude(content_hash="")
        .count()
    )

    submissions_this_month = Submission.objects.filter(
        received_at__gte=month_start, is_attachment=False,
    )
    total_this_month = submissions_this_month.count()
    ai_assisted_ids = (
        AIGenerationLog.objects.filter(
            status=AIGenerationLog.Status.SUCCESS,
            created_at__gte=month_start,
            submission_id__isnull=False,
        )
        .values_list("submission_id", flat=True)
        .distinct()
    )
    ai_assisted_count = submissions_this_month.filter(id__in=ai_assisted_ids).count()
    ai_assisted_pct = round(ai_assisted_count / total_this_month * 100) if total_this_month else None

    # Same SLA definition as dashboard_stats_view, system-wide (no ministry filter).
    active_stages = [
        WorkflowStage.DRAFT, WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.DG_APPROVED,
        WorkflowStage.PENDING_MANAGER_APPROVAL, WorkflowStage.PENDING_SECOND_APPROVAL,
        WorkflowStage.SUBMITTED, WorkflowStage.RECEIVED_BY_PSC, WorkflowStage.REGISTERED_ROUTED,
        WorkflowStage.RETURNED_FOR_CLARIFICATION, WorkflowStage.MANAGER_CHECKLIST_REVIEW,
        WorkflowStage.UNDER_ASSESSMENT, WorkflowStage.PENDING_SECRETARY_APPROVAL,
        WorkflowStage.FORWARDED_TO_COMMISSION, WorkflowStage.COMMISSION_SITTING,
        WorkflowStage.SECRETARY_REVIEW,
    ]
    overdue = Submission.objects.filter(
        current_stage=WorkflowStage.UNDER_ASSESSMENT, assessment_deadline_at__lt=now,
    ).count()
    pending_active = Submission.objects.filter(current_stage__in=active_stages).count()
    sla_pct = round((1 - overdue / pending_active) * 100) if pending_active else 100

    data = {
        "decisions_verified": decisions_verified,
        "ai_assisted_pct": ai_assisted_pct,
        "sla_compliance_pct": sla_pct,
        "generated_at": now.isoformat(),
    }
    set_cached_response(cache_key, data, _settings.CACHE_SYSTEM_STATS_TTL)
    return Response(data)


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
        WorkflowStage.PENDING_SECRETARY_APPROVAL, WorkflowStage.FORWARDED_TO_COMMISSION,
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
        data = list(qs.values("id", "reference_number", "title", "current_stage", "ministry__name", "created_at"))
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
@throttle_classes([AiAnalysisTriggerThrottle])
def trigger_ai_duplicate(request, pk):
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    from .tasks import queue_duplicate_detection
    queue_duplicate_detection(submission.id, force=True)
    return Response({"detail": "Duplicate detection queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_duplicate(request, pk):
    from .serializers import AiDuplicateResultSerializer
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    return Response(AiDuplicateResultSerializer(submission).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([AiAnalysisTriggerThrottle])
def trigger_ai_risk(request, pk):
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    from .tasks import queue_risk_assessment
    queue_risk_assessment(submission.id, force=True)
    return Response({"detail": "Risk assessment queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_risk(request, pk):
    from .serializers import AiRiskResultSerializer
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    return Response(AiRiskResultSerializer(submission).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([AiAnalysisTriggerThrottle])
def trigger_ai_outcome(request, pk):
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    from .tasks import queue_recommended_outcome
    queue_recommended_outcome(submission.id, force=True)
    return Response({"detail": "Outcome recommendation queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_outcome(request, pk):
    from .serializers import AiOutcomeResultSerializer
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    return Response(AiOutcomeResultSerializer(submission).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([AiAnalysisTriggerThrottle])
def trigger_ai_noa(request, pk):
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    deadline_days = int(request.data.get("response_deadline_days", 14))
    from .tasks import queue_notice_of_allegation
    queue_notice_of_allegation(submission.id, response_deadline_days=deadline_days, force=True)
    return Response({"detail": "Notice of Allegation draft queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_noa(request, pk):
    from .serializers import AiNoaResultSerializer
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    return Response(AiNoaResultSerializer(submission).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([AiAnalysisTriggerThrottle])
def trigger_ai_letter(request, pk):
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    outcome = request.data.get("outcome", "")
    conditions = request.data.get("conditions", [])
    from .tasks import queue_outcome_letter
    queue_outcome_letter(submission.id, outcome=outcome, conditions=conditions, force=True)
    return Response({"detail": "Outcome letter draft queued."}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def get_ai_letter(request, pk):
    from .serializers import AiLetterResultSerializer
    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    return Response(AiLetterResultSerializer(submission).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def generate_submission_letter(request, pk):
    """Generate a structured outcome letter for cessation, recruitment, secondment, or leave payout submissions."""
    from .letters import generate_letter
    from .models import LetterTemplate

    submission = get_object_or_404(_submission_queryset_for(request.user), pk=pk)
    try:
        result = generate_letter(submission)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    except LetterTemplate.DoesNotExist:
        return Response(
            {"error": f"No active letter template for form type '{submission.form_type_code}'. Ask a PSC Administrator to check Admin → Letter Templates."},
            status=400,
        )

    # Store in ai_letter fields so the existing AiLetterPanel can display it
    submission.ai_letter_subject = result["subject"]
    submission.ai_letter_content = result["body_html"] or result["body_text"]
    submission.save(update_fields=["ai_letter_subject", "ai_letter_content"])
    return Response({
        "subject": result["subject"],
        "body_text": result["body_text"],
        "body_html": result["body_html"],
    })


# ── Calendar Events ────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def calendar_events_view(request):
    """Commission calendar: meetings + deadlines + SLA warnings."""
    from .models import Meeting, CommissionTask
    profile = _profile(request.user)
    events = []

    meetings_qs = Meeting.objects.all().order_by("date")

    for m in meetings_qs[:50]:
        events.append({
            "id": f"meeting-{m.id}",
            "type": "meeting",
            "title": m.title or f"Commission Meeting #{m.id}",
            "date": m.date.isoformat() if m.date else None,
            "url": f"/meetings/{m.id}",
        })

    for t in CommissionTask.objects.filter(due_date__isnull=False).order_by("due_date")[:50]:
        events.append({
            "id": f"task-{t.id}",
            "type": "task_deadline",
            "title": t.title or "Commission Task",
            "date": t.due_date.isoformat() if t.due_date else None,
            "status": t.status,
            "url": f"/submissions/{t.submission_id}" if t.submission_id else None,
        })

    for sub in Submission.objects.filter(
        current_stage=WorkflowStage.UNDER_ASSESSMENT,
        assessment_deadline_at__isnull=False,
    ).order_by("assessment_deadline_at")[:20]:
        events.append({
            "id": f"sla-{sub.id}",
            "type": "sla_warning",
            "title": f"SLA Warning: {sub.reference_number or sub.title}",
            "date": sub.assessment_deadline_at.date().isoformat(),
            "submission_id": sub.id,
            "url": f"/submissions/{sub.id}",
        })

    events.sort(key=lambda e: e.get("date") or "")
    return Response({"events": events, "total": len(events)})


# ── Pending Decisions View ─────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def pending_decisions_view(request):
    """Submissions currently at Commission stage awaiting a decision."""
    from django.db.models import Count
    profile = _profile(request.user)
    ALLOWED = {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER, Role.PSC_OFFICER,
               Role.PSC_COMMISSIONER, Role.CHAIRPERSON}
    if profile.role not in ALLOWED and not request.user.is_staff:
        raise PermissionDenied("PSC staff and commissioners only.")

    commission_stages = [
        WorkflowStage.FORWARDED_TO_COMMISSION,
        WorkflowStage.COMMISSION_SITTING,
        WorkflowStage.TABLED,
        WorkflowStage.AWAITING_LEGAL_ADVICE,
        WorkflowStage.AWAITING_CABINET_DECISION,
        WorkflowStage.MATTERS_ARISING,
    ]
    qs = Submission.objects.filter(
        current_stage__in=commission_stages
    ).select_related("ministry", "assigned_to").order_by("received_at")

    data = []
    for s in qs[:100]:
        data.append({
            "id": s.id,
            "reference_number": s.reference_number,
            "title": s.title,
            "current_stage": s.current_stage,
            "ministry": s.ministry.name if s.ministry else None,
            "agenda_category": s.agenda_category,
            "received_at": s.received_at.isoformat() if s.received_at else None,
            "scheduled_meeting_date": s.scheduled_meeting.date.isoformat() if s.scheduled_meeting_id else None,
            "assigned_to": (s.assigned_to.get_full_name() or s.assigned_to.username) if s.assigned_to else None,
            "url": f"/submissions/{s.id}",
        })

    stage_summary = dict(
        qs.values("current_stage").annotate(n=Count("id")).values_list("current_stage", "n")
    )

    return Response({
        "submissions": data,
        "total": len(data),
        "by_stage": stage_summary,
    })


# ── Ministry Performance View ──────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def ministry_performance_view(request):
    """Per-ministry submission stats for the Secretary's oversight view."""
    from django.db.models import Count, Q
    profile = _profile(request.user)
    ALLOWED = {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER, Role.PSC_OFFICER}
    if profile.role not in ALLOWED and not request.user.is_staff:
        raise PermissionDenied("PSC staff only.")

    now = timezone.now()
    thirty_days_ago = now.date() - timedelta(days=30)
    terminal_stages = [
        WorkflowStage.APPROVED, WorkflowStage.REJECTED,
        WorkflowStage.RECALLED, WorkflowStage.RETURNED,
    ]
    active_stages = [
        WorkflowStage.DRAFT, WorkflowStage.SUBMITTED,
        WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.DG_APPROVED,
        WorkflowStage.RECEIVED_BY_PSC, WorkflowStage.REGISTERED_ROUTED,
        WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT,
        WorkflowStage.PENDING_SECRETARY_APPROVAL, WorkflowStage.FORWARDED_TO_COMMISSION,
        WorkflowStage.COMMISSION_SITTING,
    ]

    from .models import Ministry
    rows = []
    for ministry in Ministry.objects.all().order_by("name"):
        qs = Submission.objects.filter(ministry=ministry)
        total = qs.count()
        if total == 0:
            continue
        active = qs.filter(current_stage__in=active_stages).count()
        approved = qs.filter(current_stage=WorkflowStage.APPROVED).count()
        overdue = qs.filter(
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            assessment_deadline_at__lt=now,
        ).count()
        recent = qs.filter(received_at__date__gte=thirty_days_ago).count()
        rows.append({
            "ministry_id": ministry.id,
            "ministry": ministry.name,
            "total": total,
            "active": active,
            "approved": approved,
            "overdue": overdue,
            "recent_30d": recent,
            "approval_rate": round(approved / total * 100) if total else 0,
        })

    rows.sort(key=lambda r: r["total"], reverse=True)
    return Response({"ministries": rows, "total_ministries": len(rows)})


# ── Analytics Views ────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def analytics_overview_view(request):
    """Aggregated analytics overview."""
    from django.conf import settings as _settings
    from django.db.models import Count
    from django.db.models.functions import TruncMonth

    from .api_cache import _user_scope, cache_enabled, get_cached_response, set_cached_response

    cache_key = f"scdms:analytics-overview:v1:{_user_scope(request)}"
    if cache_enabled():
        hit = get_cached_response(cache_key)
        if hit is not None:
            return Response(hit)

    qs = Submission.objects.all()
    now = timezone.now()
    total = qs.count()

    # Decision outcome stages — was referencing DECIDED_APPROVED/DECIDED_REJECTED/
    # WITHDRAWN, none of which exist on WorkflowStage (this endpoint 500'd on
    # every call); use the real terminal stages instead.
    approved_count = qs.filter(current_stage=WorkflowStage.APPROVED).count()
    rejected_count = qs.filter(current_stage=WorkflowStage.REJECTED).count()
    deferred_count = qs.filter(current_stage=WorkflowStage.DEFERRED).count()
    decided_stages = [
        WorkflowStage.APPROVED, WorkflowStage.REJECTED, WorkflowStage.DEFERRED,
        WorkflowStage.RECALLED,
    ]

    monthly_counts = dict(
        qs.filter(received_at__year=now.year)
        .annotate(month=TruncMonth("received_at"))
        .values("month")
        .annotate(n=Count("id"))
        .values_list("month", "n")
    )
    monthly_by_number = {m.month: n for m, n in monthly_counts.items() if m}

    data = {
        "total": total,
        "approved": approved_count,
        "rejected": rejected_count,
        "deferred": deferred_count,
        "pending": qs.exclude(current_stage__in=decided_stages).count(),
        "by_form_type": [
            {"form_type": ft, "count": c}
            for ft, c in qs.values("form_type_code").annotate(n=Count("id")).order_by("-n")[:10].values_list("form_type_code", "n")
        ],
        "monthly_submissions": [
            {"month": m, "count": monthly_by_number.get(m, 0)}
            for m in range(1, now.month + 1)
        ],
        "year": now.year,
    }
    set_cached_response(cache_key, data, _settings.CACHE_DASHBOARD_TTL)
    return Response(data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def analytics_trends_view(request):
    """Weekly submission trends over the last 12 weeks."""
    from django.conf import settings as _settings

    from .api_cache import _user_scope, cache_enabled, get_cached_response, set_cached_response

    cache_key = f"scdms:analytics-trends:v1:{_user_scope(request)}"
    if cache_enabled():
        hit = get_cached_response(cache_key)
        if hit is not None:
            return Response(hit)

    span_end = timezone.now().date()
    span_start = span_end - timedelta(weeks=11, days=6)
    # One query for the whole 12-week span, bucketed in Python — same rolling
    # 7-day-window boundaries as before, just without a COUNT(*) per week.
    submitted_dates = list(
        Submission.objects.filter(
            received_at__date__gte=span_start, received_at__date__lte=span_end,
        ).values_list("received_at__date", flat=True)
    )
    weeks = []
    for i in range(11, -1, -1):
        week_end = span_end - timedelta(weeks=i)
        week_start = week_end - timedelta(days=6)
        count = sum(1 for d in submitted_dates if week_start <= d <= week_end)
        weeks.append({"week_start": week_start.isoformat(), "week_end": week_end.isoformat(), "count": count})

    data = {"weekly_trends": weeks}
    set_cached_response(cache_key, data, _settings.CACHE_DASHBOARD_TTL)
    return Response(data)


# ── Implementation Dashboard ───────────────────────────────────────────────────

_IMPL_DASHBOARD_OPS_ROLES = {
    Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER,
    Role.PSC_OFFICER, Role.PSC_MANAGER, Role.PSC_COMMISSIONER, Role.CHAIRPERSON,
}
_IMPL_DASHBOARD_MINISTRY_ROLES = {
    Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY,
}


def _impl_dashboard_scope(request):
    """Return the ministry_id filter for this user (None = all ministries).

    Secretariat/ops roles see everything; ministry roles are forced to their
    own ministry. Everyone else is denied.
    """
    profile = _profile(request.user)
    if profile.role in _IMPL_DASHBOARD_OPS_ROLES or request.user.is_staff:
        ministry_param = request.query_params.get("ministry")
        try:
            return int(ministry_param) if ministry_param else None
        except (TypeError, ValueError):
            return None
    if profile.role in _IMPL_DASHBOARD_MINISTRY_ROLES and profile.ministry_id:
        return profile.ministry_id
    raise PermissionDenied("You do not have access to the implementation dashboard.")


def _parse_date_param(request, key):
    from datetime import datetime

    raw = request.query_params.get(key)
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def implementation_dashboard_view(request):
    """Decision implementation rollup: % implemented within target, by
    ministry, over time. ?date_from=&date_to=&ministry= (dates filter on
    Commission approval date)."""
    from .reports.implementation_rollup import build_implementation_rollup

    ministry_id = _impl_dashboard_scope(request)
    rollup = build_implementation_rollup(
        date_from=_parse_date_param(request, "date_from"),
        date_to=_parse_date_param(request, "date_to"),
        ministry_id=ministry_id,
    )
    return Response(rollup)


def _impl_report_payload(report, request):
    return {
        "id": report.id,
        "label": report.label,
        "period_start": report.period_start,
        "period_end": report.period_end,
        "target_days": report.target_days,
        "summary": report.summary,
        "created_at": report.created_at,
        "requested_by": (
            report.requested_by.get_full_name() or report.requested_by.username
        ) if report.requested_by_id else None,
        "download_url": request.build_absolute_uri(
            f"/api/analytics/implementation/reports/{report.id}/download/"
        ) if report.pdf_file else None,
    }


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def implementation_report_list_view(request):
    """Stored implementation rollup PDFs (quarterly + on demand), newest first."""
    from .models import ImplementationDashboardReport

    profile = _profile(request.user)
    if profile.role not in _IMPL_DASHBOARD_OPS_ROLES and not request.user.is_staff:
        raise PermissionDenied("PSC staff only.")
    reports = ImplementationDashboardReport.objects.select_related("requested_by")[:24]
    return Response({"reports": [_impl_report_payload(r, request) for r in reports]})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def implementation_report_generate_view(request):
    """Generate an implementation rollup PDF now.

    POST {"year": 2026, "quarter": 1} for a specific quarter, or no body for
    the previous (most recently completed) quarter.
    """
    from .models import ImplementationDashboardReport
    from .reports.implementation_rollup import (
        previous_quarter, quarter_bounds, render_implementation_report_pdf,
    )

    profile = _profile(request.user)
    ALLOWED = {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER}
    if profile.role not in ALLOWED and not request.user.is_staff:
        raise PermissionDenied("Only the Secretariat can generate implementation reports.")

    try:
        year = int(request.data.get("year") or 0)
        quarter = int(request.data.get("quarter") or 0)
    except (TypeError, ValueError):
        return Response({"detail": "year and quarter must be integers."}, status=400)
    if not (year and quarter):
        year, quarter = previous_quarter()
    if quarter not in (1, 2, 3, 4) or not (2000 <= year <= 2100):
        return Response({"detail": "Invalid year/quarter."}, status=400)

    period_start, period_end = quarter_bounds(year, quarter)
    report = ImplementationDashboardReport.objects.create(
        label=f"Q{quarter} {year}",
        period_start=period_start,
        period_end=period_end,
        requested_by=request.user,
    )
    render_implementation_report_pdf(report)

    from .audit import log_action as _log
    from .models import AuditLog as _AL
    _log(request, _AL.Action.EXPORT,
         resource_type="ImplementationDashboardReport", resource_id=report.id,
         resource_label=report.label,
         description=f"Implementation rollup PDF generated for {report.label}")

    return Response(_impl_report_payload(report, request), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def implementation_report_download_view(request, pk):
    """Stream a stored implementation rollup PDF."""
    from django.http import FileResponse

    from .models import ImplementationDashboardReport

    profile = _profile(request.user)
    if profile.role not in _IMPL_DASHBOARD_OPS_ROLES and not request.user.is_staff:
        raise PermissionDenied("PSC staff only.")
    report = get_object_or_404(ImplementationDashboardReport, pk=pk)
    if not report.pdf_file:
        return Response({"detail": "PDF file is missing."}, status=404)
    return FileResponse(
        report.pdf_file.open("rb"),
        as_attachment=True,
        filename=report.pdf_file.name.split("/")[-1],
        content_type="application/pdf",
    )


# ── Trash Bin (soft delete + restore) ──────────────────────────────────────────


def _assert_trash_admin(request):
    profile = _profile(request.user)
    if profile.role != Role.PSC_ADMIN and not request.user.is_staff and not request.user.is_superuser:
        raise PermissionDenied("Only PSC Admin may manage the trash bin.")


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def trash_list_view(request):
    """Everything soft-removed and restorable: trashed submissions and
    archived documents, newest first."""
    _assert_trash_admin(request)

    submissions = (
        Submission.all_objects.filter(deleted_at__isnull=False)
        .select_related("ministry", "deleted_by")
        .order_by("-deleted_at")[:200]
    )
    documents = (
        SubmissionDocument.all_objects.filter(archived_at__isnull=False)
        .select_related("submission", "archived_by")
        .order_by("-archived_at")[:200]
    )
    return Response({
        "submissions": [
            {
                "id": s.id,
                "reference_number": s.reference_number,
                "title": s.title,
                "ministry": s.ministry.name if s.ministry_id else None,
                "stage": s.current_stage,
                "is_attachment": s.is_attachment,
                "deleted_at": s.deleted_at,
                "deleted_by": (
                    s.deleted_by.get_full_name() or s.deleted_by.username
                ) if s.deleted_by_id else None,
                "delete_reason": s.delete_reason,
            }
            for s in submissions
        ],
        "documents": [
            {
                "id": d.id,
                "original_name": d.original_name,
                "submission_id": d.submission_id,
                "submission_reference": d.submission.reference_number,
                "archived_at": d.archived_at,
                "archived_by": (
                    d.archived_by.get_full_name() or d.archived_by.username
                ) if d.archived_by_id else None,
            }
            for d in documents
        ],
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trash_restore_view(request):
    """Restore a trashed submission (with attachments trashed alongside it)
    or un-archive a document. POST {"type": "submission"|"document", "id": N}."""
    from .audit import log_action as _log
    from .models import AuditLog as _AL

    _assert_trash_admin(request)
    kind = request.data.get("type")
    try:
        pk = int(request.data.get("id"))
    except (TypeError, ValueError):
        return Response({"detail": "id must be an integer."}, status=400)

    if kind == "submission":
        submission = get_object_or_404(
            Submission.all_objects.filter(deleted_at__isnull=False), pk=pk,
        )
        # Restore attachments trashed in the same action (same timestamp).
        restored = list(
            Submission.all_objects.filter(
                models.Q(pk=submission.pk)
                | models.Q(parent_submission=submission, deleted_at=submission.deleted_at),
            ).values_list("id", flat=True)
        )
        Submission.all_objects.filter(id__in=restored).update(
            deleted_at=None, deleted_by=None, delete_reason="",
        )
        _log(request, _AL.Action.RESTORE,
             resource_type="Submission", resource_id=submission.id,
             resource_label=submission.reference_number,
             description=f"Submission restored from trash: {submission.title}",
             extra_data={"restored_ids": restored})
        invalidate_submission(submission.id)
        return Response({"detail": "Submission restored.", "restored_ids": restored})

    if kind == "document":
        doc = get_object_or_404(
            SubmissionDocument.all_objects.filter(archived_at__isnull=False), pk=pk,
        )
        doc.archived_at = None
        doc.archived_by = None
        doc.save(update_fields=["archived_at", "archived_by"])
        _log(request, _AL.Action.RESTORE,
             resource_type="SubmissionDocument", resource_id=doc.id,
             resource_label=doc.original_name,
             description=f"Document restored from archive: {doc.original_name} "
                         f"on {doc.submission.reference_number}")
        invalidate_submission(doc.submission_id)
        return Response({"detail": "Document restored."})

    return Response({"detail": 'type must be "submission" or "document".'}, status=400)


def _purge_document(doc) -> None:
    """Permanently delete a document: version blobs, current blob, row."""
    for version in doc.versions.all():
        version.file.delete(save=False)
    doc.file.delete(save=False)
    doc.delete()


def _purge_submission(submission) -> list[int]:
    """Permanently delete a trashed submission (and any attachments trashed
    with it): all document/version blobs, served letter PDFs, then the rows
    (WorkflowEvents, checklist items, etc. cascade). Returns purged ids."""
    targets = [submission] + list(
        Submission.all_objects.filter(
            parent_submission=submission, deleted_at__isnull=False,
        )
    )
    purged = []
    for sub in targets:
        for doc in SubmissionDocument.all_objects.filter(submission=sub):
            _purge_document(doc)
        for service in sub.decision_services.all():
            service.letter_pdf.delete(save=False)
        purged.append(sub.id)
        sub.delete()
    return purged


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trash_purge_view(request):
    """Permanently delete one trashed item — the only true deletion in the
    system, admin-only and audit-logged.
    POST {"type": "submission"|"document", "id": N}."""
    from .audit import log_action as _log
    from .models import AuditLog as _AL

    _assert_trash_admin(request)
    kind = request.data.get("type")
    try:
        pk = int(request.data.get("id"))
    except (TypeError, ValueError):
        return Response({"detail": "id must be an integer."}, status=400)

    if kind == "submission":
        submission = get_object_or_404(
            Submission.all_objects.filter(deleted_at__isnull=False), pk=pk,
        )
        ref, title = submission.reference_number, submission.title
        purged = _purge_submission(submission)
        _log(request, _AL.Action.DELETE,
             resource_type="Submission", resource_id=pk, resource_label=ref,
             description=f"Submission PERMANENTLY deleted from trash: {title}",
             extra_data={"purged_ids": purged})
        return Response({"detail": "Submission permanently deleted.", "purged_ids": purged})

    if kind == "document":
        doc = get_object_or_404(
            SubmissionDocument.all_objects.filter(archived_at__isnull=False), pk=pk,
        )
        name, sub_id = doc.original_name, doc.submission_id
        _purge_document(doc)
        _log(request, _AL.Action.DELETE,
             resource_type="SubmissionDocument", resource_id=pk, resource_label=name,
             description=f"Archived document PERMANENTLY deleted from trash: {name}")
        invalidate_submission(sub_id)
        return Response({"detail": "Document permanently deleted."})

    return Response({"detail": 'type must be "submission" or "document".'}, status=400)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trash_empty_view(request):
    """Permanently delete everything in the trash bin. Admin-only."""
    from .audit import log_action as _log
    from .models import AuditLog as _AL

    _assert_trash_admin(request)

    purged_submissions = 0
    # Top-level first; trashed attachments purge with their parent. Any
    # orphaned trashed attachments are swept in the second pass.
    for submission in list(
        Submission.all_objects.filter(deleted_at__isnull=False, is_attachment=False)
    ):
        _purge_submission(submission)
        purged_submissions += 1
    for orphan in list(Submission.all_objects.filter(deleted_at__isnull=False)):
        _purge_submission(orphan)
        purged_submissions += 1

    purged_documents = 0
    for doc in list(SubmissionDocument.all_objects.filter(archived_at__isnull=False)):
        _purge_document(doc)
        purged_documents += 1

    _log(request, _AL.Action.DELETE,
         resource_type="TrashBin", resource_label="Empty trash bin",
         description=f"Trash bin emptied: {purged_submissions} submission(s) and "
                     f"{purged_documents} archived document(s) PERMANENTLY deleted.")
    return Response({
        "detail": "Trash bin emptied.",
        "submissions_purged": purged_submissions,
        "documents_purged": purged_documents,
    })


# ── Annual Report (statistics chapter) ─────────────────────────────────────────

_ANNUAL_REPORT_ROLES = {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER}


def _assert_annual_report_access(request):
    profile = _profile(request.user)
    if profile.role not in _ANNUAL_REPORT_ROLES and not request.user.is_staff:
        raise PermissionDenied("Only the Secretariat may work with the Annual Report.")


def _can_manage_all_reports(user):
    """Super admins, staff and PSC Administrators see and delete every report;
    everyone else is scoped to the reports they generated themselves."""
    return bool(
        user.is_superuser or user.is_staff or _profile(user).role == Role.PSC_ADMIN
    )


def _annual_report_payload(report, request):
    can_delete = (
        _can_manage_all_reports(request.user)
        or report.requested_by_id == request.user.id
    )
    return {
        "id": report.id,
        "year": report.year,
        "period_type": report.period_type,
        "period_label": report.period_label or (str(report.year) if report.year else None),
        "created_at": report.created_at,
        "requested_by": (
            report.requested_by.get_full_name() or report.requested_by.username
        ) if report.requested_by_id else None,
        "can_delete": can_delete,
        "summary": {
            "total_received": (report.dataset.get("intake") or {}).get("total_received"),
            "total_decided": (report.dataset.get("decisions") or {}).get("total_decided"),
            "approval_rate": (report.dataset.get("decisions") or {}).get("approval_rate"),
            "pct_within_target": ((report.dataset.get("implementation") or {}).get("overall") or {}).get("pct_within_target"),
            "avg_agenda_per_sitting": (report.dataset.get("sittings") or {}).get("avg_agenda_per_sitting"),
        },
        "download_url": request.build_absolute_uri(
            f"/api/reports/annual/{report.id}/download/"
        ) if report.pdf_file else None,
    }


def _parse_report_year(raw):
    try:
        year = int(raw)
    except (TypeError, ValueError):
        return None
    return year if 2000 <= year <= 2100 else None


# Sections a caller may include in a generated report.
_REPORT_SECTIONS = {
    "intake", "sittings", "decisions", "timeliness",
    "implementation", "tasks", "decision_service", "ministries",
}


def _parse_report_period(source):
    """Resolve period-selector params from a query-dict or POST body into
    (start_dt, end_dt, label, key, period_type, include)."""
    from .reports.annual_report import resolve_period

    get = source.get
    period_type = (get("period_type") or "annual").lower()
    if period_type not in {"annual", "quarterly", "monthly", "custom"}:
        period_type = "annual"

    start, end, label, key = resolve_period(
        period_type,
        year=get("year"),
        quarter=get("quarter"),
        month=get("month"),
        date_from=get("date_from"),
        date_to=get("date_to"),
    )

    raw_include = source.getlist("include") if hasattr(source, "getlist") else get("include")
    if isinstance(raw_include, str):
        raw_include = [raw_include]
    flat: list[str] = []
    for item in (raw_include or []):
        flat.extend(str(item).split(","))
    include = [s.strip() for s in flat if s.strip() in _REPORT_SECTIONS] or None

    return start, end, label, key, period_type, include


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def annual_report_preview_view(request):
    """Live (unfrozen) statistics dataset for a period — on-screen preview.
    Query: ?period_type=annual|quarterly|monthly|custom plus year/quarter/month
    or date_from/date_to, and optional repeated ?include=… section flags.
    Defaults to the previous calendar year."""
    from .reports.annual_report import build_report_dataset

    _assert_annual_report_access(request)
    start, end, label, key, period_type, include = _parse_report_period(request.query_params)
    return Response(build_report_dataset(
        start, end, include=include,
        period={"type": period_type, "label": label, "key": key},
    ))


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def annual_report_list_view(request):
    from .models import AnnualReport

    _assert_annual_report_access(request)
    qs = AnnualReport.objects.select_related("requested_by")
    if not _can_manage_all_reports(request.user):
        qs = qs.filter(requested_by=request.user)
    reports = qs[:24]
    return Response({"reports": [_annual_report_payload(r, request) for r in reports]})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def annual_report_generate_view(request):
    """Freeze the dataset and render the statistics PDF for the chosen period.
    POST {period_type, year/quarter/month or date_from/date_to, include:[…]}.
    Defaults to the previous calendar year."""
    from .audit import log_action as _log
    from .models import AnnualReport, AuditLog as _AL
    from .reports.annual_report import build_report_dataset, render_report_pdf

    _assert_annual_report_access(request)
    start, end, label, key, period_type, include = _parse_report_period(request.data)

    report = AnnualReport.objects.create(
        year=timezone.localtime(start).year,
        period_type=period_type,
        period_start=timezone.localtime(start).date(),
        period_end=timezone.localtime(end).date(),
        period_label=label,
        options={"include": include} if include else {},
        dataset=build_report_dataset(
            start, end, include=include,
            period={"type": period_type, "label": label, "key": key},
        ),
        requested_by=request.user,
    )
    render_report_pdf(report)

    _log(request, _AL.Action.EXPORT,
         resource_type="AnnualReport", resource_id=report.id,
         resource_label=f"Report statistics {label}",
         description=f"Report statistics generated for {label}")

    return Response(_annual_report_payload(report, request), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def annual_report_download_view(request, pk):
    from django.http import FileResponse

    from .models import AnnualReport

    _assert_annual_report_access(request)
    report = get_object_or_404(AnnualReport, pk=pk)
    if not (_can_manage_all_reports(request.user)
            or report.requested_by_id == request.user.id):
        raise PermissionDenied("You can only download reports you generated.")
    if not report.pdf_file:
        return Response({"detail": "PDF file is missing."}, status=404)
    return FileResponse(
        report.pdf_file.open("rb"),
        as_attachment=True,
        filename=report.pdf_file.name.split("/")[-1],
        content_type="application/pdf",
    )


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def annual_report_delete_view(request, pk):
    """Delete a generated report. Admins may delete any; other Secretariat
    users may delete only the reports they generated themselves."""
    from .audit import log_action as _log
    from .models import AnnualReport, AuditLog as _AL

    _assert_annual_report_access(request)
    report = get_object_or_404(AnnualReport, pk=pk)
    if not (_can_manage_all_reports(request.user)
            or report.requested_by_id == request.user.id):
        raise PermissionDenied("You can only delete reports you generated.")

    label = report.period_label or (str(report.year) if report.year else f"#{report.id}")
    if report.pdf_file:
        report.pdf_file.delete(save=False)
    report.delete()

    _log(request, _AL.Action.DELETE,
         resource_type="AnnualReport", resource_id=pk,
         resource_label=f"Report statistics {label}",
         description=f"Generated report deleted: {label}")

    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Workload Views ─────────────────────────────────────────────────────────────

_WORKLOAD_VIEWER_ROLES = {
    Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER, Role.PSC_MANAGER,
    Role.VIPAM_MANAGER, Role.HR_UNIT_MANAGER, Role.ODU_MANAGER,
    Role.COMPLIANCE_MANAGER, Role.CSU_MANAGER,
}


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def workload_summary_view(request):
    """Age-weighted staff workload: submissions and tasks per officer/unit,
    plus review-duration averages. Powers the Workload Dashboard."""
    from .reports.workload import build_workload_summary

    profile = _profile(request.user)
    if profile.role not in _WORKLOAD_VIEWER_ROLES and not request.user.is_staff:
        raise PermissionDenied("Secretariat and unit managers only.")
    return Response(build_workload_summary())


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
        WorkflowStage.PENDING_SECRETARY_APPROVAL, WorkflowStage.FORWARDED_TO_COMMISSION,
    ]

    officers = AuthUser.objects.filter(
        is_active=True,
        psc_profile__role__in=[Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER],
    ).annotate(
        active_count=Count("assigned_submissions", filter=models.Q(assigned_submissions__current_stage__in=active_stages))
    ).order_by("active_count").select_related("psc_profile")

    return Response({
        "officers": [
            {
                "id": o.id,
                "username": o.username,
                "full_name": f"{o.first_name} {o.last_name}".strip() or o.username,
                "role": getattr(getattr(o, "psc_profile", None), "role", ""),
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

    from .ai.reliability import FEATURE_WORKLOAD_SUGGESTION, log_ai_call, timed_call
    from .models import AIGenerationLog

    with timed_call() as elapsed:
        data, err = suggest_assignment(submission_ctx, officers_ctx)
    if err or not data:
        detail = err or "empty response"
        log_ai_call(feature=FEATURE_WORKLOAD_SUGGESTION, submission_id=submission.id,
                    status=AIGenerationLog.Status.FAILED, error_detail=detail, latency_ms=elapsed())
        return Response({"detail": f"AI suggestion failed: {detail}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    log_ai_call(feature=FEATURE_WORKLOAD_SUGGESTION, submission_id=submission.id,
                status=AIGenerationLog.Status.SUCCESS, latency_ms=elapsed())
    return Response(data)


# ── AI Reliability Dashboard ───────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def ai_reliability_view(request):
    """Per-feature AI call success/failure rates and recent failures —
    Administration -> AI reliability. Reads AIGenerationLog, populated by
    every AI Celery task and synchronous AI view (see tracker/ai/reliability.py).
    """
    from django.db.models import Avg, Count, Q

    from .ai.reliability import ALL_FEATURES
    from .models import AIGenerationLog

    profile = _profile(request.user)
    if profile.role != Role.PSC_ADMIN and not request.user.is_staff:
        raise PermissionDenied("Administrators only.")

    try:
        window_hours = int(request.query_params.get("window_hours", 24))
    except (TypeError, ValueError):
        window_hours = 24
    window_hours = max(1, min(window_hours, 24 * 30))
    since = timezone.now() - timedelta(hours=window_hours)

    qs = AIGenerationLog.objects.filter(created_at__gte=since)

    by_feature = {
        row["feature"]: row
        for row in qs.values("feature").annotate(
            total=Count("id"),
            success=Count("id", filter=Q(status=AIGenerationLog.Status.SUCCESS)),
            failed=Count("id", filter=Q(status=AIGenerationLog.Status.FAILED)),
            retrying=Count("id", filter=Q(status=AIGenerationLog.Status.RETRYING)),
            avg_latency_ms=Avg("latency_ms", filter=Q(status=AIGenerationLog.Status.SUCCESS)),
        )
    }
    last_failures = {
        row["feature"]: row
        for row in qs.filter(status=AIGenerationLog.Status.FAILED)
        .values("feature")
        .annotate(last_failure_at=models.Max("created_at"))
    }

    features = []
    for name in ALL_FEATURES:
        row = by_feature.get(name)
        total = row["total"] if row else 0
        success = row["success"] if row else 0
        failed = row["failed"] if row else 0
        retrying = row["retrying"] if row else 0
        last_failure_at = last_failures.get(name, {}).get("last_failure_at")
        last_failure_log = None
        if last_failure_at:
            last_failure_log = (
                qs.filter(feature=name, status=AIGenerationLog.Status.FAILED)
                .order_by("-created_at")
                .values("created_at", "error_detail")
                .first()
            )
        features.append({
            "feature": name,
            "total": total,
            "success": success,
            "failed": failed,
            "retrying": retrying,
            "success_rate_pct": round(success / total * 100) if total else None,
            "avg_latency_ms": round(row["avg_latency_ms"]) if row and row["avg_latency_ms"] else None,
            "last_failure_at": last_failure_log["created_at"].isoformat() if last_failure_log else None,
            "last_failure_detail": last_failure_log["error_detail"] if last_failure_log else "",
        })

    recent_failures = [
        {
            "feature": row.feature,
            "submission_id": row.submission_id,
            "submission_ref": row.submission.reference_number if row.submission_id and row.submission else None,
            "detail": row.error_detail,
            "attempt": row.attempt,
            "created_at": row.created_at.isoformat(),
        }
        for row in qs.filter(status=AIGenerationLog.Status.FAILED)
        .select_related("submission")
        .order_by("-created_at")[:25]
    ]

    return Response({
        "window_hours": window_hours,
        "generated_at": timezone.now().isoformat(),
        "features": features,
        "recent_failures": recent_failures,
    })


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def integrity_flags_view(request):
    """GET: list open/resolved workflow-integrity flags (Administration ->
    Integrity Flags). POST: run the sweep on demand instead of waiting for
    the nightly schedule — see tracker/integrity_sweep.py for the checks.
    """
    from .integrity_sweep import CHECKS
    from .models import IntegrityFlag

    profile = _profile(request.user)
    if profile.role != Role.PSC_ADMIN and not request.user.is_staff:
        raise PermissionDenied("Administrators only.")

    if request.method == "POST":
        from .integrity_sweep import run_sweep

        run_sweep()
        return Response({"detail": "Sweep complete."})

    show = request.query_params.get("show", "open")
    qs = IntegrityFlag.objects.select_related("submission").order_by("-detected_at")
    if show == "open":
        qs = qs.filter(resolved_at__isnull=True)
    elif show == "resolved":
        qs = qs.filter(resolved_at__isnull=False)
    # show == "all" — no filter

    flags = [
        {
            "id": f.id,
            "check_name": f.check_name,
            "submission_id": f.submission_id,
            "submission_ref": f.submission.reference_number if f.submission_id else None,
            "submission_title": f.submission.title if f.submission_id else None,
            "detail": f.detail,
            "detected_at": f.detected_at.isoformat(),
            "resolved_at": f.resolved_at.isoformat() if f.resolved_at else None,
        }
        for f in qs[:200]
    ]
    return Response({
        "checks": list(CHECKS.keys()),
        "open_count": IntegrityFlag.objects.filter(resolved_at__isnull=True).count(),
        "flags": flags,
    })


# ── Active Sessions (Administration -> Security -> Active Sessions) ────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def active_sessions_view(request):
    """Per-user online/last-seen status, computed from User.last_login plus
    AuditLog LOGOUT entries and each user's current TrustedSession — a
    Messenger-style "online now" / "last seen 45 minutes ago" view for
    admins, not a new tracking mechanism of its own.

    Uses User.last_login (SIMPLE_JWT's UPDATE_LAST_LOGIN, refreshed on every
    token refresh — not just the initial sign-in) rather than AuditLog's own
    LOGIN entries: those are written from one specific code path in the
    login view and go stale for anyone who authenticates via 2FA or a
    PIN-based trusted-session unlock, which don't hit that path — the
    original version of this view showed a PSC Admin's own live session as
    "logged out" hours ago while they were actively using it, for exactly
    this reason. last_login reflects genuine ongoing activity instead.

    A user counts as online when all of the following hold: they haven't
    logged out manually (a LOGOUT audit entry after their last login), their
    session hasn't passed its cap (5pm Vanuatu time same day, or 12h after
    login, whichever is sooner — doesn't apply to PSC Administrators, who
    are exempt, see logout_scheduler.py / tasks.force_logout_non_admin_users),
    and — this is what makes it "who's active right now" rather than "whose
    session is still theoretically valid" — last_login is recent enough that
    their browser must still be open and talking to the API. last_login only
    moves on real activity (sign-in, or the reactive refresh the frontend
    fires when an access token expires), so anyone genuinely still using the
    system will have refreshed within one access-token lifetime; anyone who
    closed the tab simply stops generating that signal even though nothing
    "ended" their session. Applies uniformly, including to admins: cap
    exemption is about forced-logout policy, not about what counts as active
    for display. "Last seen" is whichever of the three actually ended the
    session (logout, cap expiry, or last_login itself once it's gone stale).
    """
    from datetime import timedelta

    from django.conf import settings
    from django.contrib.auth.models import User as _User

    from .models import AuditLog, TrustedSession

    profile = _profile(request.user)
    if profile.role != Role.PSC_ADMIN and not request.user.is_staff and not request.user.is_superuser:
        raise PermissionDenied("Administrators only.")

    now = timezone.now()
    # A little more than the access-token lifetime: the frontend only
    # refreshes reactively (on a 401 from a real API call), so there's a
    # short window right after expiry where a genuinely-active user hasn't
    # refreshed yet.
    recent_activity_cutoff = now - (
        settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] + timedelta(minutes=10)
    )

    last_logout = {
        row["actor_id"]: row["timestamp"]
        for row in (
            AuditLog.objects.filter(action=AuditLog.Action.LOGOUT, actor_id__isnull=False)
            .order_by("actor_id", "-timestamp").distinct("actor_id")
            .values("actor_id", "timestamp")
        )
    }
    last_session = {
        row.user_id: row
        for row in TrustedSession.objects.order_by("user_id", "-started_at").distinct("user_id")
    }

    users = (
        _User.objects.filter(is_active=True)
        .select_related("psc_profile")
        .order_by("username")
    )

    results = []
    for u in users:
        u_profile = getattr(u, "psc_profile", None)
        role = u_profile.role if u_profile else ""
        is_exempt_from_cap = role == Role.PSC_ADMIN or u.is_superuser

        login_at = u.last_login
        logout_at = last_logout.get(u.id)
        session = last_session.get(u.id)

        is_online = False
        last_seen_at = None

        if login_at is not None:
            if logout_at and logout_at > login_at:
                last_seen_at = logout_at
            elif not is_exempt_from_cap and session and session.expires_at <= now:
                last_seen_at = session.expires_at
            elif login_at < recent_activity_cutoff:
                last_seen_at = login_at
            else:
                is_online = True

        results.append({
            "id": u.id,
            "username": u.username,
            "full_name": (f"{u.first_name} {u.last_name}".strip()) or u.username,
            "email": u.email,
            "role": role,
            "last_login_at": login_at,
            "is_online": is_online,
            "last_seen_at": last_seen_at,
            "session_expires_at": session.expires_at if (session and is_online and not is_exempt_from_cap) else None,
        })

    def _sort_key(r):
        if r["is_online"]:
            return (0, -(r["last_login_at"].timestamp() if r["last_login_at"] else 0))
        if r["last_seen_at"]:
            return (1, -(r["last_seen_at"].timestamp()))
        return (2, 0)

    results.sort(key=_sort_key)

    return Response({
        "online_count": sum(1 for r in results if r["is_online"]),
        "users": results,
    })


# ── Audit Log Search ───────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def audit_log_search_view(request):
    """Full-text + filter search of AuditLog entries."""
    from .models import AuditLog

    if not rbac_user_can_view_audit_log(request.user) and not request.user.is_staff:
        raise PermissionDenied("You do not have permission to view audit logs.")

    qs = AuditLog.objects.select_related("actor").order_by("-timestamp")

    q = request.query_params.get("q", "").strip()
    user_id = request.query_params.get("user_id")
    action_filter = request.query_params.get("action")
    resource_type = request.query_params.get("resource_type")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")

    if q:
        qs = qs.filter(models.Q(description__icontains=q) | models.Q(resource_label__icontains=q) | models.Q(actor_username__icontains=q))
    if user_id:
        qs = qs.filter(actor_id=user_id)
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
                "user": log.actor_username or None,
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
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Read-only version history for PSC staff (cross-submission audit view).

    Versions are created exclusively by the document replace endpoint
    (POST /submissions/{id}/documents/{doc_id}/replace/), never directly.
    Per-submission history with RBAC lives on the SubmissionViewSet
    documents/{doc_id}/versions/ action.
    """
    permission_classes = [permissions.IsAuthenticated]

    _STAFF_ROLES = {
        Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER,
        Role.PSC_OFFICER, Role.PSC_MANAGER,
    }

    def get_serializer_class(self):
        from .serializers import DocumentVersionSerializer
        return DocumentVersionSerializer

    def get_queryset(self):
        from .models import DocumentVersion
        profile = _profile(self.request.user)
        if profile.role not in self._STAFF_ROLES and not self.request.user.is_staff:
            return DocumentVersion.objects.none()
        qs = DocumentVersion.objects.select_related("document", "uploaded_by")
        doc_id = self.request.query_params.get("document")
        if doc_id:
            qs = qs.filter(document_id=doc_id)
        return qs


# ── Submission Checklist Response ─────────────────────────────────────────────

# Roles that can fill/edit the checklist during manager_checklist_review
CHECKLIST_EDIT_STAGE   = WorkflowStage.MANAGER_CHECKLIST_REVIEW
CHECKLIST_EDIT_ROLES   = frozenset({
    Role.ODU_MANAGER, Role.ODU_PRINCIPAL, Role.ODU_SENIOR,
    Role.HR_UNIT_MANAGER, Role.HR_UNIT_PRINCIPAL, Role.HR_UNIT_SENIOR,
    Role.VIPAM_MANAGER, Role.VIPAM_PRINCIPAL, Role.VIPAM_SENIOR,
    Role.PSC_ADMIN,
})
# Roles that can view the completed checklist in later stages
CHECKLIST_VIEW_STAGES  = frozenset({
    WorkflowStage.UNDER_ASSESSMENT,
    WorkflowStage.PENDING_SECRETARY_APPROVAL,
    WorkflowStage.SECRETARY_REVIEW,
    WorkflowStage.RETURNED_FOR_CLARIFICATION,
    WorkflowStage.DEFERRED,
    WorkflowStage.TABLED,
    WorkflowStage.AWAITING_LEGAL_ADVICE,
    WorkflowStage.AWAITING_CABINET_DECISION,
    WorkflowStage.RESUBMITTED,
    WorkflowStage.FORWARDED_TO_COMMISSION,
    WorkflowStage.COMMISSION_SITTING,
    WorkflowStage.MATTERS_ARISING,
    WorkflowStage.APPROVED,
    WorkflowStage.REJECTED,
    WorkflowStage.RETURNED,
    WorkflowStage.DEFERRED_BACK_TO_HR,
    WorkflowStage.MINUTES_DRAFTED_SIGNED,
    WorkflowStage.DECISION_ENTERED_ASSIGNED,
    WorkflowStage.UNDER_IMPLEMENTATION,
    WorkflowStage.IMPLEMENTATION_REPORT,
})
CHECKLIST_VIEW_ROLES   = CHECKLIST_EDIT_ROLES | frozenset({
    Role.PSC_OFFICER, Role.PSC_SECRETARY,
    Role.SENIOR_ADMIN_OFFICER, Role.PSC_MANAGER,
    # Commissioners need to review assessment work when voting in Commission Sitting
    Role.PSC_COMMISSIONER, Role.CHAIRPERSON,
})
CHECKLIST_APPROVE_ROLES = frozenset({
    # All unit managers can approve checklists for their own unit's submissions
    Role.ODU_MANAGER,
    Role.HR_UNIT_MANAGER,
    Role.VIPAM_MANAGER,
    Role.COMPLIANCE_MANAGER,  # compliance_senior cannot approve — manager only
    Role.CSU_MANAGER,
    Role.PSC_ADMIN,
})


class SubmissionChecklistViewSet(viewsets.GenericViewSet):
    """
    Dynamic checklist attached to a submission.

    GET  /submission-checklists/ensure/?submission=<id>
         Load (or create) the checklist response for the authenticated user.
    PATCH /submission-checklists/<id>/
         Save draft answers.
    POST /submission-checklists/<id>/submit/
         Principal submits for manager review.
    POST /submission-checklists/<id>/approve/
         Manager approves.
    POST /submission-checklists/<id>/return/
         Manager returns for revision.
    """

    serializer_class   = SubmissionChecklistResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _profile_and_submission(self, request, submission_id=None):
        profile = _profile(request.user)
        if submission_id:
            submission = get_object_or_404(Submission, pk=submission_id)
        else:
            submission = None
        return profile, submission

    @action(detail=False, methods=["get"], url_path="ensure")
    def ensure(self, request):
        """Return the checklist response for a submission, creating it if it doesn't exist."""
        from django.utils import timezone

        submission_id = request.query_params.get("submission")
        if not submission_id:
            return Response({"detail": "submission query parameter required."}, status=400)

        profile, submission = self._profile_and_submission(request, submission_id)

        from .submission_checklist import resolve_checklist_form_type

        checklist_ft = resolve_checklist_form_type(submission)

        if not checklist_ft:
            return Response(
                {"detail": "No checklist is configured for this submission type."},
                status=404,
            )

        stage = submission.current_stage
        can_edit = (
            profile.role in CHECKLIST_EDIT_ROLES or request.user.is_superuser
        ) and stage == CHECKLIST_EDIT_STAGE
        can_view = (
            profile.role in CHECKLIST_VIEW_ROLES or request.user.is_superuser
        ) and (stage in CHECKLIST_VIEW_STAGES or stage == CHECKLIST_EDIT_STAGE)

        if not can_view and not can_edit:
            raise PermissionDenied("You do not have access to this checklist.")

        checklist, created = SubmissionChecklistResponse.objects.get_or_create(
            submission=submission,
            checklist_form_type=checklist_ft,
            defaults={"created_by": request.user, "data": {}},
        )

        # Compile in whatever the system can already verify (the ministry's
        # own digitized form answers, Required Documents, workflow facts) —
        # only ever fills currently-empty fields, never overwrites an answer
        # a reviewer already gave. Re-applied on every load while still
        # Draft so a newly-uploaded document gets picked up too.
        if checklist.status == SubmissionChecklistResponse.Status.DRAFT:
            from .submission_checklist_prefill import apply_prefill

            if apply_prefill(checklist, submission, checklist_ft.code):
                checklist.save(update_fields=["data"])

        serializer = SubmissionChecklistResponseSerializer(checklist)
        data = serializer.data
        data["can_edit"] = can_edit
        data["can_approve"] = profile.role in CHECKLIST_APPROVE_ROLES or request.user.is_superuser
        return Response(data)

    def partial_update(self, request, pk=None):
        """PATCH — save draft answers."""
        checklist = get_object_or_404(SubmissionChecklistResponse, pk=pk)
        profile   = _profile(request.user)
        stage     = checklist.submission.current_stage

        if not (profile.role in CHECKLIST_EDIT_ROLES or request.user.is_superuser):
            raise PermissionDenied("Only checklist reviewers can edit this checklist.")
        assigned_to_id = checklist.submission.assigned_to_id
        if (
            not request.user.is_superuser
            and profile.role != Role.PSC_ADMIN
            and profile.role in OPSC_UNIT_MANAGER_ROLES
            and assigned_to_id
            and assigned_to_id != request.user.id
        ):
            assignee = checklist.submission.assigned_to
            assignee_name = assignee.get_full_name() or assignee.username
            raise PermissionDenied(
                f"This submission is assigned to {assignee_name} for review — unassign it first "
                "if you need to edit the checklist yourself."
            )
        if checklist.status == SubmissionChecklistResponse.Status.APPROVED:
            return Response({"detail": "Approved checklists cannot be edited."}, status=400)

        allowed_fields = {"data", "manager_comments"}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = SubmissionChecklistResponseSerializer(
            checklist, data=data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def autofill(self, request, pk=None):
        """AI suggestions for the checklist's still-blank fields, extracted
        from this submission's uploaded documents. Never writes anything —
        the reviewer accepts each suggestion via the normal PATCH, same as
        the Required Documents checklist's autofill."""
        from .ai.checklist_autofill import suggest_checklist_field_values
        from .ai_settings import checklist_autofill_enabled

        checklist = get_object_or_404(SubmissionChecklistResponse, pk=pk)
        profile = _profile(request.user)
        if not (profile.role in CHECKLIST_EDIT_ROLES or request.user.is_superuser):
            raise PermissionDenied("Only checklist reviewers can use AI autofill.")
        if not checklist_autofill_enabled():
            return Response(
                {"detail": "AI checklist autofill is currently disabled by the administrator."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_data = checklist.data or {}
        blank_fields = [
            {
                "field_key": f.field_key,
                "label": f.label,
                "field_type": f.field_type,
                "help_text": f.help_text,
            }
            for f in checklist.checklist_form_type.fields.exclude(field_type="section_header")
            if current_data.get(f.field_key) in (None, "")
        ]

        suggestions, err = suggest_checklist_field_values(checklist.submission, blank_fields)
        return Response({
            "disclaimer": "AI draft — verify before accepting.",
            "suggestions": suggestions,
            "error": err,
        })

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Principal submits the checklist for manager review."""
        from django.utils import timezone

        checklist = get_object_or_404(SubmissionChecklistResponse, pk=pk)
        profile   = _profile(request.user)

        if profile.role not in (CHECKLIST_EDIT_ROLES - CHECKLIST_APPROVE_ROLES) and not request.user.is_superuser:
            raise PermissionDenied("Only the assigned principal can submit the checklist.")
        if checklist.status not in (
            SubmissionChecklistResponse.Status.DRAFT,
            SubmissionChecklistResponse.Status.RETURNED,
        ):
            return Response({"detail": "Only draft or returned checklists can be submitted."}, status=400)

        checklist.status       = SubmissionChecklistResponse.Status.SUBMITTED
        checklist.submitted_at = timezone.now()
        checklist.save(update_fields=["status", "submitted_at", "updated_at"])
        return Response(SubmissionChecklistResponseSerializer(checklist).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Manager approves the submitted checklist."""
        from django.utils import timezone

        checklist = get_object_or_404(SubmissionChecklistResponse, pk=pk)
        profile   = _profile(request.user)

        if profile.role not in CHECKLIST_APPROVE_ROLES and not request.user.is_superuser:
            raise PermissionDenied("Only the ODU Manager or admin can approve the checklist.")
        if checklist.status != SubmissionChecklistResponse.Status.SUBMITTED:
            return Response({"detail": "Only submitted checklists can be approved."}, status=400)

        checklist.status      = SubmissionChecklistResponse.Status.APPROVED
        checklist.approved_at = timezone.now()
        if request.data.get("manager_comments"):
            checklist.manager_comments = request.data["manager_comments"]
        checklist.save(update_fields=["status", "approved_at", "manager_comments", "updated_at"])
        return Response(SubmissionChecklistResponseSerializer(checklist).data)

    @action(detail=True, methods=["post"])
    def return_for_revision(self, request, pk=None):
        """Manager returns the checklist to the principal for revision."""
        checklist = get_object_or_404(SubmissionChecklistResponse, pk=pk)
        profile   = _profile(request.user)

        if profile.role not in CHECKLIST_APPROVE_ROLES and not request.user.is_superuser:
            raise PermissionDenied("Only the ODU Manager or admin can return a checklist.")
        if checklist.status != SubmissionChecklistResponse.Status.SUBMITTED:
            return Response({"detail": "Only submitted checklists can be returned."}, status=400)

        checklist.status           = SubmissionChecklistResponse.Status.RETURNED
        checklist.manager_comments = request.data.get("manager_comments", checklist.manager_comments)
        checklist.save(update_fields=["status", "manager_comments", "updated_at"])

        # Notify the principal who submitted the checklist
        principal = checklist.created_by
        if principal and principal.is_active:
            manager_name = request.user.get_full_name() or request.user.username
            comment = (checklist.manager_comments or "").strip()
            from .models import Notification as _Notif
            _Notif.objects.create(
                recipient=principal,
                submission=checklist.submission,
                channel=_Notif.Channel.BOTH,
                title=f"Checklist returned for revision: {checklist.submission.reference_number}",
                body=(
                    f"{manager_name} has returned your checklist for '{checklist.submission.title}' "
                    f"for revision."
                    + (f"\n\nManager note: {comment}" if comment else "")
                ),
            )

        return Response(SubmissionChecklistResponseSerializer(checklist).data)
