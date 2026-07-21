import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import BaseButton from '../../components/shared/BaseButton'
import BaseTextarea from '../../components/shared/BaseTextarea'
import BaseInput from '../../components/shared/BaseInput'
import {
  ChevronDown, ChevronRight, Camera, X, Users2, RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'

// ── Checklist content ─────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 's1', title: '1. Overall Workflow & Clarity', note: "the big picture, before individual screens", items: [
    "The end-to-end lifecycle (submission → your unit's review → assessment → commission sitting → decision → implementation) makes sense as a whole",
    'Stage names and terminology match how PSC actually talks about the process',
    "It's clear at every stage whose responsibility a submission currently is",
    "The distinction between similar stages (e.g. 'returned for clarification' vs 'rejected') is clear",
  ] },
  { id: 's2', title: '2. Submission Intake & Routing', note: 'ministry submits → received by PSC → reaches your unit', items: [
    'Submissions are routed to your unit correctly, without manual correction',
    'The submission detail screen shows enough context to understand what is being requested',
    'Attached documents open, display, and download correctly',
    "It's clear which submissions are new / awaiting your review vs. already actioned",
  ] },
  { id: 's3', title: '3. Checklist Review (Your Manager Gate)', note: 'manager_checklist_review stage', items: [
    'The checklist review step covers everything your unit actually checks manually today',
    'Required documents are validated correctly before a submission can proceed',
    'You can return a submission for clarification with a clear, recorded reason',
    "It's clear who a submission gets assigned to (which Principal) after it passes your review",
    'Notifications alert you promptly when something needs your review',
  ] },
  { id: 's4', title: '4. Assignment to Unit Principals & Assessment Tracking', note: 'under_assessment stage', items: [
    'Assigning a submission to a Principal in your unit is quick and unambiguous',
    'You can see the status/progress of submissions assigned to your Principals at a glance',
    'Reassignment (e.g. if someone is on leave/unavailable) is possible without losing history',
    'Deferred, tabled, or escalated (legal advice / Cabinet decision) items are clearly distinguishable from active work',
    'Escalation paths (legal advice, Cabinet, etc.) match how these are actually handled today',
  ] },
  { id: 's5', title: '5. PSC Forms Your Unit Uses', note: 'digitized forms, e.g. Form 5-1, Form 2-1/2-2', items: [
    'Digitized PSC forms your unit works with match the paper versions you know',
    'Required fields catch incomplete submissions before they reach you',
    'Multi-page / sectioned forms are easy to read and navigate',
    "It's clear if/when a paper form still needs to be used as a fallback",
  ] },
  { id: 's6', title: '6. Documents & Sign-Off', items: [
    'Viewing and reviewing supporting documents is straightforward',
    'Annotating documents (comments, markup) works as expected for your review process',
    'Digital signatures are clear and trustworthy for formal sign-off',
    "It's clear when a document has been replaced or updated",
  ] },
  { id: 's7', title: '7. Commission Sitting & Decision Outcomes', note: "visibility after your unit's part is done", items: [
    'You can see when a submission from your unit reaches commission sitting',
    'The outcome (approved / rejected / returned / deferred back to HR / matters arising) is clearly recorded and visible to your unit',
    'Signed minutes are accessible to those in your unit who need to act on them',
    'Your unit is notified promptly once a decision is made',
  ] },
  { id: 's8', title: '8. Post-Decision Implementation Tracking', items: [
    'Tasks arising from a decision that affect your unit are clearly assigned and trackable',
    'Status updates give a realistic picture of implementation progress',
    "It's clear when an implementation report is due and who owns producing it",
    'Your unit can see whether earlier decisions affecting it were actually implemented',
  ] },
  { id: 's9', title: '9. Notifications & Communication', items: [
    'In-app notifications are timely and relevant (not too noisy, not too quiet)',
    'Email notifications, where used, arrive reliably and contain enough context',
    "It's easy to tell what action a notification requires, if any",
    'Nothing important currently relies on someone remembering to check manually',
  ] },
  { id: 's10', title: "10. Your Unit's Dashboard, Reports & Search", items: [
    "The dashboard gives a useful at-a-glance view of your unit's workload",
    "Reports reflect the figures your unit would actually need for its own reporting",
    'Search finds submissions reliably by name, reference number, or keyword',
    "Filtering (by stage, date range, etc.) is sufficient for your unit's day-to-day needs",
  ] },
  { id: 's11', title: '11. Login & Everyday Access', items: [
    'Logging in, including two-factor authentication (if enabled), is manageable for your staff',
    'Your unit only sees the submissions and data it should — nothing more, nothing less',
    "Password reset / account recovery works and is easy to find if someone gets locked out",
    "You would trust the system's record of who did what, if something needed to be traced back",
  ] },
  { id: 's12', title: '12. General Usability & Training Needs', items: [
    'Overall navigation and layout are clear without training',
    'Wording, labels, and terminology throughout feel natural, not overly technical or ambiguous',
    'The system is usable on the devices/browsers your unit actually has',
    'Your staff would need dedicated training before going live, beyond a short walkthrough',
  ] },
  { id: 's13', title: "13. What's Missing?", note: 'anything not covered above', open: true, items: [
    'Features, steps, checks, or reports your unit needs that you did not see in the system today',
  ] },
  { id: 's14', title: '14. Before We Pilot', note: 'up to three must-fix items, in priority order', open: true, items: [
    'Priority 1 — the single most important thing to fix before pilot',
    'Priority 2',
    'Priority 3',
  ] },
]

