import { useState, Fragment } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Check, X, Zap, Star, Building2, Users, Shield, Clock, ChevronDown, ArrowRight, Headphones, Globe } from 'lucide-react'
import clsx from 'clsx'

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    desc: 'Perfect for individuals and small side projects getting off the ground.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    color: 'bg-slate-500',
    cta: 'Get Started Free',
    ctaVariant: 'secondary',
    featured: false,
    features: [
      { text: '5 Projects', included: true },
      { text: '10 GB Storage', included: true },
      { text: 'Up to 5 Team Members', included: true },
      { text: 'Basic Analytics Dashboard', included: true },
      { text: 'Email Support (48h response)', included: true },
      { text: 'Advanced Charts & Reports', included: false },
      { text: 'Custom Domain', included: false },
      { text: 'REST API Access', included: false },
      { text: 'Priority Support', included: false },
      { text: 'White Labeling', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Star,
    desc: 'Ideal for growing teams that need more power and collaboration tools.',
    monthlyPrice: 29,
    yearlyPrice: 23,
    color: 'bg-primary-500',
    cta: 'Start Free Trial',
    ctaVariant: 'primary',
    featured: true,
    badge: 'Most Popular',
    features: [
      { text: 'Unlimited Projects', included: true },
      { text: '100 GB Storage', included: true },
      { text: 'Up to 25 Team Members', included: true },
      { text: 'Advanced Analytics Dashboard', included: true },
      { text: 'Priority Email Support (4h response)', included: true },
      { text: 'Advanced Charts & Reports', included: true },
      { text: 'Custom Domain', included: true },
      { text: 'REST API Access', included: true },
      { text: 'Priority Support', included: false },
      { text: 'White Labeling', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Building2,
    desc: 'For large organizations with advanced security, compliance, and scale needs.',
    monthlyPrice: 99,
    yearlyPrice: 79,
    color: 'bg-cyan-500',
    cta: 'Contact Sales',
    ctaVariant: 'info',
    featured: false,
    features: [
      { text: 'Unlimited Projects', included: true },
      { text: 'Unlimited Storage', included: true },
      { text: 'Unlimited Team Members', included: true },
      { text: 'Advanced Analytics Dashboard', included: true },
      { text: '24/7 Dedicated Phone Support', included: true },
      { text: 'Advanced Charts & Reports', included: true },
      { text: 'Custom Domain', included: true },
      { text: 'Full REST & GraphQL API', included: true },
      { text: 'Priority Support (SLA)', included: true },
      { text: 'White Labeling', included: true },
    ],
  },
]

const comparisonCategories = [
  {
    label: 'Core Features',
    rows: [
      { feature: 'Projects', starter: '5', pro: 'Unlimited', enterprise: 'Unlimited' },
      { feature: 'Storage', starter: '10 GB', pro: '100 GB', enterprise: 'Unlimited' },
      { feature: 'Team Members', starter: '5', pro: '25', enterprise: 'Unlimited' },
      { feature: 'Custom Domain', starter: false, pro: true, enterprise: true },
    ],
  },
  {
    label: 'Analytics',
    rows: [
      { feature: 'Basic Analytics', starter: true, pro: true, enterprise: true },
      { feature: 'Advanced Reports', starter: false, pro: true, enterprise: true },
      { feature: 'Data Export (CSV/PDF)', starter: false, pro: true, enterprise: true },
      { feature: 'Real-time Dashboards', starter: false, pro: true, enterprise: true },
    ],
  },
  {
    label: 'Support',
    rows: [
      { feature: 'Email Support', starter: true, pro: true, enterprise: true },
      { feature: 'Priority Support', starter: false, pro: false, enterprise: true },
      { feature: '24/7 Phone Support', starter: false, pro: false, enterprise: true },
      { feature: 'Dedicated Account Manager', starter: false, pro: false, enterprise: true },
    ],
  },
  {
    label: 'Advanced',
    rows: [
      { feature: 'REST API Access', starter: false, pro: true, enterprise: true },
      { feature: 'GraphQL API', starter: false, pro: false, enterprise: true },
      { feature: 'SSO / SAML', starter: false, pro: false, enterprise: true },
      { feature: 'White Labeling', starter: false, pro: false, enterprise: true },
      { feature: 'Audit Logs', starter: false, pro: false, enterprise: true },
    ],
  },
]

const testimonials = [
  {
    initials: 'SM',
    name: 'Sarah Mitchell',
    company: 'Designly Co.',
    role: 'Head of Product',
    stars: 5,
    quote: 'Switching to the Pro plan was the best decision we made this year. The analytics alone saved us dozens of hours per month, and the API access unlocked integrations we never thought possible.',
    color: 'bg-violet-500',
  },
  {
    initials: 'JK',
    name: 'James Kowalski',
    company: 'CloudBase Inc.',
    role: 'CTO',
    stars: 5,
    quote: "The Enterprise plan gave us the compliance features and SLA guarantees our security team demanded. Onboarding was seamless and the dedicated account manager is genuinely world-class.",
    color: 'bg-primary-500',
  },
  {
    initials: 'AP',
    name: 'Amara Patel',
    company: 'Freelance Studio',
    role: 'Freelance Developer',
    stars: 5,
    quote: "I started on the free Starter plan and it covered everything I needed to launch my first client project. The upgrade path to Pro was effortless — no data migration, just instant access to more.",
    color: 'bg-emerald-500',
  },
]

const faqs = [
  {
    q: 'Can I change my plan at any time?',
    a: 'Yes, you can upgrade or downgrade your plan at any time from your account settings. Upgrades take effect immediately and you\'ll be billed a pro-rated amount for the remainder of the billing cycle. Downgrades take effect at the start of your next billing period.',
  },
  {
    q: 'Is there a free trial for the Pro plan?',
    a: 'Absolutely! The Pro plan includes a full 14-day free trial — no credit card required to start. You get access to every Pro feature during the trial so you can evaluate everything before committing.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards (Visa, MasterCard, American Express, Discover), PayPal, and bank wire transfers for annual Enterprise plans. All payments are processed securely via Stripe and are PCI-DSS compliant.',
  },
  {
    q: 'Do you offer refunds or a money-back guarantee?',
    a: 'We offer a 30-day money-back guarantee on all paid plans. If you\'re not completely satisfied for any reason within the first 30 days, contact our support team and we\'ll issue a full refund — no questions asked.',
  },
]

const trustStats = [
  { icon: Users, label: '10,000+ Customers', sub: 'Trusted worldwide', color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/20' },
  { icon: Shield, label: '99.9% Uptime', sub: 'Enterprise SLA', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { icon: Star, label: '4.9 / 5 Rating', sub: 'From 2,400 reviews', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { icon: Headphones, label: '24/7 Support', sub: 'Always here for you', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
]

function ComparisonCell({ value }) {
  if (value === true) return <Check size={18} className="text-emerald-500 mx-auto" />
  if (value === false) return <span className="block w-4 h-0.5 bg-slate-200 dark:bg-slate-600 mx-auto rounded" />
  return <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{value}</span>
}

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div>
      <PageHeader
        title="Pricing Plans"
        subtitle="Simple, transparent pricing that grows with you. No hidden fees ever."
      />

      {/* ── Hero section ── */}
      <div className="text-center mb-10">
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
          <span className="text-slate-900 dark:text-slate-100">The right plan for </span>
          <span className="text-primary-500">every team</span>
        </h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-8">
          Start free, scale with confidence. Upgrade or cancel at any time — no lock-in, no surprises.
        </p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-3 shadow-card">
          <span className={clsx('text-sm font-semibold transition-colors', !isYearly ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500')}>
            Monthly
          </span>
          <button
            onClick={() => setIsYearly(p => !p)}
            className={clsx(
              'relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              isYearly ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-600'
            )}
            aria-label="Toggle billing period"
          >
            <div className={clsx(
              'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200',
              isYearly ? 'translate-x-7' : 'translate-x-0'
            )} />
          </button>
          <span className={clsx('text-sm font-semibold transition-colors flex items-center gap-2', isYearly ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500')}>
            Yearly
            <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              Save 20%
            </span>
          </span>
        </div>
      </div>

      {/* ── Trust stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {trustStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card p-5 flex items-center gap-4">
              <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', stat.bg)}>
                <Icon size={22} className={stat.color} />
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight">{stat.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Pricing cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 items-center">
        {plans.map((plan) => {
          const Icon = plan.icon
          const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice

          return (
            <div
              key={plan.id}
              className={clsx(
                'card overflow-hidden transition-all duration-200',
                plan.featured
                  ? 'ring-2 ring-primary-500 dark:ring-primary-400 shadow-card-lg scale-[1.03]'
                  : 'hover:shadow-card-md hover:-translate-y-1'
              )}
            >
              {/* Most Popular banner */}
              {plan.featured && (
                <div className="bg-primary-500 text-white text-center text-xs font-bold py-2 tracking-widest uppercase">
                  {plan.badge}
                </div>
              )}

              {/* Card header */}
              <div className={clsx('p-7', plan.color)}>
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <Icon size={24} className="text-white" />
                </div>
                <h3 className="text-2xl font-extrabold text-white">{plan.name}</h3>
                <p className="text-white/75 text-sm mt-1.5 leading-relaxed">{plan.desc}</p>
                <div className="mt-5 flex items-end gap-1.5">
                  {price === 0 ? (
                    <span className="text-5xl font-black text-white">Free</span>
                  ) : (
                    <>
                      <span className="text-5xl font-black text-white">${price}</span>
                      <span className="text-white/70 text-sm mb-1.5 leading-none">
                        /{isYearly ? 'mo, billed yearly' : 'mo'}
                      </span>
                    </>
                  )}
                </div>
                {isYearly && price > 0 && (
                  <p className="text-white/60 text-xs mt-1">
                    ${plan.monthlyPrice}/mo if billed monthly
                  </p>
                )}
              </div>

              {/* Card body */}
              <div className="p-7">
                <button
                  className={clsx(
                    'w-full mb-7 font-semibold py-2.5 rounded-xl transition-all duration-150 text-sm',
                    plan.ctaVariant === 'primary'
                      ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-md hover:shadow-lg'
                      : plan.ctaVariant === 'info'
                      ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-md hover:shadow-lg'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                  )}
                >
                  {plan.cta}
                </button>

                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      className={clsx(
                        'flex items-center gap-3 text-sm',
                        feature.included ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'
                      )}
                    >
                      {feature.included ? (
                        <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          <X size={12} className="text-slate-400 dark:text-slate-500" />
                        </span>
                      )}
                      {feature.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Feature comparison table ── */}
      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">Full Feature Comparison</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">See exactly what's included in each plan</p>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left p-5 text-sm font-semibold text-slate-500 dark:text-slate-400 w-1/2">Feature</th>
                  <th className="p-5 text-center text-sm font-bold text-slate-700 dark:text-slate-300">Starter</th>
                  <th className="p-5 text-center text-sm font-bold text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/10">
                    <span className="flex items-center justify-center gap-1.5">
                      <Star size={14} /> Pro
                    </span>
                  </th>
                  <th className="p-5 text-center text-sm font-bold text-slate-700 dark:text-slate-300">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonCategories.map((cat) => (
                  <Fragment key={cat.label}>
                    <tr className="bg-slate-50 dark:bg-slate-800/60">
                      <td colSpan={4} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {cat.label}
                      </td>
                    </tr>
                    {cat.rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300 font-medium">{row.feature}</td>
                        <td className="px-5 py-3.5 text-center"><ComparisonCell value={row.starter} /></td>
                        <td className="px-5 py-3.5 text-center bg-primary-50/30 dark:bg-primary-900/5"><ComparisonCell value={row.pro} /></td>
                        <td className="px-5 py-3.5 text-center"><ComparisonCell value={row.enterprise} /></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Testimonials ── */}
      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">Loved by thousands of teams</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Don't take our word for it — hear from our customers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="card p-6 flex flex-col gap-4 hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-200">
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', t.color)}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.role} · {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Enterprise CTA banner ── */}
      <div className="mb-16 rounded-2xl overflow-hidden bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 p-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold px-3 py-1 rounded-full mb-4">
              <Building2 size={13} /> Enterprise
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">Need a custom solution?</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md leading-relaxed">
              Large team? Unique compliance requirements? Custom integrations? We work with enterprise customers to build tailored packages that perfectly fit your organization.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-150 text-sm">
              Contact Sales <ArrowRight size={16} />
            </button>
            <button className="inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-600 shadow-card hover:shadow-card-md transition-all duration-150 text-sm">
              <Globe size={16} /> Schedule Demo
            </button>
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">Frequently Asked Questions</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Everything you need to know about our plans and billing</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="card overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                  {faq.q}
                </span>
                <ChevronDown
                  size={18}
                  className={clsx(
                    'text-slate-400 shrink-0 transition-transform duration-200',
                    openFaq === i && 'rotate-180'
                  )}
                />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5 animate-fade-in">
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
