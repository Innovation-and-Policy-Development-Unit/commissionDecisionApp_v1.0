import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import {
  formatNotificationTime,
  getDesktopNotificationsEnabled,
  getDesktopNotificationsEnabledAt,
  inferNotificationType,
  showDesktopNotification,
} from '../utils/browserNotifications'

const POLL_MS = 45_000

function mapApiRow(row) {
  const path = row.submission
    ? `/submissions/${row.submission}`
    : row.title?.toLowerCase().includes('task')
      ? '/secretariat/tasks'
      : '/submissions'
  return {
    id: row.id,
    type: inferNotificationType(row.title),
    title: row.title,
    message: row.body,
    time: formatNotificationTime(row.created_at),
    read: row.is_read,
    path,
    createdAt: row.created_at,
  }
}

export function useNotifications({ enabled = true } = {}) {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const seenDesktopRef = useRef(new Set())
  const mountedRef = useRef(true)

  const notifyDesktop = useCallback(
    (items) => {
      if (!getDesktopNotificationsEnabled()) return
      const enabledAt = getDesktopNotificationsEnabledAt()
      const enabledAfter = enabledAt ? new Date(enabledAt).getTime() : 0

      items.forEach((n) => {
        if (n.read || seenDesktopRef.current.has(n.id)) return
        const created = n.createdAt ? new Date(n.createdAt).getTime() : 0
        if (enabledAfter && created < enabledAfter) return

        seenDesktopRef.current.add(n.id)
        showDesktopNotification({
          title: n.title,
          body: n.message,
          tag: `scdms-notification-${n.id}`,
          onClick: () => navigate(n.path),
        })
      })
    },
    [navigate],
  )

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const { data } = await api.get('/notifications/')
      const list = (Array.isArray(data) ? data : data?.results ?? []).map(mapApiRow)
      if (mountedRef.current) {
        setNotifications(list)
        setError(false)
        notifyDesktop(list.filter((n) => !n.read))
      }
    } catch {
      if (mountedRef.current) setError(true)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [enabled, notifyDesktop])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    fetchNotifications()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, fetchNotifications])

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await api.post(`/notifications/${id}/mark_read/`)
    } catch {
      fetchNotifications()
    }
  }, [fetchNotifications])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await api.post('/notifications/mark_all_read/')
    } catch {
      fetchNotifications()
    }
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchNotifications,
    markRead,
    markAllRead,
  }
}
