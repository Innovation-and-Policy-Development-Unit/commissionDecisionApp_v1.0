import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../shared/Modal'
import Avatar from '../shared/Avatar'
import { useChat } from '../../context/ChatContext'

export default function NewConversationModal({ open, onClose, onCreated }) {
  const { t } = useTranslation()
  const { searchUsers, startConversation } = useChat()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState([])
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const debounceRef = useRef(null)

  const runSearch = useCallback((q) => {
    setLoading(true)
    searchUsers(q).then(setResults).catch(() => setResults([])).finally(() => setLoading(false))
  }, [searchUsers])

  useEffect(() => {
    if (!open) return
    runSearch('')
  }, [open, runSearch])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 250)
    return () => clearTimeout(debounceRef.current)
  }, [query, runSearch])

  useEffect(() => {
    if (!open) {
      setQuery(''); setResults([]); setSelected([]); setGroupName('')
    }
  }, [open])

  const toggle = (person) => {
    setSelected((prev) => (
      prev.some((p) => p.id === person.id)
        ? prev.filter((p) => p.id !== person.id)
        : [...prev, person]
    ))
  }

  const handleCreate = async () => {
    if (!selected.length || creating) return
    setCreating(true)
    try {
      const conversation = await startConversation(selected.map((p) => p.id), groupName)
      onCreated?.(conversation)
      onClose()
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('chat.new_conversation')}
      subtitle={t('chat.select_people')}
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            {t('chat.cancel')}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!selected.length || creating}
            className="btn btn-primary disabled:opacity-50"
          >
            {t('chat.create')}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('chat.search_people')}
          className="w-full input text-sm"
        />

        {selected.length > 1 && (
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t('chat.group_name_placeholder')}
            className="w-full input text-sm"
          />
        )}

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p)}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium"
              >
                <Avatar name={p.name} src={p.picture} size="xs" />
                {p.name}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-700 border border-slate-100 dark:border-slate-700 rounded-lg">
          {loading && (
            <p className="px-3 py-6 text-center text-xs text-slate-400">…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-slate-400">{t('chat.no_conversations')}</p>
          )}
          {!loading && results.map((p) => {
            const isSelected = selected.some((s) => s.id === p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isSelected ? 'bg-primary-50/60 dark:bg-primary-900/20' : ''}`}
              >
                <Avatar name={p.name} src={p.picture} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{p.role_label}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
