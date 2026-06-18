import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PageSkeleton } from '../components/shared/Skeleton'
import Layout from '../components/layout/Layout'
import RequireAuth from '../components/auth/RequireAuth'

// Auth pages are small and on the critical path; keep them eager.
import Login from '../pages/auth/Login'
import ResetPassword from '../pages/auth/ResetPassword'
import PasswordResetConfirm from '../pages/auth/PasswordResetConfirm'
import TwoSteps from '../pages/auth/TwoSteps'
import TOTPSetup from '../pages/auth/TOTPSetup'
import Error404 from '../pages/auth/Error404'

// Core navigation pages — small enough to be eager so the list/detail loop feels instant.
import HomeDashboard from '../pages/HomeDashboard'
import SubmissionLog from '../pages/psc/SubmissionLog'

// Large pages stay code-split; fallback is invisible so there's no spinner flash.
const SubmissionDetail = lazy(() => import('../pages/psc/SubmissionDetail'))
const SubmissionForm = lazy(() => import('../pages/psc/SubmissionForm'))
const ReportBrowse = lazy(() => import('../pages/reports/ReportBrowse'))
const ReportTemplateManager = lazy(() => import('../pages/reports/ReportTemplateManager'))
const Intelligence = lazy(() => import('../pages/psc/Intelligence'))
const Dashboards = lazy(() => import('../pages/psc/Dashboards'))
const IntelligenceReports = lazy(() => import('../pages/psc/IntelligenceReports'))
const FlagMonitor = lazy(() => import('../pages/psc/FlagMonitor'))
const AlertRules = lazy(() => import('../pages/psc/AlertRules'))
const Automations = lazy(() => import('../pages/psc/Automations'))
const RedirectToMinuteIntake = lazy(() => import('../pages/meeting/RedirectToMinuteIntake'))
const AdminPanel = lazy(() => import('../pages/admin/AdminPanel'))
const MinistriesDepartments = lazy(() => import('../pages/admin/MinistriesDepartments'))
const AdminApiKeysPage = lazy(() => import('../pages/admin/AdminApiKeysPage'))
const AdminSystemConfigPage = lazy(() => import('../pages/admin/AdminSystemConfigPage'))
const DailyBriefAdmin = lazy(() => import('../pages/admin/DailyBriefAdmin'))
const AdminEmailTemplatesPage = lazy(() => import('../pages/admin/AdminEmailTemplatesPage'))
const AdminTranslationsPage = lazy(() => import('../pages/admin/AdminTranslationsPage'))
const AdminBackupRestorePage = lazy(() => import('../pages/admin/AdminBackupRestorePage'))
const AdminTrashPage = lazy(() => import('../pages/admin/AdminTrashPage'))
const AdminSecurityPage = lazy(() => import('../pages/admin/AdminSecurityPage'))
const FeedbackManagementPage = lazy(() => import('../pages/admin/FeedbackManagementPage'))
const FormTypesAdmin = lazy(() => import('../pages/admin/FormTypesAdmin'))
const AgendaSectionsAdmin = lazy(() => import('../pages/admin/AgendaSectionsAdmin'))
const FormBuilder = lazy(() => import('../pages/admin/FormBuilder'))
const KnowledgeBaseAdmin = lazy(() => import('../pages/admin/KnowledgeBaseAdmin'))
const KnowledgeArticleEditor = lazy(() => import('../pages/admin/KnowledgeArticleEditor'))
const CommissionSittings = lazy(() => import('../pages/secretariat/CommissionSittings'))
const MinutesEditor = lazy(() => import('../pages/secretariat/MinutesEditor'))
const MeetingRoomHub = lazy(() => import('../pages/meeting/MeetingRoomHub'))
const Agenda = lazy(() => import('../pages/secretariat/Agenda'))
const AgendaSittingPack = lazy(() => import('../pages/secretariat/AgendaSittingPack'))
const SittingWorkspace = lazy(() => import('../pages/secretariat/SittingWorkspace'))
const Decisions = lazy(() => import('../pages/secretariat/Decisions'))
const Notifications = lazy(() => import('../pages/secretariat/Notifications'))
const TaskManagement = lazy(() => import('../pages/secretariat/TaskManagement'))
const MinutesIndex = lazy(() => import('../pages/secretariat/MinutesIndex'))
const MinuteIntake = lazy(() => import('../pages/secretariat/MinuteIntake'))
const DeferredAgenda = lazy(() => import('../pages/secretariat/DeferredAgenda'))
const Account = lazy(() => import('../pages/pages/Account'))
const KnowledgeBaseBrowse = lazy(() => import('../pages/psc/KnowledgeBaseBrowse'))
const ArticleViewer = lazy(() => import('../pages/psc/ArticleViewer'))
const ExecutiveDashboard = lazy(() => import('../pages/psc/ExecutiveDashboard'))
const CommissionCalendar = lazy(() => import('../pages/psc/CommissionCalendar'))
const AuditTrailExplorer = lazy(() => import('../pages/psc/AuditTrailExplorer'))
const AnalyticsDashboard = lazy(() => import('../pages/psc/AnalyticsDashboard'))
const WorkloadDashboard = lazy(() => import('../pages/psc/WorkloadDashboard'))
const PendingDecisions = lazy(() => import('../pages/psc/PendingDecisions'))
const MinistryPerformance = lazy(() => import('../pages/psc/MinistryPerformance'))
const ImplementationDashboard = lazy(() => import('../pages/psc/ImplementationDashboard'))
const AnnualReport = lazy(() => import('../pages/psc/AnnualReport'))
const ComplianceCases = lazy(() => import('../pages/compliance/ComplianceCases'))
const ComplianceCaseDetail = lazy(() => import('../pages/compliance/ComplianceCaseDetail'))
const NewComplianceCaseForm = lazy(() => import('../pages/compliance/NewComplianceCaseForm'))
const ComplaintsRegister = lazy(() => import('../pages/compliance/ComplaintsRegister'))
const LodgeComplaint = lazy(() => import('../pages/compliance/LodgeComplaint'))
const ComplianceDashboard = lazy(() => import('../pages/compliance/ComplianceDashboard'))
const ComplianceReports = lazy(() => import('../pages/compliance/ComplianceReports'))
const LitigationTracker = lazy(() => import('../pages/compliance/LitigationTracker'))

