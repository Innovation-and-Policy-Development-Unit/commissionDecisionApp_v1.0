import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Check, Shield, Zap, Users, Star, Sparkles, Globe, Layers } from 'lucide-react'
import Logo from '../../components/shared/Logo'
import { img } from '../../utils/imgPath'

// 0 = empty, 1 = Weak, 2 = Fair, 3 = Good, 4 = Strong
function scorePassword(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['bg-slate-200 dark:bg-slate-600', 'bg-red-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500']
const STRENGTH_TEXT_COLORS = ['text-slate-400', 'text-red-600 dark:text-red-400', 'text-amber-600 dark:text-amber-400', 'text-yellow-600 dark:text-yellow-500', 'text-emerald-600 dark:text-emerald-400']

export default function Register() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [password, setPassword] = useState('')
  const strength = scorePassword(password)

  return (
    <div className="min-h-screen flex">
      {/* Left - Premium Visual Sidebar */}
      <div className="hidden xl:flex flex-1 relative overflow-hidden">
        {/* Background image */}
        <img
          src={img('/images/unsplash/earth-from-space.jpg')}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-indigo-950/80 to-violet-950/90" />

        {/* Animated orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[10%] left-[15%] w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-[15%] right-[10%] w-96 h-96 bg-violet-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[55%] left-[60%] w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
        </div>

        {/* Grid lines overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Top - Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/20">
              <Sparkles size={20} className="text-indigo-300" />
            </div>
            <span className="text-xl font-bold text-white/90">Liner</span>
          </div>

          {/* Center - Main content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/[0.07] backdrop-blur-xl rounded-full px-4 py-1.5 border border-white/10 w-fit mb-6">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-emerald-300/90 tracking-wide">JOIN 50,000+ DEVELOPERS</span>
            </div>

            <h2 className="text-4xl font-bold text-white mb-3 leading-tight">
              Build something<br />
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">extraordinary.</span>
            </h2>
            <p className="text-base text-white/50 leading-relaxed mb-10 max-w-md">
              The most comprehensive admin dashboard template. Ship faster with 40+ production-ready pages.
            </p>

            {/* Feature cards - 2x2 grid */}
            <div className="grid grid-cols-2 gap-3 mb-10">
              {[
                { icon: Shield, label: 'Enterprise Security', desc: 'Auth & permissions', color: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-400', borderColor: 'border-emerald-500/20' },
                { icon: Zap, label: 'Lightning Fast', desc: 'Vite + React 18', color: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-400', borderColor: 'border-amber-500/20' },
                { icon: Globe, label: 'RTL & i18n Ready', desc: 'Global audience', color: 'from-cyan-500/20 to-cyan-500/5', iconColor: 'text-cyan-400', borderColor: 'border-cyan-500/20' },
                { icon: Layers, label: '40+ Components', desc: 'Premium UI library', color: 'from-violet-500/20 to-violet-500/5', iconColor: 'text-violet-400', borderColor: 'border-violet-500/20' },
              ].map(({ icon: Icon, label, desc, color, iconColor, borderColor }) => (
                <div key={label} className={`bg-gradient-to-br ${color} backdrop-blur-xl rounded-2xl p-4 border ${borderColor} group hover:scale-[1.02] transition-transform duration-300`}>
                  <Icon size={20} className={`${iconColor} mb-2.5`} />
                  <p className="text-sm font-semibold text-white/90">{label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>

            {/* Testimonial card */}
            <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl p-5 border border-white/10">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-4 italic">
                "Liner saved us weeks of development time. The code quality is exceptional and the design is pixel-perfect. Best admin template I've ever used."
              </p>
              <div className="flex items-center gap-3">
                <img
                  src={img('/images/avatars/avatar-woman-alice.jpg')}
                  alt="Sarah Mitchell"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white/10"
                />
                <div>
                  <p className="text-sm font-semibold text-white/90">Sarah Mitchell</p>
                  <p className="text-xs text-white/40">CTO at TechFlow</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 bg-white/[0.07] rounded-full px-3 py-1">
                  <Users size={12} className="text-indigo-300" />
                  <span className="text-[11px] text-white/60 font-medium">Verified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom - Stats bar */}
          <div className="flex items-center gap-6 pt-6 border-t border-white/[0.06]">
            {[
              { value: '50K+', label: 'Downloads' },
              { value: '4.9', label: 'Rating' },
              { value: '99.9%', label: 'Uptime' },
              { value: '24/7', label: 'Support' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-lg font-bold text-white/90">{value}</p>
                <p className="text-[11px] text-white/35 tracking-wide uppercase">{label}</p>
              </div>
            ))}
            {/* Avatars stack */}
            <div className="ml-auto flex items-center">
              <div className="flex -space-x-2">
                {[img('/images/avatars/avatar-man-bob.jpg'), img('/images/avatars/avatar-woman-carol.jpg'), img('/images/avatars/avatar-man-mike.jpg'), img('/images/avatars/avatar-woman-grace.jpg'), img('/images/avatars/avatar-man-chris.jpg')].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover border-2 border-slate-900"
                  />
                ))}
              </div>
              <span className="text-[11px] text-white/40 ml-3">+50K joined</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-8 xl:px-16 bg-white dark:bg-slate-900">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <Logo size={40} />
            <span className="text-2xl font-bold text-primary-500 dark:text-slate-300">Liner</span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Create account</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Start your free journey with Liner Dashboard</p>

          <form onSubmit={e => { e.preventDefault(); navigate('/') }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
                <input type="text" className="input" placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
                <input type="text" className="input" placeholder="Doe" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
              <input type="email" className="input" placeholder="john@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pe-10"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map(level => (
                  <div key={level} className="flex-1">
                    <div className={`h-1 rounded-full transition-colors ${strength >= level ? STRENGTH_COLORS[strength] : 'bg-slate-200 dark:bg-slate-600'}`} />
                  </div>
                ))}
              </div>
              <p className={`text-xs mt-1 ${STRENGTH_TEXT_COLORS[strength]}`}>
                {password
                  ? `${STRENGTH_LABELS[strength]} — Use 8+ chars with mixed case, numbers, and symbols`
                  : 'Use 8+ chars with mixed case, numbers, and symbols'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
              <input type="password" className="input" placeholder="Repeat your password" />
            </div>

            <div className="flex items-start gap-3 cursor-pointer" onClick={() => setAgreed(p => !p)}>
              <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${agreed ? 'bg-primary-500 border-primary-500' : 'border-slate-300 dark:border-slate-600'}`}>
                {agreed && <Check size={12} className="text-white" />}
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400 select-none leading-relaxed">
                I agree to the <Link to="/pages/pricing" className="text-primary-600 dark:text-primary-400 hover:underline">Terms of Service</Link> and{' '}
                <a href="#" onClick={(e) => e.preventDefault()} className="text-primary-600 dark:text-primary-400 hover:underline">Privacy Policy</a>
              </span>
            </div>

            <button type="submit" className="btn-gradient w-full py-3 text-base" disabled={!agreed}>
              Create Account
              <ArrowRight size={18} />
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-3">
                Or sign up with
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {['Google', 'GitHub', 'Twitter'].map(provider => (
                <button key={provider} type="button" className="btn-outline text-sm py-2.5 justify-center">
                  {provider}
                </button>
              ))}
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
