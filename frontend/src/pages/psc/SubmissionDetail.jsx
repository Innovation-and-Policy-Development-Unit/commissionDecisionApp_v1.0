import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import SubmissionProgressBar from '../../components/shared/SubmissionProgressBar'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  stageLabel, stageBadgeClass, stageDotClass, stageMeta,
  needsHrAction, isTerminal, phaseForKey,
} from '../../constants/stages'
import { ArrowRight, AlertTriangle, Clock, CheckCircle2, FileText, RefreshCw, Info, ClipboardList, Square, CheckSquare, Upload, File, Trash2, ExternalLink, Paperclip, PenLine, Pen, Pencil, Eye, EyeOff } from 'lucide-react'
import DocumentAnnotatorModal from '../../components/shared/DocumentAnnotatorModal'
import DocumentSignatureModal from '../../components/shared/DocumentSignatureModal'
import PSCForm37Fields from './PSCForm37Fields'
import PSCForm37View from './PSCForm37View'
import DynamicFormRenderer from '../../components/shared/DynamicFormRenderer'
import MultiPageFormRenderer from '../../components/shared/MultiPageFormRenderer'
import PSCForm22Preview from '../../components/shared/PSCForm22Preview'
import PSCForm21Fields from './PSCForm21Fields'
import PSCForm21View from './PSCForm21View'
import PSCForm22Fields from './PSCForm22Fields'
import PSCForm22View from './PSCForm22View'
import ODURestructureChecklistForm from '../odu/ODURestructureChecklistForm'
import RestructureSubmissionForm from './RestructureSubmissionForm'
import { isComplianceFormCode, isComplianceRole } from '../../constants/compliance'

// All roles that may trigger a transition
const TRANSITION_ROLES = [
  'psc_officer', 'psc_secretary', 'psc_commissioner', 'psc_admin',
  'ministry_hr', 'dept_admin',
  'vipam_manager', 'hr_unit_manager', 'compliance_manager',
]

const UNIT_MANAGER_ROLES = ['vipam_manager', 'hr_unit_manager', 'odu_manager', 'compliance_manager']

// ─── Visual timeline ──────────────────────────────────────────────────────────

