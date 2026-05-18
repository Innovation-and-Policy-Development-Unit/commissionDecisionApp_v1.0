import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import clsx from 'clsx'
import {
  ChevronDown, HelpCircle, Settings, User, Lock, Package, Truck, RefreshCcw, Star,
  Zap, Globe, Code, Database, Rocket, BookOpen, FileText, CheckCircle, ArrowRight,
  Shield, Award, TrendingUp, Users, BarChart2, Terminal, GitBranch, Layers,
} from 'lucide-react'

// ─── Base AccordionItem ───────────────────────────────────────────────────────
function AccordionItem({
  title, content, icon: Icon, defaultOpen = false, bordered = false,
  colorBorder, gradientOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={clsx(
      'overflow-hidden transition-all duration-200',
      bordered && 'border border-slate-200 dark:border-slate-700 rounded-xl',
      colorBorder && `border-l-4 ${colorBorder} rounded-r-xl border border-slate-200 dark:border-slate-700`,
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full flex items-center gap-3 p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          gradientOpen && open
            ? 'bg-primary-500 text-white'
            : open
              ? colorBorder ? 'bg-slate-50 dark:bg-slate-800/60' : 'bg-primary-50 dark:bg-primary-900/10'
              : 'hover:bg-slate-50 dark:hover:bg-slate-700/30',
          !bordered && !colorBorder && 'border-b border-slate-200 dark:border-slate-700',
        )}
      >
        {Icon && (
          <Icon
            size={16}
            className={clsx('shrink-0', gradientOpen && open ? 'text-white' : 'text-primary-500')}
          />
        )}
        <span className={clsx('flex-1 font-medium text-sm', gradientOpen && open ? 'text-white' : 'text-slate-700 dark:text-slate-300')}>
          {title}
        </span>
        <ChevronDown
          size={16}
          className={clsx(
            'shrink-0 transition-transform duration-300',
            open ? 'rotate-180' : '',
            gradientOpen && open ? 'text-white' : 'text-slate-400',
          )}
        />
      </button>
      <div className={clsx(
        'text-sm text-slate-600 dark:text-slate-400 leading-relaxed overflow-hidden transition-all duration-300',
        open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
        !bordered && !colorBorder && open && 'border-b border-slate-200 dark:border-slate-700',
      )}>
        <div className="p-4">{content}</div>
      </div>
    </div>
  )
}

// ─── AccordionGroup (single or multi open) ────────────────────────────────────
function AccordionGroup({ items, multiple = false }) {
  const [openItems, setOpenItems] = useState(multiple ? [] : null)

  const toggle = (i) => {
    if (multiple) {
      setOpenItems(o => o.includes(i) ? o.filter(x => x !== i) : [...o, i])
    } else {
      setOpenItems(o => o === i ? null : i)
    }
  }

  const isOpen = (i) => multiple ? openItems.includes(i) : openItems === i

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => toggle(i)}
            className={clsx(
              'w-full flex items-center gap-3 p-4 text-left transition-colors focus:outline-none',
              isOpen(i) ? 'bg-primary-50 dark:bg-primary-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30',
            )}
          >
            <span className="flex-1 font-medium text-sm text-slate-700 dark:text-slate-300">{item.title}</span>
            <ChevronDown size={16} className={clsx('text-slate-400 transition-transform duration-200 shrink-0', isOpen(i) && 'rotate-180')} />
          </button>
          <div className={clsx(
            'text-sm text-slate-600 dark:text-slate-400 leading-relaxed overflow-hidden transition-all duration-300',
            isOpen(i) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
          )}>
            <div className="px-4 pb-4">{item.content}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const faqItems = [
  {
    title: 'What is the refund policy?',
    content: 'We offer a 30-day money-back guarantee on all products. If you\'re not satisfied for any reason, contact our support team within 30 days of purchase for a full refund — no questions asked.',
  },
  {
    title: 'How do I cancel my subscription?',
    content: 'You can cancel your subscription at any time from your account settings page. Navigate to Billing → Subscription and click Cancel Subscription. Your access continues until the end of the billing period.',
  },
  {
    title: 'Can I upgrade my plan at any time?',
    content: 'Yes, you can upgrade your plan at any time. The upgrade takes effect immediately and the price difference is prorated for the remaining billing period.',
  },
  {
    title: 'Is customer support available 24/7?',
    content: 'We provide email support 24/7 and live chat support during business hours (9 AM – 6 PM EST, Monday through Friday). Priority support is available on Enterprise plans.',
  },
]

const productFAQ = [
  { icon: Truck, title: 'How long does shipping take?', content: 'Standard shipping takes 5–7 business days. Express shipping (2–3 days) and overnight options are available at checkout. Free standard shipping on all orders over $50.' },
  { icon: RefreshCcw, title: 'What is your return policy?', content: 'We accept returns within 30 days of delivery for most items. Items must be unused, in original packaging, and accompanied by a receipt. Digital products are non-refundable.' },
  { icon: Package, title: 'How do I track my order?', content: 'Once your order ships, you\'ll receive a confirmation email with a tracking number. Visit our Order Tracking page or click the link in your email to see real-time updates.' },
  { icon: Star, title: 'Are products covered by warranty?', content: 'All hardware products come with a 1-year limited manufacturer warranty covering defects in materials and workmanship. Extended warranty plans are available at checkout.' },
  { icon: Lock, title: 'Is my payment information secure?', content: 'Yes. We use 256-bit SSL encryption and are PCI DSS Level 1 compliant. We never store raw card data on our servers — all payments are processed via Stripe.' },
  { icon: HelpCircle, title: 'How do I contact support?', content: 'You can reach our support team via live chat (bottom-right corner), email at support@example.com, or by calling 1-800-EXAMPLE on weekdays between 9 AM – 6 PM EST.' },
]

