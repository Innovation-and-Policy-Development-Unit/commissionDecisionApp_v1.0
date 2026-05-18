import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'

export default function Error404() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
      <div className="text-center max-w-lg">
        {/* Animated 404 */}
        <div className="relative mb-8 inline-block">
          <div className="text-[150px] font-black leading-none">
            <span className="text-primary-500">4</span>
            <span className="text-cyan-500">0</span>
            <span className="text-primary-500">4</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <div className="w-64 h-64 rounded-full bg-primary-500 blur-3xl" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          Page not found
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed mb-8 max-w-sm mx-auto">
          Oops! The page you're looking for doesn't exist or has been moved to a different location.
        </p>

        {/* Search suggestion */}
        <div className="relative max-w-xs mx-auto mb-8">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search for a page..."
            className="input pl-9 text-sm"
          />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-sm mx-auto mb-8">
          {[
            { label: 'Dashboard', path: '/' },
            { label: 'Analytics', path: '/analytics' },
            { label: 'eCommerce', path: '/ecommerce' },
            { label: 'Calendar', path: '/apps/calendar' },
            { label: 'Blog', path: '/pages/blog' },
            { label: 'Charts', path: '/charts' },
          ].map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-outline gap-2"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-gradient gap-2"
          >
            <Home size={16} />
            Go Home
          </button>
        </div>

        {/* Decorative elements */}
        <div className="mt-12 flex items-center justify-center gap-2 opacity-50">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="rounded-full bg-primary-400"
              style={{
                width: `${8 + i * 4}px`,
                height: `${8 + i * 4}px`,
                opacity: 0.3 + i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
