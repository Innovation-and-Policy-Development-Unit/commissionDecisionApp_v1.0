from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .comment_views import CommentViewSet, activity_timeline, mention_suggest
from .compliance_views import ComplaintViewSet, ComplianceCaseViewSet, OffenceTypeViewSet
from .smart_report_views import SmartReportViewSet
from .report_template_views import ReportTemplateViewSet
from .intelligence_views import (
    intelligence_dashboard_detail,
    intelligence_dashboard_favorite,
    intelligence_dashboards,
    intelligence_datasets,
    intelligence_exploration_detail,
    intelligence_explorations,
    intelligence_interpret,
    intelligence_query,
    intelligence_report_detail,
    intelligence_report_run,
    intelligence_reports,
)
from .rules_views import (
    flag_acknowledge,
    flag_clear,
    flags,
    flags_export,
    rule_detail,
    rule_fields,
    rule_test,
    rules,
    rules_run_now,
)
from .automation_views import (
    automation_detail,
    automation_fields,
    automation_run_now,
    automation_runs,
    automation_runs_export,
    automation_test,
    automations,
)
from .deadline_reminder_views import DeadlineReminderDraftViewSet
from .ui_translation_views import UiTranslationViewSet
from .daily_brief.views import DailyBriefViewSet
from .views import (
    AgendaDeferralViewSet,
    AuditLogViewSet,
    BackupViewSet,
    CommissionTaskViewSet,
    DecisionLetterViewSet,
    ODUChecklistViewSet,
    SubmissionChecklistViewSet,
    SecurityNoticeViewSet,
    DepartmentViewSet,
    UnitViewSet,
    DocumentAnnotationViewSet,
    DocumentSignatureViewSet,
    MySignatureView,
    VerifyPinView,
    AgendaSectionViewSet,
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
    FeedbackChecklistViewSet,
    dashboard_view,
    reports_view,
    ai_smart_report_view,
    me_view,
    upcoming_sittings_view,
    vapid_public_key_view,
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
    generate_submission_letter,
    calendar_events_view,
    analytics_overview_view,
    analytics_trends_view,
    implementation_dashboard_view,
    implementation_report_list_view,
    implementation_report_generate_view,
    implementation_report_download_view,
    annual_report_preview_view,
    annual_report_list_view,
    annual_report_generate_view,
    annual_report_download_view,
    annual_report_delete_view,
    trash_list_view,
    trash_restore_view,
    trash_purge_view,
    trash_empty_view,
    workload_officers_view,
    workload_summary_view,
    workload_suggest_assignment_view,
    pending_decisions_view,
    ministry_performance_view,
    audit_log_search_view,
    WebPushSubscriptionViewSet,
    DocumentVersionViewSet,
)

