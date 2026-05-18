import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Mic, Square, Upload, FileAudio, Trash2, CheckCircle2, AlertCircle, Clock, ArrowLeft } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { saveChunk, getChunks, clearSession, getAllSessions } from '../../utils/audioStorage'

const ALLOWED_EXTS = ['.mp3', '.m4a', '.mp4']
const BACKUP_INTERVAL = 30000
const BAR_COUNT = 64

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

export default function MeetingCapture() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meetingId = searchParams.get('meetingId')

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

  const canvasRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
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
      streamRef.current.getTracks().forEach(t => t.stop())
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
  }, [])

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

    const step = Math.floor(bufferLength / BAR_COUNT)
    const barW = (W / BAR_COUNT) * 0.72
    const gap = (W / BAR_COUNT) * 0.28

    const p500 = getComputedStyle(document.documentElement)
      .getPropertyValue('--p-500').trim() || '0, 66, 118'

    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j] || 0
      }
      const avg = sum / step
      const barH = Math.max(2, (avg / 255) * H)

      const x = i * (barW + gap)
      const y = H - barH

      const gradient = ctx.createLinearGradient(0, y, 0, H)
      gradient.addColorStop(0, `rgba(${p500}, 0.85)`)
      gradient.addColorStop(0.5, `rgba(${p500}, 0.5)`)
      gradient.addColorStop(1, `rgba(${p500}, 0.12)`)

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, y, barW, barH, [barW / 2, barW / 2, 0, 0])
      ctx.fill()
    }

    rafRef.current = requestAnimationFrame(drawVisualizer)
  }

  function resizeCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
  }

  async function startRecording() {
    setError('')
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.')
      } else {
        setError(`Microphone error: ${err.message}`)
      }
      return
    }

    streamRef.current = stream

    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 })
      audioContextRef.current = ac
      const source = ac.createMediaStreamSource(stream)
      sourceRef.current = source
      const analyser = ac.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyserRef.current = analyser

      if (canvasRef.current) {
        resizeCanvas()
        drawVisualizer()
      }
    } catch (err) {
      setError(`Audio context error: ${err.message}`)
      stream.getTracks().forEach(t => t.stop())
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
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    backupIntervalRef.current = setInterval(async () => {
      const sid = sessionIdRef.current
      if (!sid) return
      const pending = chunksRef.current.slice(sequenceRef.current)
      if (pending.length === 0) return
      sequenceRef.current = chunksRef.current.length
      try {
        const blob = new Blob(pending, { type: mimeType })
        await saveChunk(sid, blob, sequenceRef.current)
      } catch (err) {
        console.error('IndexedDB backup failed:', err)
      }
    }, BACKUP_INTERVAL)

    mr.onstop = async () => {
      const sid = sessionIdRef.current
      if (backupIntervalRef.current) clearInterval(backupIntervalRef.current)
      backupIntervalRef.current = null

      const mime = mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type: mime })
      setAudioBlob(blob)
      setFileName(`recording_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.webm`)

      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setMode('review')

      if (sid) {
        try { await clearSession(sid) } catch (err) { console.error('Failed to clear IndexedDB session:', err) }
      }
    }

    mr.onerror = () => {
      setError('Recording failed due to a MediaRecorder error.')
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  function handleFileSelect(file) {
    setError('')
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(`File type "${ext}" is not supported. Please upload .mp3, .m4a, or .mp4 files.`)
      return
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('File is too large. Maximum size is 500 MB.')
      return
    }

    setAudioBlob(file)
    setFileName(file.name)
    setUploadedFileSize(formatBytes(file.size))
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    setMode('review')
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) handleFileSelect(files[0])
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  function handleFileInputChange(e) {
    const files = e.target.files
    if (files.length > 0) handleFileSelect(files[0])
    e.target.value = ''
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
  }

  async function handleSubmit() {
    if (!audioBlob) return
    setMode('uploading')
    setUploadProgress(0)
    setError('')

    const fd = new FormData()
    fd.append('file', audioBlob, fileName)
    if (meetingId) fd.append('meeting_id', meetingId)

    try {
      await api.post('/meetings/upload/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: prog => {
          if (prog.total) {
            setUploadProgress(Math.round((prog.loaded / prog.total) * 100))
          }
        },
      })
      setTimeout(() => {
        handleDiscard()
      }, 2000)
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Upload failed. Please try again.'
      setError(detail)
      setMode('review')
    }
  }

  async function handleRecover(sessionId) {
    setError('')
    try {
      const chunks = await getChunks(sessionId)
      if (chunks.length === 0) {
        setError('No audio data found for this session.')
        return
      }
      const blob = new Blob(chunks, { type: 'audio/webm' })
      if (blob.size === 0) {
        setError('Recovered audio is empty.')
        return
      }
      setAudioBlob(blob)
      setFileName(`recovered_recording_${sessionId.slice(4, 18)}.webm`)
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setMode('review')
      await clearSession(sessionId)
      setRecoverableSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    } catch (err) {
      setError(`Recovery failed: ${err.message}`)
    }
  }

  async function handleDiscardRecovery(sessionId) {
    try {
      await clearSession(sessionId)
      setRecoverableSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    } catch (err) {
      console.error('Failed to clear recovery session:', err)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        {meetingId && (
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex-1">
          <PageHeader
            title={meetingRef ? `Recording: ${meetingRef}` : 'Meeting Recording'}
            subtitle="Record a meeting or upload an audio file for AI transcription"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {recoverableSessions.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} />
            <span className="font-medium">Unfinished recordings found</span>
          </div>
          <p className="mb-2 text-amber-700 dark:text-amber-300">
            Previous recording sessions were found in local storage. You can recover or discard them.
          </p>
          {recoverableSessions.map(s => (
            <div key={s.sessionId} className="flex items-center justify-between py-1.5 border-b border-amber-200/50 last:border-0">
              <span className="text-xs">
                {new Date(s.firstChunk).toLocaleString()} &middot; {s.count} chunk{s.count !== 1 ? 's' : ''} &middot; {formatBytes(s.size)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRecover(s.sessionId)}
                  className="text-xs font-medium text-amber-800 hover:text-amber-900 underline"
                >
                  Recover
                </button>
                <button
                  onClick={() => handleDiscardRecovery(s.sessionId)}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 underline"
                >
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Live Recording</h2>
            {mode === 'recording' && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                Recording
              </div>
            )}
          </div>

          <div className="relative mb-4">
            <canvas
              ref={canvasRef}
              className="w-full h-[180px] rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
            />
            {mode === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                <div className="text-center">
                  <Mic size={32} className="mx-auto mb-2 opacity-50" />
                  <span>Press "Start Recording" to begin</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode === 'recording' ? (
                <button
                  onClick={handleStopRecording}
                  className="btn-danger btn-lg"
                >
                  <Square size={18} />
                  Stop Recording
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="btn-primary btn-lg"
                  disabled={mode === 'uploading'}
                >
                  <Mic size={18} />
                  Start Recording
                </button>
              )}
              {(mode === 'recording' || duration > 0) && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-sm tabular-nums">
                  <Clock size={14} />
                  {formatTime(duration)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Upload File</h2>

          {mode === 'idle' || mode === 'recording' ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 ${
                dragOver
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                  : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Upload
                size={36}
                className={`mx-auto mb-3 ${
                  dragOver
                    ? 'text-primary-500'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {dragOver ? 'Drop file here' : 'Drag & drop audio file'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                MP3, M4A or MP4 &middot; Max 500 MB
              </p>
              <input
                id="file-input"
                type="file"
                accept=".mp3,.m4a,.mp4,audio/mpeg,audio/mp4,audio/x-m4a,video/mp4"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-xl p-8 text-center border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30">
              <FileAudio size={36} className="mx-auto mb-3 text-slate-400 dark:text-slate-500" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                File already selected. Discard the current recording to upload a new file.
              </p>
            </div>
          )}
        </div>
      </div>

      {mode === 'review' && audioUrl && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Review Recording</h2>
            {uploadedFileSize && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{uploadedFileSize}</span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
            <FileAudio size={16} />
            <span className="font-medium text-slate-700 dark:text-slate-300">{fileName}</span>
          </div>

          <audio
            controls
            src={audioUrl}
            className="w-full mb-4 rounded-lg"
            style={{ height: 48 }}
          >
            Your browser does not support the audio element.
          </audio>

          {duration > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Duration: {formatTime(duration)}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleSubmit} className="btn-primary btn-lg">
              <Upload size={18} />
              Submit Recording
            </button>
            <button onClick={handleDiscard} className="btn-secondary btn-lg">
              <Trash2 size={18} />
              Discard
            </button>
          </div>
        </div>
      )}

      {mode === 'uploading' && (
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Uploading... Please do not close the window
            </p>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-primary-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-right">
            {uploadProgress}%
          </p>
        </div>
      )}

      {mode === 'review' && !audioUrl && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={24} />
            <p className="text-sm font-medium">Recording uploaded successfully!</p>
          </div>
        </div>
      )}
    </div>
  )
}
