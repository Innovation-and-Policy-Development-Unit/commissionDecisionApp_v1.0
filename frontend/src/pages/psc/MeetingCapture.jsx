import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Mic, Square, Upload, FileAudio, Trash2, CheckCircle2, AlertCircle, Clock,
  ArrowLeft, ExternalLink, Headphones, ShieldAlert,
} from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import LogitechGroupGuideDialog from '../../components/meeting/LogitechGroupGuideDialog'
import api from '../../api/client'
import { saveChunk, getChunks, clearSession, getAllSessions } from '../../utils/audioStorage'

const ALLOWED_EXTS = ['.mp3', '.m4a', '.mp4', '.webm', '.wav', '.ogg']
const APPROVED_MIC_LABEL_RE = /logitech|group|echo cancelling speakerphone|conference|delegate|discussion|televic|bosch|shure|micromixer/i
const BLOCKED_LABEL_RE = /built-?in|default|iphone|ipad|android|phone|facetime|airpods/i

function formatTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function isAllowedInputLabel(label) {
  if (!label) return false
  if (BLOCKED_LABEL_RE.test(label)) return false
  return APPROVED_MIC_LABEL_RE.test(label)
}

export default function MeetingCapture() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meetingId = searchParams.get('meetingId')

  const [captureMode, setCaptureMode] = useState('upload')
  const [browserException, setBrowserException] = useState(false)
  const [mode, setMode] = useState('idle')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioBlob, setAudioBlob] = useState(null)
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [recoverableSessions, setRecoverableSessions] = useState([])
  const [uploadedFileSize, setUploadedFileSize] = useState('')
  const [meetingRef, setMeetingRef] = useState('')
  const [uploadDone, setUploadDone] = useState(false)
  const [audioDevices, setAudioDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [logitechGuideOpen, setLogitechGuideOpen] = useState(false)

  const canvasRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const timerRef = useRef(null)
  const chunksRef = useRef([])
  const sessionIdRef = useRef(null)
  const backupIntervalRef = useRef(null)
  const startTimeRef = useRef(null)
  const sequenceRef = useRef(0)

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    if (backupIntervalRef.current) clearInterval(backupIntervalRef.current)
    rafRef.current = null
    timerRef.current = null
    backupIntervalRef.current = null
    sessionIdRef.current = null
    sequenceRef.current = 0
  }, [])

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter(d => d.kind === 'audioinput')
      setAudioDevices(inputs)
      const allowed = inputs.filter(d => isAllowedInputLabel(d.label))
      if (allowed.length === 1) setSelectedDeviceId(allowed[0].deviceId)
    } catch {
      setAudioDevices([])
    }
  }, [])

  useEffect(() => {
    return () => {
      stopRecording()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [stopRecording, audioUrl])

  useEffect(() => {
    if (mode === 'idle') {
      getAllSessions().then(sessions => {
        if (sessions.length > 0) setRecoverableSessions(sessions)
      }).catch(() => {})
    }
  }, [mode])

  useEffect(() => {
    if (!meetingId) return
    api.get(`/meetings/${meetingId}/`).then(res => {
      setMeetingRef(res.data.reference_number || `Meeting #${meetingId}`)
    }).catch(() => {
      setMeetingRef(`Meeting #${meetingId}`)
    })
  }, [meetingId])

  useEffect(() => {
    if (captureMode === 'browser' && browserException) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop())
          return refreshDevices()
        })
        .catch(() => refreshDevices())
    }
  }, [captureMode, browserException, refreshDevices])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [captureMode, browserException])

  function drawVisualizer() {
    const analyser = analyserRef.current
    const canvas = canvasRef.current
    if (!analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = canvas.width / dpr
    const H = canvas.height / dpr
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 0, W, H)

    const BAR_COUNT = 64
    const step = Math.floor(bufferLength / BAR_COUNT)
    const barW = (W / BAR_COUNT) * 0.72
    const gap = (W / BAR_COUNT) * 0.28
    const p500 = getComputedStyle(document.documentElement).getPropertyValue('--p-500').trim() || '0, 66, 118'

    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0
      for (let j = 0; j < step; j++) sum += dataArray[i * step + j] || 0
      const barH = Math.max(2, (sum / step / 255) * H)
      const x = i * (barW + gap)
      const y = H - barH
      const gradient = ctx.createLinearGradient(0, y, 0, H)
      gradient.addColorStop(0, `rgba(${p500}, 0.85)`)
      gradient.addColorStop(1, `rgba(${p500}, 0.12)`)
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, y, barW, barH, [barW / 2, barW / 2, 0, 0])
      ctx.fill()
    }
    rafRef.current = requestAnimationFrame(drawVisualizer)
  }

  const selectedDevice = audioDevices.find(d => d.deviceId === selectedDeviceId)
  const deviceAllowed = selectedDevice && isAllowedInputLabel(selectedDevice.label)

  async function startRecording() {
    setError('')
    if (!selectedDeviceId) {
      setError(t('meeting_room.capture_select_device'))
      return
    }
    if (!deviceAllowed) {
      setError(t('meeting_room.capture_device_blocked'))
      return
    }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: selectedDeviceId },
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError(t('meeting_room.capture_mic_denied'))
      } else if (err.name === 'NotFoundError') {
        setError(t('meeting_room.capture_mic_not_found'))
      } else {
        setError(`${t('common.error')}: ${err.message}`)
      }
      return
    }

    streamRef.current = stream
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 })
      audioContextRef.current = ac
      const source = ac.createMediaStreamSource(stream)
      const analyser = ac.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyserRef.current = analyser
      if (canvasRef.current) drawVisualizer()
    } catch (err) {
      setError(`${t('common.error')}: ${err.message}`)
      stream.getTracks().forEach(track => track.stop())
      return
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    const mr = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = mr
    chunksRef.current = []
    sessionIdRef.current = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sequenceRef.current = 0
    startTimeRef.current = Date.now()

    mr.ondataavailable = e => {
      if (e.data?.size > 0) chunksRef.current.push(e.data)
    }

    backupIntervalRef.current = setInterval(async () => {
      const sid = sessionIdRef.current
      if (!sid) return
      const pending = chunksRef.current.slice(sequenceRef.current)
      if (pending.length === 0) return
      sequenceRef.current = chunksRef.current.length
      try {
        await saveChunk(sid, new Blob(pending, { type: mimeType }), sequenceRef.current)
      } catch (err) {
        console.error('IndexedDB backup failed:', err)
      }
    }, 30000)

    mr.onstop = async () => {
      const sid = sessionIdRef.current
      if (backupIntervalRef.current) clearInterval(backupIntervalRef.current)
      const blob = new Blob(chunksRef.current, { type: mimeType })
      setAudioBlob(blob)
      setFileName(`recording_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.webm`)
      setAudioUrl(URL.createObjectURL(blob))
      setMode('review')
      if (sid) {
        try { await clearSession(sid) } catch { /* ignore */ }
      }
    }

    mr.onerror = () => {
      setError(t('meeting_room.capture_recorder_error'))
      stopRecording()
      setMode('idle')
    }

    mr.start(1000)
    setMode('recording')
    setDuration(0)
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }

  function handleStopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop()
  }

  function handleFileSelect(file) {
    setError('')
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(t('meeting_room.capture_file_type_error', { ext }))
      return
    }
    if (file.size > 500 * 1024 * 1024) {
      setError(t('meeting_room.capture_file_size_error'))
      return
    }
    setAudioBlob(file)
    setFileName(file.name)
    setUploadedFileSize(formatBytes(file.size))
    setAudioUrl(URL.createObjectURL(file))
    setMode('review')
  }

  function handleDiscard() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl('')
    setAudioBlob(null)
    setFileName('')
    setUploadedFileSize('')
    setDuration(0)
    setMode('idle')
    setError('')
    setUploadProgress(0)
    setUploadDone(false)
  }

  async function handleSubmit() {
    if (!audioBlob) return
    setMode('uploading')
    setUploadProgress(0)
    setError('')

    const audioSource = captureMode === 'browser'
      ? (deviceAllowed ? 'logitech_group' : 'browser_exception')
      : 'zoom_export'

    const fd = new FormData()
    fd.append('file', audioBlob, fileName)
    if (meetingId) fd.append('meeting_id', meetingId)
    fd.append('audio_source', audioSource)

    try {
      await api.post('/meetings/upload/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: prog => {
          if (prog.total) setUploadProgress(Math.round((prog.loaded / prog.total) * 100))
        },
      })
      setUploadDone(true)
      setMode('idle')
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl('')
      setAudioBlob(null)
    } catch (err) {
      setError(err.response?.data?.detail || t('meeting_room.capture_upload_failed'))
      setMode('review')
    }
  }

  async function handleRecover(sessionId) {
    setError('')
    try {
      const chunks = await getChunks(sessionId)
      if (!chunks.length) {
        setError(t('meeting_room.capture_recovery_empty'))
        return
      }
      const blob = new Blob(chunks, { type: 'audio/webm' })
      setAudioBlob(blob)
      setFileName(`recovered_${sessionId.slice(4, 18)}.webm`)
      setAudioUrl(URL.createObjectURL(blob))
      setMode('review')
      setCaptureMode('browser')
      setBrowserException(true)
      await clearSession(sessionId)
      setRecoverableSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDiscardRecovery(sessionId) {
    try {
      await clearSession(sessionId)
      setRecoverableSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    } catch { /* ignore */ }
  }

  const meetingQ = meetingId ? `?meetingId=${meetingId}` : ''

  if (uploadDone) {
    return (
      <div>
        <PageHeader title={t('meeting_room.capture_upload_success_title')} subtitle={meetingRef} />
        <div className="card p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            {t('meeting_room.capture_upload_success')}
          </p>
          <p className="text-sm text-slate-500 mb-6">{t('meeting_room.capture_upload_next')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {meetingId && (
              <>
                <Link
                  to={`/secretariat/meeting-room/minutes-pipeline${meetingQ}`}
                  className="btn-primary btn-sm"
                >
                  {t('meeting_room.pipeline_title')}
                </Link>
                <Link
                  to={`/secretariat/meetings/${meetingId}/minutes`}
                  className="btn-secondary btn-sm"
                >
                  {t('meeting_room.open_minutes')}
                </Link>
              </>
            )}
            <button type="button" onClick={() => setUploadDone(false)} className="btn-outline btn-sm">
              {t('meeting_room.capture_upload_another')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        {meetingId && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex-1">
          <PageHeader
            title={meetingRef ? t('meeting_room.capture_title_ref', { ref: meetingRef }) : t('meeting_room.capture_title')}
            subtitle={t('meeting_room.capture_subtitle')}
          />
        </div>
        <button
          type="button"
          onClick={() => setLogitechGuideOpen(true)}
          className="btn-outline btn-sm shrink-0 hidden sm:inline-flex items-center gap-1"
        >
          <Headphones size={14} />
          {t('nav.logitech_guide')}
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-100 flex items-start gap-2">
        <ShieldAlert size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{t('meeting_room.capture_policy_title')}</p>
          <p className="mt-1 text-amber-800 dark:text-amber-200">{t('meeting_room.capture_policy_body')}</p>
          <button
            type="button"
            onClick={() => setLogitechGuideOpen(true)}
            className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-amber-900 dark:text-amber-100 underline"
          >
            {t('nav.logitech_guide')} <ExternalLink size={12} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setCaptureMode('upload'); setBrowserException(false) }}
          className={captureMode === 'upload' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
        >
          <Upload size={14} />
          {t('meeting_room.capture_mode_upload')}
        </button>
        <button
          type="button"
          onClick={() => setCaptureMode('browser')}
          className={captureMode === 'browser' ? 'btn-secondary btn-sm ring-2 ring-amber-400' : 'btn-outline btn-sm'}
        >
          <Mic size={14} />
          {t('meeting_room.capture_mode_browser')}
        </button>
      </div>

      {captureMode === 'upload' && (
        <div className="card p-6 mb-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {t('meeting_room.capture_upload_recommended')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {t('meeting_room.capture_upload_hint')}
          </p>
          {mode === 'idle' || mode === 'recording' ? (
            <div
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]) }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={e => { e.preventDefault(); setDragOver(false) }}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver ? 'border-primary-500 bg-primary-50/50' : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'
              }`}
            >
              <Upload size={40} className="mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {dragOver ? t('meeting_room.capture_drop_here') : t('meeting_room.capture_drag_drop')}
              </p>
              <p className="text-xs text-slate-500 mt-1">MP3, M4A, MP4, WEBM, WAV, OGG · 500 MB max</p>
              <input
                id="file-input"
                type="file"
                accept=".mp3,.m4a,.mp4,.webm,.wav,.ogg,audio/*,video/mp4"
                className="hidden"
                onChange={e => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); e.target.value = '' }}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">{t('meeting_room.capture_file_selected')}</p>
          )}
        </div>
      )}

      {captureMode === 'browser' && (
        <div className="space-y-4 mb-6">
          {!browserException ? (
            <div className="card p-6 border-amber-200 dark:border-amber-800">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {t('meeting_room.capture_browser_gate')}
              </p>
              <button type="button" onClick={() => setBrowserException(true)} className="btn-secondary btn-sm">
                {t('meeting_room.capture_browser_confirm')}
              </button>
            </div>
          ) : (
            <div className="card p-6">
              <h2 className="text-base font-semibold mb-4">{t('meeting_room.capture_live_title')}</h2>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                {t('meeting_room.capture_device_label')}
              </label>
              <select
                className="input mb-2"
                value={selectedDeviceId}
                onChange={e => setSelectedDeviceId(e.target.value)}
              >
                <option value="">{t('meeting_room.capture_device_placeholder')}</option>
                {audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || t('meeting_room.capture_device_unnamed')}
                    {!isAllowedInputLabel(d.label) && d.label ? ' ⚠' : ''}
                  </option>
                ))}
              </select>
              {selectedDeviceId && !deviceAllowed && (
                <p className="text-xs text-red-600 mb-3">
                  {t('meeting_room.capture_device_blocked')}{' '}
                  <button type="button" onClick={() => setLogitechGuideOpen(true)} className="underline font-semibold">
                    {t('nav.logitech_guide')}
                  </button>
                </p>
              )}
              <canvas ref={canvasRef} className="w-full h-[140px] rounded-lg border border-slate-200 dark:border-slate-600 mb-4" />
              <div className="flex items-center gap-3">
                {mode === 'recording' ? (
                  <button type="button" onClick={handleStopRecording} className="btn-danger btn-lg">
                    <Square size={18} /> {t('meeting_room.capture_stop')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={mode === 'uploading' || !deviceAllowed}
                    className="btn-primary btn-lg disabled:opacity-50"
                  >
                    <Mic size={18} /> {t('meeting_room.capture_start')}
                  </button>
                )}
                {duration > 0 && (
                  <span className="font-mono text-sm text-slate-500 flex items-center gap-1">
                    <Clock size={14} /> {formatTime(duration)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {recoverableSessions.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="font-medium mb-2">{t('meeting_room.capture_recovery_title')}</p>
          {recoverableSessions.map(s => (
            <div key={s.sessionId} className="flex items-center justify-between py-1.5">
              <span className="text-xs">{new Date(s.firstChunk).toLocaleString()} · {formatBytes(s.size)}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleRecover(s.sessionId)} className="text-xs font-bold underline">
                  {t('meeting_room.capture_recover')}
                </button>
                <button type="button" onClick={() => handleDiscardRecovery(s.sessionId)} className="text-xs underline">
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'review' && audioUrl && (
        <div className="card p-6 mb-6">
          <h2 className="text-base font-semibold mb-4">{t('meeting_room.capture_review_title')}</h2>
          <div className="flex items-center gap-2 mb-4 text-sm">
            <FileAudio size={16} />
            <span className="font-medium">{fileName}</span>
            {uploadedFileSize && <span className="text-slate-500">{uploadedFileSize}</span>}
          </div>
          <audio controls src={audioUrl} className="w-full mb-4 rounded-lg" />
          <div className="flex gap-3">
            <button type="button" onClick={handleSubmit} className="btn-primary btn-lg">
              <Upload size={18} /> {t('meeting_room.capture_submit')}
            </button>
            <button type="button" onClick={handleDiscard} className="btn-secondary btn-lg">
              <Trash2 size={18} /> {t('common.delete')}
            </button>
          </div>
        </div>
      )}

      {mode === 'uploading' && (
        <div className="card p-6">
          <p className="text-sm font-medium mb-3">{t('meeting_room.capture_uploading')}</p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div className="bg-primary-500 h-full rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-xs text-right mt-2 text-slate-500">{uploadProgress}%</p>
        </div>
      )}

      <LogitechGroupGuideDialog open={logitechGuideOpen} onClose={() => setLogitechGuideOpen(false)} />
    </div>
  )
}
