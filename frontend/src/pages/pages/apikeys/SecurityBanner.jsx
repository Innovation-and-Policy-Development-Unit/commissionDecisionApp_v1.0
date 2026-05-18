import { AlertTriangle, ChevronRight } from 'lucide-react'

export default function SecurityBanner() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700">
      <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Keep your API keys secure</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          Never share your API keys in public repositories or client-side code. Treat them like passwords.
          If a key is compromised, revoke it immediately and generate a new one.
        </p>
      </div>
      <button className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline shrink-0 flex items-center gap-0.5">
        Learn more <ChevronRight size={12} />
      </button>
    </div>
  )
}
