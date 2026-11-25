import { useMemo } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'

/**
 * Group picker for a selective backup. `groups` comes from GET /backup/groups/ — each group
 * lists the groups it *requires* (non-null links, so it cannot be backed up without them)
 * and the groups it merely *links* to (nullable links). Requirements are closed here so
 * the admin sees, live, what ticking a box pulls in and why.
 */

/** The chosen groups plus every group they (transitively) require, in list order. */
export function effectiveGroups(groups, chosen) {
  const byKey = Object.fromEntries(groups.map(g => [g.key, g]))
  const seen = new Set(chosen.filter(k => byKey[k]))
  const todo = [...seen]
  while (todo.length) {
    const g = byKey[todo.pop()]
    for (const r of g.requires || []) {
      if (!seen.has(r.group)) {
        seen.add(r.group)
        todo.push(r.group)
      }
    }
  }
  return groups.map(g => g.key).filter(k => seen.has(k))
}

export default function BackupGroupPicker({ groups, chosen, onChange, disabled }) {
  const byKey = useMemo(() => Object.fromEntries(groups.map(g => [g.key, g])), [groups])
  const effective = useMemo(() => effectiveGroups(groups, chosen), [groups, chosen])
  const effectiveSet = new Set(effective)

  // For a group that is in only because something requires it: which ticked groups need it.
  const neededBy = useMemo(() => {
    const out = {}
    for (const k of effective) {
      for (const r of byKey[k].requires || []) {
        ;(out[r.group] ||= []).push({ by: byKey[k].label, because: r.because?.[0] })
      }
    }
    return out
  }, [effective, byKey])

  // Soft links from selected groups to groups that are not in the backup.
  const looseLinks = useMemo(() => {
    const rows = []
    for (const k of effective) {
      for (const l of byKey[k].linked || []) {
        if (!effectiveSet.has(l.group)) {
          rows.push({ from: byKey[k].label, to: l.label, because: l.because?.[0] })
        }
      }
    }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, byKey])

  const toggle = key => {
    const set = new Set(chosen)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    onChange([...set])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" className="underline text-primary-600 dark:text-primary-300"
          disabled={disabled} onClick={() => onChange(groups.map(g => g.key))}>
          Select all
        </button>
        <button type="button" className="underline text-primary-600 dark:text-primary-300"
          disabled={disabled} onClick={() => onChange([])}>
          Clear
        </button>
        <span className="text-slate-500 dark:text-slate-400">
          {effective.length === groups.length
            ? 'Everything — a full backup.'
            : `${effective.length} of ${groups.length} groups.`}
        </span>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {groups.map(g => {
          const reasons = neededBy[g.key] || []
          const locked = effectiveSet.has(g.key) && reasons.length > 0
          return (
            <li key={g.key}
              className={`rounded-lg border px-3 py-2 ${effectiveSet.has(g.key)
                ? 'border-primary-300 bg-primary-50/60 dark:border-primary-700 dark:bg-primary-900/20'
                : 'border-slate-200 dark:border-slate-700'}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={effectiveSet.has(g.key)}
                  disabled={disabled || locked}
                  onChange={() => toggle(g.key)}
                  aria-label={g.label}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                    {g.label}
                    {locked && <Lock size={11} className="ml-1 inline text-slate-400" aria-label="Required" />}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{g.description}</span>
                  {effectiveSet.has(g.key) && reasons.length > 0 && (
                    <span className="mt-1 block text-[11px] text-primary-700 dark:text-primary-300">
                      Required by{' '}
                      {[...new Set(reasons.map(r => r.by))].join(', ')}
                      {reasons[0].because ? ` (${reasons[0].because})` : ''}
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {looseLinks.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-900/10" role="status">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <p className="font-medium">Some records link to data that is not in this backup.</p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {looseLinks.map((l, i) => (
                <li key={i}>
                  {l.from} links to {l.to}{l.because ? ` (${l.because})` : ''}
                </li>
              ))}
            </ul>
            <p className="mt-1">
              These links are optional. Restored into this same system they are fine; on a new
              or empty system they would point at records that do not exist. Tick the groups
              above to include them.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
