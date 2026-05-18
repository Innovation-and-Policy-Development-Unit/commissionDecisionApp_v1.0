from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AuditLogViewSet,
    BackupViewSet,
    CommissionTaskViewSet,
    SecurityNoticeViewSet,
    DepartmentViewSet,
    DocumentAnnotationViewSet,
    DocumentSignatureViewSet,
    MySignatureView,
    VerifyPinView,
    FormCategoryViewSet,
    PSCFormFieldViewSet,
    PSCFormTypeViewSet,
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
    FeedbackViewSet,
    FeedbackCommentViewSet,
    FeedbackStatusView,
    dashboard_view,
    reports_view,
    me_view,
    change_password_view,
    password_policy_view,
    security_audit_view,
    api_inventory_view,
    global_search_view,
)

router = DefaultRouter()
router.register(r"submissions", SubmissionViewSet, basename="submission")
router.register(r"ministries", MinistryViewSet, basename="ministry")
router.register(r"departments", DepartmentViewSet, basename="department")
router.register(r"form-categories", FormCategoryViewSet, basename="formcategory")
router.register(r"form-types",      PSCFormTypeViewSet,  basename="formtype")
router.register(r"form-fields",         PSCFormFieldViewSet,      basename="formfield")
router.register(r"required-documents",  RequiredDocumentViewSet,  basename="requireddocument")
router.register(r"meetings",       MeetingViewSet,      basename="meeting")
router.register(r"agenda-items",   AgendaItemViewSet,   basename="agendaitem")
router.register(r"commission-tasks", CommissionTaskViewSet, basename="commission-task")
router.register(r"users",        UserAdminViewSet,        basename="user-admin")
router.register(r"permissions",  SystemPermissionViewSet, basename="permission")
router.register(r"role-defs",    RoleDefinitionViewSet,   basename="role-definition")
router.register(r"api-keys",     APIKeyViewSet,           basename="api-key")
router.register(r"settings",     SystemSettingViewSet,    basename="system-setting")
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
]
