import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Clock,
  Lock,
  Mail,
  MapPin,
  PenSquare,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  AlertCircle,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import LockPopover from '../../components/shared/LockPopover'
import SignaturePad from '../../components/shared/SignaturePad'
import api from '../../api/client'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import DesktopNotificationSettings from '../../components/notifications/DesktopNotificationSettings'
import {
  getInactivityLockMinutes,
  setInactivityLockMinutes,
  DEFAULT_INACTIVITY_LOCK_MINUTES,
} from '../../utils/inactivityLock'

const DEFAULT_POLICY = { min_length: 8, require_uppercase: false, require_lowercase: false, require_digits: false, require_special: false, history_count: 5 }

const SPECIAL_CHARS = new Set('!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`\\')

function checkPolicy(pw, policy) {
  return {
    length:    pw.length >= policy.min_length,
    uppercase: !policy.require_uppercase || /[A-Z]/.test(pw),
    lowercase: !policy.require_lowercase || /[a-z]/.test(pw),
    digits:    !policy.require_digits    || /[0-9]/.test(pw),
    special:   !policy.require_special   || [...pw].some(c => SPECIAL_CHARS.has(c)),
  }
}

function PolicyRule({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
      {ok ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2.5} />}
      {label}
    </span>
  )
}

const ROLE_LABELS = {
  psc_admin:        'PSC Administrator',
  psc_officer:      'PSC Officer',
  psc_secretary:    'PSC Secretary',
  psc_commissioner: 'PSC Commissioner',
  psc_manager:      'OPSC Manager',
  principal_officer:'Principal Officer',
  senior_officer:   'Senior Officer',
  ministry_hr:      'Ministry HR Officer',
  dept_admin:       'Department Admin Officer',
  compliance_manager:  'Compliance Manager',
  compliance_senior:   'Compliance Senior Officer',
  compliance_principal:'Compliance Principal',
}

const ROLE_COLORS = {
  psc_admin:        'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  psc_officer:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  psc_secretary:    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  psc_commissioner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  psc_manager:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  principal_officer:'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  senior_officer:   'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  ministry_hr:      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  dept_admin:       'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  compliance_manager:  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  compliance_senior:   'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  compliance_principal:'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}

function SuccessAlert({ msg, onClear }) {
  if (!msg) return null
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 mb-4">
      <span className="flex items-center gap-2"><Check size={15} /> {msg}</span>
      <button onClick={onClear} className="text-emerald-500 hover:text-emerald-700">×</button>
    </div>
  )
}

function ErrorAlert({ msg, onClear }) {
  if (!msg) return null
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-4">
      <span className="flex items-center gap-2"><AlertCircle size={15} /> {msg}</span>
      <button onClick={onClear} className="text-red-400 hover:text-red-600">×</button>
    </div>
  )
}

function ReadonlyField({ icon: Icon, label, value, span }) {
  return (
    <div className={`space-y-1.5 ${span ? 'md:col-span-2' : ''}`}>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <div className="input pl-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-sm cursor-default select-all truncate">
          {value || <span className="text-slate-400 italic">Not assigned</span>}
        </div>
      </div>
    </div>
  )
}

