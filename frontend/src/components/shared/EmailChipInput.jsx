import { useId, useState } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Chip input for a capped list of free-text email addresses (no account required). */
export default function EmailChipInput({ label, hint, value = [], onChange, max = 8, className }) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const commit = () => {
    const email = draft.trim().replace(/,$/, '')
    if (!email) return
    if (value.length >= max) {
      setError(`You can add up to ${max} email addresses.`)
      return
    }
    if (!EMAIL_RE.test(email)) {
      setError(`'${email}' doesn't look like a valid email address.`)
      return
    }
    if (value.some(v => v.toLowerCase() === email.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...value, email])
    setDraft('')
    setError('')
  }

  const remove = email => {
    onChange(value.filter(v => v !== email))
    setError('')
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          {label}
        </label>
      )}
      <div className="input w-full min-w-0 flex flex-wrap items-center gap-1.5 py-1.5">
        {value.map(email => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs pl-2.5 pr-1 py-1"
          >
            {email}
            <button
              type="button"
              onClick={() => remove(email)}
              className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600"
              aria-label={`Remove ${email}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={e => { setDraft(e.target.value); setError('') }}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={value.length >= max ? '' : 'name@ministry.gov.vu'}
          disabled={value.length >= max}
          className="flex-1 min-w-[160px] border-none outline-none bg-transparent text-sm py-0.5"
        />
      </div>
      {error
        ? <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
        : hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  )
}
