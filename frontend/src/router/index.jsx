import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import RequireAuth from '../components/auth/RequireAuth'

import Login from '../pages/auth/Login'
import ResetPassword from '../pages/auth/ResetPassword'
import PasswordResetConfirm from '../pages/auth/PasswordResetConfirm'
import TwoSteps from '../pages/auth/TwoSteps'
import TOTPSetup from '../pages/auth/TOTPSetup'
import Error404 from '../pages/auth/Error404'

import PscDashboard from '../pages/psc/PscDashboard'
import SubmissionLog from '../pages/psc/SubmissionLog'
import SubmissionDetail from '../pages/psc/SubmissionDetail'
import SubmissionForm from '../pages/psc/SubmissionForm'
import Reports from '../pages/psc/Reports'
import MeetingCapture from '../pages/psc/MeetingCapture'
import AdminPanel from '../pages/admin/AdminPanel'
import MinistriesDepartments from '../pages/admin/MinistriesDepartments'
import AdminApiKeysPage from '../pages/admin/AdminApiKeysPage'
import AdminSystemConfigPage from '../pages/admin/AdminSystemConfigPage'
import AdminEmailTemplatesPage from '../pages/admin/AdminEmailTemplatesPage'
import AdminTranslationsPage from '../pages/admin/AdminTranslationsPage'
import AdminBackupRestorePage from '../pages/admin/AdminBackupRestorePage'
import AdminSecurityPage from '../pages/admin/AdminSecurityPage'
import FeedbackManagementPage from '../pages/admin/FeedbackManagementPage'
import FormTypesAdmin from '../pages/admin/FormTypesAdmin'
import FormBuilder from '../pages/admin/FormBuilder'
import CommissionSittings from '../pages/secretariat/CommissionSittings'
import MinutesEditor from '../pages/secretariat/MinutesEditor'
import MeetingRoomHub from '../pages/meeting/MeetingRoomHub'
import MinutesPipelineBrief from '../pages/meeting/MinutesPipelineBrief'
import Agenda from '../pages/secretariat/Agenda'
import AgendaSittingPack from '../pages/secretariat/AgendaSittingPack'
import Decisions from '../pages/secretariat/Decisions'
import Notifications from '../pages/secretariat/Notifications'
import TaskManagement from '../pages/secretariat/TaskManagement'
import MinutesIndex from '../pages/secretariat/MinutesIndex'
import Account from '../pages/pages/Account'
import StaffChatbot from '../pages/assistant/StaffChatbot'
import HrManagerGuide from '../pages/guide/HrManagerGuide'
import UnitManagerGuide from '../pages/guide/UnitManagerGuide'
import SecretaryGuide from '../pages/guide/SecretaryGuide'

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
        <Route path="/secretariat/agenda/sitting-pack" element={<AgendaSittingPack />} />
        <Route element={<Layout />}>
          <Route path="/" element={<PscDashboard />} />
          <Route path="/submissions" element={<SubmissionLog />} />
          <Route path="/submissions/new" element={<SubmissionForm />} />
          <Route path="/submissions/:id" element={<SubmissionDetail />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/assistant" element={<StaffChatbot />} />
          <Route path="/status-assistant" element={<Navigate to="/assistant" replace />} />
          <Route path="/meetings/capture" element={<MeetingCapture />} />
          <Route path="/admin/roles-permissions" element={<AdminPanel />} />
          <Route path="/admin/ministries-departments" element={<MinistriesDepartments />} />
          <Route path="/admin/api-keys" element={<AdminApiKeysPage />} />
          <Route path="/admin/system-config" element={<AdminSystemConfigPage />} />
          <Route path="/admin/email-templates" element={<AdminEmailTemplatesPage />} />
          <Route path="/admin/ui-translations" element={<AdminTranslationsPage />} />
          <Route path="/admin/security" element={<AdminSecurityPage />} />
          <Route path="/admin/feedback" element={<FeedbackManagementPage />} />
          <Route path="/admin/form-types" element={<FormTypesAdmin />} />
          <Route path="/admin/form-types/:formTypeId/builder" element={<FormBuilder />} />
          <Route path="/admin/backup-restore" element={<AdminBackupRestorePage />} />
          <Route path="/admin-panel" element={<Navigate to="/admin/roles-permissions?tab=users" replace />} />
          <Route path="/secretariat/meeting-room" element={<MeetingRoomHub />} />
          <Route path="/secretariat/meeting-room/logitech-guide" element={<Navigate to="/secretariat/meeting-room" state={{ openLogitechGuide: true }} replace />} />
          <Route path="/secretariat/meeting-room/minutes-pipeline" element={<MinutesPipelineBrief />} />
          <Route path="/secretariat/meetings" element={<CommissionSittings />} />
          <Route path="/secretariat/meetings/:meetingId/minutes" element={<MinutesEditor />} />
          <Route path="/secretariat/agenda" element={<Agenda />} />
          <Route path="/secretariat/minutes" element={<MinutesIndex />} />
          <Route path="/secretariat/decisions" element={<Decisions />} />
          <Route path="/secretariat/tasks" element={<TaskManagement />} />
          <Route path="/secretariat/notifications" element={<Notifications />} />
          <Route path="/guide/hr-manager" element={<HrManagerGuide />} />
          <Route path="/guide/unit-manager" element={<UnitManagerGuide />} />
          <Route path="/guide/secretary" element={<SecretaryGuide />} />
          <Route path="/pages/account" element={<Account />} />
          <Route path="/404" element={<Error404 />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  )
}
