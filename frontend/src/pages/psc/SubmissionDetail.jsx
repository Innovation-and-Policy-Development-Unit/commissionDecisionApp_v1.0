import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import SubmissionSubwayMap from '../../components/submissions/SubmissionSubwayMap'
import VisualAuditTrail from '../../components/audit/VisualAuditTrail'
import VerificationBadge from '../../components/audit/VerificationBadge'
import SubmissionPresenceBar from '../../components/submissions/SubmissionPresenceBar'
import SubmissionActivity from '../../components/submissions/SubmissionActivity'
import PolicyGuardrailDrawer from '../../components/submissions/PolicyGuardrailDrawer'
import { policyGuardrailApplies } from '../../utils/policyGuardrail'
import { useAgendaSections } from '../../hooks/useAgendaSections'
import api, { isRateLimited } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { userIsOpscInternal, userCanRegenerateAiBrief } from '../../utils/opscAccess'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  stageLabel, stageBadgeClass, stageDotClass, stageMeta,
  needsHrAction, isTerminal, STAGE_LABELS,
} from '../../constants/stages'
import { ArrowRight, AlertTriangle, Clock, CheckCircle2, FileText, RefreshCw, Info, ClipboardCheck, LayoutGrid, MessageSquare, FileSignature, Square, CheckSquare, Upload, File, Trash2, ExternalLink, Paperclip, PenLine, Pen, Pencil, Eye, EyeOff, Lock, X, History, Download } from 'lucide-react'
import SecretariatBriefCard from '../../components/submissions/SecretariatBriefCard'
import { AiDuplicatePanel, AiRiskPanel, AiOutcomePanel, AiNoaPanel, AiLetterPanel, StructuredLetterPanel } from '../../components/submissions/AiAnalysisPanels'
import ChecklistPanel from '../../components/submissions/ChecklistPanel'
import DocumentFactsPanel from '../../components/submissions/DocumentFactsPanel'
import DecisionServicePanel from '../../components/submissions/DecisionServicePanel'
import SubmissionPackageValidation from '../../components/submissions/SubmissionPackageValidation'
import DeadlineReminderDrafts from '../../components/submissions/DeadlineReminderDrafts'
import DocumentAnnotatorModal from '../../components/shared/DocumentAnnotatorModal'
import TravelEndorsementPanel from '../../components/travel/TravelEndorsementPanel'
import DocumentSignatureModal from '../../components/shared/DocumentSignatureModal'
import PSCForm37Fields from './PSCForm37Fields'
import PSCForm37View from './PSCForm37View'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseTextarea from '../../components/shared/BaseTextarea'
import EmailChipInput from '../../components/shared/EmailChipInput'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseMessageBar from '../../components/shared/BaseMessageBar'
import BaseCheckbox from '../../components/shared/BaseCheckbox'
import MultiPageFormRenderer from '../../components/shared/MultiPageFormRenderer'
import PSCForm22Preview from '../../components/shared/PSCForm22Preview'
import PSCForm21Fields from './PSCForm21Fields'
import PSCForm21View from './PSCForm21View'
import PSCForm22Fields from './PSCForm22Fields'
import PSCForm22View from './PSCForm22View'
import ODURestructureChecklistForm from '../odu/ODURestructureChecklistForm'
import ODUBoardPaperForm from '../odu/ODUBoardPaperForm'
import SubmissionChecklistPanel from '../../components/submissions/SubmissionChecklistPanel'
import WorkflowActionsPanel from '../../components/submissions/WorkflowActionsPanel'
import CarryoverBanner from '../../components/submissions/CarryoverBanner'
import { canShowOduChecklist, canShowBoardPaper, submissionUsesOduRestructureChecklist } from '../../utils/oduChecklist'
import { isComplianceFormCode, isComplianceRole } from '../../constants/compliance'
import { formatApiError } from '../../utils/apiError'
import { PageSkeleton } from '../../components/shared/Skeleton'
import { queryClient } from '../../api/queryClient'
import {
  fetchSubmissionBootstrap,
  invalidateSubmissionBootstrap,
  getCachedSubmissionBootstrap,
} from '../../utils/submissionBootstrap'
import {
  useOnTabVisible,
  useVisibilityAwareInterval,
} from '../../hooks/useVisibilityAwareInterval'

// All roles that may trigger a transition
const TRANSITION_ROLES = [
  'psc_officer', 'psc_secretary', 'psc_commissioner', 'psc_admin',
  'ministry_hr', 'dept_admin', 'head_of_agency', 'receptionist',
  'vipam_manager', 'hr_unit_manager', 'odu_manager', 'compliance_manager',
]

const UNIT_MANAGER_ROLES = ['vipam_manager', 'hr_unit_manager', 'odu_manager', 'compliance_manager']
const MANAGER_ROLE_TO_UNIT = {
  odu_manager: 'odu',
  vipam_manager: 'vipam',
  hr_unit_manager: 'hr',
  compliance_manager: 'compliance',
  csu_manager: 'csu',
}
const DOC_EXTRACT_ROLES = [
  'psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer',
  'compliance_manager', 'compliance_senior', 'compliance_principal',
]
const DEADLINE_DRAFT_ROLES = [
  'psc_secretary', 'psc_admin', 'psc_officer', 'senior_admin_officer', 'psc_manager',
]
const PACKAGE_VALIDATE_ROLES = [
  'ministry_hr', 'dept_admin', 'head_of_agency',
  'psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer',
  'csu_manager', 'vipam_principal', 'vipam_senior',
  'compliance_manager', 'compliance_senior', 'compliance_principal',
]
const CHECKLIST_EDIT_ROLES = [
  'ministry_hr', 'dept_admin', 'head_of_agency',
  'psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer',
  'vipam_manager', 'hr_unit_manager', 'compliance_manager', 'compliance_senior',
]
// Submitter roles (ministry-side, and OPSC-internal submitters like CSU
// Manager) must attach a real file to satisfy a required-document item —
// they cannot self-declare "present" with the manual checkbox toggle the
// way OPSC reviewers can (see ChecklistPanel's uploadOnly mode).
const MINISTRY_SUBMITTER_ROLES = ['ministry_hr', 'dept_admin', 'csu_manager']

const DYNAMIC_CHECKLIST_EDIT_ROLES = [
  'odu_manager', 'odu_principal', 'odu_senior', 'psc_admin',
]
const DYNAMIC_CHECKLIST_VIEW_ROLES = [
  ...DYNAMIC_CHECKLIST_EDIT_ROLES,
  'psc_officer', 'psc_secretary', 'senior_admin_officer', 'psc_manager',
  // Commissioners need to review assessment work when voting during Commission Sitting
  'psc_commissioner', 'chairperson',
]
const DYNAMIC_CHECKLIST_EDIT_STAGE   = 'manager_checklist_review'
const DYNAMIC_CHECKLIST_VIEW_STAGES  = [
  'under_assessment', 'pending_secretary_approval', 'secretary_review', 'returned_for_clarification', 'deferred', 'tabled',
  'awaiting_legal_advice', 'awaiting_cabinet_decision', 'resubmitted', 'forwarded_to_commission',
  'commission_sitting', 'matters_arising', 'approved', 'rejected', 'returned',
  'deferred_back_to_hr', 'minutes_drafted_signed', 'decision_entered_assigned',
  'under_implementation', 'implementation_report',
]

// ─── Stage badge ──────────────────────────────────────────────────────────────