// ─── Sections ─────────────────────────────────────────────────────────────────

// 1. Basic Accordion
function BasicAccordionSection() {
  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Basic Accordion</h3>
        <p className="text-xs text-slate-500 mt-0.5">Standard FAQ-style. One item open at a time.</p>
      </div>
      <AccordionGroup
        items={[
          { title: 'What is the refund policy?', content: faqItems[0].content },
          { title: 'How do I cancel my subscription?', content: faqItems[1].content },
          { title: 'Can I upgrade my plan at any time?', content: faqItems[2].content },
          { title: 'Is customer support available 24/7?', content: faqItems[3].content },
        ]}
      />
    </div>
  )
}

// 2. Bordered Accordion
function BorderedAccordionSection() {
  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Bordered Accordion</h3>
        <p className="text-xs text-slate-500 mt-0.5">Each item is its own bordered card. Multiple can be open.</p>
      </div>
      <div className="space-y-2">
        <AccordionItem title="What is the refund policy?" content={faqItems[0].content} bordered defaultOpen />
        <AccordionItem title="How do I cancel my subscription?" content={faqItems[1].content} bordered />
        <AccordionItem title="Can I upgrade my plan?" content={faqItems[2].content} bordered />
        <AccordionItem title="Is support available 24/7?" content={faqItems[3].content} bordered />
      </div>
    </div>
  )
}