function PasswordInput({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type={show ? 'text' : 'password'}
          className="input pl-10 pr-10 py-2.5 text-sm"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

export default function Account() {
  const { user, refreshMe } = useAuth()
  const toast   = useToast()
  const confirm = useConfirm()
  const fileInputRef = useRef(null)
  const sigFileRef = useRef(null)

  // Photo state
  const [previewUrl, setPreviewUrl]     = useState(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoSuccess, setPhotoSuccess] = useState('')
  const [photoError, setPhotoError]     = useState('')

  // Password state
  const [oldPw, setOldPw]           = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [pwLoading, setPwLoading]   = useState(false)
  const [pwSuccess, setPwSuccess]   = useState('')
  const [pwError, setPwError]       = useState('')

  // Password policy
  const [policy, setPolicy] = useState(DEFAULT_POLICY)
  useEffect(() => {
    api.get('/auth/password-policy/').then(r => setPolicy(r.data)).catch(() => {})
  }, [])

  // Session PIN state
  const [pinFormOpen,    setPinFormOpen]    = useState(false)
  const [pinInput,       setPinInput]       = useState('')
  const [pinConfirm,     setPinConfirm]     = useState('')
  const [pinCurrentPw,   setPinCurrentPw]   = useState('')
  const [pinLoading,     setPinLoading]     = useState(false)
  const [pinError,       setPinError]       = useState('')
  const [pinSuccess,     setPinSuccess]     = useState('')

  const [inactivityMinutes, setInactivityMinutes] = useState(DEFAULT_INACTIVITY_LOCK_MINUTES)

  useEffect(() => {
    if (user?.username) {
      setInactivityMinutes(getInactivityLockMinutes(user.username))
    }
  }, [user?.username])

  const handleInactivityMinutesChange = (value) => {
    const minutes = parseInt(value, 10)
    setInactivityMinutes(minutes)
    if (user?.username) {
      setInactivityLockMinutes(user.username, minutes)
      toast.success(minutes === 0 ? 'Automatic screen lock disabled.' : `Screen will lock after ${minutes} minutes of inactivity.`)
    }
  }

  const resetPinForm = () => {
    setPinInput(''); setPinConfirm(''); setPinCurrentPw(''); setPinError('')
  }

  const handlePinSetup = async e => {
    e.preventDefault()
    setPinError('')
    setPinSuccess('')
    if (pinInput !== pinConfirm) { setPinError('PINs do not match.'); return }
    if (pinInput.length < 4)    { setPinError('PIN must be at least 4 digits.'); return }
    if (user?.session_pin_set && !pinCurrentPw) {
      setPinError('Enter your current password to change the PIN.')
      return
    }
    setPinLoading(true)
    try {
      const payload = { pin: pinInput }
      if (user?.session_pin_set) payload.current_password = pinCurrentPw
      await api.post('/auth/session-pin/setup/', payload)
      await refreshMe()
      setPinSuccess('Session PIN set successfully.')
      setPinFormOpen(false)
      resetPinForm()
    } catch (err) {
      setPinError(err.response?.data?.detail || 'Failed to set PIN.')
    } finally {
      setPinLoading(false)
    }
  }

  // ── My Signature state ─────────────────────────────────────────────────────
  const [storedSig,     setStoredSig]     = useState(null)   // { id, image_url, ... }
  const [sigLoading,    setSigLoading]    = useState(false)
  const [showSignPad,   setShowSignPad]   = useState(false)
  const [sigLock,       setSigLock]       = useState(null)   // 'delete' | 'edit' | null
  const [pendingUpload, setPendingUpload] = useState(null)   // File waiting after lock

  useEffect(() => {
    api.get('/my-signature/')
      .then((r) => {
        const data = r.data
        if (!data?.image_url) {
          setStoredSig(null)
          return
        }
        setStoredSig({ ...data, image_url: resolveMediaUrl(data.image_url) })
      })
      .catch(() => setStoredSig(null))
  }, [])

  const uploadSignatureBlob = async (blob, filename = 'signature.png') => {
    setSigLoading(true)
    try {
      const fd = new FormData()
      fd.append('image', blob instanceof File ? blob : new File([blob], filename, { type: 'image/png' }))
      const r = await api.post('/my-signature/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const data = r.data
      setStoredSig(data?.image_url ? { ...data, image_url: resolveMediaUrl(data.image_url) } : data)
      toast.success('Signature saved.')
    } catch {
      toast.error('Failed to save signature.')
    } finally {
      setSigLoading(false)
    }
  }

  // Upload directly (no lock needed for first-time upload)
  const handleSigUpload = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (storedSig) {
      // Has existing → require lock then upload
      setPendingUpload(file)
      setSigLock('edit')
    } else {
      await uploadSignatureBlob(file, file.name)
    }
  }

  // Draw (no lock for first-time, lock if replacing)
  const handleDrawClick = () => {
    if (storedSig) {
      setSigLock('draw')
    } else {
      setShowSignPad(true)
    }
  }

  const handleSigLockVerified = () => {
    const action = sigLock
    setSigLock(null)
    if (action === 'delete') {
      deleteSig()
    } else if (action === 'edit' && pendingUpload) {
      uploadSignatureBlob(pendingUpload, pendingUpload.name)
      setPendingUpload(null)
    } else if (action === 'draw') {
      setShowSignPad(true)
    }
  }

  const deleteSig = async () => {
    setSigLoading(true)
    try {
      await api.delete('/my-signature/')
      setStoredSig(null)
      toast.success('Signature removed.')
    } catch {
      toast.error('Failed to remove signature.')
    } finally {
      setSigLoading(false)
    }
  }

  // ── Photo handlers ──────────────────────────────────────────────────────────
  const handleFileChange = e => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('File is too large. Maximum size is 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => setPreviewUrl(reader.result)
    reader.readAsDataURL(file)
    setPhotoError('')
  }

  const handleSavePhoto = async () => {
    if (!fileInputRef.current?.files[0]) return
    setPhotoLoading(true)
    setPhotoError('')
    setPhotoSuccess('')
    try {
      const fd = new FormData()
      fd.append('profile_picture', fileInputRef.current.files[0])
      await api.patch('/me/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await refreshMe()
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Profile photo updated.')
    } catch {
      toast.error('Failed to upload photo. Please try again.')
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleRemovePhoto = async () => {
    const ok = await confirm({ title: 'Remove Photo', message: 'Remove your profile photo?', confirmLabel: 'Remove' })
    if (!ok) return
    setPhotoLoading(true)
    try {
      await api.patch('/me/', { profile_picture: null })
      await refreshMe()
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Profile photo removed.')
    } catch {
      toast.error('Failed to remove photo.')
    } finally {
      setPhotoLoading(false)
    }
  }

  // ── Password handler ────────────────────────────────────────────────────────
  const handleChangePassword = async e => {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')
    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.')
      return
    }
    setPwLoading(true)
    try {
      await api.post('/me/change-password/', {
        old_password: oldPw,
        new_password: newPw,
        confirm_password: confirmPw,
      })
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
      toast.success('Password changed. Use the new password on your next login.')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to change password.')
    } finally {
      setPwLoading(false)
    }
  }

  const roleLabel = ROLE_LABELS[user?.role] ?? user?.role?.replace(/_/g, ' ')
  const roleColor = ROLE_COLORS[user?.role] ?? 'bg-slate-100 text-slate-600'
  const initials  = (user?.username ?? '?').charAt(0).toUpperCase()
  const hasPhoto  = !!(user?.profile_picture || previewUrl)

  return (
    <>
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ── Banner header ── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0c2451 0%, #1e3a6f 60%, #0c2451 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute top-4 right-24 w-16 h-16 rounded-full bg-amber-400/10" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-5 px-8 pt-8 pb-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white/20 shadow-2xl bg-primary-700">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : user?.profile_picture ? (
                <img src={user.profile_picture} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                  {initials}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-amber-400 hover:bg-amber-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
              title="Change photo"
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Name + meta */}
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl font-bold text-white mb-1">{user?.username}</h1>
            <p className="text-white/60 text-sm mb-2">{user?.email || '—'}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${roleColor}`}>
                <Shield size={11} /> {roleLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                <BadgeCheck size={11} /> Verified Account
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: Photo management + Quick Info ── */}
        <div className="space-y-5">

          {/* Photo card */}
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Camera size={15} className="text-primary-500" /> Profile Photo
            </h3>
            <SuccessAlert msg={photoSuccess} onClear={() => setPhotoSuccess('')} />
            <ErrorAlert   msg={photoError}   onClear={() => setPhotoError('')} />

            <div className="flex flex-col gap-2">
              {previewUrl ? (
                <button
                  type="button"
                  onClick={handleSavePhoto}
                  disabled={photoLoading}
                  className="btn-gradient w-full py-2 text-sm justify-center inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {photoLoading ? 'Uploading…' : <><Check size={14} /> Save New Photo</>}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-outline w-full py-2 text-sm justify-center inline-flex items-center gap-2"
                >
                  <Upload size={14} /> Upload Photo
                </button>
              )}
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="btn-outline w-full py-2 text-sm justify-center inline-flex items-center gap-2 text-slate-500"
                >
                  Cancel
                </button>
              )}
              {hasPhoto && !previewUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={photoLoading}
                  className="btn-outline w-full py-2 text-sm justify-center inline-flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30 disabled:opacity-40"
                >
                  <Trash2 size={14} /> Remove Photo
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              JPG, PNG or GIF · max 2 MB
            </p>
          </div>

          {/* Signature card */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1">
              <PenSquare size={15} className="text-primary-500" /> My Signature
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Your pre-saved signature is placed on PDF documents when you sign them.
              {!storedSig && ' Upload an image or draw your signature below — no PIN needed for the first upload.'}
              {storedSig && ' To change or delete your existing signature, your Session PIN is required.'}
            </p>

            {/* Preview */}
            {storedSig?.image_url && (
              <div className="mb-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center" style={{ minHeight: 90 }}>
                <img src={storedSig.image_url} alt="Your signature" className="max-h-16 max-w-full" />
              </div>
            )}
            {!storedSig && (
              <div className="mb-4 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs text-slate-400" style={{ minHeight: 80 }}>
                No signature saved yet
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {/* Upload image */}
              <label className="btn-outline py-2 px-3 text-xs cursor-pointer inline-flex items-center gap-1.5">
                <Upload size={13} />
                {storedSig ? 'Replace with image' : 'Upload image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  className="hidden"
                  ref={sigFileRef}
                  onChange={handleSigUpload}
                  disabled={sigLoading}
                />
              </label>

              {/* Draw */}
              <button
                type="button"
                onClick={handleDrawClick}
                disabled={sigLoading}
                className="btn-outline py-2 px-3 text-xs inline-flex items-center gap-1.5"
              >
                <PenSquare size={13} />
                {storedSig ? 'Re-draw signature' : 'Draw signature'}
              </button>

              {/* Delete */}
              {storedSig && (
                <button
                  type="button"
                  onClick={() => setSigLock('delete')}
                  disabled={sigLoading}
                  className="btn-outline py-2 px-3 text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20 inline-flex items-center gap-1.5"
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}

              {sigLoading && <span className="text-xs text-slate-400 animate-pulse">Saving…</span>}
            </div>
          </div>

          {/* Quick stats card */}
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Shield size={15} className="text-primary-500" /> Account Details
            </h3>
            <dl className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-xs text-slate-500 dark:text-slate-400">Status</dt>
                <dd className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Active
                </dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-xs text-slate-500 dark:text-slate-400">Role</dt>
                <dd className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${roleColor}`}>
                  {roleLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-xs text-slate-500 dark:text-slate-400">Ministry</dt>
                <dd className="text-xs text-slate-700 dark:text-slate-300 text-right max-w-[140px] truncate">
                  {user?.ministry?.name ?? <span className="text-slate-400 italic">None</span>}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-xs text-slate-500 dark:text-slate-400">Department</dt>
                <dd className="text-xs text-slate-700 dark:text-slate-300 text-right max-w-[140px] truncate">
                  {user?.department?.name ?? <span className="text-slate-400 italic">None</span>}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ── Right column: Info + Change Password + Notice ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Personal Information */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
                <User size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Personal Information</h3>
                <p className="text-xs text-slate-400">Your account details managed by the system</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadonlyField icon={User}      label="Username"       value={user?.username} />
              <ReadonlyField icon={Mail}      label="Email Address"  value={user?.email} />
              <ReadonlyField icon={Briefcase} label="System Role"    value={roleLabel} />
              <ReadonlyField icon={Building2} label="Ministry"       value={user?.ministry?.name} />
              <ReadonlyField icon={MapPin}    label="Department"     value={user?.department?.name} span />
            </div>
          </div>

          <div className="card p-6">
            <DesktopNotificationSettings />
          </div>

          {/* Change Password */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                <KeyRound size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Change Password</h3>
                <p className="text-xs text-slate-400">Use a strong password with letters, numbers and symbols</p>
              </div>
            </div>

            <SuccessAlert msg={pwSuccess} onClear={() => setPwSuccess('')} />
            <ErrorAlert   msg={pwError}   onClear={() => setPwError('')} />

            <form onSubmit={handleChangePassword} className="space-y-4" autoComplete="off">
              <PasswordInput
                label="Current Password"
                value={oldPw}
                onChange={setOldPw}
                placeholder="Enter your current password"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PasswordInput
                  label="New Password"
                  value={newPw}
                  onChange={setNewPw}
                  placeholder="Min 8 characters"
                />
                <PasswordInput
                  label="Confirm New Password"
                  value={confirmPw}
                  onChange={setConfirmPw}
                  placeholder="Repeat new password"
                />
              </div>

              {/* Policy-aware strength checklist */}
              {newPw.length > 0 && (() => {
                const rules = checkPolicy(newPw, policy)
                const passed = Object.values(rules).filter(Boolean).length
                const total  = Object.values(rules).length
                const pct    = total ? passed / total : 0
                const barColor = pct === 1 ? 'bg-emerald-500' : pct >= 0.6 ? 'bg-amber-400' : 'bg-red-400'
                return (
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    {/* Progress bar */}
                    <div className="flex gap-1">
                      {Array.from({ length: total }).map((_, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < passed ? barColor : 'bg-slate-200 dark:bg-slate-700'}`} />
                      ))}
                    </div>
                    {/* Per-rule indicators */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <PolicyRule ok={rules.length}    label={`Min ${policy.min_length} chars`} />
                      {policy.require_uppercase && <PolicyRule ok={rules.uppercase} label="Uppercase letter" />}
                      {policy.require_lowercase && <PolicyRule ok={rules.lowercase} label="Lowercase letter" />}
                      {policy.require_digits    && <PolicyRule ok={rules.digits}    label="Number (0–9)" />}
                      {policy.require_special   && <PolicyRule ok={rules.special}   label="Special character" />}
                    </div>
                    {policy.history_count > 0 && (
                      <p className="text-[11px] text-slate-400">Cannot reuse your last {policy.history_count} passwords.</p>
                    )}
                  </div>
                )
              })()}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={pwLoading || !oldPw || !newPw || !confirmPw}
                  className="btn-gradient py-2 px-6 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {pwLoading ? 'Changing…' : <><KeyRound size={14} /> Change Password</>}
                </button>
              </div>
            </form>
          </div>

          {/* Two-Factor Authentication */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
                <Shield size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Two-Factor Authentication</h3>
                <p className="text-xs text-slate-400">Add an extra layer of security to your account using Microsoft Authenticator</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user?.two_factor_enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Authenticator App {user?.two_factor_enabled ? '(Enabled)' : '(Disabled)'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {user?.two_factor_enabled 
                      ? 'Your account is protected with TOTP-based 2FA.' 
                      : 'Microsoft Authenticator, Google Authenticator, etc.'}
                  </p>
                </div>
              </div>
              
              {user?.two_factor_enabled ? (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({ title: 'Disable 2FA', message: 'Disable two-factor authentication? This will reduce your account security.', confirmLabel: 'Disable', variant: 'warning' })
                    if (!ok) return
                    try {
                      await api.post('/auth/totp/disable/')
                      await refreshMe()
                      toast.success('Two-factor authentication disabled.')
                    } catch {
                      toast.error('Failed to disable 2FA.')
                    }
                  }}
                  className="btn-outline py-2 px-4 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30"
                >
                  Disable 2FA
                </button>
              ) : (
                <Link
                  to="/auth/totp-setup"
                  className="btn-gradient py-2 px-4 text-xs"
                >
                  Setup 2FA
                </Link>
              )}
            </div>

            {/* Session PIN (separator) */}
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Session PIN</h3>
                  <p className="text-xs text-slate-400">Unlock the screen after inactivity or manual lock (valid until 5pm or 8h after full login)</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user?.session_pin_set ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      PIN {user?.session_pin_set ? '(Set)' : '(Not Set)'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {user?.session_pin_set
                        ? 'Use your PIN for quick sign-in within the trusted session window.'
                        : 'Set a 4-6 digit PIN for faster re-authentication.'}
                    </p>
                  </div>
                </div>

                {pinFormOpen ? (
                  <form onSubmit={handlePinSetup} className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Current password — only required when changing existing PIN */}
                    {user?.session_pin_set && (
                      <input
                        type="password"
                        className="input !py-1.5 !px-3 text-sm"
                        style={{ width: 140, borderRadius: 8 }}
                        placeholder="current password"
                        value={pinCurrentPw}
                        onChange={e => setPinCurrentPw(e.target.value)}
                        required
                        autoFocus
                      />
                    )}
                    <input
                      type="password"
                      className="input !py-1.5 !px-3 text-center text-sm font-mono"
                      style={{ width: 100, borderRadius: 8, letterSpacing: '0.3em' }}
                      maxLength={6}
                      placeholder="new PIN"
                      value={pinInput}
                      onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      autoFocus={!user?.session_pin_set}
                    />
                    <input
                      type="password"
                      className="input !py-1.5 !px-3 text-center text-sm font-mono"
                      style={{ width: 100, borderRadius: 8, letterSpacing: '0.3em' }}
                      maxLength={6}
                      placeholder="confirm"
                      value={pinConfirm}
                      onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                    <button type="submit"
                      disabled={pinLoading || pinInput.length < 4 || pinInput !== pinConfirm || (user?.session_pin_set && !pinCurrentPw)}
                      className="btn-gradient py-1.5 px-3 text-xs">
                      {pinLoading ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => { setPinFormOpen(false); resetPinForm() }}
                      className="py-1.5 px-2 text-xs text-slate-400 hover:text-slate-600">
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPinFormOpen(true)}
                    className="btn-gradient py-2 px-4 text-xs"
                  >
                    {user?.session_pin_set ? 'Change PIN' : 'Set PIN'}
                  </button>
                )}
              </div>
              {pinError && (
                <p className="mt-2 text-xs text-red-500">{pinError}</p>
              )}
              {pinSuccess && (
                <p className="mt-2 text-xs text-emerald-600">{pinSuccess}</p>
              )}
            </div>
          </div>

          {/* Automatic screen lock — own card so it is easy to find */}
          <div id="automatic-screen-lock" className="card p-6 scroll-mt-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400 flex-shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Automatic screen lock</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  After inactivity, the screen locks. Enter your session PIN to continue — you stay signed in.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="inactivity-lock-minutes" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Lock screen after
              </label>
              <select
                id="inactivity-lock-minutes"
                className="input text-sm max-w-xs"
                value={inactivityMinutes}
                onChange={e => handleInactivityMinutesChange(e.target.value)}
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes (default)</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={0}>Never (manual lock only)</option>
              </select>

              {inactivityMinutes > 0 && !user?.session_pin_set && (
                <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  Set a session PIN in the card above first; otherwise automatic lock cannot unlock.
                </p>
              )}
            </div>
          </div>

          {/* Information Notice */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-5 flex gap-4">
            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-500 flex-shrink-0">
              <Shield size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Account Information
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Username, email address, system role, ministry and department assignments are managed by the
                system administrator. If any of these details need updating, please contact the
                <strong className="text-slate-700 dark:text-slate-300"> PSC HR department</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {showSignPad && (
      <SignaturePad
        onDone={async blob => {
          setShowSignPad(false)
          await uploadSignatureBlob(blob)
        }}
        onCancel={() => setShowSignPad(false)}
      />
    )}

    {sigLock && (
      <LockPopover
        title={sigLock === 'delete' ? 'Confirm Deletion' : 'Confirm Identity'}
        message={
          sigLock === 'delete'
            ? 'Enter your Session PIN to delete your saved signature.'
            : 'Enter your Session PIN to replace your existing signature.'
        }
        onVerified={handleSigLockVerified}
        onCancel={() => { setSigLock(null); setPendingUpload(null) }}
      />
    )}
    </>
  )
}