function StageBadge({ stage, overdue }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${stageBadgeClass(stage)}`}>
      {stageLabel(stage)}
      {overdue && (
        <span className="text-red-600 dark:text-red-400 font-normal">(overdue)</span>
      )}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubmissionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast   = useToast()
  const confirm = useConfirm()
  const { agendaSectionLabel, allSections: agendaSections } = useAgendaSections()
  const [submission, setSubmission] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [auditStationFilter, setAuditStationFilter] = useState(null)

  useEffect(() => {
    setAuditStationFilter(null)
  }, [id])
  const [allowed, setAllowed]       = useState([])
  const [canEndorse, setCanEndorse] = useState(false)
  const [remarks, setRemarks]       = useState('')
  const [error, setError]           = useState('')
  const [busy, setBusy]             = useState(false)
  const [checklist, setChecklist]   = useState([])
  const [checklistBusy, setChecklistBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [boardPaperDirty, setBoardPaperDirty] = useState(false)
  const [documents, setDocuments]   = useState([])
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadDesc, setUploadDesc] = useState('')
  const [versionsOpenFor, setVersionsOpenFor] = useState(null)  // doc id with history expanded
  const [versionsByDoc, setVersionsByDoc] = useState({})        // { docId: [versions] }
  const [annotatorDoc, setAnnotatorDoc] = useState(null)
  const [annotationCounts, setAnnotationCounts] = useState({})
  const [signerDoc, setSignerDoc] = useState(null)
  const [signatureCounts, setSignatureCounts] = useState({})  // { docId: signerCount }
  const [form37, setForm37] = useState(null)
  const [form37Busy, setForm37Busy] = useState(false)
  const [dynamicForm, setDynamicForm] = useState(null)   // values object
  const [dynamicFormFields, setDynamicFormFields] = useState([])
  const [dynamicFormBusy, setDynamicFormBusy] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [policyDrawerOpen, setPolicyDrawerOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', agenda_category: '', notes: '', notify_emails: [] })
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const [officers, setOfficers] = useState([])
  const [selectedOfficer, setSelectedOfficer] = useState('')
  const [allocateBusy, setAllocateBusy] = useState(false)
  const [assessmentFile, setAssessmentFile] = useState(null)
  const isAdmin = user?.role === 'psc_admin'
  const isUnitManager  = user && UNIT_MANAGER_ROLES.includes(user.role)
  // Allocation is an assessment-stage action — routed_unit is set once at intake and
  // never cleared, so without this the panel would stay usable at every later stage too.
  // Matches STAGE_META's "Assessment" category (constants/stages.js): checklist review
  // (where the unit manager first allocates) through the actual assessment work.
  const inAssessmentStage = ['manager_checklist_review', 'under_assessment'].includes(submission?.current_stage)
  const canAllocate    = user && inAssessmentStage && (
    isAdmin
    || (MANAGER_ROLE_TO_UNIT[user.role] && MANAGER_ROLE_TO_UNIT[user.role] === submission?.routed_unit)
  )
  // The assigned principal/senior officer hands their completed checklist
  // review or assessment back to their unit manager — only the manager
  // advances the stage from here (see transitions.py _UNIT_PRINCIPAL_ROLES).
  const isAssignedToMe = user && submission?.assigned_to === user.id
  const canSubmitToManager = isAssignedToMe && inAssessmentStage
  const canAnnotateDocs = user && [
    ...UNIT_MANAGER_ROLES,
    'psc_officer', 'psc_secretary', 'psc_commissioner', 'psc_admin',
    'senior_admin_officer', 'psc_manager', 'principal_officer',
  ].includes(user.role)
  const canSignDocs = user && [
    'psc_secretary', 'psc_commissioner', 'chairperson', 'psc_admin',
    'psc_manager', 'principal_officer', 'senior_admin_officer',
    ...UNIT_MANAGER_ROLES,
  ].includes(user.role)
  // Stage/role content-edit gate from the backend (single source of truth):
  // HR can edit only while drafting; the DG is view-only. `can_edit === false`
  // means the submission is locked for this user; undefined (older payloads)
  // stays permissive and the server still enforces.
  const contentEditable = submission?.can_edit !== false
  const canUploadDocs  = contentEditable && user && ['ministry_hr', 'dept_admin', 'head_of_agency',
                                   'psc_admin', 'psc_officer', 'psc_secretary', 'csu_manager'].includes(user.role)
  const canEditForm37  = contentEditable && user && ['ministry_hr', 'dept_admin', 'psc_admin',
                                   'psc_officer', 'psc_secretary', 'csu_manager'].includes(user.role)
  // Compliance forms are completed in CMS; portal record is read-only for compliance roles
  const canEditComplianceForm = false
  const canEditDigitizedForm = canEditForm37 || canEditComplianceForm
  // PSC 2-1 / PSC 2-2 / ORG-3.1 are ministry-authored — once it reaches ODU
  // or general OPSC staff, they review it read-only (single-page PSCForm21View/
  // PSCForm22View, not the editable multi-page wizard). Only the originating
  // ministry can still edit it, plus psc_admin for oversight/override.
  const canEditRestructureForm = contentEditable && user
    && ['ministry_hr', 'dept_admin', 'csu_manager', 'psc_admin'].includes(user.role)
  const isComplianceSubmission = isComplianceFormCode(submission?.form_type_code)

  // Dynamic checklist — shown when the form type has a linked checklist and the user has a matching role/stage
  const hasDynamicChecklist = Boolean(submission?.form_type_detail?.checklist_form_type)

  // Suppress the legacy hardcoded ODU form when a dynamic XML checklist is configured for this form type
  const showOduChecklist = canShowOduChecklist(submission, user) && !hasDynamicChecklist
  const showOduBoardPaper = canShowBoardPaper(submission, user) && !hasDynamicChecklist
  const stage = submission?.current_stage
  const showDynamicChecklist = user && hasDynamicChecklist && (
    (DYNAMIC_CHECKLIST_EDIT_ROLES.includes(user.role) && stage === DYNAMIC_CHECKLIST_EDIT_STAGE) ||
    (DYNAMIC_CHECKLIST_VIEW_ROLES.includes(user.role) && DYNAMIC_CHECKLIST_VIEW_STAGES.includes(stage)) ||
    user.is_superuser
  )
  // ORG-3.1 is the same real-world Organisation Restructure form as PSC 2-1
  // (see 0200_org_3_1_required_documents_odu_confirmed.py) — it reuses the
  // PSC 2-1 wizard rather than a separate dedicated form.
  const isDedicatedForm = ['PSC 2-1', 'PSC 2-2', 'ORG-3.1'].includes(submission?.form_type_code)
  // The executive brief is a triage tool for the OPSC unit that receives the
  // submission — while still in Draft (being authored by HR/CSU/VIPAM/Compliance),
  // there's nothing to triage yet; only package validation applies at that point.
  const showSecretariatBrief = user && userIsOpscInternal(user) && user.ai_enabled === true
    && submission?.current_stage !== 'draft'
  const canRegenerateBrief = userCanRegenerateAiBrief(user)
  const showDeadlineDrafts = user && DEADLINE_DRAFT_ROLES.includes(user.role) && user.ai_enabled === true
  const showPackageValidation = user && PACKAGE_VALIDATE_ROLES.includes(user.role)
    && user.ai_package_validation_enabled !== false
  const showPolicyGuardrail = user && ['ministry_hr', 'dept_admin', 'head_of_agency'].includes(user.role)
    && policyGuardrailApplies(submission)
  const canExtractDocs = user && DOC_EXTRACT_ROLES.includes(user.role)
  const isMinistrySubmitterChecklist = user && MINISTRY_SUBMITTER_ROLES.includes(user.role)
  const canEditChecklist = user && CHECKLIST_EDIT_ROLES.includes(user.role) && !isMinistrySubmitterChecklist
  // is_internal submissions that follow the normal route (e.g. CSU Manager's)
  // still get a checklist — only the short internal-only path skips it.
  const showChecklist = !submission?.is_attachment && !submission?.secretary_only
    && !(submission?.is_internal && !submission?.follows_normal_route)

  // ── Tab visibility — which of the fixed tab set applies to this
  // submission/role, so a tab with nothing in it never shows up. ──
  const showDigitizedFormTab = form37 !== null
    || (dynamicForm !== null && (dynamicFormFields.length > 0 || isDedicatedForm))
  const showChecklistTab = showOduChecklist || showDynamicChecklist
  const showCommissionPaperTab = showOduBoardPaper
  const TABS = [
    { key: 'overview', label: 'Overview', Icon: LayoutGrid },
    showDigitizedFormTab && { key: 'digitized_form', label: 'Digitized Form', Icon: FileText },
    showCommissionPaperTab && { key: 'commission_paper', label: 'Commission Paper', Icon: FileSignature },
    { key: 'documents', label: 'Required Documents', Icon: Paperclip },
    showChecklistTab && { key: 'checklist', label: 'Checklist', Icon: ClipboardCheck },
    { key: 'activity', label: 'Activity', Icon: MessageSquare },
  ].filter(Boolean)
  // If the previously active tab isn't valid for this submission/role (e.g.
  // navigating from a submission that had a Checklist tab to one that
  // doesn't), fall back to Overview instead of rendering an empty pane.
  const effectiveTab = TABS.some(t => t.key === activeTab) ? activeTab : 'overview'

  const applyBootstrap = useCallback((data) => {
    const tr = data.allowed_transitions || {}
    const nextAllowed = tr.allowed || []
    setSubmission(data.submission)
    setDocuments(data.documents || [])
    setChecklist(data.checklist || [])
    setAllowed(nextAllowed)
    setCanEndorse(tr.can_endorse ?? false)
    setAnnotationCounts(data.annotation_counts || {})
    setSignatureCounts(data.signature_counts || {})
  }, [])

  const loadBootstrap = useCallback(async ({ useCache = true } = {}) => {
    if (!id) return
    const cached = useCache ? getCachedSubmissionBootstrap(id) : null
    if (cached) {
      applyBootstrap(cached)
      setError('')
      setPageLoading(false)
      return
    }
    setPageLoading(true)
    try {
      const data = await fetchSubmissionBootstrap(id, { useCache: false })
      applyBootstrap(data)
      setError('')
    } catch (err) {
      setError(formatApiError(err, 'Unable to load submission.'))
    } finally {
      setPageLoading(false)
    }
  }, [id, applyBootstrap])

  const fetchSubmission = useCallback(async () => {
    try {
      const r = await api.get(`/submissions/${id}/`)
      setSubmission(r.data)
    } catch {
      // Keep last good state during background refresh
    }
  }, [id])

  useEffect(() => {
    if (showPolicyGuardrail) setPolicyDrawerOpen(true)
  }, [showPolicyGuardrail])

  useEffect(() => {
    let cancelled = false
    if (!id || !canAllocate) { setOfficers([]); return undefined }
    api.get(`/submissions/${id}/assignable-officers/`)
      .then(r => { if (!cancelled) setOfficers(r.data || []) })
      .catch(() => { if (!cancelled) setOfficers([]) })
    return () => { cancelled = true }
  }, [id, canAllocate])

  const allocateOfficer = async () => {
    if (!selectedOfficer) { toast.error('Select an officer to allocate to.'); return }
    setAllocateBusy(true)
    try {
      await api.post(`/submissions/${id}/assign/`, { assigned_to: Number(selectedOfficer) })
      setSelectedOfficer('')
      await reload()
      toast.success('Submission allocated.')
    } catch (err) {
      toast.error(formatApiError(err, 'Could not allocate the submission.'))
    } finally {
      setAllocateBusy(false)
    }
  }

  const unallocateOfficer = async () => {
    setAllocateBusy(true)
    try {
      await api.post(`/submissions/${id}/assign/`, { assigned_to: null })
      await reload()
      toast.success('Submission unallocated.')
    } catch (err) {
      toast.error(formatApiError(err, 'Could not unallocate the submission.'))
    } finally {
      setAllocateBusy(false)
    }
  }

  const submitToManager = async () => {
    setAllocateBusy(true)
    try {
      let payload
      let headers
      if (assessmentFile) {
        payload = new FormData()
        payload.append('file', assessmentFile)
        headers = { 'Content-Type': 'multipart/form-data' }
      }
      await api.post(`/submissions/${id}/submit-to-manager/`, payload, headers ? { headers } : undefined)
      setAssessmentFile(null)
      await reload()
      toast.success('Submitted back to your unit manager.')
    } catch (err) {
      toast.error(formatApiError(err, 'Could not submit back to your manager.'))
    } finally {
      setAllocateBusy(false)
    }
  }

  const addCoAssignee = async (userId) => {
    setAllocateBusy(true)
    try {
      await api.post(`/submissions/${id}/co-assign/`, { user_id: Number(userId), action: 'add' })
      await reload()
      toast.success('Co-analyst added.')
    } catch (err) {
      toast.error(formatApiError(err, 'Could not add co-analyst.'))
    } finally {
      setAllocateBusy(false)
    }
  }

  const removeCoAssignee = async (userId) => {
    setAllocateBusy(true)
    try {
      await api.post(`/submissions/${id}/co-assign/`, { user_id: userId, action: 'remove' })
      await reload()
      toast.success('Co-analyst removed.')
    } catch (err) {
      toast.error(formatApiError(err, 'Could not remove co-analyst.'))
    } finally {
      setAllocateBusy(false)
    }
  }

  const fetchTransitions = useCallback(async () => {
    if (!id || !user) { setAllowed([]); setCanEndorse(false); return }
    try {
      const r = await api.get(`/submissions/${id}/allowed_transitions/`)
      setAllowed(r.data.allowed || [])
      setCanEndorse(r.data.can_endorse ?? false)
    } catch {
      setAllowed([]); setCanEndorse(false)
    }
  }, [id, user])

  useEffect(() => {
    setSubmission(null)
    setDocuments([])
    setChecklist([])
    setAllowed([])
    setCanEndorse(false)
    setPageLoading(true)
    loadBootstrap({ useCache: true })
  }, [id, loadBootstrap])

  useEffect(() => {
    fetchTransitions()
  }, [fetchTransitions])

  // Stage sync when returning to the tab — global notification polling (Header)
  // already covers desktop alerts; no background 30s poll while the tab is hidden.
  useOnTabVisible(() => {
    if (!isRateLimited()) fetchSubmission()
  }, Boolean(submission))

  const toggleChecklistItem = async (item) => {
    setChecklistBusy(true)
    try {
      const r = await api.patch(`/submissions/${id}/checklist/${item.id}/`, {
        is_present: !item.is_present,
      })
      setChecklist(prev => prev.map(i => i.id === item.id ? r.data : i))
    } catch {
      // keep current state on failure
    } finally {
      setChecklistBusy(false)
    }
  }

  const fetchDocuments = useCallback(async () => {
    try {
      const r = await api.get(`/submissions/${id}/documents/`)
      setDocuments(r.data)
    } catch {
      // silently ignore
    }
  }, [id])

  const fetchAnnotationCounts = useCallback(async () => {
    try {
      const r = await api.get(`/doc-annotations/?submission=${id}`)
      const counts = {}
      r.data.forEach(ann => {
        counts[ann.document] = (counts[ann.document] || 0) + 1
      })
      setAnnotationCounts(counts)
    } catch {
      // silently ignore
    }
  }, [id])

  const fetchSignatureCounts = useCallback(async () => {
    try {
      const r = await api.get(`/doc-signatures/?submission=${id}`)
      const counts = {}
      r.data.forEach(sig => {
        counts[sig.document] = (counts[sig.document] || 0) + 1
      })
      setSignatureCounts(counts)
    } catch {
      // silently ignore
    }
  }, [id])

  const ocrInProgress = documents.some(
    d => d.ocr_status === 'pending' || d.ocr_status === 'processing',
  )
  useVisibilityAwareInterval(fetchDocuments, 5000, {
    enabled: ocrInProgress,
    fireOnVisible: true,
  })

  useEffect(() => {
    if (submission?.form_type_code !== 'PSC 3-7') return
    api.get(`/submissions/${id}/form37/`).then(r => {
      setForm37(r.data && Object.keys(r.data).length ? r.data : {})
    }).catch(() => setForm37({}))
  }, [id, submission?.form_type_code])

  // Load dynamic form (form builder) for digitized forms that are NOT the legacy PSC 3-7
  useEffect(() => {
    const ft = submission?.form_type_detail
    if (!ft?.is_digitized || ft?.digitized_form_key === 'psc_3_7' || !ft?.id) return

    if (isDedicatedForm) {
      // Dedicated forms have hardcoded fields — only load saved values
      api.get(`/submissions/${id}/dynamic-form/`)
        .then(valuesRes => {
          const data = valuesRes.data?.data ?? valuesRes.data ?? {}
          setDynamicForm(typeof data === 'object' && data !== null ? data : {})
        })
        .catch(() => setDynamicForm({}))
      return
    }

    Promise.all([
      api.get(`/form-fields/?form_type=${ft.id}`),
      api.get(`/submissions/${id}/dynamic-form/`),
    ]).then(([fieldsRes, valuesRes]) => {
      const raw = Array.isArray(fieldsRes.data) ? fieldsRes.data : (fieldsRes.data?.results ?? [])
      setDynamicFormFields(raw.sort((a, b) => a.display_order - b.display_order || a.id - b.id))
      const data = valuesRes.data?.data ?? valuesRes.data ?? {}
      const merged = typeof data === 'object' && data !== null ? { ...data } : {}
      if (!merged.prepared_by && raw.some(f => f.field_key === 'prepared_by') && user?.full_name) {
        merged.prepared_by = user.full_name
      }
      setDynamicForm(merged)
    }).catch(() => {
      setDynamicFormFields([])
      setDynamicForm({})
    })
  }, [id, submission?.form_type_detail?.id, isDedicatedForm, user?.full_name])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('description', uploadDesc)
      await api.post(`/submissions/${id}/documents/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUploadDesc('')
      await fetchDocuments()
      toast.success('Document uploaded successfully.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploadBusy(false)
    }
  }

  // Upload a document specifically for a required checklist item — tags the
  // file with required_document so the backend auto-marks the item present
  // (ministry-side roles can't self-declare presence without a real file).
  const handleUploadForItem = async (e, item) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('description', item.document_name)
      fd.append('required_document', item.document)
      await api.post(`/submissions/${id}/documents/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, is_present: true } : i))
      await fetchDocuments()
      toast.success(`"${item.document_name}" uploaded.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploadBusy(false)
    }
  }

  const handleReplaceDoc = async (e, doc) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/submissions/${id}/documents/${doc.id}/replace/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await fetchDocuments()
      setVersionsByDoc(prev => ({ ...prev, [doc.id]: undefined }))
      toast.success(`New version of "${doc.original_name}" uploaded — the previous file is kept on record.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Replace failed.')
    } finally {
      setUploadBusy(false)
    }
  }

  const toggleVersions = async (doc) => {
    if (versionsOpenFor === doc.id) {
      setVersionsOpenFor(null)
      return
    }
    setVersionsOpenFor(doc.id)
    if (!versionsByDoc[doc.id]) {
      try {
        const r = await api.get(`/submissions/${id}/documents/${doc.id}/versions/`)
        setVersionsByDoc(prev => ({ ...prev, [doc.id]: r.data.versions || [] }))
      } catch {
        toast.error('Could not load version history.')
        setVersionsOpenFor(null)
      }
    }
  }

  const downloadVersion = (doc, version) => {
    api.get(`/submissions/${id}/documents/${doc.id}/versions/${version.id}/download/`, { responseType: 'blob' })
      .then(r => {
        const url = URL.createObjectURL(new Blob([r.data], { type: r.headers['content-type'] }))
        const a = document.createElement('a')
        a.href = url
        a.download = `v${version.version_num}_${version.filename}`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      })
      .catch(() => toast.error('Could not download this version.'))
  }

  const handleDeleteDoc = async (doc) => {
    const isDraft = submission?.current_stage === 'draft'
    const ok = await confirm({
      title: isDraft ? 'Delete Document' : 'Remove Document',
      message: isDraft
        ? `Delete "${doc.original_name}"? This cannot be undone.`
        : `Remove "${doc.original_name}" from this submission? It will be archived on record — nothing is destroyed once a submission is in the workflow.`,
      confirmLabel: isDraft ? 'Delete' : 'Remove',
    })
    if (!ok) return
    try {
      await api.delete(`/submissions/${id}/documents/${doc.id}/`)
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      // Auto-unmark the linked checklist item if this doc was fulfilling it
      const linkedItem = checklist.find(i => i.document_name === doc.description && i.is_present)
      if (linkedItem) {
        await api.patch(`/submissions/${id}/checklist/${linkedItem.id}/`, { is_present: false })
        setChecklist(prev => prev.map(i => i.id === linkedItem.id ? { ...i, is_present: false } : i))
      }
      toast.success(isDraft ? 'Document deleted.' : 'Document removed and archived on record.')
    } catch {
      toast.error('Failed to remove document.')
    }
  }

  const openDocument = (doc) => {
    api.get(`/submissions/${id}/documents/${doc.id}/`, { responseType: 'blob' }).then(r => {
      const url = URL.createObjectURL(new Blob([r.data], { type: r.headers['content-type'] }))
      const a = document.createElement('a')
      a.href = url
      if (doc.content_type === 'application/pdf') {
        a.target = '_blank'
        a.rel = 'noopener'
      } else {
        a.download = doc.original_name
      }
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }).catch(() => toast.error('Could not open document.'))
  }

  const formatBytes = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

const hrAction = needsHrAction(submission?.current_stage)
const terminal = isTerminal(submission?.current_stage)

const stageDescriptions = {
  commission_sitting: 'Matters at this stage may be deferred to a later meeting (tabled) or referred for legal advice as needed.',
  matters_arising: 'This matter has been previously deliberated by the Commission and is returning for further consideration, bypassing the standard assessment pipeline.',
}

  const reload = async () => {
    invalidateSubmissionBootstrap(id)
    const data = await fetchSubmissionBootstrap(id, { useCache: false })
    applyBootstrap(data)
    // A transition/mutation here may change the row's stage — refresh the list cache.
    queryClient.invalidateQueries({ queryKey: ['submissions'] })
  }

  /**
   * Perform a standard workflow transition via the /transition/ endpoint.
   * `transitionRemarks` is the HTML from WorkflowActionsPanel's RichNoteModal
   * (or '' for actions with no note); the backend derives the plain-text
   * `remarks` it hashes/emails/etc. from this HTML server-side.
   */
  const performTransition = async (newStage, transitionRemarks = '', acknowledgeGaps = false) => {
    setBusy(true)
    setError('')
    const runOnce = async (ack = false) => {
      const resp = await api.post(`/submissions/${id}/transition/`, {
        new_stage: newStage,
        remarks_html: transitionRemarks,
        acknowledge_gaps: ack,
      })
      setRemarks('')
      await reload()
      toast.success('Stage updated successfully.')
      const cs = resp.data?.carryover_status
      if (newStage === 'submitted' && cs?.is_late) {
        toast.error(
          `Submitted after the due date for ${cs.nearest_meeting?.ref || 'the next sitting'}. ` +
          `Queued for ${cs.target_meeting?.ref || 'a later sitting'} — the Chairman may still admit it before endorsing that agenda.`,
        )
      }
    }
    try {
      await runOnce(acknowledgeGaps)
    } catch (err) {
      const data = err.response?.data
      const gaps = data?.package_gaps
      if (newStage === 'submitted' && Array.isArray(gaps) && gaps.some(g => g.severity === 'critical')) {
        setSubmission(prev => ({
          ...prev,
          ai_package_gaps: gaps,
          ai_package_ready: data.package_ready,
          ai_package_summary: data.package_summary,
          ai_package_processed: true,
        }))
        const proceed = await confirm({
          title: 'Critical gaps found',
          message: `${data.detail || 'Fix critical items before submitting.'} Submit anyway?`,
          confirmLabel: 'Submit anyway',
        })
        if (proceed) {
          try { await runOnce(true) } catch (err2) {
            const m = err2.response?.data?.detail || 'Transition failed.'
            setError(String(m)); toast.error(String(m))
          }
          setBusy(false)
          return
        }
        setError(data.detail || 'Submission blocked until critical gaps are resolved.')
        toast.error('Fix critical gaps or confirm submit anyway.')
        setBusy(false)
        return
      }
      const msg = data?.detail || (typeof data === 'object' ? JSON.stringify(data) : null) || 'Transition failed.'
      setError(String(msg))
      toast.error(String(msg))
    } finally {
      setBusy(false)
    }
  }

  /** DG Endorse — single API call that auto-chains to SUBMITTED. */
  const performEndorse = async () => {
    setBusy(true)
    setError('')
    try {
      await api.post(`/submissions/${id}/endorse/`)
      await reload()
      toast.success('Endorsed — submission forwarded directly to PSC.')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Endorsement failed.'
      setError(String(msg))
      toast.error(String(msg))
    } finally {
      setBusy(false)
    }
  }

  // Legacy alias (unused — kept so nothing crashes if any lingering ref exists)
  const submitTransition = async e => { e?.preventDefault?.() }

  const handleDeleteSubmission = async () => {
    const ok = await confirm({
      title: 'Move to Trash',
      message: `Move ${submission?.reference_number} to the trash bin? Nothing is destroyed — PSC Admin can restore it from Admin → Trash Bin.`,
      confirmLabel: 'Move to trash',
    })
    if (!ok) return
    try {
      await api.delete(`/submissions/${id}/`)
      toast.success('Submission moved to the trash bin.')
      navigate('/submissions')
    } catch {
      toast.error('Failed to move the submission to trash.')
    }
  }

  const handleTabChange = async (tab) => {
    if (tab === activeTab) return
    if (activeTab === 'commission_paper' && boardPaperDirty) {
      const ok = await confirm({
        title: 'Unsaved changes',
        message: 'You have unsaved changes to the Commission paper. Switch tabs without saving?',
        confirmLabel: 'Switch without saving',
      })
      if (!ok) return
    }
    setActiveTab(tab)
  }

  if (pageLoading && !submission) {
    return <PageSkeleton detailMode />
  }

  if (!submission) {
    return <div><PageHeader title="Submission" subtitle={error || 'Loading…'} /></div>
  }

  const meta = stageMeta(submission.current_stage)

  return (
    <>
    <div className={showPolicyGuardrail && policyDrawerOpen ? 'lg:mr-[28rem] transition-[margin] duration-300' : ''}>
      <PageHeader
        title={submission.reference_number}
        subtitle={submission.title}
        action={
          <div className="flex items-center gap-2">
            <BaseButton variant="outline" as={Link} to="/submissions">Back to log</BaseButton>
            {isAdmin && (
              <>
                <BaseButton
                  variant="outline"
                  icon={<Pencil size={14} />}
                  onClick={() => {
                    setEditForm({
                      title: submission.title || '',
                      agenda_category: submission.agenda_category || '',
                      notes: submission.notes || '',
                      notify_emails: submission.notify_emails || [],
                    })
                    setEditError('')
                    setEditOpen(true)
                  }}
                >
                  Edit
                </BaseButton>
                <BaseButton
                  variant="danger"
                  icon={<Trash2 size={14} />}
                  onClick={handleDeleteSubmission}
                >
                  Delete
                </BaseButton>
              </>
            )}
          </div>
        }
      />

      <SubmissionPresenceBar submissionId={id} />

      <SubmissionSubwayMap
        className="mb-4"
        subwayMap={submission.subway_map}
        currentStage={submission.current_stage}
        events={submission.events}
        selectedStationId={auditStationFilter?.stationId}
        onStationSelect={setAuditStationFilter}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      <CarryoverBanner status={submission.carryover_status} />

      {submission.can_edit === false && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>
            {user?.role === 'head_of_agency'
              ? t('submission.readonly_dg', { defaultValue: 'View-only: as Director-General you can endorse or return this submission, but not edit its content. Use “Return to HR” to request changes.' })
              : t('submission.readonly_hr', { defaultValue: 'Read-only: this submission is with the DG for endorsement. You can edit it again only if the DG returns it to draft.' })}
          </span>
        </div>
      )}

      {showPolicyGuardrail && (
        <>
          <PolicyGuardrailDrawer
            open={policyDrawerOpen}
            onOpenChange={setPolicyDrawerOpen}
            submission={submission}
            submissionId={id}
            onUpdated={setSubmission}
          />
          {!policyDrawerOpen && (
            <BaseButton
              variant="primary"
              onClick={() => setPolicyDrawerOpen(true)}
              icon={<span aria-hidden="true">🛡</span>}
              className="!fixed !bottom-24 !right-6 !z-[68] !rounded-full !bg-indigo-600 hover:!bg-indigo-700 dark:!bg-indigo-500"
            >
              AI policy scan
            </BaseButton>
          )}
        </>
      )}

      {isComplianceSubmission && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
          <p className="font-semibold">Compliance matter</p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            This is an OPSC Compliance case handled within SCDMS. Secretary and Commission
            stages run here; after the decision, implementation is assigned back to the
            Compliance Manager.
          </p>
        </div>
      )}

      {/* ── Attachment banner: shown when this submission is a child ── */}
      {submission.is_attachment && submission.parent_submission && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20 px-4 py-3 text-sm text-violet-800 dark:text-violet-200">
          <Paperclip size={15} className="shrink-0" />
          <span>
            This Job Description is submitted as an attachment to{' '}
            <Link
              to={`/submissions/${submission.parent_submission}`}
              className="font-semibold underline hover:text-violet-600 dark:hover:text-violet-300"
            >
              {submission.parent_reference || `#${submission.parent_submission}`}
            </Link>
            {submission.parent_title && <> — {submission.parent_title}</>}.
            It is reviewed alongside that submission.
          </span>
        </div>
      )}

      <div className="sticky top-16 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800">
        <div className="hidden sm:flex items-center gap-1 rounded-lg bg-white/70 dark:bg-slate-800 backdrop-blur-sm p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                effectiveTab === tab.key
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <tab.Icon size={13} />
              {tab.label}
              {tab.key === 'commission_paper' && boardPaperDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
              )}
            </button>
          ))}
        </div>
        <div className="flex sm:hidden gap-1 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
                effectiveTab === tab.key
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <tab.Icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Left: details + timeline ── */}
        <div className="lg:col-span-2 space-y-4">

          {effectiveTab === 'overview' && (
          <>
          {/* Stage guidance (subway map is at page top) */}
          {submission.current_stage !== 'draft' && (hrAction || terminal || submission.current_stage === 'matters_arising') && (
            <div className={`card card-compact space-y-2 ${hrAction ? 'border-l-4 border-l-orange-400' : terminal ? 'border-l-4 border-l-emerald-400' : ''}`}>
              {hrAction && (
                <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin shrink-0" />
                  Action needed — see the journey map above for where to respond.
                </p>
              )}
              {terminal && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="shrink-0" />
                  This matter has reached a completed implementation stage.
                </p>
              )}
              {submission.current_stage === 'matters_arising' && (
                <p className="text-xs text-purple-600 dark:text-purple-400 flex items-start gap-1.5">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  Previously deliberated matter — returning for further Commission consideration without re-entering the assessment pipeline.
                </p>
              )}
            </div>
          )}

          {/* Submission metadata */}
          <div className="card card-compact space-y-4 text-sm">
            {/* Stage + category header */}
              <div className="flex flex-wrap items-start gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current Stage</p>
                  <StageBadge stage={submission.current_stage} overdue={submission.is_assessment_overdue} />
                  <p className="text-[11px] text-slate-400 mt-1">{meta.category}</p>
                  {stageDescriptions[submission.current_stage] && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-1.5 border border-slate-100 dark:border-slate-700">
                      <Info size={11} className="mt-0.5 shrink-0 text-slate-400" />
                      <span>{stageDescriptions[submission.current_stage]}</span>
                    </div>
                  )}
                </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Logged</p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {submission.received_at ? new Date(submission.received_at).toLocaleDateString('en-VU', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                </p>
              </div>
            </div>

            {/* Grid of key fields */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ministry</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{submission.ministry?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{submission.department?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Submission Type</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {submission.agenda_category
                    ? agendaSectionLabel(submission.agenda_category).replace(/^\d+\.\s*/, '')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Assessment Started</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {submission.assessment_started_at
                    ? new Date(submission.assessment_started_at).toLocaleDateString('en-VU', { day:'2-digit', month:'short', year:'numeric' })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Assessment Deadline</p>
                <p className={`font-medium mt-0.5 ${submission.is_assessment_overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {submission.assessment_deadline_at
                    ? new Date(submission.assessment_deadline_at).toLocaleDateString('en-VU', { day:'2-digit', month:'short', year:'numeric' })
                    : '—'}
                </p>
              </div>
            </div>

            {submission.notes && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Notes</p>
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 text-xs">
                  {submission.notes}
                </p>
              </div>
            )}
          </div>

          {submission.secretary_only && (
            <TravelEndorsementPanel
              submissionId={id}
              submission={submission}
              onSigned={() => { fetchSubmission(); fetchTransitions() }}
            />
          )}

          {showPackageValidation && (
            <SubmissionPackageValidation
              submission={submission}
              submissionId={id}
              onUpdated={setSubmission}
            />
          )}

          {showSecretariatBrief && (
            <SecretariatBriefCard
              submission={submission}
              submissionId={id}
              onUpdated={setSubmission}
              canRegenerate={canRegenerateBrief}
            />
          )}

          {showDeadlineDrafts && submission?.assessment_deadline_at && (
            <div className="card card-compact">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                AI deadline reminder drafts
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Personalised emails for ministry contacts and assigned officers when the assessment deadline is approaching.
              </p>
              <DeadlineReminderDrafts submissionId={id} />
            </div>
          )}
          </>
          )}

          {/* ── Digitized PSC Form ── */}
          {effectiveTab === 'digitized_form' && (
          <>
          {form37 !== null && (
            <div className="card card-compact">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                <FileText size={14} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  PSC Form 3-7 — Request to Employ
                </h3>
                <span className="ml-auto text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-full">
                  Digitized
                </span>
              </div>

              {canEditForm37 ? (
                <>
                  <PSCForm37Fields form37={form37} setForm37={setForm37} />
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <BaseButton
                      variant="primary"
                      loading={form37Busy}
                      loadingLabel="Saving"
                      onClick={async () => {
                        setForm37Busy(true)
                        try {
                          const payload = { ...form37 }
                          ;['period_from', 'period_to', 'director_date', 'dg_date'].forEach(k => {
                            if (!payload[k]) payload[k] = null
                          })
                          await api.post(`/submissions/${id}/form37/`, payload)
                          toast.success('Form 3-7 saved.')
                        } catch {
                          toast.error('Failed to save Form 3-7.')
                        } finally {
                          setForm37Busy(false)
                        }
                      }}
                    >
                      Save Form 3-7
                    </BaseButton>
                  </div>
                </>
              ) : (
                <PSCForm37View data={form37} />
              )}
            </div>
          )}

          {/* ── Dynamic Form (Form Builder) ── */}
          {dynamicForm !== null && (dynamicFormFields.length > 0 || isDedicatedForm) && (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2 px-1">
                <FileText size={14} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {submission?.form_type_detail?.name ?? submission?.form_type_code ?? 'Digitized Form'}
                </h3>
                <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                  Digitized
                </span>
                {/* Preview toggle — only for forms that have a known preview template */}
                {submission?.form_type_code === 'PSC 2-2' && (
                  <BaseButton
                    variant={showPreview ? 'primary' : 'outline'}
                    size="sm"
                    className="ml-auto"
                    icon={showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                    onClick={() => setShowPreview(p => !p)}
                  >
                    {showPreview ? 'Hide Preview' : 'Preview Form'}
                  </BaseButton>
                )}
              </div>

              {/* Split layout when preview is active */}
              <div className={showPreview && submission?.form_type_code === 'PSC 2-2'
                ? 'grid grid-cols-1 xl:grid-cols-2 gap-4 items-start'
                : ''
              }>
                {/* Form editor / read-only view */}
                <div>
                  {(isDedicatedForm ? canEditRestructureForm : canEditDigitizedForm) ? (
                    isDedicatedForm ? (
                      <>
                        {['PSC 2-1', 'ORG-3.1'].includes(submission.form_type_code) && (
                          <PSCForm21Fields
                            form={dynamicForm}
                            setForm={setDynamicForm}
                            submission={submission}
                            onSave={async () => {
                              setDynamicFormBusy(true)
                              try {
                                await api.post(`/submissions/${id}/dynamic-form/`, {
                                  form_type: submission?.form_type_detail?.id,
                                  data: dynamicForm,
                                })
                                toast.success('Form saved.')
                              } catch {
                                toast.error('Failed to save form.')
                              } finally {
                                setDynamicFormBusy(false)
                              }
                            }}
                            isSaving={dynamicFormBusy}
                          />
                        )}
                        {submission.form_type_code === 'PSC 2-2' && (
                          <PSCForm22Fields
                            form={dynamicForm}
                            setForm={setDynamicForm}
                            submission={submission}
                            onSave={async () => {
                              setDynamicFormBusy(true)
                              try {
                                await api.post(`/submissions/${id}/dynamic-form/`, {
                                  form_type: submission?.form_type_detail?.id,
                                  data: dynamicForm,
                                })
                                toast.success('Form saved.')
                              } catch {
                                toast.error('Failed to save form.')
                              } finally {
                                setDynamicFormBusy(false)
                              }
                            }}
                            isSaving={dynamicFormBusy}
                          />
                        )}
                      </>
                    ) : (
                      <MultiPageFormRenderer
                        fields={dynamicFormFields}
                        values={dynamicForm}
                        onChange={setDynamicForm}
                        readOnly={false}
                        saving={dynamicFormBusy}
                        onSave={async () => {
                          setDynamicFormBusy(true)
                          try {
                            await api.post(`/submissions/${id}/dynamic-form/`, {
                              form_type: submission?.form_type_detail?.id,
                              data: dynamicForm,
                            })
                            toast.success('Form saved.')
                          } catch {
                            toast.error('Failed to save form.')
                          } finally {
                            setDynamicFormBusy(false)
                          }
                        }}
                      />
                    )
                  ) : (
                    isDedicatedForm ? (
                      <div className="card card-compact">
                        {submission.form_type_code === 'PSC 2-1' && submissionUsesOduRestructureChecklist(submission) && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                            Ministry's original request — reference only. See the ODU Commission Submission Paper below for the version prepared for the Commission.
                          </p>
                        )}
                        {['PSC 2-1', 'ORG-3.1'].includes(submission.form_type_code) && <PSCForm21View data={dynamicForm} submission={submission} />}
                        {submission.form_type_code === 'PSC 2-2' && <PSCForm22View data={dynamicForm} />}
                      </div>
                    ) : (
                      <MultiPageFormRenderer
                        fields={dynamicFormFields}
                        values={dynamicForm}
                        readOnly
                      />
                    )
                  )}
                </div>

                {/* Live preview panel (PSC Form 2-2 only) */}
                {showPreview && submission?.form_type_code === 'PSC 2-2' && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-4" style={{ maxHeight: '80vh' }}>
                    <PSCForm22Preview
                      values={dynamicForm}
                      submissionRef={submission.reference_number}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Formal decision service + acknowledgement ── */}
          {submission && <DecisionServicePanel submission={submission} />}
          </>
          )}

          {/* ── Commission Paper (ODU Board Paper) ── */}
          {effectiveTab === 'commission_paper' && showCommissionPaperTab && (
            <div className="card card-compact">
              <ODUBoardPaperForm
                submissionId={Number(id)}
                submission={submission}
                onDirtyChange={setBoardPaperDirty}
              />
            </div>
          )}

          {/* ── Checklist — the structured ODU sign-off form only; the
              plain required-documents tracker lives in Required Documents
              alongside the files themselves, so the two don't duplicate. ── */}
          {effectiveTab === 'checklist' && (
          <>
          {hasDynamicChecklist && showDynamicChecklist && (
            <SubmissionChecklistPanel submissionId={id} />
          )}

          {showOduChecklist && (
            <ODURestructureChecklistForm
              submissionId={Number(id)}
              submission={submission}
            />
          )}
          </>
          )}

          {/* ── Documents panel (additional, non-checklist attachments) ── */}
          {effectiveTab === 'documents' && (() => {
            const DocActions = ({ doc }) => (
              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                <BaseButton variant="ghost" size="sm" icon={<ExternalLink size={13} />} onClick={() => openDocument(doc)}>Open</BaseButton>
                {canAnnotateDocs && doc.content_type === 'application/pdf' && (
                  <BaseButton variant="ghost" size="sm" icon={<PenLine size={13} />} onClick={() => setAnnotatorDoc(doc)}>
                    Annotate
                    {annotationCounts[doc.id] > 0 && (
                      <span className="ml-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold px-1.5 py-0 leading-4">
                        {annotationCounts[doc.id]}
                      </span>
                    )}
                  </BaseButton>
                )}
                {canSignDocs && doc.content_type === 'application/pdf' && (
                  <BaseButton variant="ghost" size="sm" icon={<Pen size={13} />} onClick={() => setSignerDoc(doc)}>
                    Sign
                    {signatureCounts[doc.id] > 0 && (
                      <span className="ml-0.5 bg-indigo-500 text-white rounded-full text-[10px] font-bold px-1.5 py-0 leading-4">
                        {signatureCounts[doc.id]}
                      </span>
                    )}
                  </BaseButton>
                )}
                {canUploadDocs && (
                  <label
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      uploadBusy
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                    }`}
                    title="Upload a new version — the current file is kept on record"
                  >
                    <RefreshCw size={13} /> Replace
                    <input
                      type="file"
                      className="sr-only"
                      disabled={uploadBusy}
                      onChange={e => handleReplaceDoc(e, doc)}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    />
                  </label>
                )}
                {(canUploadDocs || user?.role === 'psc_admin') && (
                  <BaseButton variant="ghost" size="icon" iconOnly aria-label="Delete document" icon={<Trash2 size={13} />} onClick={() => handleDeleteDoc(doc)} />
                )}
              </div>
            )

            return (
              <>
              {/* ── Required Documents Checklist (AI autofill) — the same
                  required-document set as the file list below, tracked at
                  the item level (present/absent) rather than by file. ── */}
              {showChecklist && checklist.length > 0 && (
                <ChecklistPanel
                  checklist={checklist}
                  setChecklist={setChecklist}
                  submissionId={id}
                  canEdit={canEditChecklist}
                  hasDocuments={documents.length > 0}
                  autofillEnabled={user?.ai_checklist_autofill_enabled !== false}
                  uploadOnly={isMinistrySubmitterChecklist}
                  onUploadForItem={isMinistrySubmitterChecklist ? handleUploadForItem : undefined}
                  uploadBusy={uploadBusy}
                  currentStage={submission?.current_stage}
                  onAttached={reload}
                />
              )}
              <div className="card card-compact">
                {/* Panel header */}
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700">
                  <Paperclip size={14} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Documents</h3>
                  {documents.length > 0 && (
                    <span className="text-xs text-slate-400 ml-1">{documents.length} attached</span>
                  )}
                </div>

                {/* ── Document list ── */}
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 py-2 mb-4">No documents attached yet.</p>
                ) : (
                  <ul className="space-y-2 mb-4">
                    {documents.map(doc => (
                      <li key={doc.id} className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2.5">
                        <File size={16} className="text-slate-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {doc.original_name}
                            {doc.version_num > 1 && (
                              <span className="ml-2 inline-flex rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-200 align-middle">
                                v{doc.version_num}
                              </span>
                            )}
                          </p>
                          {doc.document_type && doc.document_type !== 'unclassified' && (
                            <span className="inline-flex mt-1 rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:text-violet-200">
                              {doc.document_type_display || doc.document_type}
                              {doc.document_type_confidence != null && (
                                <span className="opacity-70 ml-1">({doc.document_type_confidence}%)</span>
                              )}
                            </span>
                          )}
                          {doc.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{doc.description}</p>
                          )}
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {formatBytes(doc.file_size)}{doc.file_size ? ' · ' : ''}{doc.uploaded_by_username} · {new Date(doc.uploaded_at).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          {doc.version_count > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleVersions(doc)}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:underline"
                            >
                              <History size={11} />
                              {versionsOpenFor === doc.id ? 'Hide version history' : `Version history (${doc.version_count})`}
                            </button>
                          )}
                          {versionsOpenFor === doc.id && (
                            <ul className="mt-2 space-y-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
                              {!versionsByDoc[doc.id] ? (
                                <li className="text-[11px] text-slate-400 px-1">Loading…</li>
                              ) : versionsByDoc[doc.id].length === 0 ? (
                                <li className="text-[11px] text-slate-400 px-1">No previous versions.</li>
                              ) : versionsByDoc[doc.id].map(v => (
                                <li key={v.id} className="flex items-center justify-between gap-2 px-1">
                                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                    <span className="font-semibold">v{v.version_num}</span> · {v.filename}
                                    {' · '}{v.uploaded_by_username || 'unknown'}
                                    {' · '}{new Date(v.uploaded_at).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    {v.notes && <span className="italic"> — {v.notes}</span>}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => downloadVersion(doc, v)}
                                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"
                                    title="Download this version exactly as it was filed"
                                  >
                                    <Download size={11} /> Download
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <DocumentFactsPanel
                            submissionId={id}
                            doc={doc}
                            canExtract={canExtractDocs}
                            onRefresh={fetchDocuments}
                          />
                        </div>
                        <DocActions doc={doc} />
                      </li>
                    ))}
                  </ul>
                )}

                {/* ── Upload area ── */}
                {canUploadDocs && (
                  <div className={`${documents.length > 0 ? 'border-t border-slate-100 dark:border-slate-700 pt-4' : ''} space-y-2`}>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Attach any additional document not listed above but deemed necessary for review and recommendation</p>
                    <BaseInput
                      hideLabel
                      label="Description"
                      placeholder="Description (optional)"
                      value={uploadDesc}
                      onChange={e => setUploadDesc(e.target.value)}
                      disabled={uploadBusy}
                    />
                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                      uploadBusy
                        ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                        : 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
                    }`}>
                      <Upload size={14} />
                      {uploadBusy ? 'Uploading…' : 'Choose file & upload'}
                      <input
                        type="file"
                        className="sr-only"
                        disabled={uploadBusy}
                        onChange={handleUpload}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      />
                    </label>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">PDF, Word, Excel, or images — max 20 MB</p>
                  </div>
                )}
              </div>
              </>
            )
          })()}

          {/* ── Activity & audit trail ── */}
          {effectiveTab === 'activity' && (
          <>
          {/* Visual audit trail (workflow + tamper-evident decision proofs) —
              OPSC-internal only; ministry HR/DG never see this. */}
          {userIsOpscInternal(user) && (
            <div id="audit-trail" className="card card-compact scroll-mt-24">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700 flex-wrap">
                <FileText size={14} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Visual Audit Trail
                </h3>
                {submission.events?.some((e) => e.has_decision_proof || e.content_hash) && (
                  <VerificationBadge
                    submissionId={id}
                    workflowEventId={
                      [...(submission.events || [])]
                        .reverse()
                        .find((e) => e.has_decision_proof || e.content_hash)?.id
                    }
                    contentHash={
                      [...(submission.events || [])]
                        .reverse()
                        .find((e) => e.content_hash)?.content_hash
                    }
                  />
                )}
              </div>
              <VisualAuditTrail
                submissionId={id}
                stageFilter={auditStationFilter?.stages}
                filterLabel={auditStationFilter?.label}
                onClearFilter={() => setAuditStationFilter(null)}
              />
            </div>
          )}

          {/* ── Activity & Discussion (A7 collaboration) ── */}
          <SubmissionActivity submissionId={id} />
          </>
          )}
        </div>

        {/* ── Right: transition panel ── */}
        <div className="space-y-5">

          {submission?.ai_clarification_bilingual?.processed && (
            <div className="card card-compact space-y-3 border border-sky-200/60 dark:border-sky-900/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                AI draft — verify ministry communication
              </p>
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">English</p>
                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {submission.ai_clarification_bilingual.english}
                </p>
              </div>
              {submission.ai_clarification_bilingual.bislama && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Bislama</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {submission.ai_clarification_bilingual.bislama}
                  </p>
                </div>
              )}
            </div>
          )}

          <WorkflowActionsPanel
            submission={submission}
            allowed={allowed}
            canEndorse={canEndorse}
            checklist={checklist}
            onTransition={performTransition}
            onEndorse={performEndorse}
            busy={busy}
            error={error}
            setError={setError}
          />

          {canAllocate && (
            <div className="card card-compact space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Allocate to officer</h3>

              {/* Primary assignee */}
              {submission.assigned_to_name ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">
                    <span className="text-xs text-slate-400 mr-1">Primary:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{submission.assigned_to_name}</span>
                  </span>
                  <BaseButton variant="ghost" size="sm" onClick={unallocateOfficer} disabled={allocateBusy}>
                    Remove
                  </BaseButton>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Not yet allocated. Choose a primary officer below.
                </p>
              )}

              {/* Co-assignees */}
              {submission.co_assignments?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Co-analysts:</p>
                  {submission.co_assignments.map(ca => (
                    <div key={ca.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-700 dark:text-slate-300">
                        {ca.full_name}
                        <span className="ml-1.5 text-xs text-slate-400">({ca.role})</span>
                      </span>
                      <BaseButton variant="ghost" size="sm" onClick={() => removeCoAssignee(ca.id)} disabled={allocateBusy}>
                        Remove
                      </BaseButton>
                    </div>
                  ))}
                </div>
              )}

              {/* Assignment selector — primary or co-analyst */}
              <BaseSelect
                label={submission.assigned_to_name ? 'Add co-analyst / Reassign primary' : 'Officer'}
                value={selectedOfficer}
                onChange={(_e, v) => setSelectedOfficer(v)}
                options={[
                  { value: '', label: 'Select an officer…' },
                  ...officers
                    .filter(o => o.id !== submission.assigned_to && !submission.co_assignments?.some(ca => ca.id === o.id))
                    .map(o => ({
                      value: String(o.id),
                      label: `${o.full_name} — ${(o.role || '').replace(/_/g, ' ')}`
                        + (o.weighted_load != null
                          ? ` · ${o.active_count} active${o.open_tasks ? `, ${o.open_tasks} task(s)` : ''} (load ${o.weighted_load})`
                          : ''),
                    })),
                ]}
              />
              {officers.length > 0 && officers[0].weighted_load != null && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-1">
                  Officers are listed lightest plate first; "load" weights older work more heavily.
                </p>
              )}
              <div className="flex gap-2">
                <BaseButton type="button" variant="primary" className="flex-1"
                  loading={allocateBusy} loadingLabel="Saving"
                  onClick={allocateOfficer} disabled={!selectedOfficer}>
                  {submission.assigned_to_name ? 'Reassign primary' : 'Allocate'}
                </BaseButton>
                {submission.assigned_to_name && (
                  <BaseButton type="button" variant="secondary" className="flex-1"
                    loading={allocateBusy} loadingLabel="Adding"
                    onClick={() => { if (selectedOfficer) addCoAssignee(selectedOfficer) }}
                    disabled={!selectedOfficer}>
                    Add as co-analyst
                  </BaseButton>
                )}
              </div>
            </div>
          )}

          {canSubmitToManager && (
            <div className="card card-compact space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {submission.current_stage === 'manager_checklist_review' ? 'Checklist review' : 'Assessment'}
              </h3>
              {submission.ready_for_manager_at ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Submitted back to your unit manager — waiting for their review.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {submission.current_stage === 'under_assessment'
                      ? 'Attach your assessment (PDF), then submit it back to your unit manager for final verification.'
                      : "Once your review is complete, submit it back to your unit manager — they'll advance it to the next stage."}
                  </p>
                  {submission.current_stage === 'under_assessment' && (
                    <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:border-primary-400">
                      <Upload size={14} className="shrink-0" />
                      <span className="truncate flex-1">
                        {assessmentFile ? assessmentFile.name : 'Choose assessment PDF…'}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        onChange={e => setAssessmentFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                  <BaseButton type="button" variant="primary" className="w-full"
                    loading={allocateBusy} loadingLabel="Submitting"
                    disabled={submission.current_stage === 'under_assessment' && !assessmentFile}
                    onClick={submitToManager}>
                    Submit back to Manager
                  </BaseButton>
                </>
              )}
            </div>
          )}

          {/* No actions available — view-only notice */}
          {!allowed.length && !canEndorse && (
            <div className="card card-compact text-xs text-slate-500 dark:text-slate-400">
              No actions available at this stage for your role.
            </div>
          )}

          {/* Linked Job Descriptions panel — shown on the restructure parent
              (PSC 2-1 or ORG-3.1 — same real-world form, two codes) when children exist */}
          {submissionUsesOduRestructureChecklist(submission) && submission.attached_submissions?.length > 0 && (
            <div className="card card-compact space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                <Paperclip size={14} className="text-violet-500" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Linked Job Descriptions
                </h3>
                <span className="ml-auto text-xs text-slate-400">{submission.attached_submissions.length}</span>
              </div>
              <ul className="space-y-2">
                {submission.attached_submissions.map(child => (
                  <li key={child.id} className="flex items-start gap-2 text-xs">
                    <Link
                      to={`/submissions/${child.id}`}
                      className="font-mono text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
                    >
                      {child.reference_number}
                    </Link>
                    <span className="text-slate-600 dark:text-slate-300 min-w-0 truncate">{child.title}</span>
                    <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${stageBadgeClass(child.current_stage)}`}>
                      {stageLabel(child.current_stage)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick facts sidebar */}
          <div className="card card-compact space-y-3 text-xs">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Quick Info</p>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Logged by</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{submission.created_by_username || '—'}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Routed unit</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{submission.routed_unit || '—'}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Impl. status</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{submission.implementation_status || '—'}</span>
            </div>
            {submission.closing_deadline_at && (
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Closing deadline</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {new Date(submission.closing_deadline_at).toLocaleDateString('en-VU', { day:'2-digit', month:'short', year:'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ── AI Analysis Section (PSC staff only) ─────────────────────────── */}
    {submission && !isComplianceRole(user?.role) && (
      <div style={{ marginTop: '32px' }}>
        <details>
          <summary style={{ cursor: 'pointer', userSelect: 'none', marginBottom: '16px' }}>
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>
              🤖 AI Analysis Tools
            </span>
            <span style={{ color: 'var(--colorNeutralForeground3)', fontSize: '0.85rem', marginLeft: '8px' }}>
              (duplicate detection, risk assessment, outcome recommendation, letters)
            </span>
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: '16px', marginTop: '8px' }}>
            <AiDuplicatePanel submissionId={id} />
            <AiRiskPanel submissionId={id} />
            <AiOutcomePanel submissionId={id} />
            <AiNoaPanel submissionId={id} />
            <AiLetterPanel submissionId={id} suggestedOutcome={submission.ai_outcome_recommendation || ''} />
            <StructuredLetterPanel submissionId={id} formTypeCode={submission?.form_type_code || ''} />
          </div>
        </details>
      </div>
    )}

    {annotatorDoc && (
      <DocumentAnnotatorModal
        document={annotatorDoc}
        submissionId={id}
        onClose={() => {
          setAnnotatorDoc(null)
          fetchAnnotationCounts()
        }}
      />
    )}
    {signerDoc && (
      <DocumentSignatureModal
        document={signerDoc}
        submissionId={id}
        onClose={() => {
          setSignerDoc(null)
          fetchSignatureCounts()
        }}
      />
    )}
    {editOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
        <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Edit Submission</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{submission.reference_number}</p>
            </div>
            <BaseButton
              variant="ghost" size="icon" iconOnly
              aria-label="Close"
              onClick={() => setEditOpen(false)}
              icon={<X size={16} />}
            />
          </div>
          <form
            className="px-6 py-5 space-y-4"
            onSubmit={async e => {
              e.preventDefault()
              if (!editForm.title.trim()) { setEditError('Title is required.'); return }
              setEditBusy(true); setEditError('')
              try {
                const { data } = await api.patch(`/submissions/${id}/`, {
                  title: editForm.title.trim(),
                  agenda_category: editForm.agenda_category || undefined,
                  notes: editForm.notes,
                  notify_emails: editForm.notify_emails,
                })
                setSubmission(data)
                toast.success('Submission updated.')
                setEditOpen(false)
              } catch (err) {
                setEditError(formatApiError(err, 'Failed to update submission.'))
              } finally {
                setEditBusy(false)
              }
            }}
          >
            {editError && (
              <BaseMessageBar intent="error" className="mb-1">{editError}</BaseMessageBar>
            )}
            <BaseInput
              label="Title / Subject"
              required
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Enter submission title"
            />
            <BaseSelect
              label="Agenda section"
              placeholder="— None —"
              value={editForm.agenda_category}
              options={agendaSections.map(s => ({ value: s.value, label: s.label }))}
              onChange={(_, value) => setEditForm(f => ({ ...f, agenda_category: value }))}
            />
            <BaseTextarea
              label="Notes"
              rows={3}
              value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Internal notes (optional)"
            />
            <EmailChipInput
              label="Notify additional people (optional)"
              hint="They'll get an email with the reference number and a link to track progress — no account needed."
              value={editForm.notify_emails}
              onChange={emails => setEditForm(f => ({ ...f, notify_emails: emails }))}
              max={8}
            />
            <div className="flex gap-3 pt-1">
              <BaseButton type="submit" variant="primary" loading={editBusy} loadingLabel="Saving">
                Save Changes
              </BaseButton>
              <BaseButton type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancel</BaseButton>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  )
}