const RATING_META = {
  good:    { label: 'Works well',     sel: 'bg-emerald-50 border-emerald-400 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-600 dark:text-emerald-300' },
  needs:   { label: 'Needs work',     sel: 'bg-amber-50 border-amber-400 text-amber-800 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-300' },
  missing: { label: 'Missing / N/A',  sel: 'bg-red-50 border-red-400 text-red-800 dark:bg-red-900/30 dark:border-red-600 dark:text-red-300' },
}

function totalRatingItemCount() {
  let n = 0
  SECTIONS.forEach(sec => { if (!sec.open) n += sec.items.length })
  return n
}
const TOTAL_RATING_ITEMS = totalRatingItemCount()

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const maxW = 900
        const scale = Math.min(1, maxW / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Could not process image')); return }
          resolve(new File([blob], 'screenshot.jpg', { type: 'image/jpeg' }))
        }, 'image/jpeg', 0.75)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// ── Screenshot drop/paste zone ──────────────────────────────────────────────

function ScreenshotZone({ preview, onChange, onRemove }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file || file.type.indexOf('image') !== 0) return
    try {
      const resized = await resizeImage(file)
      onChange(resized)
    } catch {
      onChange(file)
    }
  }

  return (
    <div className="w-full sm:w-56 shrink-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => { if (!preview) inputRef.current?.click() }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !preview) inputRef.current?.click() }}
        onPaste={(e) => {
          const items = e.clipboardData?.items || []
          for (const it of items) {
            if (it.type.indexOf('image') === 0) { handleFile(it.getAsFile()); e.preventDefault(); return }
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) handleFile(file)
        }}
        className={clsx(
          'relative min-h-[56px] rounded-lg border-2 border-dashed flex items-center justify-center text-center p-2 text-xs cursor-pointer overflow-hidden',
          dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40',
          preview && 'border-solid p-0',
        )}
      >
        {preview ? (
          <>
            <img src={preview} alt="Screenshot preview" className="max-h-32 max-w-full mx-auto block" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              aria-label="Remove screenshot"
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <Camera size={14} /> Paste, drop, or click to add a screenshot
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
        />
      </div>
    </div>
  )
}

// ── Single rated item (fill mode) ───────────────────────────────────────────

function FillItem({ sectionId, idx, text, isOpen, value, onChange }) {
  const itemId = `${sectionId}-i${idx}`
  const setRating = (v) => onChange(itemId, { ...value, rating: value.rating === v ? null : v })
  const setComment = (comment) => onChange(itemId, { ...value, comment })
  const setScreenshotFile = (file) => {
    const preview = URL.createObjectURL(file)
    onChange(itemId, { ...value, screenshotFile: file, screenshotPreview: preview, removeScreenshot: false })
  }
  const removeScreenshot = () => onChange(itemId, { ...value, screenshotFile: null, screenshotPreview: null, screenshotUrl: null, removeScreenshot: true })

  return (
    <div className={clsx('py-4', !isOpen && 'border-b border-slate-100 dark:border-slate-700 last:border-0')}>
      <p className={clsx('mb-2.5', isOpen ? 'text-sm font-semibold text-primary-700 dark:text-primary-400' : 'text-sm font-medium text-slate-800 dark:text-slate-200')}>
        {text}
      </p>
      {!isOpen && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {Object.entries(RATING_META).map(([v, meta]) => (
            <button
              key={v}
              type="button"
              onClick={() => setRating(v)}
              className={clsx(
                'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
                value.rating === v ? meta.sel : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500',
              )}
            >
              {meta.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <BaseTextarea
          hideLabel
          label={`Comment for ${itemId}`}
          rows={2}
          placeholder="Comment (optional)..."
          value={value.comment || ''}
          onChange={(e) => setComment(e.target.value)}
          className="flex-1"
        />
        <ScreenshotZone
          preview={value.screenshotPreview || value.screenshotUrl}
          onChange={setScreenshotFile}
          onRemove={removeScreenshot}
        />
      </div>
    </div>
  )
}

// ── Section (fill mode) ──────────────────────────────────────────────────────

function FillSection({ section, forceOpen, responses, onChange }) {
  const [open, setOpen] = useState(section.id === 's1')
  const isOpenState = forceOpen ?? open

  return (
    <div className="card overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{section.title}</p>
          {section.note && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{section.note}</p>}
        </div>
        {isOpenState ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
      </button>
      {isOpenState && (
        <div className="px-5 pb-4 border-t border-slate-100 dark:border-slate-700">
          {section.items.map((text, idx) => (
            <FillItem
              key={idx}
              sectionId={section.id}
              idx={idx}
              text={text}
              isOpen={!!section.open}
              value={responses[`${section.id}-i${idx}`] || {}}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Read-only item (team view) ───────────────────────────────────────────────

function ReadOnlyItem({ text, isOpen, data }) {
  return (
    <div className="py-2.5">
      <p className={clsx('text-xs mb-1.5', isOpen ? 'font-semibold text-primary-700 dark:text-primary-400' : 'font-medium text-slate-700 dark:text-slate-300')}>{text}</p>
      {!isOpen && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {Object.entries(RATING_META).map(([v, meta]) => (
            <span key={v} className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-full border', data?.rating === v ? meta.sel : 'border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600')}>
              {meta.label}
            </span>
          ))}
        </div>
      )}
      {data?.comment && (
        <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-2.5 py-1.5 mt-1">{data.comment}</p>
      )}
      {data?.screenshot && (
        <img src={data.screenshot} alt="" className="max-w-[220px] rounded-lg border border-slate-200 dark:border-slate-700 mt-1.5" />
      )}
    </div>
  )
}

// ── Team response card ───────────────────────────────────────────────────────

function TeamCard({ entry }) {
  const [open, setOpen] = useState(false)
  const counts = { good: 0, needs: 0, missing: 0, comments: 0, shots: 0 }
  Object.values(entry.byItem).forEach(r => {
    if (r.rating === 'good') counts.good++
    if (r.rating === 'needs') counts.needs++
    if (r.rating === 'missing') counts.missing++
    if (r.comment) counts.comments++
    if (r.screenshot) counts.shots++
  })

  return (
    <div className="card p-4 mb-2.5">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-start justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {entry.username}{entry.unit && <span className="font-normal text-slate-400 dark:text-slate-500"> · {entry.unit}</span>}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{counts.good} works well</span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{counts.needs} needs work</span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">{counts.missing} missing</span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">{counts.comments} comments</span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">{counts.shots} screenshots</span>
          </div>
        </div>
        {open ? <ChevronDown size={16} className="text-slate-400 shrink-0 mt-1" /> : <ChevronRight size={16} className="text-slate-400 shrink-0 mt-1" />}
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          {SECTIONS.map(sec => (
            <div key={sec.id} className="mb-3">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">{sec.title}</p>
              {sec.items.map((text, idx) => (
                <ReadOnlyItem key={idx} text={text} isOpen={!!sec.open} data={entry.byItem[`${sec.id}-i${idx}`]} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function FeedbackChecklist() {
  const { user } = useAuth()
  const toast = useToast()
  const [unit, setUnit] = useState('')
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState('fill')
  const [forceOpen, setForceOpen] = useState(null)
  const [team, setTeam] = useState(null)
  const [teamLoading, setTeamLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get('/feedback-checklist/mine/').then(r => {
      if (cancelled) return
      const map = {}
      let foundUnit = ''
      r.data.forEach(row => {
        map[row.item_id] = { rating: row.rating || null, comment: row.comment || '', screenshotUrl: row.screenshot || null }
        if (row.unit) foundUnit = row.unit
      })
      setResponses(map)
      setUnit(foundUnit || user?.unit?.name || '')
    }).catch(() => {
      setUnit(user?.unit?.name || '')
    }).finally(() => setLoading(false))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (dirty) {
      const handler = (e) => { e.preventDefault(); e.returnValue = '' }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
    return undefined
  }, [dirty])

  const ratedCount = useMemo(
    () => Object.values(responses).filter(r => r.rating).length,
    [responses],
  )

  const handleItemChange = useCallback((itemId, value) => {
    setResponses(prev => ({ ...prev, [itemId]: value }))
    setDirty(true)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const items = []
      const fd = new FormData()
      SECTIONS.forEach(sec => {
        sec.items.forEach((text, idx) => {
          const itemId = `${sec.id}-i${idx}`
          const r = responses[itemId]
          if (!r || (!r.rating && !r.comment && !r.screenshotFile && !r.screenshotUrl)) return
          items.push({
            item_id: itemId,
            section_id: sec.id,
            section_title: sec.title,
            item_text: text,
            rating: r.rating || '',
            comment: r.comment || '',
            remove_screenshot: !!r.removeScreenshot,
          })
          if (r.screenshotFile) fd.append(`screenshot_${itemId}`, r.screenshotFile)
        })
      })
      fd.append('items', JSON.stringify(items))
      fd.append('unit', unit || '')
      const res = await api.post('/feedback-checklist/save/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const map = { ...responses }
      res.data.forEach(row => {
        map[row.item_id] = {
          ...map[row.item_id],
          rating: row.rating || null,
          comment: row.comment || '',
          screenshotUrl: row.screenshot || null,
          screenshotFile: null,
          screenshotPreview: null,
          removeScreenshot: false,
        }
      })
      setResponses(map)
      setDirty(false)
      toast.success('Feedback saved. Thank you.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save feedback. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const loadTeam = useCallback(async () => {
    setTeamLoading(true)
    try {
      const r = await api.get('/feedback-checklist/team/')
      const byUser = {}
      r.data.forEach(row => {
        const key = row.user
        if (!byUser[key]) byUser[key] = { username: row.username, unit: row.unit, byItem: {} }
        byUser[key].byItem[row.item_id] = row
      })
      setTeam(Object.values(byUser))
    } catch {
      toast.error('Could not load team responses.')
    } finally {
      setTeamLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (tab === 'team' && team === null) loadTeam()
  }, [tab, team, loadTeam])

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="System Feedback Checklist"
        subtitle="Work through each section, rate the items, and add a comment or screenshot anywhere it helps explain what you mean. Save anytime."
        action={
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 gap-1">
            <button type="button" onClick={() => setTab('fill')} className={clsx('px-3.5 py-1.5 text-xs font-semibold rounded-md', tab === 'fill' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400')}>
              Fill out
            </button>
            <button type="button" onClick={() => setTab('team')} className={clsx('px-3.5 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5', tab === 'team' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400')}>
              <Users2 size={13} /> Team responses
            </button>
          </div>
        }
      />

      {tab === 'fill' ? (
        loading ? (
          <div className="text-center p-16 text-sm text-slate-400">Loading your responses…</div>
        ) : (
          <>
            <div className="card p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Name</label>
                  <p className="input bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">{user?.username}</p>
                </div>
                <BaseInput
                  label="Unit"
                  value={unit}
                  onChange={(e) => { setUnit(e.target.value); setDirty(true) }}
                  placeholder="VIPAM / HR / ODU / Compliance"
                />
              </div>
            </div>

            <div className="sticky top-0 z-10 -mx-6 px-6 py-2.5 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{ratedCount}/{TOTAL_RATING_ITEMS} items rated</span>
              <div className="flex-1 min-w-[100px] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 transition-all" style={{ width: `${TOTAL_RATING_ITEMS ? (ratedCount / TOTAL_RATING_ITEMS * 100) : 0}%` }} />
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">{dirty ? 'Unsaved changes' : 'Up to date'}</span>
              <BaseButton variant="primary" size="sm" onClick={handleSave} loading={saving} loadingLabel="Saving">
                Save my feedback
              </BaseButton>
            </div>

            <div className="flex justify-end gap-2">
              <BaseButton variant="outline" size="sm" onClick={() => setForceOpen(true)}>Expand all</BaseButton>
              <BaseButton variant="outline" size="sm" onClick={() => setForceOpen(false)}>Collapse all</BaseButton>
            </div>

            <div>
              {SECTIONS.map(sec => (
                <FillSection key={sec.id} section={sec} forceOpen={forceOpen} responses={responses} onChange={handleItemChange} />
              ))}
            </div>
          </>
        )
      ) : (
        <div>
          <div className="card p-4 flex items-center justify-between gap-3 mb-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{team?.length ?? 0} responses submitted</span>
            <BaseButton variant="outline" size="sm" icon={<RefreshCw size={13} />} onClick={loadTeam} loading={teamLoading} loadingLabel="Refreshing">
              Refresh
            </BaseButton>
          </div>
          {teamLoading && !team ? (
            <div className="text-center p-16 text-sm text-slate-400">Loading team responses…</div>
          ) : !team?.length ? (
            <div className="text-center p-16 text-sm text-slate-400">No responses submitted yet.</div>
          ) : (
            team.map(entry => <TeamCard key={entry.username} entry={entry} />)
          )}
        </div>
      )}
    </div>
  )
}
