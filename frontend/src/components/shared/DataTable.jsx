import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import BaseInput from './BaseInput'
import BaseButton from './BaseButton'

/** Sortable, paginated table (Tailwind) + sticky header. */
export default function DataTable({
  columns,
  data,
  pageSize = 10,
  searchable = true,
  rowKey,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results found',
  maxHeight = 'min(70vh, 640px)',
}) {
  const [query, setQuery] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)

  const filtered = data.filter(row =>
    !searchable || !query || Object.values(row).some(v =>
      String(v).toLowerCase().includes(query.toLowerCase()),
    ),
  )

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol]
        const bv = b[sortCol]
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleSort = (key) => {
    if (sortCol === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  return (
    <div className="card overflow-hidden">
      {searchable && (
        <div className="p-3 border-b border-slate-100 dark:border-slate-700">
          <BaseInput
            type="search"
            hideLabel
            label="Search table"
            placeholder={searchPlaceholder}
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            className="max-w-xs"
            inputClassName="text-sm"
          />
        </div>
      )}

      <div className="overflow-auto custom-scrollbar" style={{ maxHeight }}>
        <table className="w-full min-w-full text-left">
          <thead className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={clsx(
                    'px-3 py-2',
                    col.sortable !== false && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 select-none',
                  )}
                >
                  <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {col.label}
                    {col.sortable !== false && sortCol === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-slate-500 dark:text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => {
                const key = rowKey ? rowKey(row) : (row.id ?? row.key ?? i)
                return (
                  <tr key={key} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    {columns.map(col => (
                      <td key={col.key} className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {Math.min((safePage - 1) * pageSize + 1, sorted.length)}–
            {Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <BaseButton variant="ghost" size="sm" iconOnly icon={<ChevronLeft size={16} />}
              disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))} aria-label="Previous page" />
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p = i + 1
              if (totalPages > 5 && safePage > 3) p = safePage - 2 + i
              if (p > totalPages) return null
              return (
                <BaseButton key={p} variant={safePage === p ? 'primary' : 'ghost'} size="sm"
                  onClick={() => setPage(p)} className="min-w-8">
                  {p}
                </BaseButton>
              )
            })}
            <BaseButton variant="ghost" size="sm" iconOnly icon={<ChevronRight size={16} />}
              disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} aria-label="Next page" />
          </div>
        </div>
      )}
    </div>
  )
}
