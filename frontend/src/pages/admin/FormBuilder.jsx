import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import DynamicFormRenderer from '../../components/shared/DynamicFormRenderer'
import {
  ArrowLeft, PlusCircle, Pencil, Trash2, GripVertical,
  ChevronUp, ChevronDown, Save, X, Eye, Upload, AlertCircle, CheckCircle2, Square, CheckSquare
} from 'lucide-react'

const FIELD_TYPES = [
  { value: 'section_header', label: 'Section Header' },
  { value: 'text',           label: 'Short Text' },
  { value: 'textarea',       label: 'Long Text / Paragraph' },
  { value: 'number',         label: 'Number' },
  { value: 'date',           label: 'Date' },
  { value: 'datetime',       label: 'Date & Time' },
  { value: 'select',         label: 'Dropdown (Select One)' },
  { value: 'radio',          label: 'Radio Buttons (Select One)' },
  { value: 'checkbox',       label: 'Checkbox (Yes / No)' },
]

const EMPTY_FIELD = {
  label: '',
  field_key: '',
  field_type: 'text',
  placeholder: '',
  help_text: '',
  choices: '',
  is_required: false,
  start_new_page: false,
  display_order: 0,
}

function toSnakeCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64)
}

// ── Import helpers ────────────────────────────────────────────────────────────

const VALID_TYPES = new Set(FIELD_TYPES.map(t => t.value))

function normalizeField(raw, idx) {
  const fieldType = VALID_TYPES.has(raw.field_type) ? raw.field_type : 'text'
  const label = String(raw.label ?? '').trim()
  const fieldKey = String(raw.field_key ?? toSnakeCase(label) ?? `field_${idx + 1}`).trim()
  return {
    label,
    field_key: fieldKey || `field_${idx + 1}`,
    field_type: fieldType,
    placeholder: String(raw.placeholder ?? '').trim(),
    help_text: String(raw.help_text ?? '').trim(),
    choices: String(raw.choices ?? '').trim(),
    is_required: raw.is_required === true || String(raw.is_required).toLowerCase() === 'true',
    display_order: Number(raw.display_order ?? (idx + 1) * 10) || (idx + 1) * 10,
  }
}

function parseImportFile(text, filename) {
  const ext = filename.split('.').pop().toLowerCase()
  if (ext === 'json') {
    const obj = JSON.parse(text)
    const arr = Array.isArray(obj) ? obj : (obj.fields ?? obj.form_fields ?? Object.values(obj))
    if (!Array.isArray(arr)) throw new Error('JSON must contain a "fields" array.')
    return arr.map(normalizeField)
  }
  if (ext === 'xml') {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    const parseErr = doc.querySelector('parsererror')
    if (parseErr) throw new Error('Invalid XML: ' + parseErr.textContent.slice(0, 120))
    const nodes = Array.from(doc.querySelectorAll('field'))
    if (nodes.length === 0) throw new Error('No <field> elements found in XML.')
    return nodes.map((node, idx) => normalizeField({
      label:         node.querySelector('label')?.textContent ?? '',
      field_key:     node.querySelector('field_key')?.textContent ?? '',
      field_type:    node.querySelector('field_type')?.textContent ?? 'text',
      placeholder:   node.querySelector('placeholder')?.textContent ?? '',
      help_text:     node.querySelector('help_text')?.textContent ?? '',
      choices:       node.querySelector('choices')?.textContent ?? '',
      is_required:   node.querySelector('is_required')?.textContent ?? 'false',
      display_order: node.querySelector('display_order')?.textContent ?? String((idx + 1) * 10),
    }, idx))
  }
  throw new Error('Unsupported file type. Upload a .json or .xml file.')
}

// ── Import modal ──────────────────────────────────────────────────────────────

