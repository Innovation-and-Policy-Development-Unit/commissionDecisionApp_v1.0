import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { buildWsUrl } from '../utils/websocket'

const PING_MS = 30_000
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

/** Real-time "who's viewing this submission" — pushed over WebSocket by
 * SubmissionPresenceConsumer rather than polled. */
export function useSubmissionPresence(submissionId) {
  const { user, isLocked } = useAuth()
  const enabled = !!user && !isLocked && !!submissionId
  const [viewers, setViewers] = useState([])

  const wsRef = useRef(null)
  const pingIntervalRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS)

  useEffect(() => {
    setViewers([])
    if (!enabled) return undefined

    let cancelled = false

    function scheduleReconnect() {
      if (cancelled) return
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(connect, reconnectDelayRef.current)
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, RECONNECT_MAX_MS)
    }

    function connect() {
      if (cancelled) return
      const token = localStorage.getItem('psc_access')
      if (!token) return
      const ws = new WebSocket(buildWsUrl(`/ws/submissions/${submissionId}/presence/`, token))
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) { ws.close(); return }
        reconnectDelayRef.current = RECONNECT_BASE_MS
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
        }, PING_MS)
      }
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'viewers') setViewers(data.viewers || [])
        } catch { /* ignore malformed frame */ }
      }
      ws.onclose = () => {
        clearInterval(pingIntervalRef.current)
        scheduleReconnect()
      }
      ws.onerror = () => ws.close()
    }

    connect()

    function onAuthRefreshed() {
      // Reconnect with the new token rather than waiting for the stale one
      // to be rejected on the next natural reconnect cycle.
      wsRef.current?.close()
    }
    function onAuthCleared() {
      cancelled = true
      wsRef.current?.close()
    }
    window.addEventListener('psc-auth:refreshed', onAuthRefreshed)
    window.addEventListener('psc-auth:cleared', onAuthCleared)

    return () => {
      cancelled = true
      clearInterval(pingIntervalRef.current)
      clearTimeout(reconnectTimerRef.current)
      window.removeEventListener('psc-auth:refreshed', onAuthRefreshed)
      window.removeEventListener('psc-auth:cleared', onAuthCleared)
      wsRef.current?.close()
    }
  }, [enabled, submissionId])

  return viewers
}
