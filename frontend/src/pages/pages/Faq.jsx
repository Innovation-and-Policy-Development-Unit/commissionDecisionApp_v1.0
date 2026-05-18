import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { ChevronDown, Search, HelpCircle, MessageCircle, Mail, Phone, BookOpen, CreditCard, Settings, User, Globe, CheckCircle, ArrowRight, Zap } from 'lucide-react'
import clsx from 'clsx'

const categories = ['All', 'Getting Started', 'Billing', 'Features', 'Technical', 'Account']

const categoryCards = [
  {
    icon: Zap,
    label: 'Getting Started',
    count: 8,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-800/40',
  },
  {
    icon: CreditCard,
    label: 'Billing',
    count: 6,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    border: 'border-emerald-200 dark:border-emerald-800/40',
  },
  {
    icon: Settings,
    label: 'Features',
    count: 12,
    color: 'text-primary-600 dark:text-primary-400',
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    border: 'border-primary-200 dark:border-primary-800/40',
  },
  {
    icon: BookOpen,
    label: 'Technical',
    count: 10,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    border: 'border-violet-200 dark:border-violet-800/40',
  },
  {
    icon: User,
    label: 'Account',
    count: 7,
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    border: 'border-pink-200 dark:border-pink-800/40',
  },
  {
    icon: Globe,
    label: 'Community',
    count: 5,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    border: 'border-cyan-200 dark:border-cyan-800/40',
  },
]

const faqs = [
  {
    q: 'How do I get started with Liner Dashboard?',
    a: 'Getting started is simple! After purchasing, extract the archive and run npm install followed by npm run dev. The dashboard will be available at localhost:5173. You can then customize the theme from the Settings Panel, connect your data sources, and configure navigation to match your project structure.',
    category: 'Getting Started',
  },
  {
    q: 'What technologies does Liner use?',
    a: 'Liner is built on a modern, production-grade stack: React 18, Vite 5, Tailwind CSS v3, React Router v6 for routing, Recharts for data visualization, and Lucide React for the icon system. All dependencies are actively maintained and chosen for their performance and developer experience.',
    category: 'Getting Started',
  },
  {
    q: 'Is Liner compatible with TypeScript?',
    a: 'While Liner ships as JavaScript by default, migrating to TypeScript is straightforward. Rename .jsx files to .tsx, install @types/react and @types/react-dom, and add a tsconfig.json. We plan to ship an official TypeScript variant in an upcoming major release.',
    category: 'Technical',
  },
  {
    q: 'How do I customize the color theme?',
    a: 'Liner supports multiple built-in color presets (Purple, Blue, Green, Orange, Red). Open the Settings Panel via the gear icon in the header to switch presets instantly. For fully custom branding, modify the CSS custom properties in src/index.css — each preset is defined as a set of --p-50 through --p-900 RGB values.',
    category: 'Features',
  },
  {
    q: 'Does Liner support dark mode?',
    a: "Yes — Liner has full, polished dark mode support using Tailwind's class-based strategy. Toggle it with the moon icon in the header or via the Settings Panel. Your preference is persisted in localStorage and respected on every page reload. Every single component has been carefully designed for both light and dark contexts.",
    category: 'Features',
  },
  {
    q: 'Can I use Liner for commercial projects?',
    a: 'Yes! The Regular License covers use in a single commercial end product. The Extended License covers unlimited end products and SaaS applications. Please review the full license agreement included in the download package for all permitted and prohibited uses.',
    category: 'Billing',
  },
  {
    q: 'How do I add new pages to the dashboard?',
    a: "Create a new .jsx file under src/pages/, export your default component, and register the route in src/router/index.jsx. Then add a corresponding navigation entry in src/components/layout/Sidebar.jsx with the route path, label, and a Lucide icon. Hot module reloading means you'll see changes instantly.",
    category: 'Technical',
  },
  {
    q: 'Is the dashboard fully mobile responsive?',
    a: 'Absolutely. Liner is built mobile-first throughout. The sidebar collapses to an animated slide-in drawer on small screens, data tables switch to a card layout on mobile, and all charts resize fluidly via Recharts ResponsiveContainer. We test against a comprehensive matrix of device sizes before every release.',
    category: 'Features',
  },
  {
    q: 'How do I update my billing information?',
    a: 'Navigate to Account Settings and open the Billing tab. From there you can update your payment method (credit card or PayPal), edit your billing address, download past invoices as PDFs, and manage your subscription tier. Changes to payment methods take effect on your next billing date.',
    category: 'Billing',
  },
  {
    q: 'What browsers are supported?',
    a: 'Liner supports all evergreen browsers: Chrome 90+, Firefox 88+, Safari 14+, and Edge 90+. Internet Explorer is explicitly not supported as it lacks the ES2020 features and CSS Grid capabilities that Liner depends on. Mobile Chrome and Safari on iOS are fully supported.',
    category: 'Technical',
  },
  {
    q: 'How can I reset my password?',
    a: "Click your profile avatar in the top-right header, select Account Settings, and navigate to the Security tab. Use the Change Password section to set a new password — you'll need to confirm your current password first. Alternatively, use the Forgot Password link on the Login page to receive a reset email.",
    category: 'Account',
  },
  {
    q: 'Is there a refund policy?',
    a: "Yes — we offer a 30-day money-back guarantee on all purchases. If you're not completely satisfied with Liner for any reason within 30 days of purchase, contact our support team with your order number and we'll process a full refund promptly, no questions asked.",
    category: 'Billing',
  },
]