function ImportModal({ parsedFields, onClose, onConfirm, importing }) {
  const [replace, setReplace] = useState(false)

  const issues = parsedFields.filter(f => !f.label || !f.field_key)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Import Fields</h2>
            <p className="text-xs text-slate-400 mt-0.5">{parsedFields.length} field{parsedFields.length !== 1 ? 's' : ''} parsed from file</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-3 flex-1">
          {issues.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{issues.length} field{issues.length !== 1 ? 's' : ''} missing a label or key — they will be skipped on import.</span>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {parsedFields.map((f, i) => {
              const invalid = !f.label || !f.field_key
              return (
                <div key={i} className={`flex items-start gap-3 px-3 py-2.5 ${invalid ? 'opacity-40' : ''}`}>
                  {invalid
                    ? <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    : <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {f.label || <span className="italic text-slate-400">No label</span>}
                      {f.is_required && <span className="ml-1.5 text-xs text-red-500">required</span>}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">{f.field_key || '—'} · {f.field_type}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" className="w-4 h-4 rounded" checked={replace} onChange={e => setReplace(e.target.checked)} />
            Replace all existing fields (otherwise appends)
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => onConfirm(parsedFields.filter(f => f.label && f.field_key), replace)}
              disabled={importing || parsedFields.every(f => !f.label || !f.field_key)}
              className="btn-primary px-5 py-2 inline-flex items-center gap-2"
            >
              <Upload size={14} />
              {importing ? 'Importing…' : `Import ${parsedFields.filter(f => f.label && f.field_key).length} Fields`}
            </button>
            <button onClick={onClose} className="btn-secondary px-5 py-2">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldModal({ field, onClose, onSave }) {
  const [form, setForm] = useState(field)
  const [error, setError] = useState('')
  const [autoKey, setAutoKey] = useState(!field.id)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleLabelChange = (v) => {
    set('label', v)
    if (autoKey) set('field_key', toSnakeCase(v))
  }

  const handleSave = () => {
    if (!form.label.trim()) { setError('Label is required.'); return }
    if (!form.field_key.trim()) { setError('Field key is required.'); return }
    if (!/^[a-z0-9_]+$/.test(form.field_key)) {
      setError('Field key must be lowercase letters, numbers, and underscores only.')
      return
    }
    onSave(form)
  }

  const needsChoices = ['select', 'radio'].includes(form.field_type)
  const isHeader = form.field_type === 'section_header'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {field.id ? 'Edit Field' : 'Add Field'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Field Type
            </label>
            <select
              className="input"
              value={form.field_type}
              onChange={e => set('field_type', e.target.value)}
            >
              {FIELD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              value={form.label}
              onChange={e => handleLabelChange(e.target.value)}
              placeholder={isHeader ? 'Section title' : 'Field label shown to users'}
            />
          </div>

          {!isHeader && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Field Key <span className="text-red-500">*</span>
                <span className="ml-1 font-normal text-slate-400">(unique snake_case identifier)</span>
              </label>
              <input
                className="input font-mono text-sm"
                value={form.field_key}
                onChange={e => { setAutoKey(false); set('field_key', e.target.value) }}
                placeholder="e.g. employee_name"
              />
            </div>
          )}

          {isHeader && (
            <>
              <input type="hidden" value={form.field_key || toSnakeCase(form.label) || 'section'} />
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <input
                  type="checkbox"
                  id="start_new_page"
                  className="w-4 h-4 rounded"
                  checked={!!form.start_new_page}
                  onChange={e => set('start_new_page', e.target.checked)}
                />
                <label htmlFor="start_new_page" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  Start a new page here
                  <span className="block text-xs text-slate-400 font-normal mt-0.5">
                    This section will appear as a separate step in the multi-page form.
                  </span>
                </label>
              </div>
            </>
          )}

          {!isHeader && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Placeholder
                </label>
                <input
                  className="input"
                  value={form.placeholder}
                  onChange={e => set('placeholder', e.target.value)}
                  placeholder="Optional hint inside the input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Help Text
                </label>
                <input
                  className="input"
                  value={form.help_text}
                  onChange={e => set('help_text', e.target.value)}
                  placeholder="Optional guidance shown below the field"
                />
              </div>

              {needsChoices && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Choices <span className="text-slate-400 font-normal">(one per line)</span>
                  </label>
                  <textarea
                    className="input min-h-[100px] font-mono text-sm"
                    value={form.choices}
                    onChange={e => set('choices', e.target.value)}
                    placeholder={"Option A\nOption B\nOption C"}
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_required"
                  className="w-4 h-4 rounded"
                  checked={form.is_required}
                  onChange={e => set('is_required', e.target.checked)}
                />
                <label htmlFor="is_required" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  Required field
                </label>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} className="btn-primary px-5 py-2">
              <Save size={14} className="mr-1.5 inline" />
              {field.id ? 'Save Changes' : 'Add Field'}
            </button>
            <button onClick={onClose} className="btn-secondary px-5 py-2">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ formType, fields, onClose }) {
  const [values, setValues] = useState({})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Form Preview — {formType?.code}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">This is how the form will appear to users. Values are not saved.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {fields.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No fields to preview yet.</p>
          ) : (
            <DynamicFormRenderer
              fields={fields}
              values={values}
              onChange={setValues}
              readOnly={false}
            />
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={() => setValues({})}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Clear all values
          </button>
          <button onClick={onClose} className="btn-secondary px-4 py-2">Close Preview</button>
        </div>
      </div>
    </div>
  )
}

function FieldTypeChip({ type }) {
  const t = FIELD_TYPES.find(f => f.value === type)
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono">
      {t?.label ?? type}
    </span>
  )
}

export default function FormBuilder() {
  const { formTypeId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const isAdmin = user?.role === 'psc_admin' || user?.is_superuser

  const [formType, setFormType] = useState(null)
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)  // null | EMPTY_FIELD | existing field obj
  const [showPreview, setShowPreview] = useState(false)
  const [importedFields, setImportedFields] = useState(null)  // parsed fields awaiting confirmation
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return }
    loadData()
  }, [formTypeId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [ft, ff] = await Promise.all([
        api.get(`/form-types/${formTypeId}/`),
        api.get(`/form-fields/?form_type=${formTypeId}`),
      ])
      setFormType(ft.data)
      const raw = Array.isArray(ff.data) ? ff.data : (ff.data?.results ?? [])
      setFields(raw.sort((a, b) => a.display_order - b.display_order || a.id - b.id))
    } catch {
      toast.error('Failed to load form type.')
      navigate('/admin/form-types')
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    const nextOrder = fields.length > 0 ? Math.max(...fields.map(f => f.display_order)) + 10 : 10
    setModal({ ...EMPTY_FIELD, display_order: nextOrder })
  }

  const openEdit = (field) => setModal({ ...field })

  const handleSave = async (fieldData) => {
    try {
      if (fieldData.id) {
        const { data } = await api.patch(`/form-fields/${fieldData.id}/`, fieldData)
        setFields(prev => prev.map(f => f.id === data.id ? data : f).sort((a, b) => a.display_order - b.display_order || a.id - b.id))
        toast.success('Field updated.')
      } else {
        const payload = { ...fieldData, form_type: Number(formTypeId) }
        if (payload.field_type === 'section_header' && !payload.field_key) {
          payload.field_key = toSnakeCase(payload.label) || `section_${Date.now()}`
        }
        const { data } = await api.post('/form-fields/', payload)
        setFields(prev => [...prev, data].sort((a, b) => a.display_order - b.display_order || a.id - b.id))
        toast.success('Field added.')
      }
      setModal(null)
    } catch (err) {
      const detail = err.response?.data
      toast.error(typeof detail === 'object' ? JSON.stringify(detail) : 'Save failed.')
    }
  }

  const handleDelete = async (field) => {
    const ok = await confirm({
      title: 'Delete Field',
      message: `Delete field "${field.label}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await api.delete(`/form-fields/${field.id}/`)
      setFields(prev => prev.filter(f => f.id !== field.id))
      toast.success('Field deleted.')
    } catch {
      toast.error('Failed to delete field.')
    }
  }

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === fields.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(fields.map(f => f.id)))
    }
  }

  const handleBulkDelete = async () => {
    const count = selected.size
    const ok = await confirm({
      title: 'Delete Fields',
      message: `Delete ${count} selected field${count !== 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await Promise.all([...selected].map(id => api.delete(`/form-fields/${id}/`).catch(() => {})))
      setFields(prev => prev.filter(f => !selected.has(f.id)))
      setSelected(new Set())
      toast.success(`${count} field${count !== 1 ? 's' : ''} deleted.`)
    } catch {
      toast.error('Failed to delete some fields.')
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseImportFile(ev.target.result, file.name)
        if (parsed.length === 0) { toast.error('No fields found in file.'); return }
        setImportedFields(parsed)
      } catch (err) {
        toast.error(`Parse error: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }

  const handleImportConfirm = async (validFields, replace) => {
    setImporting(true)
    try {
      if (replace) {
        await Promise.all(fields.map(f => api.delete(`/form-fields/${f.id}/`).catch(() => {})))
      }
      const baseOrder = replace ? 0 : (fields.length > 0 ? Math.max(...fields.map(f => f.display_order)) : 0)
      const created = await Promise.all(
        validFields.map((f, i) =>
          api.post('/form-fields/', {
            ...f,
            form_type: Number(formTypeId),
            display_order: replace ? f.display_order : baseOrder + (i + 1) * 10,
          }).then(r => r.data)
        )
      )
      setFields(prev => {
        const base = replace ? [] : prev
        return [...base, ...created].sort((a, b) => a.display_order - b.display_order || a.id - b.id)
      })
      toast.success(`${created.length} field${created.length !== 1 ? 's' : ''} imported.`)
      setImportedFields(null)
    } catch {
      toast.error('Import failed. Some fields may not have been saved.')
    } finally {
      setImporting(false)
    }
  }

  const move = async (index, direction) => {
    const newFields = [...fields]
    const swapIdx = index + direction
    if (swapIdx < 0 || swapIdx >= newFields.length) return

    const a = newFields[index]
    const b = newFields[swapIdx]

    // Swap display_order values
    const orderA = a.display_order
    const orderB = b.display_order
    const newA = { ...a, display_order: orderB === orderA ? orderA + direction : orderB }
    const newB = { ...b, display_order: orderA }

    try {
      await Promise.all([
        api.patch(`/form-fields/${a.id}/`, { display_order: newA.display_order }),
        api.patch(`/form-fields/${b.id}/`, { display_order: newB.display_order }),
      ])
      newFields[index] = newA
      newFields[swapIdx] = newB
      setFields([...newFields].sort((x, y) => x.display_order - y.display_order || x.id - y.id))
    } catch {
      toast.error('Failed to reorder fields.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading form builder…
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Form Builder — ${formType?.code ?? ''}`}
        subtitle={formType?.name ?? ''}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/form-types')}
              className="btn-outline inline-flex items-center gap-2 py-2 px-3 text-sm"
            >
              <ArrowLeft size={14} />
              Back to Form Types
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="btn-outline inline-flex items-center gap-2 py-2 px-3 text-sm"
            >
              <Eye size={14} />
              Preview
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-outline inline-flex items-center gap-2 py-2 px-3 text-sm"
              title="Import fields from a .json or .xml file"
            >
              <Upload size={14} />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.xml"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button onClick={openAdd} className="btn-primary inline-flex items-center gap-2">
              <PlusCircle size={16} />
              Add Field
            </button>
          </div>
        }
      />

      {fields.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-400 mb-4">No fields yet. Add fields to design this form.</p>
          <button onClick={openAdd} className="btn-primary inline-flex items-center gap-2">
            <PlusCircle size={16} />
            Add First Field
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700"
                  title="Deselect all"
                >
                  <CheckSquare size={16} />
                </button>
                <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                  {selected.size} of {fields.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Trash2 size={13} />
                  Delete {selected.size}
                </button>
              </div>
            </div>
          )}

          {/* Select-all row when nothing selected yet */}
          {selected.size === 0 && (
            <div className="flex items-center gap-2 px-1 pb-1">
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <Square size={14} />
                Select all
              </button>
            </div>
          )}

          {fields.map((field, idx) => (
            <div
              key={field.id}
              className={`card px-4 py-3 flex items-center gap-3 ${
                selected.has(field.id) ? 'ring-2 ring-primary-400 dark:ring-primary-600' : ''
              } ${
                field.field_type === 'section_header'
                  ? 'bg-slate-50 dark:bg-slate-800/60 border-l-4 border-blue-400'
                  : ''
              }`}
            >
              {/* Per-row checkbox */}
              <button
                type="button"
                onClick={() => toggleOne(field.id)}
                className={`flex-shrink-0 ${selected.has(field.id) ? 'text-primary-600 dark:text-primary-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                title={selected.has(field.id) ? 'Deselect' : 'Select'}
              >
                {selected.has(field.id) ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>

              <GripVertical size={16} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />

              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {field.field_type === 'section_header' ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{field.label}</span>
                      {field.start_new_page && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 uppercase tracking-wide">
                          New Page
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{field.label}</span>
                      {field.is_required && (
                        <span className="text-red-500 text-xs font-semibold">required</span>
                      )}
                    </>
                  )}
                  <FieldTypeChip type={field.field_type} />
                </div>
                {field.field_type !== 'section_header' && (
                  <span className="text-xs text-slate-400 font-mono">{field.field_key}</span>
                )}
                {field.help_text && (
                  <span className="text-xs text-slate-400 italic">{field.help_text}</span>
                )}
                {field.choices && (
                  <span className="text-xs text-slate-400">
                    Options: {field.choices.split('\n').filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === fields.length - 1}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => openEdit(field)}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(field)}
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <FieldModal
          field={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {showPreview && (
        <PreviewModal
          formType={formType}
          fields={fields}
          onClose={() => setShowPreview(false)}
        />
      )}

      {importedFields && (
        <ImportModal
          parsedFields={importedFields}
          importing={importing}
          onClose={() => setImportedFields(null)}
          onConfirm={handleImportConfirm}
        />
      )}
    </div>
  )
}
