from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views_webhooks import cms_register_submission, cms_signoff_callback
from .staff_chat_views import StaffChatSessionViewSet
from .deadline_reminder_views import DeadlineReminderDraftViewSet
from .ui_translation_views import UiTranslationViewSet
from .daily_brief.views import DailyBriefViewSet
from .views import (
    AuditLogViewSet,
    BackupViewSet,
    CommissionTaskViewSet,
    ODUChecklistViewSet,
    SecurityNoticeViewSet,
    DepartmentViewSet,
    DocumentAnnotationViewSet,
    DocumentSignatureViewSet,
    MySignatureView,
    VerifyPinView,
    FormCategoryViewSet,
    PSCFormFieldViewSet,
    PSCFormTypeViewSet,
    KnowledgeCategoryViewSet,
    KnowledgeArticleViewSet,
    RequiredDocumentViewSet,
    MeetingViewSet,
    AgendaItemViewSet,
    MinistryViewSet,
    MinutesViewSet,
    TranscriptViewSet,
    NotificationViewSet,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    TOTPSetupView,
    TOTPVerifySetupView,
    DisableTOTPView,
    SessionPinSetupView,
    SessionPinVerifyView,
    RoleDefinitionViewSet,
    SecurityIncidentViewSet,
    SecurityScanViewSet,
    SubmissionViewSet,
    SystemPermissionViewSet,
    TokenObtainPairView,
    LogoutView,
    UserAdminViewSet,
    VerifyOTPView,
    APIKeyViewSet,
    SystemSettingViewSet,
    EmailTemplateViewSet,
    FeedbackViewSet,
    FeedbackCommentViewSet,
    FeedbackStatusView,
    dashboard_view,
    reports_view,
    ai_smart_report_view,
    me_view,
    change_password_view,
    password_policy_view,
    security_audit_view,
    api_inventory_view,
    global_search_view,
    # ── P1–P4 New Views ─────────────────────────────────────────────────────
    dashboard_stats_view,
    submission_sla_view,
    submission_bulk_action_view,
    trigger_ai_duplicate,
    get_ai_duplicate,
    trigger_ai_risk,
    get_ai_risk,
    trigger_ai_outcome,
    get_ai_outcome,
    trigger_ai_noa,
    get_ai_noa,
    trigger_ai_letter,
    get_ai_letter,
    calendar_events_view,
    analytics_overview_view,
    analytics_trends_view,
    workload_officers_view,
    workload_suggest_assignment_view,
    audit_log_search_view,
    WebPushSubscriptionViewSet,
    DocumentVersionViewSet,
)

