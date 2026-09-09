import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'
import { getDesktopNotificationsEnabled, showDesktopNotification } from '../utils/browserNotifications'
import { isTabVisible } from '../hooks/useVisibilityAwareInterval'

const ChatContext = createContext(null)

const PING_MS = 30_000
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

function buildWsUrl(token) {
  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'
  let wsBase
  if (/^https?:\/\//.test(apiBase)) {
    wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api\/?$/, '')
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    wsBase = `${proto}//${window.location.host}`
  }
  return `${wsBase}/ws/chat/?token=${encodeURIComponent(token)}`
}

function sortConversations(list) {
  return [...list].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
}

export function ChatProvider({ children }) {
  const { user, isLocked } = useAuth()
  const enabled = !!user && !isLocked

  const [conversations, setConversations] = useState([])
  const [connected, setConnected] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [messagesByConversation, setMessagesByConversation] = useState({})
  const [typingByConversation, setTypingByConversation] = useState({})
  const [onlineByUser, setOnlineByUser] = useState({})

  const wsRef = useRef(null)
  const pingIntervalRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS)
  const pendingSendsRef = useRef({}) // conversationId -> [{tempId, body}]
  const activeIdRef = useRef(null)
  activeIdRef.current = activeId
  const conversationsRef = useRef([])
  conversationsRef.current = conversations
  const openWindowsRef = useRef([])
  const openChatWindowRef = useRef(() => {})

  const fetchConversations = useCallback(async () => {
    if (!enabled) return
    try {
      const { data } = await api.get('/chat/conversations/')
      setConversations(sortConversations(Array.isArray(data) ? data : data?.results ?? []))
    } catch { /* keep whatever we had */ }
  }, [enabled])

  const fetchMessages = useCallback(async (conversationId, { before } = {}) => {
    const { data } = await api.get(`/chat/conversations/${conversationId}/messages/`, {
      params: before ? { before } : undefined,
    })
    setMessagesByConversation((prev) => {
      const existing = prev[conversationId] || []
      const merged = before ? [...data, ...existing] : data
      return { ...prev, [conversationId]: merged }
    })
    return data
  }, [])

  const selectConversation = useCallback((conversationId) => {
    setActiveId(conversationId)
    if (conversationId && !messagesByConversation[conversationId]) {
      fetchMessages(conversationId)
    }
  }, [fetchMessages, messagesByConversation])

  // ── Messenger-style floating popup windows (independent of the full
  // /chat page's single `activeId` selection above) ──────────────────────
  const MAX_OPEN_WINDOWS = 3
  const [openWindows, setOpenWindows] = useState([]) // [{ id, minimized }], oldest first
  openWindowsRef.current = openWindows

  const openChatWindow = useCallback((conversationId) => {
    if (!messagesByConversation[conversationId]) fetchMessages(conversationId)
    setOpenWindows((prev) => {
      const existing = prev.find((w) => w.id === conversationId)
      if (existing) {
        if (!existing.minimized) return prev
        return prev.map((w) => (w.id === conversationId ? { ...w, minimized: false } : w))
      }
      const next = [...prev, { id: conversationId, minimized: false }]
      return next.length > MAX_OPEN_WINDOWS ? next.slice(next.length - MAX_OPEN_WINDOWS) : next
    })
  }, [fetchMessages, messagesByConversation])
  openChatWindowRef.current = openChatWindow

  const closeChatWindow = useCallback((conversationId) => {
    setOpenWindows((prev) => prev.filter((w) => w.id !== conversationId))
  }, [])

  const minimizeChatWindow = useCallback((conversationId, minimized) => {
    setOpenWindows((prev) => prev.map((w) => (w.id === conversationId ? { ...w, minimized } : w)))
  }, [])

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
      return true
    }
    return false
  }, [])

  const sendMessage = useCallback((conversationId, body, replyToId = null) => {
    const trimmed = (body || '').trim()
    if (!trimmed) return
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    pendingSendsRef.current[conversationId] = [
      ...(pendingSendsRef.current[conversationId] || []),
      { tempId, body: trimmed },
    ]
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: [
        ...(prev[conversationId] || []),
        {
          id: tempId,
          conversation: conversationId,
          sender: user?.id,
          sender_name: user?.username,
          body: trimmed,
          created_at: new Date().toISOString(),
          pending: true,
        },
      ],
    }))
    const ok = send({ type: 'message.send', conversation_id: conversationId, body: trimmed, reply_to: replyToId })
    if (!ok) {
      // No live socket — fall back to REST so the message isn't silently lost.
      // No WS echo will arrive for this one (the socket wasn't connected when
      // it was broadcast), so reconcile directly from the REST response
      // instead of leaving the optimistic placeholder pending forever.
      api.post(`/chat/conversations/${conversationId}/messages/`, { body: trimmed, reply_to: replyToId })
        .then(({ data }) => {
          pendingSendsRef.current[conversationId] = (pendingSendsRef.current[conversationId] || [])
            .filter((p) => p.tempId !== tempId)
          setMessagesByConversation((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).map((m) => (m.id === tempId ? data : m)),
          }))
          setConversations((prev) => sortConversations(prev.map((c) => (c.id === conversationId
            ? { ...c, last_message: { id: data.id, sender: data.sender, body: data.body, created_at: data.created_at }, updated_at: data.created_at }
            : c))))
        })
        .catch(() => {
          setMessagesByConversation((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).map((m) => (
              m.id === tempId ? { ...m, failed: true, pending: false } : m
            )),
          }))
        })
    }
  }, [send, user])

  // Attachments always go via REST (WebSockets don't carry binary uploads).
  const sendAttachments = useCallback(async (conversationId, { body = '', files = [], replyToId } = {}) => {
    const form = new FormData()
    if (body.trim()) form.append('body', body.trim())
    if (replyToId) form.append('reply_to', replyToId)
    files.forEach((f) => form.append('files', f))
    const { data } = await api.post(`/chat/conversations/${conversationId}/messages/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    setMessagesByConversation((prev) => {
      const existing = prev[conversationId] || []
      return existing.some((m) => m.id === data.id)
        ? prev
        : { ...prev, [conversationId]: [...existing, data] }
    })
    setConversations((prev) => sortConversations(prev.map((c) => (c.id === conversationId
      ? { ...c, last_message: { id: data.id, sender: data.sender, body: data.body, created_at: data.created_at }, updated_at: data.created_at }
      : c))))
    return data
  }, [])

  const editMessage = useCallback(async (conversationId, messageId, body) => {
    const { data } = await api.patch(`/chat/conversations/${conversationId}/messages/${messageId}/`, { body })
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map((m) => (m.id === messageId ? data : m)),
    }))
  }, [])

  const deleteMessage = useCallback(async (conversationId, messageId) => {
    const { data } = await api.delete(`/chat/conversations/${conversationId}/messages/${messageId}/`)
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map((m) => (m.id === messageId ? data : m)),
    }))
  }, [])

  const reactToMessage = useCallback(async (conversationId, messageId, emoji) => {
    const { data } = await api.post(`/chat/conversations/${conversationId}/messages/${messageId}/react/`, { emoji })
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map((m) => (
        m.id === messageId ? { ...m, reactions: data.reactions } : m
      )),
    }))
  }, [])

  const setTyping = useCallback((conversationId, isTyping) => {
    send({ type: 'typing', conversation_id: conversationId, is_typing: isTyping })
  }, [send])

  const markRead = useCallback((conversationId) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)))
    const okViaSocket = send({ type: 'read', conversation_id: conversationId })
    if (!okViaSocket) {
      api.post(`/chat/conversations/${conversationId}/read/`).catch(() => {})
    }
  }, [send])

  const startConversation = useCallback(async (participantIds, name = '') => {
    const { data } = await api.post('/chat/conversations/', { participant_ids: participantIds, name })
    setConversations((prev) => {
      if (prev.some((c) => c.id === data.id)) return sortConversations(prev)
      return sortConversations([...prev, data])
    })
    return data
  }, [])

  const searchUsers = useCallback(async (q) => {
    const { data } = await api.get('/chat/users/', { params: q ? { q } : undefined })
    return data
  }, [])

  // ── incoming event handling ────────────────────────────────────────────
  const handleEvent = useCallback((evt) => {
    switch (evt.type) {
      case 'message': {
        const msg = evt.message
        const convId = msg.conversation
        const isOwn = msg.sender === user?.id
        const isViewed = activeIdRef.current === convId
          || openWindowsRef.current.some((w) => w.id === convId && !w.minimized)

        setMessagesByConversation((prev) => {
          const existing = prev[convId] || []
          const pendingQueue = pendingSendsRef.current[convId] || []
          if (isOwn && pendingQueue.length) {
            const [match, ...rest] = pendingQueue
            pendingSendsRef.current[convId] = rest
            return { ...prev, [convId]: existing.map((m) => (m.id === match.tempId ? msg : m)) }
          }
          if (existing.some((m) => m.id === msg.id)) return prev
          return { ...prev, [convId]: [...existing, msg] }
        })
        setConversations((prev) => {
          const next = prev.map((c) => (c.id === convId
            ? {
              ...c,
              last_message: { id: msg.id, sender: msg.sender, body: msg.body, created_at: msg.created_at },
              updated_at: msg.created_at,
              unread_count: (!isViewed && !isOwn) ? (c.unread_count || 0) + 1 : c.unread_count,
            }
            : c))
          return sortConversations(next)
        })

        if (!isOwn && !isViewed && getDesktopNotificationsEnabled() && !isTabVisible()) {
          const conv = conversationsRef.current.find((c) => c.id === convId)
          showDesktopNotification({
            title: conv?.display_name || msg.sender_name,
            body: msg.body || 'Sent an attachment',
            tag: `scdms-chat-${convId}`,
            onClick: () => openChatWindowRef.current(convId),
          })
        }
        break
      }
      case 'message_edited': {
        const msg = evt.message
        setMessagesByConversation((prev) => ({
          ...prev,
          [msg.conversation]: (prev[msg.conversation] || []).map((m) => (m.id === msg.id ? msg : m)),
        }))
        break
      }
      case 'message_deleted': {
        const msg = evt.message
        setMessagesByConversation((prev) => ({
          ...prev,
          [msg.conversation]: (prev[msg.conversation] || []).map((m) => (m.id === msg.id ? msg : m)),
        }))
        break
      }
      case 'reaction': {
        const { message_id: msgId, reactions } = evt
        setMessagesByConversation((prev) => {
          const next = { ...prev }
          for (const convId of Object.keys(next)) {
            if (next[convId].some((m) => m.id === msgId)) {
              next[convId] = next[convId].map((m) => (m.id === msgId ? { ...m, reactions } : m))
            }
          }
          return next
        })
        break
      }
      case 'typing': {
        const { conversation_id: convId, user_id: uid, is_typing: typing } = evt
        setTypingByConversation((prev) => {
          const current = new Set(prev[convId] || [])
          if (typing) current.add(uid); else current.delete(uid)
          return { ...prev, [convId]: Array.from(current) }
        })
        break
      }
      case 'read': {
        // Read receipts from other participants don't change unread counts
        // (those are already tracked from this user's own perspective);
        // conversation list re-render just needs to happen if we show
        // per-message "seen" state, which the thread view derives itself
        // from conversation.participants — nothing to update globally here.
        break
      }
      case 'presence': {
        setOnlineByUser((prev) => ({ ...prev, [evt.user_id]: evt.online }))
        break
      }
      case 'conversation_new': {
        setConversations((prev) => {
          if (prev.some((c) => c.id === evt.conversation.id)) return prev
          return sortConversations([...prev, evt.conversation])
        })
        break
      }
      default:
        break
    }
  }, [user])

  // ── socket lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
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
      const ws = new WebSocket(buildWsUrl(token))
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) { ws.close(); return }
        setConnected(true)
        reconnectDelayRef.current = RECONNECT_BASE_MS
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = setInterval(() => send({ type: 'ping' }), PING_MS)
      }
      ws.onmessage = (e) => {
        try { handleEvent(JSON.parse(e.data)) } catch { /* ignore malformed frame */ }
      }
      ws.onclose = () => {
        setConnected(false)
        clearInterval(pingIntervalRef.current)
        scheduleReconnect()
      }
      ws.onerror = () => ws.close()
    }

    fetchConversations()
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
  }, [enabled, fetchConversations, handleEvent, send])

  // Presence updates land in onlineByUser as they arrive over the socket —
  // merge them over each conversation's initial `online` (set once, at fetch
  // time) rather than trusting that snapshot for the conversation's whole
  // lifetime in memory.
  const conversationsWithPresence = useMemo(() => conversations.map((c) => {
    if (c.is_group) return c
    const otherId = (c.participant_ids || []).find((id) => id !== user?.id)
    const live = otherId != null ? onlineByUser[otherId] : undefined
    return live === undefined ? c : { ...c, online: live }
  }), [conversations, onlineByUser, user])

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [conversations],
  )

  const value = useMemo(() => ({
    conversations: conversationsWithPresence,
    connected,
    activeId,
    messages: messagesByConversation[activeId] || [],
    typingUserIds: typingByConversation[activeId] || [],
    messagesByConversation,
    typingByConversation,
    onlineByUser,
    unreadTotal,
    selectConversation,
    sendMessage,
    sendAttachments,
    editMessage,
    deleteMessage,
    reactToMessage,
    setTyping,
    markRead,
    startConversation,
    searchUsers,
    fetchMessages,
    refresh: fetchConversations,
    openWindows,
    openChatWindow,
    closeChatWindow,
    minimizeChatWindow,
  }), [
    conversationsWithPresence, connected, activeId, messagesByConversation, typingByConversation,
    onlineByUser, unreadTotal, selectConversation, sendMessage, sendAttachments, editMessage,
    deleteMessage, reactToMessage, setTyping, markRead,
    startConversation, searchUsers, fetchMessages, fetchConversations,
    openWindows, openChatWindow, closeChatWindow, minimizeChatWindow,
  ])

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return ctx
}