router = DefaultRouter()
router.register(r"submissions", SubmissionViewSet, basename="submission")
router.register(r"ministries", MinistryViewSet, basename="ministry")
router.register(r"departments", DepartmentViewSet, basename="department")
router.register(r"units", UnitViewSet, basename="unit")
router.register(r"agenda-sections", AgendaSectionViewSet, basename="agendasection")
router.register(r"form-categories", FormCategoryViewSet, basename="formcategory")
router.register(r"form-types",      PSCFormTypeViewSet,  basename="formtype")
router.register(r"form-fields",         PSCFormFieldViewSet,      basename="formfield")
router.register(r"required-documents",  RequiredDocumentViewSet,  basename="requireddocument")
router.register(r"knowledge/categories", KnowledgeCategoryViewSet, basename="knowledge-category")
router.register(r"knowledge/articles",   KnowledgeArticleViewSet,  basename="knowledge-article")
router.register(r"meetings",       MeetingViewSet,      basename="meeting")
router.register(r"agenda-items",   AgendaItemViewSet,   basename="agendaitem")
router.register(r"commission-tasks", CommissionTaskViewSet, basename="commission-task")
router.register(r"decision-letters", DecisionLetterViewSet, basename="decision-letter")
router.register(r"agenda-deferrals", AgendaDeferralViewSet, basename="agenda-deferral")
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
router.register(r"feedback-checklist", FeedbackChecklistViewSet, basename="feedback-checklist")
router.register(r"notifications",    NotificationViewSet,    basename="notification")
router.register(r"comments",         CommentViewSet,         basename="comment")
router.register(r"minutes",          MinutesViewSet,          basename="minutes")
router.register(r"transcripts",      TranscriptViewSet,       basename="transcript")
router.register(r"doc-annotations",  DocumentAnnotationViewSet, basename="doc-annotation")
router.register(r"doc-signatures",   DocumentSignatureViewSet,  basename="doc-signature")
router.register(r"odu-checklists",        ODUChecklistViewSet,        basename="odu-checklist")
router.register(r"submission-checklists", SubmissionChecklistViewSet, basename="submission-checklist")
router.register(r"smart-reports", SmartReportViewSet, basename="smart-report")
router.register(r"report-templates", ReportTemplateViewSet, basename="report-template")
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
# ── Compliance module ────────────────────────────────────────────────────────
router.register(r"compliance/cases",      ComplianceCaseViewSet, basename="compliance-case")
router.register(r"compliance/complaints", ComplaintViewSet,      basename="compliance-complaint")
router.register(r"compliance/offence-types", OffenceTypeViewSet, basename="compliance-offence-type")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("me/", me_view),
    path("me/change-password/", change_password_view),
    path("auth/password-policy/", password_policy_view),
    path("upcoming-sittings/", upcoming_sittings_view),
    path("push/vapid-public-key/", vapid_public_key_view),
    path("dashboard/", dashboard_view),
    path("reports/stats/", reports_view),
    path("reports/ai-smart-query/", ai_smart_report_view),
    path("mentions/suggest/", mention_suggest),
    path("activity/", activity_timeline),
    path("intelligence/datasets/", intelligence_datasets),
    path("intelligence/query/", intelligence_query),
    path("intelligence/interpret/", intelligence_interpret),
    path("intelligence/explorations/", intelligence_explorations),
    path("intelligence/explorations/<int:pk>/", intelligence_exploration_detail),
    path("intelligence/dashboards/", intelligence_dashboards),
    path("intelligence/dashboards/<int:pk>/", intelligence_dashboard_detail),
    path("intelligence/dashboards/<int:pk>/favorite/", intelligence_dashboard_favorite),
    path("intelligence/reports/", intelligence_reports),
    path("intelligence/reports/<int:pk>/", intelligence_report_detail),
    path("intelligence/reports/<int:pk>/run/", intelligence_report_run),
    # ── Rule Engine & Flag Monitor ───────────────────────────────────────────
    path("rules/", rules),
    path("rules/fields/", rule_fields),
    path("rules/test/", rule_test),
    path("rules/run/", rules_run_now),
    path("rules/<int:pk>/", rule_detail),
    path("flags/", flags),
    path("flags/export/", flags_export),
    path("flags/<int:pk>/acknowledge/", flag_acknowledge),
    path("flags/<int:pk>/clear/", flag_clear),
    # ── Act (Automation) engine ──────────────────────────────────────────────
    path("automations/", automations),
    path("automations/fields/", automation_fields),
    path("automations/test/", automation_test),
    path("automations/runs/", automation_runs),
    path("automations/runs/export/", automation_runs_export),
    path("automations/<int:pk>/", automation_detail),
    path("automations/<int:pk>/run/", automation_run_now),
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
    # Slashless alias avoids APPEND_SLASH redirects in some clients/SW states.
    path("auth/feedback-status", FeedbackStatusView.as_view(), name="feedback-status-noslash"),
    path("auth/verify-pin/",      VerifyPinView.as_view(),      name="verify-pin"),
    path("my-signature/",         MySignatureView.as_view(),    name="my-signature"),
    path("search/", global_search_view),
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
    path("submissions/<int:pk>/trigger-ai-letter/",    trigger_ai_letter,         name="trigger-ai-letter"),
    path("submissions/<int:pk>/ai-letter/",            get_ai_letter,             name="get-ai-letter"),
    path("submissions/<int:pk>/generate-letter/",      generate_submission_letter, name="generate-letter"),
    # Calendar
    path("calendar/events/",               calendar_events_view,               name="calendar-events"),
    # Analytics
    path("analytics/overview/",            analytics_overview_view,            name="analytics-overview"),
    path("analytics/trends/",              analytics_trends_view,              name="analytics-trends"),
    path("analytics/implementation/",      implementation_dashboard_view,      name="analytics-implementation"),
    path("analytics/implementation/reports/",          implementation_report_list_view,     name="implementation-reports"),
    path("analytics/implementation/reports/generate/", implementation_report_generate_view, name="implementation-report-generate"),
    path("analytics/implementation/reports/<int:pk>/download/", implementation_report_download_view, name="implementation-report-download"),
    # Trash Bin (soft delete + restore)
    path("admin/trash/",                   trash_list_view,                    name="trash-list"),
    path("admin/trash/restore/",           trash_restore_view,                 name="trash-restore"),
    path("admin/trash/purge/",             trash_purge_view,                   name="trash-purge"),
    path("admin/trash/empty/",             trash_empty_view,                   name="trash-empty"),
    # Annual Report (statistics chapter)
    path("reports/annual/",                annual_report_list_view,            name="annual-reports"),
    path("reports/annual/preview/",        annual_report_preview_view,         name="annual-report-preview"),
    path("reports/annual/generate/",       annual_report_generate_view,        name="annual-report-generate"),
    path("reports/annual/<int:pk>/download/", annual_report_download_view,     name="annual-report-download"),
    path("reports/annual/<int:pk>/",       annual_report_delete_view,          name="annual-report-delete"),
    # Workload
    path("workload/officers/",             workload_officers_view,             name="workload-officers"),
    path("workload/summary/",              workload_summary_view,              name="workload-summary"),
    path("workload/suggest-assignment/",   workload_suggest_assignment_view,   name="workload-suggest-assignment"),
    # Operations — Commissioners & Secretary
    path("ops/pending-decisions/",         pending_decisions_view,             name="pending-decisions"),
    path("ops/ministry-performance/",      ministry_performance_view,          name="ministry-performance"),
    # Audit log search
    path("audit-logs/search/",             audit_log_search_view,              name="audit-log-search"),
]
