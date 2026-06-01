import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import RequireAuth from '../components/auth/RequireAuth'

// Auth pages are small and on the critical path; keep them eager.
import Login from '../pages/auth/Login'
import ResetPassword from '../pages/auth/ResetPassword'
import PasswordResetConfirm from '../pages/auth/PasswordResetConfirm'
import TwoSteps from '../pages/auth/TwoSteps'
import TOTPSetup from '../pages/auth/TOTPSetup'
import Error404 from '../pages/auth/Error404'

// Everything else is code-split so heavy pages (charts, PDF, canvas, calendar,
// admin tooling) only download when the route is actually visited.
const PscDashboard = lazy(() => import('../pages/psc/PscDashboard'))
const SubmissionLog = lazy(() => import('../pages/psc/SubmissionLog'))
const SubmissionDetail = lazy(() => import('../pages/psc/SubmissionDetail'))
const SubmissionForm = lazy(() => import('../pages/psc/SubmissionForm'))
const SmartReports = lazy(() => import('../pages/psc/SmartReports'))
const RedirectToMinuteIntake = lazy(() => import('../pages/meeting/RedirectToMinuteIntake'))
const AdminPanel = lazy(() => import('../pages/admin/AdminPanel'))
const MinistriesDepartments = lazy(() => import('../pages/admin/MinistriesDepartments'))
const AdminApiKeysPage = lazy(() => import('../pages/admin/AdminApiKeysPage'))
const AdminSystemConfigPage = lazy(() => import('../pages/admin/AdminSystemConfigPage'))
const DailyBriefAdmin = lazy(() => import('../pages/admin/DailyBriefAdmin'))
const AdminEmailTemplatesPage = lazy(() => import('../pages/admin/AdminEmailTemplatesPage'))
const AdminTranslationsPage = lazy(() => import('../pages/admin/AdminTranslationsPage'))
const AdminBackupRestorePage = lazy(() => import('../pages/admin/AdminBackupRestorePage'))
const AdminSecurityPage = lazy(() => import('../pages/admin/AdminSecurityPage'))
const FeedbackManagementPage = lazy(() => import('../pages/admin/FeedbackManagementPage'))
const FormTypesAdmin = lazy(() => import('../pages/admin/FormTypesAdmin'))
const AgendaSectionsAdmin = lazy(() => import('../pages/admin/AgendaSectionsAdmin'))
const AgendaSectionFormsAdmin = lazy(() => import('../pages/admin/AgendaSectionFormsAdmin'))
const FormBuilder = lazy(() => import('../pages/admin/FormBuilder'))
const KnowledgeBaseAdmin = lazy(() => import('../pages/admin/KnowledgeBaseAdmin'))
const KnowledgeArticleEditor = lazy(() => import('../pages/admin/KnowledgeArticleEditor'))
const CommissionSittings = lazy(() => import('../pages/secretariat/CommissionSittings'))
const MinutesEditor = lazy(() => import('../pages/secretariat/MinutesEditor'))
const MeetingRoomHub = lazy(() => import('../pages/meeting/MeetingRoomHub'))
const Agenda = lazy(() => import('../pages/secretariat/Agenda'))
const AgendaSittingPack = lazy(() => import('../pages/secretariat/AgendaSittingPack'))
const Decisions = lazy(() => import('../pages/secretariat/Decisions'))
const Notifications = lazy(() => import('../pages/secretariat/Notifications'))
const TaskManagement = lazy(() => import('../pages/secretariat/TaskManagement'))
const MinutesIndex = lazy(() => import('../pages/secretariat/MinutesIndex'))
const MinuteIntake = lazy(() => import('../pages/secretariat/MinuteIntake'))
const Account = lazy(() => import('../pages/pages/Account'))
const StaffChatbot = lazy(() => import('../pages/assistant/StaffChatbot'))
const KnowledgeBaseBrowse = lazy(() => import('../pages/psc/KnowledgeBaseBrowse'))
const ArticleViewer = lazy(() => import('../pages/psc/ArticleViewer'))
const ExecutiveDashboard = lazy(() => import('../pages/psc/ExecutiveDashboard'))
const CommissionCalendar = lazy(() => import('../pages/psc/CommissionCalendar'))
const AuditTrailExplorer = lazy(() => import('../pages/psc/AuditTrailExplorer'))
const AnalyticsDashboard = lazy(() => import('../pages/psc/AnalyticsDashboard'))
const WorkloadDashboard = lazy(() => import('../pages/psc/WorkloadDashboard'))

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-primary-500" />
    </div>
  )
}

