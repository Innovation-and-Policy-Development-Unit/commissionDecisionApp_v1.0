import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Check, Star, ArrowRight, Menu, X, Zap, Shield, Globe, BarChart3, Users, TrendingUp } from 'lucide-react'
import Logo from '../../components/shared/Logo'

const features = [
  { icon: LayoutDashboard, title: 'Modern Dashboard', desc: 'Beautiful dashboards with real-time data, customizable widgets, and insightful analytics.' },
  { icon: Shield, title: 'Enterprise Security', desc: 'Bank-grade security with SSO, 2FA, audit logs, and role-based access control.' },
  { icon: Zap, title: 'Lightning Fast', desc: 'Optimized performance with sub-second load times, lazy loading, and smart caching.' },
  { icon: BarChart3, title: 'Advanced Analytics', desc: 'Deep insights with customizable charts, exportable reports, and data visualization.' },
  { icon: Globe, title: 'Multi-language', desc: 'Full RTL support and internationalization for 20+ languages and locales.' },
  { icon: Users, title: 'Team Collaboration', desc: 'Built for teams with real-time updates, comments, notifications, and permissions.' },
]

const pricing = [
  {
    name: 'Starter', price: 0, desc: 'Perfect for individuals',
    features: ['Up to 5 projects', '2 team members', 'Basic analytics', '5GB storage', 'Email support'],
    cta: 'Get Started Free', highlight: false,
  },
  {
    name: 'Pro', price: 29, desc: 'For growing teams',
    features: ['Unlimited projects', '25 team members', 'Advanced analytics', '100GB storage', 'Priority support', 'Custom domain', 'API access'],
    cta: 'Start Pro Trial', highlight: true,
  },
  {
    name: 'Enterprise', price: 99, desc: 'For large organizations',
    features: ['Unlimited everything', 'Unlimited members', 'Custom analytics', '1TB storage', '24/7 dedicated support', 'SSO & SAML', 'SLA guarantee', 'Custom integrations'],
    cta: 'Contact Sales', highlight: false,
  },
]

const stats = [
  { label: 'Active Users', value: '50K+' },
  { label: 'Projects Created', value: '200K+' },
  { label: 'Countries', value: '120+' },
  { label: 'Uptime', value: '99.99%' },
]

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Navbar */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-bold text-xl text-primary-500 dark:text-slate-300">Liner</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {['Features', 'Pricing', 'Docs', 'Blog'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium">
                {item}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth/auth1/login" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 transition-colors">Log In</Link>
            <Link to="/auth/auth1/register" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
          <button onClick={() => setMobileOpen(o => !o)} className="md:hidden text-slate-600 dark:text-slate-400">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-4 space-y-3">
            {['Features', 'Pricing', 'Docs', 'Blog'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-slate-400 py-1">{item}</a>
            ))}
            <div className="flex gap-3 pt-2">
              <Link to="/auth/auth1/login" className="btn btn-outline flex-1 text-sm">Log In</Link>
              <Link to="/auth/auth1/register" className="btn btn-primary flex-1 text-sm">Get Started</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute top-20 left-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-sm font-semibold mb-6 border border-primary-100 dark:border-primary-800">
            <Star size={14} className="fill-primary-500 text-primary-500" /> New: Liner 2.0 is here
          </span>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 dark:text-white mb-6 leading-tight">
            The Admin Template
            <br />
            <span className="text-primary-500">Built for Modern Teams</span>
          </h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Liner is a comprehensive React admin dashboard template with beautiful UI components, dark mode, RTL support, and everything you need to build powerful web applications.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/" className="btn btn-gradient btn-xl shadow-glow">
              View Demo <ArrowRight size={20} />
            </Link>
            <a href="#pricing" className="btn btn-outline btn-xl">View Pricing</a>
          </div>
          <p className="text-sm text-slate-400 mt-5">No credit card required · Free forever plan available</p>
        </div>

        {/* Preview */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5 p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              {['bg-red-400', 'bg-amber-400', 'bg-green-400'].map((c, i) => <div key={i} className={`w-3 h-3 rounded-full ${c}`} />)}
            </div>
            <div className="h-80 bg-primary-500/10 dark:bg-primary-900/20 flex items-center justify-center">
              <div className="grid grid-cols-3 gap-4 p-8 w-full max-w-2xl">
                {['bg-primary-500', 'bg-cyan-500', 'bg-emerald-500'].map((g, i) => (
                  <div key={i} className={`h-20 rounded-xl ${g} opacity-80`} />
                ))}
                <div className="col-span-2 h-32 rounded-xl bg-slate-200 dark:bg-slate-700 opacity-60" />
                <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-700 opacity-40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-primary-600">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center text-white">
          {stats.map((stat, i) => (
            <div key={i}>
              <p className="text-4xl font-extrabold mb-1">{stat.value}</p>
              <p className="opacity-80 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="badge badge-primary mb-3">Features</span>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Everything you need</h2>
            <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">A complete toolkit for building beautiful, functional admin dashboards</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="card-hover p-6">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
                  <feature.icon size={22} className="text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="badge badge-primary mb-3">Pricing</span>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Simple, transparent pricing</h2>
            <p className="text-xl text-slate-500 dark:text-slate-400">No hidden fees, no surprises</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricing.map((plan, i) => (
              <div key={i} className={`rounded-2xl p-7 ${plan.highlight ? 'bg-primary-600 text-white shadow-glow scale-105' : 'card'}`}>
                {plan.highlight && (
                  <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-bold inline-block mb-3">Most Popular</div>
                )}
                <h3 className={`font-bold text-xl mb-1 ${plan.highlight ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{plan.name}</h3>
                <p className={`text-sm mb-4 ${plan.highlight ? 'text-white/80' : 'text-slate-500'}`}>{plan.desc}</p>
                <div className="mb-6">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-slate-900 dark:text-white'}`}>${plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? 'text-white/70' : 'text-slate-400'}`}>/month</span>
                </div>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((f, j) => (
                    <li key={j} className={`flex items-center gap-2.5 text-sm ${plan.highlight ? 'text-white/90' : 'text-slate-600 dark:text-slate-400'}`}>
                      <Check size={15} className={plan.highlight ? 'text-white' : 'text-emerald-500'} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button className={`w-full btn ${plan.highlight ? 'bg-white text-primary-700 hover:bg-slate-100' : 'btn-outline'}`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-5">Ready to get started?</h2>
          <p className="text-xl text-slate-500 dark:text-slate-400 mb-8">Join 50,000+ developers building amazing dashboards with Liner.</p>
          <Link to="/" className="btn btn-gradient btn-xl shadow-glow">
            Start Building for Free <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Logo size={28} />
              <span className="font-bold text-lg text-primary-500 dark:text-slate-300">Liner</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">The modern admin template for React developers.</p>
          </div>
          {[
            { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
            { title: 'Resources', links: ['Documentation', 'Blog', 'Guides', 'Examples'] },
            { title: 'Company', links: ['About', 'Careers', 'Privacy', 'Terms'] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 text-sm">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(link => (
                  <li key={link}><a href="#" onClick={(e) => e.preventDefault()} className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{link}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-sm text-slate-400">© 2026 Liner Admin. All rights reserved.</p>
          <p className="text-sm text-slate-400">Built with React & Tailwind CSS</p>
        </div>
      </footer>
    </div>
  )
}