router = DefaultRouter()
router.register(r"submissions", SubmissionViewSet, basename="submission")
router.register(r"ministries", MinistryViewSet, basename="ministry")
router.register(r"departments", DepartmentViewSet, basename="department")
router.register(r"form-categories", FormCategoryViewSet, basename="formcategory")
router.register(r"form-types",      PSCFormTypeViewSet,  basename="formtype")
router.register(r"form-fields",         PSCFormFieldViewSet,      basename="formfield")
router.register(r"required-documents",  RequiredDocumentViewSet,  basename="requireddocument")
router.register(r"knowledge/categories", KnowledgeCategoryViewSet, basename="knowledge-category")
router.register(r"knowledge/articles",   KnowledgeArticleViewSet,  basename="knowledge-article")
router.register(r"meetings",       MeetingViewSet,      basename="meeting")
router.register(r"agenda-items",   AgendaItemViewSet,   basename="agendaitem")
router.register(r"commission-tasks", CommissionTaskViewSet, basename="commission-task")
router.register(r"users",        UserAdminViewSet,        basename="user-admin")
router.register(r"permissions",  SystemPermissionViewSet, basename="permission")
router.register(r"role-defs",    RoleDefinitionViewSet,   basename="role-definition")
router.register(r"api-keys",     APIKeyViewSet,           basename="api-key")
router.register(r"settings",     SystemSettingViewSet,    basename="system-setting")
router.register(r"email-templates", EmailTemplateViewSet, basename="email-template")
router.register(r"backup",           BackupViewSet,           basename="backup")
router.register(r"audit-logs",       AuditLogViewSet,         basename="audit-log")
router.register(r"incidents",        SecurityIncidentViewSet, basename="incident")
router.register(r"security-scans",   SecurityScanViewSet,     basename="security-scan")
router.register(r"security-notices", SecurityNoticeViewSet,   basename="security-notice")
router.register(r"feedback",         FeedbackViewSet,         basename="feedback")
router.register(r"feedback-comments", FeedbackCommentViewSet, basename="feedback-comments")
router.register(r"notifications",    NotificationViewSet,    basename="notification")
router.register(r"minutes",          MinutesViewSet,          basename="minutes")
router.register(r"transcripts",      TranscriptViewSet,       basename="transcript")
router.register(r"doc-annotations",  DocumentAnnotationViewSet, basename="doc-annotation")
router.register(r"doc-signatures",   DocumentSignatureViewSet,  basename="doc-signature")
router.register(r"odu-checklists",   ODUChecklistViewSet,       basename="odu-checklist")
router.register(r"staff-chat/sessions", StaffChatSessionViewSet, basename="staff-chat-session")
router.register(
    r"deadline-reminder-drafts",
    DeadlineReminderDraftViewSet,
    basename="deadline-reminder-draft",
)
router.register(r"ui-translations", UiTranslationViewSet, basename="ui-translation")
router.register(r"daily-brief", DailyBriefViewSet, basename="daily-brief")
# ── P1–P4 New ViewSet Registrations ──────────────────────────────────────────
router.register(r"push-subscriptions", WebPushSubscriptionViewSet, basename="push-subscription")
router.register(r"document-versions",  DocumentVersionViewSet,     basename="document-version")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("me/", me_view),
    path("me/change-password/", change_password_view),
    path("auth/password-policy/", password_policy_view),
    path("dashboard/", dashboard_view),
    path("reports/stats/", reports_view),
    path("reports/ai-smart-query/", ai_smart_report_view),
    path("register/", RegisterView.as_view()),
    # Two-factor authentication (TOTP / Microsoft Authenticator)
    path("auth/totp/setup/", TOTPSetupView.as_view(), name="totp-setup"),
    path("auth/totp/verify-setup/", TOTPVerifySetupView.as_view(), name="totp-verify-setup"),
    path("auth/totp/verify/", VerifyOTPView.as_view(), name="totp-verify"),
    path("auth/totp/disable/", DisableTOTPView.as_view(), name="totp-disable"),
    # Session PIN (trusted-device re-authentication)
    path("auth/session-pin/setup/", SessionPinSetupView.as_view(), name="session-pin-setup"),
    path("auth/session-pin/verify/", SessionPinVerifyView.as_view(), name="session-pin-verify"),
    # Password reset
    path("auth/password-reset/request/", PasswordResetRequestView.as_view()),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view()),
    path("auth/security-audit/", security_audit_view),
    path("auth/api-inventory/", api_inventory_view),
    path("auth/feedback-status/", FeedbackStatusView.as_view(), name="feedback-status"),
    path("auth/verify-pin/",      VerifyPinView.as_view(),      name="verify-pin"),
    path("my-signature/",         MySignatureView.as_view(),    name="my-signature"),
    path("search/", global_search_view),
    # ── Inbound webhooks from external systems ───────────────────────────────
    path("webhooks/cms-signoff/", cms_signoff_callback, name="cms-signoff-callback"),
    path("webhooks/cms-register/", cms_register_submission, name="cms-register-submission"),
    # ── P1–P4 New Endpoints ───────────────────────────────────────────────────
    path("dashboard/stats/",                dashboard_stats_view,               name="dashboard-stats"),
    path("submissions/<int:pk>/sla/",       submission_sla_view,                name="submission-sla"),
    path("submissions/bulk-action/",        submission_bulk_action_view,        name="submission-bulk-action"),
    # AI triggers + result getters
    path("submissions/<int:pk>/trigger-ai-duplicate/", trigger_ai_duplicate,   name="trigger-ai-duplicate"),
    path("submissions/<int:pk>/ai-duplicate/",         get_ai_duplicate,       name="get-ai-duplicate"),
    path("submissions/<int:pk>/trigger-ai-risk/",      trigger_ai_risk,        name="trigger-ai-risk"),
    path("submissions/<int:pk>/ai-risk/",              get_ai_risk,            name="get-ai-risk"),
    path("submissions/<int:pk>/trigger-ai-outcome/",   trigger_ai_outcome,     name="trigger-ai-outcome"),
    path("submissions/<int:pk>/ai-outcome/",           get_ai_outcome,         name="get-ai-outcome"),
    path("submissions/<int:pk>/trigger-ai-noa/",       trigger_ai_noa,         name="trigger-ai-noa"),
    path("submissions/<int:pk>/ai-noa/",               get_ai_noa,             name="get-ai-noa"),
    path("submissions/<int:pk>/trigger-ai-letter/",    trigger_ai_letter,      name="trigger-ai-letter"),
    path("submissions/<int:pk>/ai-letter/",            get_ai_letter,          name="get-ai-letter"),
    # Calendar
    path("calendar/events/",               calendar_events_view,               name="calendar-events"),
    # Analytics
    path("analytics/overview/",            analytics_overview_view,            name="analytics-overview"),
    path("analytics/trends/",              analytics_trends_view,              name="analytics-trends"),
    # Workload
    path("workload/officers/",             workload_officers_view,             name="workload-officers"),
    path("workload/suggest-assignment/",   workload_suggest_assignment_view,   name="workload-suggest-assignment"),
    # Audit log search
    path("audit-logs/search/",             audit_log_search_view,              name="audit-log-search"),
]