// 3. With Icons
function WithIconsSection() {
  const iconItems = [
    {
      icon: Settings,
      title: 'App Preferences',
      content: 'Customize your dashboard layout, widget arrangement, default views, color theme, and notification delivery channels to match your workflow.',
      iconColor: 'text-primary-500',
      bg: 'bg-primary-50 dark:bg-primary-900/20',
    },
    {
      icon: User,
      title: 'Profile Settings',
      content: 'Update your personal information, profile photo, display name, and public bio. Changes are reflected across all connected services within 5 minutes.',
      iconColor: 'text-violet-500',
      bg: 'bg-violet-50 dark:bg-violet-900/20',
    },
    {
      icon: Lock,
      title: 'Security Settings',
      content: 'Manage your password, enable two-factor authentication via app or SMS, review active sessions, and set up trusted device management.',
      iconColor: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      icon: HelpCircle,
      title: 'Help & Support',
      content: 'Access our comprehensive documentation, browse FAQs, submit a ticket, or start a live chat session with our support team during business hours.',
      iconColor: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
  ]

  const [open, setOpen] = useState(null)

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">With Colored Icons</h3>
        <p className="text-xs text-slate-500 mt-0.5">Each item has a unique colored icon for visual distinction.</p>
      </div>
      <div className="space-y-2">
        {iconItems.map((item, i) => (
          <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(o => o === i ? null : i)}
              className={clsx('w-full flex items-center gap-3 p-4 text-left transition-colors', open === i ? 'bg-slate-50 dark:bg-slate-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30')}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}>
                <item.icon size={15} className={item.iconColor} />
              </div>
              <span className="flex-1 font-medium text-sm text-slate-700 dark:text-slate-300">{item.title}</span>
              <ChevronDown size={16} className={clsx('text-slate-400 transition-transform duration-300 shrink-0', open === i && 'rotate-180')} />
            </button>
            <div className={clsx('overflow-hidden transition-all duration-300', open === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0')}>
              <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 4. Colored Accordion
function ColoredAccordionSection() {
  const [open, setOpen] = useState(0)
  const items = [
    { title: 'Primary — Feature Overview', color: 'border-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/10', text: 'text-primary-700 dark:text-primary-400', content: 'Explore the core features of our platform including real-time collaboration, advanced analytics dashboards, and automated workflow tools.' },
    { title: 'Emerald — Updates & Changelog', color: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-700 dark:text-emerald-400', content: 'Version 3.2 brings major performance improvements, a redesigned navigation menu, dark mode enhancements, and 12 new integrations.' },
    { title: 'Amber — Warnings & Notices', color: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10', text: 'text-amber-700 dark:text-amber-400', content: 'Scheduled maintenance window: Sunday 2–4 AM UTC. The API and webhooks may be intermittently unavailable during this period.' },
    { title: 'Red — Critical Alerts', color: 'border-red-500', bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-700 dark:text-red-400', content: 'Please rotate your API keys immediately if you received an email about a potential credential exposure. No user data was compromised.' },
  ]

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Colored Left-Border Accordion</h3>
        <p className="text-xs text-slate-500 mt-0.5">Semantic colors with colored open state.</p>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className={`border border-slate-200 dark:border-slate-700 border-l-4 ${item.color} rounded-r-xl overflow-hidden`}>
            <button
              onClick={() => setOpen(o => o === i ? null : i)}
              className={clsx('w-full flex items-center gap-3 p-4 text-left transition-colors', open === i ? item.bg : 'hover:bg-slate-50 dark:hover:bg-slate-800/30')}
            >
              <span className={clsx('flex-1 font-medium text-sm', open === i ? item.text : 'text-slate-700 dark:text-slate-300')}>{item.title}</span>
              <ChevronDown size={16} className={clsx('transition-transform duration-300 shrink-0', open === i ? item.text : 'text-slate-400', open === i && 'rotate-180')} />
            </button>
            <div className={clsx('overflow-hidden transition-all duration-300', open === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0')}>
              <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 5. Nested Accordion
function NestedAccordionSection() {
  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Nested Accordion</h3>
        <p className="text-xs text-slate-500 mt-0.5">A secondary accordion inside one of the parent items.</p>
      </div>
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
        <AccordionItem
          title="Infrastructure Settings"
          content={
            <div className="space-y-2 mt-1">
              <p className="text-sm text-slate-500 mb-3">Expand a sub-section to configure individual components.</p>
              <AccordionItem
                title="Database Configuration"
                content={
                  <div className="space-y-2 text-xs">
                    <p>Configure PostgreSQL connection pool, max connections (default 100), idle timeout (30s), and statement timeout (60s).</p>
                    <div className="bg-slate-900 rounded-lg p-3 font-mono text-slate-200 text-[11px]">
                      {'DB_HOST=localhost\nDB_PORT=5432\nDB_POOL_SIZE=20'}
                    </div>
                  </div>
                }
                bordered
              />
              <AccordionItem
                title="Cache & Redis"
                content="Configure Redis cache TTL (default 3600s), max memory limit (256MB), eviction policy (allkeys-lru), and persistence mode."
                bordered
              />
              <AccordionItem
                title="API Rate Limiting"
                content="Set global rate limit (1000 req/min), per-IP limit (60 req/min), burst allowance (20 extra), and whitelist trusted IPs for higher limits."
                bordered
              />
            </div>
          }
        />
        <AccordionItem
          title="Integration Settings"
          content={
            <div className="space-y-2 mt-1">
              <p className="text-sm text-slate-500 mb-3">Configure third-party integrations and webhooks.</p>
              <AccordionItem
                title="Webhook Configuration"
                content="Set up outgoing webhooks for real-time event notifications. Supports HMAC signature verification and configurable retry logic (up to 5 retries with exponential backoff)."
                bordered
              />
              <AccordionItem
                title="OAuth 2.0 Providers"
                content="Configure Google, GitHub, Microsoft, and custom OAuth 2.0 providers. Manage client IDs, secrets, scopes, and redirect URIs from this panel."
                bordered
              />
              <AccordionItem
                title="SAML / SSO"
                content="Enterprise SSO via SAML 2.0. Supports Okta, Azure AD, and any IdP. Configure IdP metadata URL, attribute mapping, and JIT provisioning."
                bordered
              />
            </div>
          }
        />
        <AccordionItem
          title="Monitoring & Alerting"
          content="Set up health checks, uptime monitoring, and alert thresholds. Integrates with PagerDuty, Slack, and email for incident escalation."
        />
      </div>
    </div>
  )
}

// 6. Custom Styled — Gradient Header
function CustomStyledSection() {
  const [open, setOpen] = useState(null)
  const items = [
    { title: 'What makes Liner different?', content: 'Liner combines a powerful design system with developer-friendly APIs. Every component is built with accessibility in mind, supports dark mode out of the box, and is fully customizable via Tailwind CSS utility classes.' },
    { title: 'Does it support TypeScript?', content: 'Yes, Liner ships with full TypeScript definitions. All components, props, and hooks are typed, giving you complete IntelliSense support in VS Code and other editors.' },
    { title: 'Can I use it in existing projects?', content: 'Absolutely. Liner is designed to be incrementally adoptable. You can start with a single component and expand usage over time. It works alongside other component libraries without conflicts.' },
    { title: 'What\'s on the roadmap?', content: 'Upcoming features include a data table with sorting and virtual scrolling, a rich text editor component, drag-and-drop layouts, and a comprehensive charting library integration.' },
  ]

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Custom Styled — Gradient Header</h3>
        <p className="text-xs text-slate-500 mt-0.5">Gradient background on open state with animated chevron.</p>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setOpen(o => o === i ? null : i)}
              className={clsx(
                'w-full flex items-center justify-between p-4 text-left transition-all duration-300',
                open === i
                  ? 'bg-primary-500'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750',
              )}
            >
              <span className={clsx('font-semibold text-sm', open === i ? 'text-white' : 'text-slate-700 dark:text-slate-300')}>
                {item.title}
              </span>
              <ChevronDown
                size={18}
                className={clsx(
                  'shrink-0 transition-transform duration-500',
                  open === i ? 'rotate-180 text-white' : 'text-slate-400',
                )}
              />
            </button>
            <div className={clsx('overflow-hidden transition-all duration-400', open === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0')}>
              <p className="p-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-primary-50 dark:bg-primary-900/10">
                {item.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 7. Product FAQ
function ProductFAQSection() {
  const [open, setOpen] = useState(null)

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Product FAQ</h3>
          <p className="text-xs text-slate-500 mt-0.5">Common questions about our products and services</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
          {productFAQ.length} questions
        </span>
      </div>

      <div className="space-y-2">
        {productFAQ.map((item, i) => (
          <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(o => o === i ? null : i)}
              className={clsx(
                'w-full flex items-center gap-3 p-4 text-left transition-colors',
                open === i ? 'bg-slate-50 dark:bg-slate-800/60' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
              )}
            >
              <div className={clsx(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                open === i ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-slate-100 dark:bg-slate-700',
              )}>
                <item.icon size={14} className={open === i ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'} />
              </div>
              <span className={clsx(
                'flex-1 font-medium text-sm transition-colors',
                open === i ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300',
              )}>
                {item.title}
              </span>
              <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all', open === i ? 'bg-primary-100 dark:bg-primary-900/40' : '')}>
                <ChevronDown size={14} className={clsx('transition-transform duration-300 text-slate-400', open === i && 'rotate-180 text-primary-500')} />
              </div>
            </button>
            <div className={clsx('overflow-hidden transition-all duration-300', open === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0')}>
              <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <p className="text-xs text-slate-500">Still have questions?</p>
        <button className="btn btn-primary text-xs py-2">Contact Support</button>
      </div>
    </div>
  )
}

// ─── NEW SECTIONS ─────────────────────────────────────────────────────────────

// 8. Flush / No Border Style
function FlushAccordionSection() {
  const [open, setOpen] = useState(null)
  const items = [
    {
      icon: Zap,
      title: 'Instant deployment with zero configuration',
      content: 'Our platform detects your framework automatically and configures the optimal build pipeline. Node.js, Python, Go, Ruby — all supported with sensible defaults you can override at any time.',
    },
    {
      icon: Globe,
      title: 'Global edge network with 200+ PoPs',
      content: 'Your application is distributed across 200+ points of presence worldwide. Static assets are cached at the edge and served with sub-10ms latency to 95% of the world\'s internet users.',
    },
    {
      icon: Shield,
      title: 'Enterprise-grade security built in',
      content: 'Every deployment automatically gets DDoS protection, WAF rules, SSL/TLS certificates, and secret scanning. SOC 2 Type II certified with GDPR and HIPAA compliance options.',
    },
    {
      icon: BarChart2,
      title: 'Real-time observability and analytics',
      content: 'Stream logs, traces, and metrics in real time. Set custom alerts on latency, error rate, or any business metric. Integrates natively with Datadog, New Relic, and Grafana.',
    },
    {
      icon: GitBranch,
      title: 'Git-native workflow with preview environments',
      content: 'Every pull request gets its own preview URL. Run automated tests, share with stakeholders, and merge with confidence. Full rollback to any previous deployment in one click.',
    },
  ]

  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Flush / No Border Style</h3>
        <p className="text-xs text-slate-500 mt-0.5">Minimal divider-only style — no card borders, clean and spacious.</p>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {items.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(o => o === i ? null : i)}
              className="w-full flex items-center gap-3 py-4 text-left group focus:outline-none"
            >
              <div className={clsx(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200',
                open === i
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-500',
              )}>
                <item.icon size={15} />
              </div>
              <span className={clsx(
                'flex-1 font-medium text-sm transition-colors',
                open === i ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100',
              )}>
                {item.title}
              </span>
              <ChevronDown
                size={16}
                className={clsx(
                  'shrink-0 transition-transform duration-300',
                  open === i ? 'rotate-180 text-primary-500' : 'text-slate-300 dark:text-slate-600',
                )}
              />
            </button>
            <div className={clsx('overflow-hidden transition-all duration-300', open === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0')}>
              <p className="pb-4 pl-12 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {item.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 9. Colored Accent Headers
function ColoredAccentSection() {
  const [open, setOpen] = useState(0)

  const accents = [
    {
      color: 'border-primary-500',
      headerOpen: 'bg-primary-50 dark:bg-primary-900/20',
      iconBg: 'bg-primary-100 dark:bg-primary-900/40',
      iconColor: 'text-primary-600 dark:text-primary-400',
      titleOpen: 'text-primary-700 dark:text-primary-300',
      badgeBg: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
      icon: Rocket,
      badge: 'New',
      title: 'Rocket Launches — Deploy in seconds',
      content: 'Push your code and watch it deploy globally in under 30 seconds. Our build system runs in parallel across multiple regions, ensuring the fastest possible cold start times.',
    },
    {
      color: 'border-emerald-500',
      headerOpen: 'bg-emerald-50 dark:bg-emerald-900/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      titleOpen: 'text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
      icon: CheckCircle,
      badge: 'Stable',
      title: 'Zero-downtime deployments guaranteed',
      content: 'Traffic is shifted to new instances only after health checks pass. Automatic rollback triggers if error rate spikes above your defined threshold within the first 5 minutes post-deploy.',
    },
    {
      color: 'border-amber-500',
      headerOpen: 'bg-amber-50 dark:bg-amber-900/20',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      titleOpen: 'text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
      icon: Zap,
      badge: 'Beta',
      title: 'Serverless functions with cold-start < 5ms',
      content: 'Our V8 isolate runtime keeps functions warm without dedicated VMs. Write standard JavaScript, TypeScript, or WebAssembly — functions spin up in under 5ms anywhere in the world.',
    },
    {
      color: 'border-rose-500',
      headerOpen: 'bg-rose-50 dark:bg-rose-900/20',
      iconBg: 'bg-rose-100 dark:bg-rose-900/40',
      iconColor: 'text-rose-600 dark:text-rose-400',
      titleOpen: 'text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
      icon: Database,
      badge: 'Preview',
      title: 'Edge-native key-value and SQL storage',
      content: 'Store and query data at the edge with sub-millisecond reads. Our distributed KV store replicates synchronously to 5 regions and provides strong consistency for writes.',
    },
  ]

  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Colored Accent Headers</h3>
        <p className="text-xs text-slate-500 mt-0.5">Left border accent in primary, emerald, amber, and rose with matching open state colors.</p>
      </div>
      <div className="space-y-2">
        {accents.map((item, i) => (
          <div
            key={i}
            className={clsx(
              'border border-slate-200 dark:border-slate-700 border-l-4 rounded-r-xl overflow-hidden transition-all duration-200',
              item.color,
            )}
          >
            <button
              onClick={() => setOpen(o => o === i ? null : i)}
              className={clsx(
                'w-full flex items-center gap-3 p-4 text-left transition-colors duration-200',
                open === i ? item.headerOpen : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
              )}
            >
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', item.iconBg)}>
                <item.icon size={14} className={item.iconColor} />
              </div>
              <span className={clsx(
                'flex-1 font-semibold text-sm transition-colors',
                open === i ? item.titleOpen : 'text-slate-700 dark:text-slate-300',
              )}>
                {item.title}
              </span>
              <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full mr-2', item.badgeBg)}>
                {item.badge}
              </span>
              <ChevronDown
                size={15}
                className={clsx(
                  'shrink-0 transition-transform duration-300 text-slate-400',
                  open === i && 'rotate-180',
                )}
              />
            </button>
            <div className={clsx('overflow-hidden transition-all duration-300', open === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0')}>
              <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 10. Rich Content Accordion
function RichContentAccordionSection() {
  const [open, setOpen] = useState(0)

  const items = [
    {
      icon: TrendingUp,
      title: 'Platform Performance Overview',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Our platform achieved record performance metrics in Q1 2026, with latency dropping 42% year-over-year and throughput reaching 2.4M requests per second at peak load.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Avg Latency', value: '8.2ms', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
              { label: 'Uptime SLA', value: '99.99%', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Req/sec', value: '2.4M', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
              { label: 'Error Rate', value: '0.003%', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            ].map(stat => (
              <div key={stat.label} className={clsx('rounded-xl p-3 text-center', stat.bg)}>
                <p className={clsx('text-lg font-bold', stat.color)}>{stat.value}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[
              { label: 'CDN Cache Hit Rate', pct: 94 },
              { label: 'Build Success Rate', pct: 99 },
              { label: 'Test Coverage', pct: 87 },
            ].map(bar => (
              <div key={bar.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">{bar.label}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{bar.pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all duration-700" style={{ width: `${bar.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: Users,
      title: 'Team & Collaboration Features',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Built for teams of every size — from solo developers to enterprise engineering organizations with thousands of contributors.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: CheckCircle, text: 'Fine-grained role-based access control (RBAC)' },
              { icon: CheckCircle, text: 'Audit logs for every action across all resources' },
              { icon: CheckCircle, text: 'Real-time collaborative editing with conflict resolution' },
              { icon: CheckCircle, text: 'SSO via SAML 2.0, Okta, Azure AD, and Google Workspace' },
              { icon: CheckCircle, text: 'Team-scoped secrets and environment variables' },
              { icon: CheckCircle, text: 'Slack and Teams integration with smart notifications' },
            ].map((f, j) => (
              <div key={j} className="flex items-start gap-2">
                <f.icon size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">{f.text}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <div className="flex -space-x-2">
              {['bg-primary-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-violet-400'].map((c, j) => (
                <div key={j} className={`w-7 h-7 rounded-full border-2 border-white dark:border-slate-800 ${c}`} />
              ))}
            </div>
            <span className="text-xs text-slate-500">+2,840 teams already onboard</span>
          </div>
        </div>
      ),
    },
    {
      icon: Code,
      title: 'Developer Experience & Tooling',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            First-class CLI, SDKs for every major language, and deep IDE integration make it a pleasure to build on our platform from day one.
          </p>
          <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 font-mono text-[12px] space-y-1.5">
            <p className="text-slate-500"># Install the CLI</p>
            <p className="text-emerald-400">npm install -g @liner/cli</p>
            <p className="text-slate-500 mt-2"># Initialize a new project</p>
            <p className="text-emerald-400">liner init my-app --template nextjs</p>
            <p className="text-slate-500 mt-2"># Deploy to production</p>
            <p className="text-emerald-400">liner deploy --env production</p>
            <p className="text-slate-400 mt-1">✓ Build completed in 12.4s</p>
            <p className="text-slate-400">✓ Deployed to 12 regions</p>
            <p className="text-primary-400">→ https://my-app.liner.app</p>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Rich Content Accordion</h3>
        <p className="text-xs text-slate-500 mt-0.5">Accordion panels with stats grids, checklists, avatars, and code blocks inside.</p>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(o => o === i ? null : i)}
              className={clsx(
                'w-full flex items-center gap-3 p-4 text-left transition-colors',
                open === i ? 'bg-slate-50 dark:bg-slate-800/60' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
              )}
            >
              <div className={clsx(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                open === i ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-500',
              )}>
                <item.icon size={16} />
              </div>
              <span className={clsx('flex-1 font-semibold text-sm', open === i ? 'text-slate-800 dark:text-slate-200' : 'text-slate-700 dark:text-slate-300')}>
                {item.title}
              </span>
              <ChevronDown
                size={16}
                className={clsx('shrink-0 transition-transform duration-300 text-slate-400', open === i && 'rotate-180')}
              />
            </button>
            <div className={clsx('overflow-hidden transition-all duration-300', open === i ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0')}>
              <div className="px-4 pb-4 pt-1">{item.content}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 11. Step-by-Step Guide (Stepper Accordion)
function StepperAccordionSection() {
  const [open, setOpen] = useState(0)

  const steps = [
    {
      num: '01',
      color: 'bg-primary-500',
      ring: 'ring-primary-200 dark:ring-primary-800',
      textColor: 'text-primary-600 dark:text-primary-400',
      borderColor: 'border-primary-200 dark:border-primary-800',
      icon: Rocket,
      title: 'Create your account',
      subtitle: '2 minutes · Free forever',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Sign up with your email or continue with GitHub, Google, or GitLab. No credit card required. Your account is provisioned instantly with a starter workspace.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {['Sign up free', 'Continue with GitHub', 'Continue with Google'].map((btn, j) => (
              <div key={j} className="border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-xs text-center text-slate-600 dark:text-slate-400 font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                {btn}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle size={12} className="text-emerald-500" />
            <span>No credit card required · Free plan includes 3 projects</span>
          </div>
        </div>
      ),
    },
    {
      num: '02',
      color: 'bg-emerald-500',
      ring: 'ring-emerald-200 dark:ring-emerald-800',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      icon: Globe,
      title: 'Connect your repository',
      subtitle: '1 minute · Supports GitHub, GitLab, Bitbucket',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Install the Liner GitHub App or connect via OAuth. We request only the minimum permissions needed — read access to selected repositories.
          </p>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 space-y-1.5">
            {['Select organization or personal account', 'Choose repositories to grant access', 'Authorize Liner GitHub App', 'Import your first repository'].map((s, j) => (
              <div key={j} className="flex items-center gap-2 text-xs">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${j < 2 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  {j < 2 ? '✓' : j + 1}
                </div>
                <span className={j < 2 ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70' : 'text-slate-600 dark:text-slate-400'}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      num: '03',
      color: 'bg-amber-500',
      ring: 'ring-amber-200 dark:ring-amber-800',
      textColor: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-amber-200 dark:border-amber-800',
      icon: Settings,
      title: 'Configure your project',
      subtitle: '3 minutes · Auto-detected for most frameworks',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Liner auto-detects your framework and suggests optimal settings. Review and adjust build commands, output directory, environment variables, and region preferences.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Framework', value: 'Next.js 14' },
              { label: 'Node Version', value: '20.x LTS' },
              { label: 'Build Command', value: 'npm run build' },
              { label: 'Output Dir', value: '.next' },
              { label: 'Root Dir', value: '/' },
              { label: 'Install Cmd', value: 'npm install' },
            ].map(f => (
              <div key={f.label} className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2">
                <p className="text-slate-400 text-[10px]">{f.label}</p>
                <p className="font-mono text-slate-700 dark:text-slate-300 font-medium">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      num: '04',
      color: 'bg-violet-500',
      ring: 'ring-violet-200 dark:ring-violet-800',
      textColor: 'text-violet-600 dark:text-violet-400',
      borderColor: 'border-violet-200 dark:border-violet-800',
      icon: CheckCircle,
      title: 'Deploy and go live',
      subtitle: '< 30 seconds · Automatic on every push',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Click "Deploy" and your project goes live in seconds. Every subsequent push to your main branch triggers an automatic deployment. Preview deployments are created for all pull requests.
          </p>
          <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-3 font-mono text-[11px] space-y-1">
            <p className="text-slate-500">[liner] Building project...</p>
            <p className="text-slate-400">[liner] Installing dependencies... 8.2s</p>
            <p className="text-slate-400">[liner] Running build... 14.1s</p>
            <p className="text-slate-400">[liner] Uploading artifacts... 2.8s</p>
            <p className="text-emerald-400">[liner] ✓ Deploy complete! Total: 25.1s</p>
            <p className="text-primary-400">[liner] → https://my-app.liner.app</p>
          </div>
          <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-violet-500/25">
            <Rocket size={14} />
            Deploy your first project
            <ArrowRight size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Getting Started Guide</h3>
          <p className="text-xs text-slate-500 mt-0.5">Accordion used as a numbered stepper — expand each step to reveal details.</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          4 steps · ~6 min
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={clsx(
              'border rounded-2xl overflow-hidden transition-all duration-200',
              open === i ? step.borderColor : 'border-slate-200 dark:border-slate-700',
            )}
          >
            <button
              onClick={() => setOpen(o => o === i ? null : i)}
              className={clsx(
                'w-full flex items-center gap-4 p-4 text-left transition-colors',
                open === i ? 'bg-slate-50 dark:bg-slate-800/60' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
              )}
            >
              {/* Step number badge */}
              <div className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm text-white ring-4 transition-all duration-200',
                step.color,
                open === i ? step.ring : 'ring-transparent',
              )}>
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className={clsx('font-semibold text-sm', open === i ? 'text-slate-800 dark:text-slate-200' : 'text-slate-700 dark:text-slate-300')}>
                  {step.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{step.subtitle}</p>
              </div>
              <step.icon size={16} className={clsx('shrink-0 mr-1', open === i ? step.textColor : 'text-slate-300 dark:text-slate-600')} />
              <ChevronDown
                size={15}
                className={clsx('shrink-0 transition-transform duration-300 text-slate-400', open === i && 'rotate-180')}
              />
            </button>
            <div className={clsx('overflow-hidden transition-all duration-300', open === i ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0')}>
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                {step.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 12. Animated Accordion with smooth height + rotating icons
function AnimatedAccordionSection() {
  const [openSet, setOpenSet] = useState(new Set([0]))

  const toggle = (i) => {
    setOpenSet(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const items = [
    {
      icon: Layers,
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      accentBar: 'bg-indigo-500',
      title: 'Component Architecture',
      tag: 'Core',
      tagBg: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
      content: 'Liner\'s component architecture is built on a layered system of primitives, composites, and patterns. Primitives are unstyled base elements. Composites combine primitives into higher-level UI constructs. Patterns are opinionated solutions for common UX problems like infinite scroll, drag-and-drop, and multi-step forms.',
    },
    {
      icon: Terminal,
      iconBg: 'bg-slate-100 dark:bg-slate-700',
      iconColor: 'text-slate-600 dark:text-slate-300',
      accentBar: 'bg-slate-500',
      title: 'CLI & Build Tooling',
      tag: 'DevOps',
      tagBg: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
      content: 'The Liner CLI provides scaffolding, code generation, and deployment commands. Built on esbuild and Rollup, the build system produces optimized bundles with tree-shaking, code splitting, and automatic asset fingerprinting. First-class support for monorepos via workspaces.',
    },
    {
      icon: BookOpen,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      accentBar: 'bg-amber-500',
      title: 'Documentation & Storybook',
      tag: 'Docs',
      tagBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      content: 'Every component ships with interactive Storybook stories, prop tables, accessibility notes, and copy-paste code snippets. The documentation site is built with MDX and automatically updates when component APIs change. Inline live editors let you experiment without leaving the browser.',
    },
    {
      icon: Award,
      iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
      accentBar: 'bg-rose-500',
      title: 'Accessibility & Compliance',
      tag: 'A11y',
      tagBg: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
      content: 'All components meet WCAG 2.1 AA standards. Keyboard navigation, screen reader announcements, focus management, and color contrast ratios are tested in CI using axe-core and jest-axe. WAI-ARIA patterns are implemented per the ARIA Authoring Practices Guide.',
    },
    {
      icon: FileText,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      accentBar: 'bg-emerald-500',
      title: 'Licensing & Open Source',
      tag: 'Legal',
      tagBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
      content: 'The core component library is MIT licensed and free to use in commercial projects. The pro tier unlocks advanced components, themes, and priority support. Enterprise licenses include source access, SLA, and dedicated engineering support.',
    },
  ]

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Animated Accordion</h3>
          <p className="text-xs text-slate-500 mt-0.5">Smooth max-height animation, rotating icons, multiple open at once.</p>
        </div>
        <button
          onClick={() => setOpenSet(openSet.size === items.length ? new Set() : new Set(items.map((_, i) => i)))}
          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          {openSet.size === items.length ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => {
          const isOpen = openSet.has(i)
          return (
            <div
              key={i}
              className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => toggle(i)}
                className={clsx(
                  'w-full flex items-center gap-3 p-4 text-left transition-all duration-200',
                  isOpen ? 'bg-slate-50 dark:bg-slate-800/60' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20',
                )}
              >
                {/* Color accent bar */}
                <div className={clsx('w-1 h-8 rounded-full shrink-0 transition-all duration-300', item.accentBar, isOpen ? 'opacity-100' : 'opacity-30')} />
                <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', item.iconBg)}>
                  <item.icon size={16} className={item.iconColor} />
                </div>
                <span className="flex-1 font-semibold text-sm text-slate-700 dark:text-slate-300">{item.title}</span>
                <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full hidden sm:block', item.tagBg)}>{item.tag}</span>
                <div className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center ml-1 transition-all duration-300',
                  isOpen ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-slate-100 dark:bg-slate-700',
                )}>
                  <ChevronDown
                    size={13}
                    className={clsx('transition-transform duration-500', isOpen ? 'rotate-180 text-primary-500' : 'text-slate-400')}
                  />
                </div>
              </button>
              <div className={clsx('overflow-hidden transition-all duration-500', isOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0')}>
                <div className="px-4 pb-4 pt-0">
                  <div className="pl-[calc(0.25rem+2.25rem+0.75rem)]">
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.content}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 13. Premium Card Accordion
function PremiumCardAccordionSection() {
  const [open, setOpen] = useState(null)

  const cards = [
    {
      icon: Rocket,
      iconGradient: 'bg-primary-500',
      glowColor: 'shadow-primary-500/20',
      title: 'Starter Plan',
      subtitle: '$0 / month · Up to 3 projects',
      badge: 'Free',
      badgeBg: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
      headerGradient: 'bg-primary-500',
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {['3 projects', '10 GB bandwidth', '100 GB storage', 'SSL certificates', 'Custom domains', 'Community support'].map(f => (
              <div key={f} className="flex items-center gap-1.5">
                <CheckCircle size={11} className="text-emerald-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">{f}</span>
              </div>
            ))}
          </div>
          <button className="w-full py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-colors">
            Get started for free
          </button>
        </div>
      ),
    },
    {
      icon: Zap,
      iconGradient: 'bg-violet-500',
      glowColor: 'shadow-violet-500/20',
      title: 'Pro Plan',
      subtitle: '$29 / month · Unlimited projects',
      badge: 'Popular',
      badgeBg: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
      headerGradient: 'bg-violet-500',
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {['Unlimited projects', '1 TB bandwidth', '500 GB storage', 'Priority support', 'Team of 5', 'Analytics dashboard', 'Custom integrations', 'Preview deploys', 'Serverless functions'].map(f => (
              <div key={f} className="flex items-center gap-1.5">
                <CheckCircle size={11} className="text-violet-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">{f}</span>
              </div>
            ))}
          </div>
          <button className="w-full py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all shadow-md shadow-violet-500/25">
            Upgrade to Pro
          </button>
        </div>
      ),
    },
    {
      icon: Award,
      iconGradient: 'bg-amber-500',
      glowColor: 'shadow-amber-500/20',
      title: 'Enterprise Plan',
      subtitle: 'Custom pricing · Unlimited everything',
      badge: 'Enterprise',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
      headerGradient: 'bg-amber-500',
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {['Unlimited everything', 'Dedicated cluster', '99.99% SLA', 'SAML / SSO', 'Custom contracts', 'HIPAA & SOC 2', '24/7 phone support', 'Onboarding sessions', 'Source access'].map(f => (
              <div key={f} className="flex items-center gap-1.5">
                <CheckCircle size={11} className="text-amber-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-400">{f}</span>
              </div>
            ))}
          </div>
          <button className="w-full py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shadow-md shadow-amber-500/25">
            Contact sales
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="card p-6">
      <div className="mb-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Premium Card Accordion</h3>
        <p className="text-xs text-slate-500 mt-0.5">Cards with gradient headers on open, drop shadows, and rich plan content inside.</p>
      </div>
      <div className="space-y-4">
        {cards.map((card, i) => (
          <div
            key={i}
            className={clsx(
              'rounded-2xl overflow-hidden border transition-all duration-300',
              open === i
                ? 'border-transparent shadow-xl ' + card.glowColor
                : 'border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md',
            )}
          >
            {/* Card header */}
            <button
              onClick={() => setOpen(o => o === i ? null : i)}
              className={clsx(
                'w-full flex items-center gap-4 p-5 text-left transition-all duration-300',
                open === i
                  ? `${card.headerGradient}`
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80',
              )}
            >
              {/* Icon circle */}
              <div className={clsx(
                'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
                open === i
                  ? 'bg-white/20 backdrop-blur-sm shadow-inner'
                  : `${card.iconGradient} shadow-md`,
              )}>
                <card.icon size={18} className={open === i ? 'text-white' : 'text-white'} />
              </div>
              {/* Title block */}
              <div className="flex-1 min-w-0">
                <p className={clsx('font-bold text-sm', open === i ? 'text-white' : 'text-slate-800 dark:text-slate-200')}>
                  {card.title}
                </p>
                <p className={clsx('text-xs mt-0.5', open === i ? 'text-white/75' : 'text-slate-400')}>
                  {card.subtitle}
                </p>
              </div>
              {/* Badge */}
              <span className={clsx(
                'text-[10px] font-bold px-2.5 py-1 rounded-full mr-1',
                open === i ? 'bg-white/20 text-white' : card.badgeBg,
              )}>
                {card.badge}
              </span>
              {/* Chevron */}
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300',
                open === i ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700',
              )}>
                <ChevronDown
                  size={14}
                  className={clsx('transition-transform duration-400', open === i ? 'rotate-180 text-white' : 'text-slate-400')}
                />
              </div>
            </button>
            {/* Card body */}
            <div className={clsx('overflow-hidden transition-all duration-400', open === i ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0')}>
              <div className="p-5 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/50">
                {card.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AccordionPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Accordion" subtitle="Collapsible content panels — FAQ, settings, nested, colored, stepper, animated, and premium card variants" />

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BasicAccordionSection />
        <BorderedAccordionSection />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WithIconsSection />
        <ColoredAccordionSection />
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NestedAccordionSection />
        <CustomStyledSection />
      </div>

      {/* Row 4 — Full width */}
      <ProductFAQSection />

      {/* Row 5 — New sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FlushAccordionSection />
        <ColoredAccentSection />
      </div>

      {/* Row 6 — Rich content + Stepper */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RichContentAccordionSection />
        <StepperAccordionSection />
      </div>

      {/* Row 7 — Animated + Premium Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatedAccordionSection />
        <PremiumCardAccordionSection />
      </div>
    </div>
  )
}
