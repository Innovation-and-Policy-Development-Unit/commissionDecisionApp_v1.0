export default function Section({ title, subtitle, children }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">{title}</h2>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>
      {children}
    </section>
  )
}
