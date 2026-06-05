export default function ResultsGrid({ result }) {
  if (!result?.rows?.length) {
    return <p className="text-sm text-slate-400 p-4">No results.</p>
  }
  return (
    <div className="overflow-auto max-h-80">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
          <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
            {result.columns.map(c => <th key={c.key} className="px-3 py-2">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
              {result.columns.map(c => <td key={c.key} className="px-3 py-1.5">{String(r[c.key] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
