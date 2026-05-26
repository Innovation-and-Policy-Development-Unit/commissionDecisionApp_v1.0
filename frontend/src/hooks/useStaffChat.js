import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'
import { normalizeListPayload, normalizeFieldPayload } from '../utils/listPayload'

export const STAFF_CHAT_SUGGESTIONS = [
  'What is the status of case PSC-2026-00042?',
  'What are my ministry\'s active submissions?',
  'What are the steps after a submission is registered and routed?',
  'Which PSC form is used for a serious misconduct referral?',
]

export function useStaffChat({ enabled = true } = {}) {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const bottomRef = useRef(null)

  const loadSessions = useCallback(async () => {
    if (!enabled) return
    setLoadingSessions(true)
    try {
      const res = await api.get('/staff-chat/sessions/')
      setSessions(normalizeListPayload(res.data))
    } catch {
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [enabled])

  const loadSession = useCallback(async (id) => {
    if (!id) {
      setMessages([])
      setActiveId(null)
      return
    }
    try {
      const res = await api.get(`/staff-chat/sessions/${id}/`)
      setMessages(normalizeFieldPayload(res.data, 'messages'))
      setActiveId(id)
    } catch {
      setMessages([])
    }
  }, [])

  useEffect(() => {
    if (enabled) loadSessions()
  }, [enabled, loadSessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const startNewChat = useCallback(() => {
    setActiveId(null)
    setMessages([])
    setInput('')
  }, [])

  const sendMessage = useCallback(async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    setLoading(true)

    const optimisticUser = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    try {
      const res = await api.post('/staff-chat/sessions/send/', {
        message: content,
        session_id: activeId,
      })
      const data = res.data
      if (!activeId) {
        setActiveId(data.session_id)
        loadSessions()
      }
      setMessages(normalizeFieldPayload(data, 'messages'))
    } catch (err) {
      const detail = err.response?.data?.detail
      const errText =
        typeof detail === 'string' ? detail : t('staff_chat.error_send')
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        optimisticUser,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: errText,
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [activeId, input, loadSessions, loading, t])

  const deleteSession = useCallback(async (id, e) => {
    e?.stopPropagation?.()
    if (!window.confirm(t('staff_chat.confirm_delete'))) return
    try {
      await api.delete(`/staff-chat/sessions/${id}/`)
      if (activeId === id) startNewChat()
      loadSessions()
    } catch {
      /* ignore */
    }
  }, [activeId, loadSessions, startNewChat, t])

  return {
    sessions,
    activeId,
    messages,
    input,
    setInput,
    loading,
    loadingSessions,
    bottomRef,
    loadSessions,
    loadSession,
    startNewChat,
    sendMessage,
    deleteSession,
  }
}