function RouteFallback({ detail = false }) {
  return <PageSkeleton detailMode={detail} />
}

const S = ({ detail = false, children }) => (
  <Suspense fallback={<RouteFallback detail={detail} />}>{children}</Suspense>
)

export default function AppRouter() {
  return (
    <Routes>
      {/* ── Public auth routes ── */}
      <Route path="/auth/login"                    element={<Login />} />
      <Route path="/auth/reset-password"           element={<ResetPassword />} />
      <Route path="/auth/reset-password/confirm"   element={<PasswordResetConfirm />} />
      <Route path="/auth/2fa"                      element={<TwoSteps />} />
      <Route path="/auth/totp-setup"               element={<TOTPSetup />} />

      <Route element={<RequireAuth />}>
        <Route path="/secretariat/agenda/sitting-pack" element={<S><AgendaSittingPack /></S>} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomeDashboard />} />
          <Route path="/submissions" element={<SubmissionLog />} />
          <Route path="/submissions/new" element={<S><SubmissionForm /></S>} />
          <Route path="/submissions/:id" element={<S detail><SubmissionDetail /></S>} />
          <Route path="/reports" element={<S><ReportBrowse /></S>} />
          <Route path="/reports/templates" element={<S><ReportTemplateManager /></S>} />
          <Route path="/intelligence" element={<S><Intelligence /></S>} />
          <Route path="/intelligence/dashboards" element={<S><Dashboards /></S>} />
          <Route path="/intelligence/dashboards/:id" element={<S detail><Dashboards /></S>} />
          <Route path="/intelligence/reports" element={<S><IntelligenceReports /></S>} />
          <Route path="/intelligence/flags" element={<S><FlagMonitor /></S>} />
          <Route path="/intelligence/rules" element={<S><AlertRules /></S>} />
          <Route path="/intelligence/automations" element={<S><Automations /></S>} />
          <Route path="/wiki" element={<S><KnowledgeBaseBrowse /></S>} />
          <Route path="/wiki/:slug" element={<S detail><ArticleViewer /></S>} />
          <Route path="/meetings/capture" element={<S><RedirectToMinuteIntake /></S>} />

          {/* ── P1–P4 New Routes ── */}
          <Route path="/executive-dashboard"  element={<S><ExecutiveDashboard /></S>} />
          <Route path="/calendar"             element={<S><CommissionCalendar /></S>} />
          <Route path="/audit-trail"          element={<S><AuditTrailExplorer /></S>} />
          <Route path="/analytics"            element={<S><AnalyticsDashboard /></S>} />
          <Route path="/workload"             element={<S><WorkloadDashboard /></S>} />
          <Route path="/pending-decisions"    element={<S><PendingDecisions /></S>} />
          <Route path="/ministry-performance" element={<S><MinistryPerformance /></S>} />
          <Route path="/implementation"       element={<S><ImplementationDashboard /></S>} />
          <Route path="/annual-report"        element={<S><AnnualReport /></S>} />

          {/* ── Compliance ── */}
          <Route path="/compliance/dashboard"      element={<S><ComplianceDashboard /></S>} />
          <Route path="/compliance/cases"          element={<S><ComplianceCases /></S>} />
          <Route path="/compliance/cases/new"      element={<S><NewComplianceCaseForm /></S>} />
          <Route path="/compliance/cases/:id"      element={<S detail><ComplianceCaseDetail /></S>} />
          <Route path="/compliance/complaints"     element={<S><ComplaintsRegister /></S>} />
          <Route path="/compliance/lodge-complaint" element={<S><LodgeComplaint /></S>} />
          <Route path="/compliance/reports"        element={<S><ComplianceReports /></S>} />
          <Route path="/compliance/litigation"     element={<S><LitigationTracker /></S>} />

          {/* ── Admin ── */}
          <Route path="/admin/roles-permissions" element={<S><AdminPanel /></S>} />
          <Route path="/admin/ministries-departments" element={<S><MinistriesDepartments /></S>} />
          <Route path="/admin/api-keys" element={<S><AdminApiKeysPage /></S>} />
          <Route path="/admin/system-config" element={<S><AdminSystemConfigPage /></S>} />
          <Route path="/admin/email-templates" element={<S><AdminEmailTemplatesPage /></S>} />
          <Route path="/admin/daily-brief" element={<S><DailyBriefAdmin /></S>} />
          <Route path="/admin/ui-translations" element={<S><AdminTranslationsPage /></S>} />
          <Route path="/admin/security" element={<S><AdminSecurityPage /></S>} />
          <Route path="/admin/feedback" element={<S><FeedbackManagementPage /></S>} />
          <Route path="/admin/form-types" element={<S><FormTypesAdmin /></S>} />
          <Route path="/admin/agenda-sections" element={<S><AgendaSectionsAdmin /></S>} />
          <Route path="/admin/form-types/:formTypeId/builder" element={<S detail><FormBuilder /></S>} />
          <Route path="/admin/knowledge-base" element={<S><KnowledgeBaseAdmin /></S>} />
          <Route path="/admin/knowledge-base/new" element={<S detail><KnowledgeArticleEditor /></S>} />
          <Route path="/admin/knowledge-base/edit/:slug" element={<S detail><KnowledgeArticleEditor /></S>} />
          <Route path="/admin/backup-restore" element={<S><AdminBackupRestorePage /></S>} />
          <Route path="/admin/trash" element={<S><AdminTrashPage /></S>} />
          <Route path="/admin-panel" element={<Navigate to="/admin/roles-permissions?tab=users" replace />} />

          {/* ── Secretariat ── */}
          <Route path="/secretariat/meeting-room" element={<S><MeetingRoomHub /></S>} />
          <Route path="/secretariat/meeting-room/logitech-guide" element={<Navigate to="/secretariat/meeting-room" state={{ openLogitechGuide: true }} replace />} />
          <Route path="/secretariat/meeting-room/minutes-pipeline" element={<S><RedirectToMinuteIntake /></S>} />
          <Route path="/secretariat/meetings" element={<S><CommissionSittings /></S>} />
          <Route path="/secretariat/meetings/:meetingId/minutes" element={<S detail><MinutesEditor /></S>} />
          <Route path="/secretariat/meetings/:meetingId/workspace" element={<S detail><SittingWorkspace /></S>} />
          <Route path="/secretariat/agenda" element={<S><Agenda /></S>} />
          <Route path="/secretariat/minutes" element={<S><MinutesIndex /></S>} />
          <Route path="/secretariat/minute-intake" element={<S detail><MinuteIntake /></S>} />
          <Route path="/secretariat/minute-intake/:meetingId" element={<S detail><MinuteIntake /></S>} />
          <Route path="/secretariat/decisions" element={<S><Decisions /></S>} />
          <Route path="/secretariat/deferred-agenda" element={<S><DeferredAgenda /></S>} />
          <Route path="/secretariat/tasks" element={<S><TaskManagement /></S>} />
          <Route path="/secretariat/notifications" element={<S><Notifications /></S>} />

          <Route path="/guide/hr-manager" element={<Navigate to="/wiki/hr-manager-guide" replace />} />
          <Route path="/guide/unit-manager" element={<Navigate to="/wiki/unit-manager-guide" replace />} />
          <Route path="/guide/secretary" element={<Navigate to="/wiki/secretary-guide" replace />} />

          <Route path="/pages/account" element={<S detail><Account /></S>} />
          <Route path="/404" element={<Error404 />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  )
}