export default function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ── Public auth routes ── */}
        <Route path="/auth/login"                    element={<Login />} />
        <Route path="/auth/reset-password"           element={<ResetPassword />} />
        <Route path="/auth/reset-password/confirm"   element={<PasswordResetConfirm />} />
        <Route path="/auth/2fa"                      element={<TwoSteps />} />
        <Route path="/auth/totp-setup"               element={<TOTPSetup />} />

        <Route element={<RequireAuth />}>
          <Route path="/secretariat/agenda/sitting-pack" element={<AgendaSittingPack />} />
          <Route element={<Layout />}>
            <Route path="/" element={<PscDashboard />} />
            <Route path="/submissions" element={<SubmissionLog />} />
            <Route path="/submissions/new" element={<SubmissionForm />} />
            <Route path="/submissions/:id" element={<SubmissionDetail />} />
            <Route path="/reports" element={<SmartReports />} />
            <Route path="/wiki" element={<KnowledgeBaseBrowse />} />
            <Route path="/wiki/:slug" element={<ArticleViewer />} />
            <Route path="/assistant" element={<StaffChatbot />} />
            <Route path="/status-assistant" element={<Navigate to="/assistant" replace />} />
            <Route path="/meetings/capture" element={<RedirectToMinuteIntake />} />

            {/* ── P1–P4 New Routes ── */}
            <Route path="/executive-dashboard"  element={<ExecutiveDashboard />} />
            <Route path="/calendar"             element={<CommissionCalendar />} />
            <Route path="/audit-trail"          element={<AuditTrailExplorer />} />
            <Route path="/analytics"            element={<AnalyticsDashboard />} />
            <Route path="/workload"             element={<WorkloadDashboard />} />

            {/* ── Admin ── */}
            <Route path="/admin/roles-permissions" element={<AdminPanel />} />
            <Route path="/admin/ministries-departments" element={<MinistriesDepartments />} />
            <Route path="/admin/api-keys" element={<AdminApiKeysPage />} />
            <Route path="/admin/system-config" element={<AdminSystemConfigPage />} />
            <Route path="/admin/email-templates" element={<AdminEmailTemplatesPage />} />
            <Route path="/admin/daily-brief" element={<DailyBriefAdmin />} />
            <Route path="/admin/ui-translations" element={<AdminTranslationsPage />} />
            <Route path="/admin/security" element={<AdminSecurityPage />} />
            <Route path="/admin/feedback" element={<FeedbackManagementPage />} />
            <Route path="/admin/form-types" element={<FormTypesAdmin />} />
            <Route path="/admin/agenda-sections" element={<AgendaSectionsAdmin />} />
            <Route path="/admin/agenda-section-forms" element={<AgendaSectionFormsAdmin />} />
            <Route path="/admin/form-types/:formTypeId/builder" element={<FormBuilder />} />
            <Route path="/admin/knowledge-base" element={<KnowledgeBaseAdmin />} />
            <Route path="/admin/knowledge-base/new" element={<KnowledgeArticleEditor />} />
            <Route path="/admin/knowledge-base/edit/:slug" element={<KnowledgeArticleEditor />} />
            <Route path="/admin/backup-restore" element={<AdminBackupRestorePage />} />
            <Route path="/admin-panel" element={<Navigate to="/admin/roles-permissions?tab=users" replace />} />

            {/* ── Secretariat ── */}
            <Route path="/secretariat/meeting-room" element={<MeetingRoomHub />} />
            <Route path="/secretariat/meeting-room/logitech-guide" element={<Navigate to="/secretariat/meeting-room" state={{ openLogitechGuide: true }} replace />} />
            <Route path="/secretariat/meeting-room/minutes-pipeline" element={<RedirectToMinuteIntake />} />
            <Route path="/secretariat/meetings" element={<CommissionSittings />} />
            <Route path="/secretariat/meetings/:meetingId/minutes" element={<MinutesEditor />} />
            <Route path="/secretariat/agenda" element={<Agenda />} />
            <Route path="/secretariat/minutes" element={<MinutesIndex />} />
            <Route path="/secretariat/minute-intake" element={<MinuteIntake />} />
            <Route path="/secretariat/minute-intake/:meetingId" element={<MinuteIntake />} />
            <Route path="/secretariat/decisions" element={<Decisions />} />
            <Route path="/secretariat/tasks" element={<TaskManagement />} />
            <Route path="/secretariat/notifications" element={<Notifications />} />

            <Route path="/guide/hr-manager" element={<Navigate to="/wiki/hr-manager-guide" replace />} />
            <Route path="/guide/unit-manager" element={<Navigate to="/wiki/unit-manager-guide" replace />} />
            <Route path="/guide/secretary" element={<Navigate to="/wiki/secretary-guide" replace />} />

            <Route path="/pages/account" element={<Account />} />
            <Route path="/404" element={<Error404 />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    </Suspense>
  )
}
