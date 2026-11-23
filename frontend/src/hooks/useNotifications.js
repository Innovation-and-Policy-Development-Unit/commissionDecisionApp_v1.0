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
import { isTabVisible } from './useVisibilityAwareInterval'
import { installNotificationSoundUnlock, playNotificationChime } from '../utils/notificationSound'

const POLL_MS = 45_000

function mapApiRow(row) {
  const path = row.link
    || (row.submission
      ? `/submissions/${row.submission}`
      : row.title?.toLowerCase().includes('task')
        ? '/secretariat/tasks'
        : '/submissions')
  return {
    id: row.id,
    // Server-stored severity wins; the title guess only covers rows from before it existed.
    type: row.severity && row.severity !== 'info' ? row.severity : inferNotificationType(row.title),
    category: row.category || '',
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
  const [filter, setFilter] = useState('all') // 'all' | 'unread'
  const [serverUnread, setServerUnread] = useState(null)
  const [nextPage, setNextPage] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const filterRef = useRef('all')
  const seenDesktopRef = useRef(new Set())
  // Ids already heard or seen. The first load only fills it, so opening the app
  // with old unread items stays silent; later arrivals chime once per batch.
  const knownIdsRef = useRef(null)
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
      const params = filterRef.current === 'unread' ? { unread: 1 } : {}
      const [{ data }, countRes] = await Promise.all([
        api.get('/notifications/', { params }),
        api.get('/notifications/unread_count/').catch(() => null),
      ])
      const list = (Array.isArray(data) ? data : data?.results ?? []).map(mapApiRow)
      if (mountedRef.current) {
        // Keep older pages the user already loaded: the poll only refreshes page one.
        setNotifications((prev) => {
          const fresh = new Set(list.map((n) => n.id))
          const older = prev.filter((n) => !fresh.has(n.id) && list.length && n.createdAt < list[list.length - 1].createdAt)
          return [...list, ...older]
        })
        setNextPage((cur) => (cur && cur > 2 ? cur : (data?.next ? 2 : null)))
        if (countRes?.data) setServerUnread(countRes.data.unread_count)
        setError(false)
        const unread = list.filter((n) => !n.read)
        const known = knownIdsRef.current
        if (known) {
          if (unread.some((n) => !known.has(n.id))) playNotificationChime()
        }
        knownIdsRef.current = new Set([...(known || []), ...list.map((n) => n.id)])
        notifyDesktop(unread)
      }
    } catch {
      if (mountedRef.current) setError(true)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [enabled, notifyDesktop])

  useEffect(() => {
    installNotificationSoundUnlock()
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    fetchNotifications()

    const tick = () => {
      if (isTabVisible()) fetchNotifications()
    }

    const onVisibility = () => {
      if (isTabVisible()) fetchNotifications()
    }

    document.addEventListener('visibilitychange', onVisibility)
    const id = setInterval(tick, POLL_MS)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, fetchNotifications])

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setServerUnread((c) => (c == null ? c : Math.max(0, c - 1)))
    try {
      await api.post(`/notifications/${id}/mark_read/`)
    } catch {
      fetchNotifications()
    }
  }, [fetchNotifications])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setServerUnread(0)
    try {
      await api.post('/notifications/mark_all_read/')
    } catch {
      fetchNotifications()
    }
  }, [fetchNotifications])

  const markUnread = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)))
    setServerUnread((c) => (c == null ? c : c + 1))
    try {
      await api.post(`/notifications/${id}/mark_unread/`)
    } catch {
      fetchNotifications()
    }
  }, [fetchNotifications])

  const changeFilter = useCallback((value) => {
    filterRef.current = value
    setFilter(value)
    setNextPage(null)
    setNotifications([])
    fetchNotifications()
  }, [fetchNotifications])

  const loadMore = useCallback(async () => {
    if (!nextPage || loadingMore) return
    setLoadingMore(true)
    try {
      const params = { page: nextPage, ...(filterRef.current === 'unread' ? { unread: 1 } : {}) }
      const { data } = await api.get('/notifications/', { params })
      const more = (data?.results ?? []).map(mapApiRow)
      if (mountedRef.current) {
        setNotifications((prev) => {
          const have = new Set(prev.map((n) => n.id))
          return [...prev, ...more.filter((n) => !have.has(n.id))]
        })
        setNextPage(data?.next ? nextPage + 1 : null)
        knownIdsRef.current = new Set([...(knownIdsRef.current || []), ...more.map((n) => n.id)])
      }
    } catch {
      /* the button stays; the user can try again */
    } finally {
      if (mountedRef.current) setLoadingMore(false)
    }
  }, [nextPage, loadingMore])

  // The server count covers every page; the loaded list alone undercounts past 50.
  const unreadCount = serverUnread ?? notifications.filter((n) => !n.read).length

  return {
    filter,
    setFilter: changeFilter,
    hasMore: !!nextPage,
    loadMore,
    loadingMore,
    markUnread,
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchNotifications,
    markRead,
    markAllRead,
  }
}
