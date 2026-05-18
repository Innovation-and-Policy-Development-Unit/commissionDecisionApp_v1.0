import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import Badge from '../../components/shared/Badge'
import Avatar from '../../components/shared/Avatar'
import {
  TrendingUp, TrendingDown, Star, Heart, Share2, Bookmark,
  MoreHorizontal, ArrowRight, Package, Users, DollarSign, BarChart3,
  Zap, Shield, Globe, Cpu, ShoppingCart, CheckCircle, MapPin,
  Clock, Eye, MessageSquare, Twitter, Linkedin, Github, Check,
  ChevronRight, ExternalLink, Activity
} from 'lucide-react'
import { img } from '../../utils/imgPath'

/* ─── Section wrapper ─────────────────────────────────────────── */
function Section({ title, description, children, cols = 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' }) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className={`grid ${cols} gap-4`}>{children}</div>
    </div>
  )
}

export default function Cards() {
  const [wishlist, setWishlist] = useState({})
  const [followed, setFollowed] = useState({})

  function toggleWishlist(id) {
    setWishlist(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleFollow(name) {
    setFollowed(prev => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <div>
      <PageHeader
        title="Cards"
        subtitle="Versatile card components for displaying content, stats, profiles, products and more"
      />

      {/* ── 1. Basic Cards ─────────────────────────────────────── */}
      <Section title="Basic Cards" description="Simple, hover-lift and glassmorphism card styles">
        <div className="card p-5">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Simple Card</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            A clean card with a white background and subtle border. Perfect for structured content layouts.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400">Updated 2 hours ago</span>
            <button className="text-primary-600 dark:text-primary-400 text-xs font-semibold hover:underline flex items-center gap-1">
              View details <ChevronRight size={12} />
            </button>
          </div>
        </div>

        <div className="card-hover p-5 group">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <Activity size={20} className="text-primary-600 dark:text-primary-400" />
            </div>
            <span className="text-xs text-slate-400 group-hover:text-primary-500 transition-colors">Hover me</span>
          </div>
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Interactive Hover Card</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            This card lifts on hover with a smooth shadow animation — great for clickable list items.
          </p>
          <button className="btn-outline btn-sm mt-4 w-full">Learn More</button>
        </div>

        <div className="glass p-5 rounded-xl shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Live</span>
          </div>
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Glassmorphism Card</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            A frosted-glass effect with backdrop blur. Looks stunning over colorful gradient backgrounds.
          </p>
          <div className="mt-4 flex gap-2">
            <div className="flex-1 bg-white/50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">1.2k</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Users</p>
            </div>
            <div className="flex-1 bg-white/50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">98%</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Uptime</p>
            </div>
            <div className="flex-1 bg-white/50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">4.9</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Rating</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 2. Gradient Stat Cards ─────────────────────────────── */}
      <Section
        title="Gradient Stat Cards"
        description="Vibrant gradient stat cards with trend indicators"
        cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          { title: 'Total Users', value: '24,521', icon: Users, change: 12.5, sub: 'vs last month', color: 'bg-primary-500' },
          { title: 'Revenue', value: '$48,295', icon: DollarSign, change: 18.2, sub: 'vs last month', color: 'bg-cyan-500' },
          { title: 'Orders', value: '1,429', icon: Package, change: 8.7, sub: 'vs last month', color: 'bg-emerald-500' },
          { title: 'Growth Rate', value: '3.24%', icon: BarChart3, change: -0.5, sub: 'vs last month', color: 'bg-amber-500' },
        ].map(card => {
          const Icon = card.icon
          const isPos = card.change >= 0
          return (
            <div key={card.title} className={`relative rounded-2xl p-5 text-white shadow-lg ${card.color} overflow-hidden`}>
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
              <div className="absolute -bottom-6 -right-2 w-20 h-20 rounded-full bg-white/10" />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider leading-tight">{card.title}</p>
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <Icon size={18} />
                  </div>
                </div>
                <p className="text-3xl font-bold mb-2 tracking-tight">{card.value}</p>
                <div className="flex items-center gap-1.5">
                  <div className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${isPos ? 'bg-white/20' : 'bg-white/20'}`}>
                    {isPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {isPos ? '+' : ''}{card.change}%
                  </div>
                  <span className="text-white/60 text-xs">{card.sub}</span>
                </div>
              </div>
            </div>
          )
        })}
      </Section>

      {/* ── 3. Light Stat Cards ────────────────────────────────── */}
      <Section
        title="Light Stat Cards"
        description="Tinted light-background stat cards — elegant and subtle"
        cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          { title: 'Active Sessions', value: '3,842', icon: Activity, change: 5.4, iconBg: 'bg-primary-100 dark:bg-primary-900/30', iconCls: 'text-primary-600 dark:text-primary-400', border: 'border-primary-100 dark:border-primary-900/30' },
          { title: 'New Signups', value: '248', icon: Users, change: 22.1, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconCls: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-900/30' },
          { title: 'Open Tickets', value: '17', icon: MessageSquare, change: -8.3, iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconCls: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-900/30' },
          { title: 'Server Load', value: '42%', icon: Cpu, change: -2.1, iconBg: 'bg-cyan-100 dark:bg-cyan-900/30', iconCls: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-100 dark:border-cyan-900/30' },
        ].map(card => {
          const Icon = card.icon
          const isPos = card.change >= 0
          return (
            <div key={card.title} className={`card p-5 border ${card.border}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center`}>
                  <Icon size={20} className={card.iconCls} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isPos ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {isPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {isPos ? '+' : ''}{card.change}%
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-0.5 tracking-tight">{card.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{card.title}</p>
            </div>
          )
        })}
      </Section>

      {/* ── 4. Profile Cards ───────────────────────────────────── */}
      <Section title="Profile Cards" description="User profile cards with social stats and follow action">
        {[
          { name: 'Alice Johnson', role: 'Product Manager', company: 'TechCorp Inc.', bio: 'Passionate about building delightful user experiences that solve real problems.', followers: '12.4K', following: '842', posts: '234', status: 'online', img: img('/images/avatars/avatar-woman-alice.jpg'), cover: img('/images/unsplash/beach-ocean.jpg') },
          { name: 'Bob Smith', role: 'Senior Developer', company: 'WebSolutions', bio: 'Full-stack engineer focused on performance, DX and scalable architecture.', followers: '8.2K', following: '421', posts: '156', status: 'busy', img: img('/images/avatars/avatar-man-bob.jpg'), cover: img('/images/unsplash/mountain-landscape.jpg') },
          { name: 'Carol Williams', role: 'UX Designer', company: 'DesignHub', bio: 'Crafting pixel-perfect interfaces with a focus on accessibility and motion.', followers: '24.8K', following: '1.2K', posts: '389', status: 'away', img: img('/images/avatars/avatar-woman-carol.jpg'), cover: img('/images/unsplash/forest-path.jpg') },
        ].map(person => (
          <div key={person.name} className="card overflow-hidden">
            <div className="h-24 relative overflow-hidden rounded-t-2xl">
              <img src={person.cover} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <button className="absolute top-3 right-3 w-7 h-7 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-colors">
                <MoreHorizontal size={14} />
              </button>
            </div>
            <div className="px-5 pb-5">
              <div className="flex items-end justify-between -mt-7 mb-3">
                <div className="relative inline-flex shrink-0">
                  <img src={person.img} alt={person.name} className="w-16 h-16 rounded-2xl object-cover border-4 border-white dark:border-slate-800 shadow-lg" />
                  {person.status && (
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${person.status === 'online' ? 'bg-emerald-500' : person.status === 'busy' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  )}
                </div>
                <div className="flex gap-2 mb-1">
                  <button className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-primary-500 hover:border-primary-300 dark:hover:border-primary-600 transition-colors bg-white dark:bg-slate-800">
                    <Twitter size={14} />
                  </button>
                  <button className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-primary-500 hover:border-primary-300 dark:hover:border-primary-600 transition-colors bg-white dark:bg-slate-800">
                    <Linkedin size={14} />
                  </button>
                </div>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 leading-tight">{person.name}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">{person.role}</p>
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5 font-medium">{person.company}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed line-clamp-2">{person.bio}</p>
              <div className="flex gap-0 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                {[['Followers', person.followers], ['Following', person.following], ['Posts', person.posts]].map(([label, val]) => (
                  <div key={label} className="text-center flex-1">
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{val}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => toggleFollow(person.name)}
                  className={`flex-1 btn-sm rounded-lg font-semibold text-xs transition-all ${followed[person.name] ? 'btn-outline' : 'btn-primary'}`}
                >
                  {followed[person.name] ? <Check size={13} /> : null}
                  {followed[person.name] ? 'Following' : 'Follow'}
                </button>
                <button className="btn-outline btn-sm px-2.5 rounded-lg"><Share2 size={14} /></button>
                <button className="btn-outline btn-sm px-2.5 rounded-lg"><MessageSquare size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* ── 5. Product Cards ───────────────────────────────────── */}
      <Section title="Product Cards" description="E-commerce product cards with rating, price and cart action">
        {[
          { id: 'p1', name: 'MacBook Pro 14"', price: '$2,499', oldPrice: '$2,799', category: 'Electronics', rating: 4.9, reviews: 342, badge: 'New', badgeCls: 'bg-primary-500', img: img('/images/unsplash/macbook-laptop.jpg') },
          { id: 'p2', name: 'Wireless ANC Headphones', price: '$349', oldPrice: '$429', category: 'Audio', rating: 4.7, reviews: 218, badge: 'Best Seller', badgeCls: 'bg-amber-500', img: img('/images/unsplash/wireless-headphones.jpg') },
          { id: 'p3', name: 'Mechanical Keyboard', price: '$149', oldPrice: '$199', category: 'Accessories', rating: 4.6, reviews: 156, badge: 'Sale', badgeCls: 'bg-red-500', img: img('/images/unsplash/mechanical-keyboard.jpg') },
        ].map(product => (
          <div key={product.id} className="card-hover overflow-hidden group">
            <div className="relative h-44 bg-slate-50 dark:bg-slate-700/30 overflow-hidden">
              <img src={product.img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-lg ${product.badgeCls} text-white shadow-sm`}>
                {product.badge}
              </span>
              <button
                onClick={() => toggleWishlist(product.id)}
                className={`absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm ${wishlist[product.id] ? 'bg-red-500 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-red-500'}`}
              >
                <Heart size={15} className={wishlist[product.id] ? 'fill-white' : ''} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">{product.category}</p>
                <div className="flex items-center gap-0.5">
                  <Star size={11} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{product.rating}</span>
                  <span className="text-xs text-slate-400 ml-0.5">({product.reviews})</span>
                </div>
              </div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {product.name}
              </h4>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{product.price}</span>
                  <span className="text-xs text-slate-400 line-through">{product.oldPrice}</span>
                </div>
                <button className="btn-primary btn-sm rounded-lg gap-1.5">
                  <ShoppingCart size={13} /> Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* ── 6. Blog / Article Cards ────────────────────────────── */}
      <Section
        title="Blog / Article Cards"
        description="Article cards with cover images, category, author, reading time and bookmark"
        cols="grid-cols-1 md:grid-cols-2"
      >
        {[
          {
            title: 'Building Premium Dashboards with React & Tailwind',
            excerpt: 'A deep dive into architecting beautiful, maintainable admin interfaces using modern tooling, design tokens, and component-driven workflows.',
            author: 'John Doe',
            authorImg: img('/images/avatars/avatar-man-john.jpg'),
            date: 'Mar 11, 2026',
            readTime: '8 min read',
            views: '2.4k',
            image: img('/images/unsplash/coding-laptop.jpg'),
            category: 'Tutorial',
            catVariant: 'primary',
          },
          {
            title: 'Advanced Tailwind CSS Techniques You Should Know',
            excerpt: 'Unlock the full potential of Tailwind with configuration tricks, custom plugins, JIT mode, and design system integration patterns.',
            author: 'Alice Johnson',
            authorImg: img('/images/avatars/avatar-woman-alice.jpg'),
            date: 'Mar 9, 2026',
            readTime: '6 min read',
            views: '1.8k',
            image: img('/images/unsplash/code-screen-dark.jpg'),
            category: 'Development',
            catVariant: 'info',
          },
          {
            title: 'Dark Mode Design — Best Practices for 2026',
            excerpt: 'Learn how to implement dark mode that feels intentional, improves accessibility, and delights users across all devices and contexts.',
            author: 'Carol Williams',
            authorImg: img('/images/avatars/avatar-woman-carol.jpg'),
            date: 'Mar 7, 2026',
            readTime: '5 min read',
            views: '3.1k',
            image: img('/images/unsplash/code-editor.jpg'),
            category: 'Design',
            catVariant: 'success',
          },
          {
            title: 'State Management in 2026 — What Actually Works',
            excerpt: 'Comparing Zustand, Jotai, Redux Toolkit and React Query — when to use each, and how to avoid over-engineering your frontend.',
            author: 'Bob Smith',
            authorImg: img('/images/avatars/avatar-man-bob.jpg'),
            date: 'Mar 5, 2026',
            readTime: '7 min read',
            views: '4.7k',
            image: img('/images/unsplash/react-code.jpg'),
            category: 'Architecture',
            catVariant: 'warning',
          },
        ].map(post => (
          <div key={post.title} className="card-hover overflow-hidden group">
            <div className="h-44 overflow-hidden relative">
              <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute top-3 start-3">
                <Badge variant={post.catVariant}>{post.category}</Badge>
              </div>
              <button className="absolute top-3 end-3 p-1.5 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white transition-colors">
                <Bookmark size={14} />
              </button>
            </div>
            <div className="p-5">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {post.title}
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2">
                {post.excerpt}
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  <img src={post.authorImg} alt={post.author} className="w-8 h-8 rounded-full object-cover" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{post.author}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Clock size={10} />
                      <span>{post.date}</span>
                      <span>·</span>
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Eye size={12} />
                  <span>{post.views}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* ── 7. Feature Cards ───────────────────────────────────── */}
      <Section
        title="Feature Cards"
        description="Highlight product features or services with icons in colored backgrounds"
        cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          { icon: Zap, title: 'Lightning Fast', desc: 'Optimized for speed with sub-100ms response times and intelligent caching strategies.', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconCls: 'text-amber-600 dark:text-amber-400', accentCls: 'bg-amber-500' },
          { icon: Shield, title: 'Enterprise Security', desc: 'Bank-grade AES-256 encryption, SSO, 2FA, and full SOC 2 Type II compliance.', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconCls: 'text-emerald-600 dark:text-emerald-400', accentCls: 'bg-emerald-500' },
          { icon: Globe, title: 'Global CDN', desc: '200+ edge locations worldwide for ultra-low latency content delivery to every user.', iconBg: 'bg-cyan-100 dark:bg-cyan-900/30', iconCls: 'text-cyan-600 dark:text-cyan-400', accentCls: 'bg-cyan-500' },
          { icon: Cpu, title: 'Smart Automation', desc: 'AI-powered workflow automation that learns and adapts to your team\'s patterns.', iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconCls: 'text-violet-600 dark:text-violet-400', accentCls: 'bg-primary-500' },
        ].map(feat => {
          const Icon = feat.icon
          return (
            <div key={feat.title} className="card-hover p-5 group">
              <div className={`relative w-12 h-12 ${feat.iconBg} rounded-2xl flex items-center justify-center mb-4 overflow-hidden`}>
                <div className={`absolute inset-0 ${feat.accentCls} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <Icon size={22} className={`relative z-10 ${feat.iconCls} group-hover:text-white transition-colors duration-300`} />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">{feat.title}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feat.desc}</p>
              <button className="mt-4 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 group-hover:gap-1.5 transition-all">
                Learn more <ArrowRight size={12} />
              </button>
            </div>
          )
        })}
      </Section>

      {/* ── 8. Horizontal Cards ────────────────────────────────── */}
      <Section
        title="Horizontal Cards"
        description="Side-by-side image and content layout — ideal for list views"
        cols="grid-cols-1 xl:grid-cols-2"
      >
        {[
          {
            img: img('/images/unsplash/analytics-dashboard.jpg'),
            badge: 'New Release',
            badgeCls: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
            title: 'Analytics Dashboard 3.0',
            desc: 'Completely rebuilt analytics engine with real-time data streaming and customizable widget layouts.',
            tags: ['React', 'TypeScript', 'Charts'],
            action: 'View Product',
          },
          {
            img: img('/images/unsplash/dashboard-charts.jpg'),
            badge: 'Popular',
            badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            title: 'Automation Studio',
            desc: 'Build powerful no-code automation workflows with drag-and-drop and 200+ integrations.',
            tags: ['No-code', 'Integrations', 'API'],
            action: 'Try Free',
          },
        ].map((item, i) => (
          <div key={i} className="card-hover flex overflow-hidden group">
            <div className="w-28 sm:w-36 shrink-0 overflow-hidden">
              <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>
            <div className="flex-1 p-4 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.badgeCls}`}>
                  {item.badge}
                </span>
                <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <ExternalLink size={13} />
                </button>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {item.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3 line-clamp-2">
                {item.desc}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 flex-wrap">
                  {item.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                      {tag}
                    </span>
                  ))}
                </div>
                <button className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 shrink-0 ml-2">
                  {item.action} <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* ── 9. Pricing Mini Cards ──────────────────────────────── */}
      <Section
        title="Pricing Mini Cards"
        description="Compact 3-tier pricing cards — the center card uses featured styling"
        cols="grid-cols-1 sm:grid-cols-3"
      >
        {[
          {
            name: 'Starter',
            price: '$0',
            period: '/month',
            desc: 'Perfect for side projects and personal use.',
            features: ['5 projects', '1 GB storage', 'Basic analytics', 'Community support'],
            cta: 'Get Started',
            featured: false,
          },
          {
            name: 'Pro',
            price: '$29',
            period: '/month',
            desc: 'Everything you need for a growing team.',
            features: ['Unlimited projects', '50 GB storage', 'Advanced analytics', 'Priority support', 'Custom domain', 'API access'],
            cta: 'Start Free Trial',
            featured: true,
          },
          {
            name: 'Enterprise',
            price: '$99',
            period: '/month',
            desc: 'For large teams that need full control.',
            features: ['Unlimited everything', '1 TB storage', 'Custom analytics', '24/7 dedicated support', 'SSO & SAML', 'SLA guarantee'],
            cta: 'Contact Sales',
            featured: false,
          },
        ].map(plan => (
          <div
            key={plan.name}
            className={`relative rounded-2xl p-5 ${plan.featured
              ? 'bg-primary-600 text-white shadow-xl scale-105'
              : 'card'
            }`}
          >
            {plan.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-[11px] font-bold bg-amber-400 text-amber-900 px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                  Most Popular
                </span>
              </div>
            )}
            <h4 className={`font-bold text-sm uppercase tracking-wide mb-1 ${plan.featured ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
              {plan.name}
            </h4>
            <div className="flex items-baseline gap-1 mb-1">
              <span className={`text-3xl font-bold tracking-tight ${plan.featured ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                {plan.price}
              </span>
              <span className={`text-sm ${plan.featured ? 'text-white/60' : 'text-slate-400'}`}>{plan.period}</span>
            </div>
            <p className={`text-xs leading-relaxed mb-4 ${plan.featured ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
              {plan.desc}
            </p>
            <ul className="space-y-2 mb-5">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <Check size={13} className={plan.featured ? 'text-white/70 shrink-0' : 'text-emerald-500 shrink-0'} />
                  <span className={plan.featured ? 'text-white/80' : 'text-slate-600 dark:text-slate-400'}>{f}</span>
                </li>
              ))}
            </ul>
            <button className={`w-full btn-sm rounded-xl font-semibold text-xs ${plan.featured
              ? 'bg-white text-primary-700 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50'
              : 'btn-primary'
            }`}>
              {plan.cta}
            </button>
          </div>
        ))}
      </Section>

      {/* ── 10. Action Cards ───────────────────────────────────── */}
      <Section
        title="Action Cards"
        description="Cards with gradient top borders, icon headers and action buttons"
        cols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            icon: Activity,
            title: 'Monitor Performance',
            desc: 'Track page speed, Core Web Vitals and uptime across all your applications in real time.',
            gradient: 'bg-primary-500',
            iconBg: 'bg-primary-100 dark:bg-primary-900/30',
            iconCls: 'text-primary-600 dark:text-primary-400',
            action: 'Open Monitor',
          },
          {
            icon: Shield,
            title: 'Security Audit',
            desc: 'Automated security scans detect vulnerabilities and misconfigurations before they become threats.',
            gradient: 'bg-emerald-500',
            iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
            iconCls: 'text-emerald-600 dark:text-emerald-400',
            action: 'Run Audit',
          },
          {
            icon: Globe,
            title: 'CDN Settings',
            desc: 'Configure edge caching rules, custom headers, and geo-based routing for optimal delivery.',
            gradient: 'bg-cyan-500',
            iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
            iconCls: 'text-cyan-600 dark:text-cyan-400',
            action: 'Configure',
          },
          {
            icon: Zap,
            title: 'Workflow Triggers',
            desc: 'Set up automated triggers based on events, schedules, or webhooks to streamline operations.',
            gradient: 'bg-amber-500',
            iconBg: 'bg-amber-100 dark:bg-amber-900/30',
            iconCls: 'text-amber-600 dark:text-amber-400',
            action: 'Add Trigger',
          },
        ].map(card => {
          const Icon = card.icon
          return (
            <div key={card.title} className="card overflow-hidden flex flex-col">
              <div className={`h-1 ${card.gradient}`} />
              <div className="p-5 flex flex-col flex-1">
                <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon size={20} className={card.iconCls} />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5 leading-snug">{card.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed flex-1">{card.desc}</p>
                <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button className="flex-1 btn-primary btn-sm rounded-lg text-xs">{card.action}</button>
                  <button className="btn-ghost btn-sm px-2.5 rounded-lg">
                    <MoreHorizontal size={15} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </Section>
    </div>
  )
}