const popularArticles = [
  {
    title: 'Setting up your first dashboard: a step-by-step guide',
    category: 'Getting Started',
    readTime: '5 min read',
    categoryColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  {
    title: 'Understanding the Tailwind theme system and color presets',
    category: 'Technical',
    readTime: '8 min read',
    categoryColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  {
    title: 'Upgrading, downgrading, and managing your subscription',
    category: 'Billing',
    readTime: '3 min read',
    categoryColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
]

const contactOptions = [
  {
    icon: MessageCircle,
    title: 'Live Chat',
    description: 'Chat with our support team in real time. Average response time under 2 minutes during business hours.',
    action: 'Start Chat',
    available: 'Available Mon–Fri, 9am–6pm EST',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    btnClass: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  },
  {
    icon: Mail,
    title: 'Email Support',
    description: 'Send us a detailed message and we\'ll get back to you within 24 hours with a thorough answer.',
    action: 'Send Email',
    available: 'Response within 24 hours',
    iconBg: 'bg-primary-100 dark:bg-primary-900/30',
    iconColor: 'text-primary-600 dark:text-primary-400',
    btnClass: 'bg-primary-500 hover:bg-primary-600 text-white',
  },
  {
    icon: Phone,
    title: 'Phone Support',
    description: 'Enterprise plan customers get dedicated phone support with a named account manager.',
    action: 'Call Us',
    available: 'Enterprise plan only',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    btnClass: 'bg-violet-500 hover:bg-violet-600 text-white',
  },
]

const quickLinks = [
  { label: 'Getting Started', icon: Zap, color: 'text-amber-500' },
  { label: 'Billing', icon: CreditCard, color: 'text-emerald-500' },
  { label: 'Technical', icon: Settings, color: 'text-violet-500' },
  { label: 'Account', icon: User, color: 'text-pink-500' },
]

export default function Faq() {
  const [openItem, setOpenItem] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = faqs.filter(f => {
    const matchCategory = activeCategory === 'All' || f.category === activeCategory
    const matchSearch = !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  return (
    <div>
      <PageHeader
        title="Help Center"
        subtitle="Find answers, guides, and resources to get the most from Liner Dashboard."
      />

      {/* ── Status banner ── */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="inline-flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold px-4 py-2 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          All systems operational
          <CheckCircle size={13} />
        </div>
      </div>

      {/* ── Hero section ── */}
      <div className="relative rounded-2xl overflow-hidden bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 p-10 mb-10 text-center">
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-52 h-52 bg-primary-200/30 dark:bg-primary-700/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-52 h-52 bg-violet-200/30 dark:bg-violet-700/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
            How can we{' '}
            <span className="text-primary-500">
              help you?
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-base mb-8 max-w-md mx-auto">
            Search our knowledge base or browse categories below to find the answer you need.
          </p>

          {/* Search bar */}
          <div className="relative max-w-lg mx-auto mb-8">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search for answers, guides, or topics..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 shadow-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-xs font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick link buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon
              return (
                <button
                  key={link.label}
                  onClick={() => { setActiveCategory(link.label); setSearch('') }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-card-md transition-all duration-150"
                >
                  <Icon size={15} className={link.color} />
                  {link.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Category cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {categoryCards.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.label}
              onClick={() => { setActiveCategory(cat.label); setSearch('') }}
              className={clsx(
                'card p-5 flex flex-col items-center gap-3 text-center hover:shadow-card-md hover:-translate-y-1 transition-all duration-200 cursor-pointer border',
                activeCategory === cat.label
                  ? 'ring-2 ring-primary-500 dark:ring-primary-400'
                  : cat.border
              )}
            >
              <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center', cat.bg)}>
                <Icon size={20} className={cat.color} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight">{cat.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{cat.count} articles</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Category filter pills ── */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium transition-all duration-150',
              activeCategory === cat
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600'
            )}
          >
            {cat}
            {cat !== 'All' && (
              <span className="ml-1.5 text-xs opacity-60">
                ({faqs.filter(f => f.category === cat).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── FAQ accordion ── */}
      <div className="max-w-3xl mx-auto space-y-3 mb-14">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <HelpCircle size={32} className="text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-bold mb-1">No results found</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              Try a different search term or{' '}
              <button onClick={() => { setActiveCategory('All'); setSearch('') }} className="text-primary-500 hover:underline font-medium">
                browse all categories
              </button>
            </p>
          </div>
        ) : (
          filtered.map((faq, i) => (
            <div key={i} className="card overflow-hidden transition-all duration-200">
              <button
                onClick={() => setOpenItem(openItem === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                  {faq.q}
                </span>
                <ChevronDown
                  size={18}
                  className={clsx(
                    'text-slate-400 shrink-0 transition-transform duration-200',
                    openItem === i && 'rotate-180'
                  )}
                />
              </button>
              {openItem === i && (
                <div className="px-5 pb-5 animate-fade-in">
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{faq.a}</p>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-full font-medium">
                      {faq.category}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Popular articles ── */}
      <div className="mb-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Popular Articles</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Most-read guides from our knowledge base</p>
          </div>
          <button className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 font-semibold hover:gap-2.5 transition-all duration-150">
            View all <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {popularArticles.map((article, i) => (
            <div key={i} className="card p-5 hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full', article.categoryColor)}>
                  {article.category}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{article.readTime}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug mb-4 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {article.title}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 font-semibold group-hover:gap-2.5 transition-all duration-150">
                Read article <ArrowRight size={13} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Contact support section ── */}
      <div className="mb-10">
        <div className="text-center mb-7">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-1">Still need help?</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Our support team is ready to assist you through any channel.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {contactOptions.map((opt) => {
            const Icon = opt.icon
            return (
              <div key={opt.title} className="card p-6 flex flex-col gap-4 hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-200">
                <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center', opt.iconBg)}>
                  <Icon size={24} className={opt.iconColor} />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{opt.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">{opt.description}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{opt.available}</p>
                </div>
                <button className={clsx(
                  'w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm hover:shadow-md',
                  opt.btnClass
                )}>
                  {opt.action}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