function WorkflowTimeline({ events, currentStage }) {
  if (!events?.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-4">
        <Clock size={14} />
        No stage transitions recorded yet.
      </div>
    )
  }

  return (
    <ol className="relative">
      {events.map((ev, idx) => {
        const isLast = idx === events.length - 1
        const dotClass = stageDotClass(ev.new_stage)
        const badgeClass = stageBadgeClass(ev.new_stage)
        return (
          <li key={ev.id} className="flex gap-4 pb-6 last:pb-0">
            {/* Dot + connector line */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800 shrink-0 mt-1 ${dotClass}`} />
              {!isLast && <div className="w-px flex-1 mt-1 bg-slate-200 dark:bg-slate-700" />}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {stageLabel(ev.previous_stage)}
                </span>
                <ArrowRight size={11} className="text-slate-400 shrink-0" />
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${badgeClass}`}>
                  {stageLabel(ev.new_stage)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {ev.actor_username} · {new Date(ev.created_at).toLocaleString('en-VU', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
              {ev.remarks && (
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-700 italic">
                  "{ev.remarks}"
                </p>
              )}
            </div>
          </li>
        )
      })}

      {/* Current stage cap */}
      <li className="flex gap-4">
        <div className="flex flex-col items-center">
          <div className={`w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800 shrink-0 mt-1 ring-offset-1 ${stageDotClass(currentStage)}`} />
        </div>
        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${stageBadgeClass(currentStage)}`}>
            <CheckCircle2 size={10} />
            {stageLabel(currentStage)} — current
          </span>
        </div>
      </li>
    </ol>
  )
}

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
  const { user } = useAuth()
  const toast   = useToast()
  const confirm = useConfirm()
  const [submission, setSubmission] = useState(null)
  const [allowed, setAllowed]       = useState([])
  const [remarks, setRemarks]       = useState('')
  const [targetStage, setTargetStage] = useState('')
  const [error, setError]           = useState('')
  const [busy, setBusy]             = useState(false)
  const [checklist, setChecklist]   = useState([])
  const [checklistBusy, setChecklistBusy] = useState(false)
  const [documents, setDocuments]   = useState([])
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadDesc, setUploadDesc] = useState('')
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

  const isAdmin        = user?.role === 'psc_admin'
  const canTransition  = user && TRANSITION_ROLES.includes(user.role)
  const isUnitManager  = user && UNIT_MANAGER_ROLES.includes(user.role)
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
  const canUploadDocs  = user && ['ministry_hr', 'dept_admin', 'head_of_agency',
                                   'psc_admin', 'psc_officer', 'psc_secretary'].includes(user.role)
  const canEditForm37  = user && ['ministry_hr', 'dept_admin', 'psc_admin',
                                   'psc_officer', 'psc_secretary'].includes(user.role)
  const canEditComplianceForm = user && isComplianceRole(user.role)
    && isComplianceFormCode(submission?.form_type_code)
    && ['draft', 'returned_for_clarification'].includes(submission?.current_stage)
  const canEditDigitizedForm = canEditForm37 || canEditComplianceForm

  const isOduRole      = user && ['odu_principal', 'odu_manager'].includes(user.role)
  const canViewOduChecklist = user && [
    'odu_principal', 'odu_manager',
    'psc_secretary', 'psc_admin', 'psc_manager',
  ].includes(user.role)

  // Restructure Submission Form (ORG-3.1 template)
  const isRestructureSubmission = submission?.form_type_code === 'ORG-3.1'
  const canEditRestructure = user && [
    'ministry_hr', 'dept_admin', 'head_of_agency',
    'psc_officer', 'psc_admin', 'psc_secretary',
  ].includes(user.role)

  const isDedicatedForm = ['PSC 2-1', 'PSC 2-2'].includes(submission?.form_type_code)

  const fetchSubmission = useCallback(async () => {
    try {
      const r = await api.get(`/submissions/${id}/`)
      setSubmission(prev => {
        const changed = prev?.current_stage !== r.data.current_stage
        return r.data
      })
    } catch {
      if (!submission) setError('Unable to load submission.')
    }
  }, [id])

  const fetchTransitions = useCallback(async () => {
    if (!id || !user || !canTransition) { setAllowed([]); setTargetStage(''); return }
    try {
      const r = await api.get(`/submissions/${id}/allowed_transitions/`)
      const next = r.data.allowed || []
      setAllowed(next)
      setTargetStage(p => (next.includes(p) ? p : next[0] || ''))
    } catch {
      setAllowed([])
    }
  }, [id, user, canTransition])

  useEffect(() => {
    fetchSubmission()
  }, [fetchSubmission])

  useEffect(() => {
    fetchTransitions()
  }, [fetchTransitions])

  // Poll every 30s for stage changes (no WebSocket infra needed)
  useEffect(() => {
    const interval = setInterval(fetchSubmission, 30000)
    return () => clearInterval(interval)
  }, [fetchSubmission])

  // Fetch checklist for all stages — required docs are always relevant
  const fetchChecklist = useCallback(async () => {
    if (!submission) return
    try {
      const r = await api.get(`/submissions/${id}/checklist/`)
      setChecklist(r.data)
    } catch {
      // silently ignore
    }
  }, [id, submission?.id])

  useEffect(() => {
    fetchChecklist()
  }, [fetchChecklist])

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

  useEffect(() => {
    fetchDocuments()
    fetchAnnotationCounts()
    fetchSignatureCounts()
  }, [fetchDocuments, fetchAnnotationCounts, fetchSignatureCounts])

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
      setDynamicForm(typeof data === 'object' && data !== null ? data : {})
    }).catch(() => {
      setDynamicFormFields([])
      setDynamicForm({})
    })
  }, [id, submission?.form_type_detail?.id, isDedicatedForm])

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

  // Upload a document specifically for a required checklist item
  const handleUploadForItem = async (e, item) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('description', item.document_name)
      await api.post(`/submissions/${id}/documents/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // Auto-mark checklist item as present
      if (!item.is_present) {
        await api.patch(`/submissions/${id}/checklist/${item.id}/`, { is_present: true })
        setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, is_present: true } : i))
      }
      await fetchDocuments()
      toast.success(`"${item.document_name}" uploaded.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploadBusy(false)
    }
  }

  const handleDeleteDoc = async (doc) => {
    const ok = await confirm({
      title: 'Delete Document',
      message: `Delete "${doc.original_name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
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
      toast.success('Document deleted.')
    } catch {
      toast.error('Failed to delete document.')
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
    const [subRes, trRes] = await Promise.all([
      api.get(`/submissions/${id}/`),
      canTransition ? api.get(`/submissions/${id}/allowed_transitions/`) : Promise.resolve({ data: { allowed: [] } }),
    ])
    setSubmission(subRes.data)
    const next = trRes.data.allowed || []
    setAllowed(next)
    setTargetStage(p => (next.includes(p) ? p : next[0] || ''))
  }

  const submitTransition = async e => {
    e.preventDefault()
    if (!targetStage) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/submissions/${id}/transition/`, { new_stage: targetStage, remarks })
      setRemarks('')
      await reload()
      toast.success('Stage updated successfully.')
    } catch (err) {
      const msg = err.response?.data?.detail
        || (typeof err.response?.data === 'object' ? JSON.stringify(err.response.data) : null)
        || 'Transition failed.'
      setError(String(msg))
      toast.error(String(msg))
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSubmission = async () => {
    const ok = await confirm({
      title: 'Delete Submission',
      message: `Delete ${submission?.reference_number}? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await api.delete(`/submissions/${id}/`)
      toast.success('Submission deleted.')
      navigate('/submissions')
    } catch {
      toast.error('Failed to delete submission.')
    }
  }

  if (!submission) {
    return <div><PageHeader title="Submission" subtitle={error || 'Loading…'} /></div>
  }

  const meta = stageMeta(submission.current_stage)

  return (
    <>
    <div>
      <PageHeader
        title={submission.reference_number}
        subtitle={submission.title}
        action={
          <div className="flex items-center gap-2">
            <Link to="/submissions" className="btn-outline">Back to log</Link>
            {isAdmin && (
              <>
                <Link
                  to={`/submissions/${id}/edit`}
                  className="btn-outline inline-flex items-center gap-1.5"
                >
                  <Pencil size={14} />
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={handleDeleteSubmission}
                  className="btn-outline inline-flex items-center gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </>
            )}
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: details + timeline ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Progress bar — HR-friendly phase tracker */}
          {submission.current_stage !== 'draft' && (
            <div className={`card p-5 ${hrAction ? 'border-l-4 border-l-orange-400' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                {hrAction && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                    <RefreshCw size={11} className="animate-spin" />
                    Action needed
                  </span>
                )}
                {terminal && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 size={11} />
                    Completed
                  </span>
                )}
                {!hrAction && !terminal && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {phaseForKey(submission.current_stage)?.label || stageLabel(submission.current_stage)}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <RefreshCw size={10} /> Live
                </span>
              </div>
              <SubmissionProgressBar currentStage={submission.current_stage} />
              {submission.current_stage === 'returned_for_clarification' && (
                <p className="mt-3 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
                  This submission requires clarification. Please review the remarks, make the required changes, and resubmit for processing.
                </p>
              )}
              {submission.current_stage === 'deferred_back_to_hr' && (
                <p className="mt-3 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
                  The Commission has deferred this matter and returned it for review. Once you have addressed the feedback, resubmit it as a <strong>Matter Arising</strong> for the next sitting.
                </p>
              )}
              {submission.current_stage === 'matters_arising' && (
                <p className="mt-3 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  Previously deliberated matter — returning for further Commission consideration without re-entering the assessment pipeline.
                </p>
              )}
            </div>
          )}

          {/* Submission metadata */}
          <div className="card p-5 space-y-4 text-sm">
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
                <p className="text-xs text-slate-500 dark:text-slate-400">Category</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{submission.form_category?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Form Type</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{submission.form_type_code || '—'}</p>
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

          {/* ── Digitized PSC Form ── */}
          {form37 !== null && (
            <div className="card p-5">
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
                    <button
                      type="button"
                      disabled={form37Busy}
                      className="btn-primary px-5 py-2"
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
                      {form37Busy ? 'Saving…' : 'Save Form 3-7'}
                    </button>
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
                  <button
                    type="button"
                    onClick={() => setShowPreview(p => !p)}
                    className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      showPreview
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary-400'
                    }`}
                  >
                    {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showPreview ? 'Hide Preview' : 'Preview Form'}
                  </button>
                )}
              </div>

              {/* Split layout when preview is active */}
              <div className={showPreview && submission?.form_type_code === 'PSC 2-2'
                ? 'grid grid-cols-1 xl:grid-cols-2 gap-4 items-start'
                : ''
              }>
                {/* Form editor / read-only view */}
                <div>
                  {canEditDigitizedForm ? (
                    isDedicatedForm ? (
                      <>
                        {submission.form_type_code === 'PSC 2-1' && (
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
                      <div className="card p-5">
                        {submission.form_type_code === 'PSC 2-1' && <PSCForm21View data={dynamicForm} />}
                        {submission.form_type_code === 'PSC 2-2' && <PSCForm22View data={dynamicForm} />}
                      </div>
                    ) : (
                      <div className="card p-5">
                        <DynamicFormRenderer
                          fields={dynamicFormFields}
                          values={dynamicForm}
                          readOnly
                        />
                      </div>
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

          {/* ── Documents panel ── */}
          {(() => {
            const DocActions = ({ doc }) => (
              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => openDocument(doc)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                >
                  <ExternalLink size={13} /> Open
                </button>
                {canAnnotateDocs && doc.content_type === 'application/pdf' && (
                  <button
                    type="button"
                    onClick={() => setAnnotatorDoc(doc)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    <PenLine size={13} /> Annotate
                    {annotationCounts[doc.id] > 0 && (
                      <span className="ml-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold px-1.5 py-0 leading-4">
                        {annotationCounts[doc.id]}
                      </span>
                    )}
                  </button>
                )}
                {canSignDocs && doc.content_type === 'application/pdf' && (
                  <button
                    type="button"
                    onClick={() => setSignerDoc(doc)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                  >
                    <Pen size={13} /> Sign
                    {signatureCounts[doc.id] > 0 && (
                      <span className="ml-0.5 bg-indigo-500 text-white rounded-full text-[10px] font-bold px-1.5 py-0 leading-4">
                        {signatureCounts[doc.id]}
                      </span>
                    )}
                  </button>
                )}
                {(canUploadDocs || user?.role === 'psc_admin') && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(doc)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )

            return (
              <div className="card p-5">
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
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{doc.original_name}</p>
                          {doc.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{doc.description}</p>
                          )}
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {formatBytes(doc.file_size)}{doc.file_size ? ' · ' : ''}{doc.uploaded_by_username} · {new Date(doc.uploaded_at).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <DocActions doc={doc} />
                      </li>
                    ))}
                  </ul>
                )}

                {/* ── Upload area ── */}
                {canUploadDocs && (
                  <div className={`${documents.length > 0 ? 'border-t border-slate-100 dark:border-slate-700 pt-4' : ''} space-y-2`}>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Attach a document</p>
                    <input
                      type="text"
                      className="input text-sm"
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
            )
          })()}

          {/* ── Restructure Submission Form (ORG-3.1 template) ── */}
          {isRestructureSubmission && (
            <RestructureSubmissionForm
              submissionId={Number(id)}
              submission={submission}
              canEdit={!!canEditRestructure}
            />
          )}

          {/* ── ODU Restructure Checklist ── */}
          {canViewOduChecklist && (
            <ODURestructureChecklistForm
              submissionId={Number(id)}
              submission={submission}
              readOnly={!isOduRole}
            />
          )}

          {/* Workflow timeline */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700">
              <FileText size={14} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Workflow Timeline</h3>
              {submission.events?.length > 0 && (
                <span className="ml-auto text-xs text-slate-400">{submission.events.length} transition{submission.events.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <WorkflowTimeline events={submission.events} currentStage={submission.current_stage} />
          </div>
        </div>

        {/* ── Right: transition panel ── */}
        <div className="space-y-5">

          {canTransition && allowed.length > 0 && (
            <form onSubmit={submitTransition} className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Move to Next Stage</h3>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Select stage
                </label>
                <select className="input" value={targetStage} onChange={e => setTargetStage(e.target.value)}>
                  {allowed.map(s => (
                    <option key={s} value={s}>{stageLabel(s)}</option>
                  ))}
                </select>
                {targetStage && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {stageMeta(targetStage).category}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Remarks <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  className="input min-h-[88px] text-sm"
                  placeholder="Add notes about this transition…"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn-gradient w-full justify-center py-2.5 gap-2"
                disabled={busy}
              >
                {busy ? 'Saving…' : <><ArrowRight size={14} /> Apply Transition</>}
              </button>
            </form>
          )}

          {canTransition && !allowed.length && (
            <div className="card p-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No transitions available from <span className="font-medium">{stageLabel(submission.current_stage)}</span> for your role.
              </p>
            </div>
          )}

          {!canTransition && (
            <div className="card p-5 text-sm text-slate-600 dark:text-slate-300">
              You have read-only access to this submission.
            </div>
          )}

          {/* Linked Job Descriptions panel — shown on Form 2-1 when children exist */}
          {submission.form_type_code === 'PSC 2-1' && submission.attached_submissions?.length > 0 && (
            <div className="card p-5 space-y-3">
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
          <div className="card p-5 space-y-3 text-xs">
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
    </>
  )
}
