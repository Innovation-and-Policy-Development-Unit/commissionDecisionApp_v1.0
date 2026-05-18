import { useState, useRef, useEffect } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Info, User, Bell, Settings, ChevronDown, Heart, Share2, BookmarkPlus, MoreHorizontal, Edit, Trash2, Copy, ExternalLink, MapPin, Mail, Phone, Shield, Zap, Star, Crown, Calendar, Clock, CheckCircle, AlertTriangle, Sparkles, Globe, Twitter, Linkedin, Github, Gift, TrendingUp, Users, CreditCard, Download, Eye, MessageSquare, ArrowRight, Lock } from 'lucide-react'
import { img } from '../../utils/imgPath'

function Popover({ trigger, content, position = 'bottom' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const positions = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full me-2 top-1/2 -translate-y-1/2',
    right: 'left-full ms-2 top-1/2 -translate-y-1/2',
  }

  const arrows = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-200 dark:border-t-slate-600',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-200 dark:border-b-slate-600',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-200 dark:border-l-slate-600',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-200 dark:border-r-slate-600',
  }

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div className={`absolute z-50 ${positions[position]} animate-fade-in`}>
          <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-card-md p-4 min-w-48">
            <div className={`absolute w-0 h-0 border-4 ${arrows[position]}`} />
            {content}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PopoverPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Popover" subtitle="Floating content panels triggered by user interaction" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Position examples */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Positions</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-8">Popovers can appear in four directions relative to the trigger element.</p>
          <div className="flex flex-wrap items-center justify-center gap-8 py-8">
            {['top', 'bottom', 'left', 'right'].map(pos => (
              <Popover key={pos} position={pos}
                trigger={
                  <button className="btn btn-outline btn-sm capitalize">{pos}</button>
                }
                content={
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-1">Popover {pos}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">This popover opens to the {pos}.</p>
                  </div>
                }
              />
            ))}
          </div>
        </div>

        {/* Color Variants */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Color Variants</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Popovers with colored headers for different contextual meanings.</p>
          <div className="flex flex-wrap gap-4">
            {[
              { label: 'Primary', gradient: 'bg-primary-500', icon: Zap, desc: 'Primary actions and highlights' },
              { label: 'Success', gradient: 'bg-emerald-500', icon: Shield, desc: 'Completed or verified states' },
              { label: 'Warning', gradient: 'bg-amber-500', icon: Star, desc: 'Items needing attention' },
              { label: 'Danger', gradient: 'bg-rose-500', icon: Info, desc: 'Critical alerts and errors' },
            ].map((item) => (
              <Popover key={item.label}
                trigger={
                  <button className={`btn btn-sm text-white ${item.gradient} hover:opacity-90 transition-opacity`}>{item.label}</button>
                }
                content={
                  <div className="w-56">
                    <div className={`-mx-4 -mt-4 mb-3 px-4 py-3 rounded-t-xl ${item.gradient}`}>
                      <div className="flex items-center gap-2 text-white">
                        <item.icon size={16} />
                        <span className="font-semibold text-sm">{item.label} Notice</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <button className="text-xs text-primary-500 hover:text-primary-600 font-medium transition-colors">Learn more</button>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        </div>

        {/* Rich Profile Popovers */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Profile Popovers</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Detailed user profile cards with cover images, avatars, and social stats.</p>
          <div className="flex flex-wrap gap-4">
            {[
              { name: 'Sarah Connor', role: 'Product Designer', img: img('/images/avatars/avatar-woman-alice.jpg'), cover: img('/images/unsplash/beach-ocean.jpg'), location: 'San Francisco, CA', email: 'sarah@acme.co', projects: 24, followers: '1.2k' },
              { name: 'Alex Rivera', role: 'Full-Stack Developer', img: img('/images/avatars/avatar-man-bob.jpg'), cover: img('/images/unsplash/mountain-landscape.jpg'), location: 'New York, NY', email: 'alex@acme.co', projects: 38, followers: '890' },
              { name: 'Maya Chen', role: 'Engineering Manager', img: img('/images/avatars/avatar-woman-carol.jpg'), cover: img('/images/unsplash/forest-path.jpg'), location: 'Austin, TX', email: 'maya@acme.co', projects: 15, followers: '2.1k' },
            ].map((user) => (
              <Popover key={user.name}
                trigger={
                  <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors">
                    <img src={user.img} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{user.name}</span>
                  </button>
                }
                content={
                  <div className="w-64">
                    <div className="-mx-4 -mt-4 h-20 rounded-t-xl overflow-hidden relative">
                      <img src={user.cover} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                    <div className="-mt-8 mb-3 flex flex-col items-center relative z-10">
                      <img src={user.img} alt={user.name} className="w-14 h-14 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-md" />
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mt-2">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.role}</p>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin size={12} /> {user.location}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Mail size={12} /> {user.email}
                      </div>
                    </div>
                    <div className="flex gap-4 py-2 border-t border-slate-100 dark:border-slate-700">
                      <div className="text-center flex-1">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{user.projects}</p>
                        <p className="text-[10px] text-slate-400">Projects</p>
                      </div>
                      <div className="text-center flex-1">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{user.followers}</p>
                        <p className="text-[10px] text-slate-400">Followers</p>
                      </div>
                    </div>
                    <button className="w-full mt-2 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors">View Full Profile</button>
                  </div>
                }
              />
            ))}
          </div>
        </div>

        {/* Custom content popovers */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Custom Content Popovers</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Rich content popovers with custom layouts and interactive elements.</p>
          <div className="flex flex-wrap gap-4">
            {/* User Info Popover */}
            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <User size={14} /> User Info
                </button>
              }
              content={
                <div className="w-52">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={img('/images/avatars/avatar-man-john.jpg')} alt="John Doe" className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">John Doe</p>
                      <p className="text-xs text-slate-500">john@example.com</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1">
                    <button className="w-full text-start text-xs text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 py-1 transition-colors">View Profile</button>
                    <button className="w-full text-start text-xs text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 py-1 transition-colors">Account Settings</button>
                    <button className="w-full text-start text-xs text-red-500 hover:text-red-600 py-1 transition-colors">Sign Out</button>
                  </div>
                </div>
              }
            />

            {/* Notification Popover */}
            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Bell size={14} /> Notifications
                </button>
              }
              content={
                <div className="w-72">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Notifications</p>
                    <span className="px-1.5 py-0.5 rounded-full bg-primary-500 text-white text-[10px] font-bold">3 new</span>
                  </div>
                  {[
                    { text: 'Sarah commented on your design', time: '2m ago', img: img('/images/avatars/avatar-woman-alice.jpg'), dot: 'bg-primary-500' },
                    { text: 'Marcus approved your PR', time: '1h ago', img: img('/images/avatars/avatar-man-bob.jpg'), dot: 'bg-emerald-500' },
                    { text: 'System update available', time: '3h ago', img: null, dot: 'bg-amber-500' },
                  ].map((n, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 -mx-2 px-2 rounded-lg cursor-pointer transition-colors">
                      {n.img ? (
                        <img src={n.img} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className={`w-8 h-8 rounded-full ${n.dot} flex items-center justify-center shrink-0`}>
                          <Bell size={12} className="text-white" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-700 dark:text-slate-300">{n.text}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                  <button className="w-full text-center text-xs text-primary-500 hover:text-primary-600 font-medium mt-2 py-1 transition-colors">View all notifications</button>
                </div>
              }
            />

            {/* Info Popover */}
            <Popover
              trigger={
                <button className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-500 hover:bg-primary-100 transition-colors">
                  <Info size={15} />
                </button>
              }
              content={
                <div className="w-56">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-1">Important Info</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">This field is required. Please provide valid information to continue with the process.</p>
                </div>
              }
            />

            {/* Dropdown Style Popover */}
            <Popover
              trigger={
                <button className="btn btn-primary btn-sm gap-2">
                  Options <ChevronDown size={13} />
                </button>
              }
              content={
                <div className="w-44">
                  {[
                    { label: 'Edit Item', icon: Edit },
                    { label: 'Duplicate', icon: Copy },
                    { label: 'Share', icon: Share2 },
                    { label: 'Archive', icon: BookmarkPlus },
                  ].map((action, i) => (
                    <button key={i} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors">
                      <action.icon size={13} />
                      {action.label}
                    </button>
                  ))}
                </div>
              }
            />
          </div>
        </div>

        {/* Product Preview Popover */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Product Preview</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Hover-style product cards with image, price, and quick actions.</p>
          <div className="flex flex-wrap gap-4">
            {[
              { name: 'Wireless Headphones', price: '$249.99', rating: 4.8, reviews: 328, img: img('/images/unsplash/wireless-headphones.jpg'), badge: 'Best Seller' },
              { name: 'Mechanical Keyboard', price: '$149.99', rating: 4.5, reviews: 156, img: img('/images/unsplash/mechanical-keyboard.jpg'), badge: 'New' },
              { name: 'Minimalist Watch', price: '$319.00', rating: 4.9, reviews: 89, img: img('/images/unsplash/minimalist-watch.jpg'), badge: '-29%' },
            ].map((product) => (
              <Popover key={product.name}
                trigger={
                  <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors">
                    <img src={product.img} alt={product.name} className="w-8 h-8 rounded-lg object-cover" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{product.name}</span>
                  </button>
                }
                content={
                  <div className="w-64">
                    <div className="-mx-4 -mt-4 h-36 rounded-t-xl overflow-hidden relative">
                      <img src={product.img} alt={product.name} className="w-full h-full object-cover" />
                      <span className="absolute top-2 start-2 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">{product.badge}</span>
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star key={j} size={10} className={j < Math.floor(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-400">{product.rating} ({product.reviews})</span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{product.price}</span>
                        <button className="px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors">Add to Cart</button>
                      </div>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        </div>

        {/* Event / Calendar Popover */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Event Preview</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Calendar event details with attendees, time, and location info.</p>
          <div className="flex flex-wrap gap-4">
            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Calendar size={14} /> Team Standup
                </button>
              }
              content={
                <div className="w-72">
                  <div className="-mx-4 -mt-4 mb-3 px-4 py-3 rounded-t-xl bg-gradient-to-r from-primary-500 to-cyan-500">
                    <p className="font-semibold text-sm text-white">Daily Team Standup</p>
                    <p className="text-xs text-white/70 mt-0.5">Engineering Team</p>
                  </div>
                  <div className="space-y-2.5 mb-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <Clock size={13} className="text-primary-500 shrink-0" />
                      <span>Today, 9:00 AM - 9:30 AM (30 min)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <MapPin size={13} className="text-primary-500 shrink-0" />
                      <span>Conference Room B / Zoom Meeting</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <Globe size={13} className="text-primary-500 shrink-0" />
                      <span className="text-primary-500 hover:underline cursor-pointer">meet.zoom.us/j/123456789</span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Attendees (5)</p>
                    <div className="flex items-center">
                      {[
                        img('/images/avatars/avatar-woman-alice.jpg'),
                        img('/images/avatars/avatar-man-bob.jpg'),
                        img('/images/avatars/avatar-woman-carol.jpg'),
                        img('/images/avatars/avatar-man-david.jpg'),
                        img('/images/avatars/avatar-woman-grace.jpg'),
                      ].map((avatar, i) => (
                        <img key={i} src={avatar} alt="" className="-ms-1.5 first:ms-0 w-7 h-7 rounded-full object-cover border-2 border-white dark:border-slate-800" />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors">Join Meeting</button>
                    <button className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">Decline</button>
                  </div>
                </div>
              }
            />

            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Calendar size={14} /> Design Review
                </button>
              }
              content={
                <div className="w-72">
                  <div className="-mx-4 -mt-4 mb-3 px-4 py-3 rounded-t-xl bg-gradient-to-r from-violet-500 to-rose-500">
                    <p className="font-semibold text-sm text-white">Design Review: Dashboard v3</p>
                    <p className="text-xs text-white/70 mt-0.5">Product Design</p>
                  </div>
                  <div className="space-y-2.5 mb-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <Clock size={13} className="text-violet-500 shrink-0" />
                      <span>Tomorrow, 2:00 PM - 3:00 PM (1 hour)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <MapPin size={13} className="text-violet-500 shrink-0" />
                      <span>Design Studio / Floor 3</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-violet-50 dark:bg-violet-900/10 mb-3">
                    <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">Review the new dashboard wireframes and gather feedback from stakeholders before dev handoff.</p>
                  </div>
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Attendees (3)</p>
                    <div className="flex items-center">
                      {[
                        img('/images/avatars/avatar-woman-jessica.jpg'),
                        img('/images/avatars/avatar-man-mike.jpg'),
                        img('/images/avatars/avatar-woman-sarah-kim.jpg'),
                      ].map((avatar, i) => (
                        <img key={i} src={avatar} alt="" className="-ms-1.5 first:ms-0 w-7 h-7 rounded-full object-cover border-2 border-white dark:border-slate-800" />
                      ))}
                    </div>
                  </div>
                  <button className="w-full py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium transition-colors">Accept Invite</button>
                </div>
              }
            />
          </div>
        </div>

        {/* Upgrade / Premium Popover */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Premium Popovers</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Upgrade prompts, feature previews, and premium content teasers.</p>
          <div className="flex flex-wrap gap-4">
            <Popover
              trigger={
                <button className="btn btn-sm bg-gradient-to-r from-violet-600 to-primary-600 text-white hover:opacity-90 transition-all gap-2">
                  <Crown size={14} /> Upgrade
                </button>
              }
              content={
                <div className="w-72">
                  <div className="-mx-4 -mt-4 mb-4 px-4 py-4 rounded-t-xl bg-gradient-to-br from-violet-600 via-primary-600 to-cyan-500 text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-2 left-4 w-16 h-16 rounded-full bg-white blur-2xl" />
                      <div className="absolute bottom-2 right-4 w-12 h-12 rounded-full bg-white blur-xl" />
                    </div>
                    <Crown size={28} className="text-white mx-auto mb-2 relative z-10" />
                    <p className="font-bold text-white text-sm relative z-10">Go Pro Today</p>
                    <p className="text-white/70 text-xs mt-0.5 relative z-10">Unlock all premium features</p>
                  </div>
                  <div className="space-y-2 mb-4">
                    {[
                      { icon: Zap, text: 'Unlimited projects' },
                      { icon: Users, text: 'Team collaboration' },
                      { icon: Shield, text: 'Priority support' },
                      { icon: Sparkles, text: 'AI-powered features' },
                    ].map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <f.icon size={13} className="text-primary-500" />
                        <span>{f.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center mb-3">
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-200">$12</span>
                    <span className="text-sm text-slate-400">/mo</span>
                  </div>
                  <button className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600 to-primary-600 text-white text-xs font-semibold hover:opacity-90 transition-all">Start Free Trial</button>
                  <p className="text-center text-[10px] text-slate-400 mt-1.5">14-day free trial. Cancel anytime.</p>
                </div>
              }
            />

            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Lock size={14} /> Pro Feature
                </button>
              }
              content={
                <div className="w-64">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                      <Sparkles size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">AI Smart Assist</p>
                      <p className="text-xs text-slate-500 mt-0.5">This feature requires a Pro plan</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">Get AI-powered suggestions, auto-completions, and intelligent insights to boost your productivity.</p>
                  <div className="-mx-4 -mb-4 p-3 rounded-b-xl bg-amber-50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-800/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Upgrade to unlock</span>
                      <button className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors flex items-center gap-1">
                        <Crown size={10} /> Upgrade
                      </button>
                    </div>
                  </div>
                </div>
              }
            />

            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Gift size={14} /> Special Offer
                </button>
              }
              content={
                <div className="w-64">
                  <div className="-mx-4 -mt-4 mb-3 rounded-t-xl overflow-hidden relative h-28">
                    <img src={img('/images/unsplash/starry-night-mountain.jpg')} alt="Offer" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 start-4">
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">LIMITED TIME</span>
                      <p className="font-bold text-white text-sm mt-1">50% Off Annual Plan</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">Get our annual Pro plan at half price. This offer expires in 48 hours!</p>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">23</p>
                      <p className="text-[10px] text-slate-400">Hours</p>
                    </div>
                    <span className="text-slate-300">:</span>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">45</p>
                      <p className="text-[10px] text-slate-400">Min</p>
                    </div>
                    <span className="text-slate-300">:</span>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">12</p>
                      <p className="text-[10px] text-slate-400">Sec</p>
                    </div>
                  </div>
                  <button className="w-full py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors">Claim Offer</button>
                </div>
              }
            />
          </div>
        </div>

        {/* Stats & Analytics Popover */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Stats & Analytics</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Quick analytics previews and stat breakdowns in compact popovers.</p>
          <div className="flex flex-wrap gap-4">
            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <TrendingUp size={14} /> Revenue
                </button>
              }
              content={
                <div className="w-64">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Revenue Overview</p>
                    <span className="text-xs text-emerald-500 font-semibold flex items-center gap-0.5"><TrendingUp size={10} /> +12.5%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label: 'This Month', value: '$48.2k', color: 'text-primary-600 dark:text-primary-400' },
                      { label: 'Last Month', value: '$42.8k', color: 'text-slate-600 dark:text-slate-400' },
                      { label: 'Growth', value: '12.5%', color: 'text-emerald-600' },
                      { label: 'Target', value: '$50k', color: 'text-amber-600' },
                    ].map((stat, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/30">
                        <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-slate-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 h-12 items-end">
                    {[35, 52, 48, 65, 42, 70, 58, 82, 68, 75, 90, 85].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-primary-400 dark:bg-primary-500 transition-all hover:bg-primary-500 dark:hover:bg-primary-400 cursor-pointer" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-slate-400">Jan</span>
                    <span className="text-[9px] text-slate-400">Dec</span>
                  </div>
                </div>
              }
            />

            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Eye size={14} /> Page Views
                </button>
              }
              content={
                <div className="w-60">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-1">Page Views</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-3">24,892 <span className="text-xs font-normal text-emerald-500">+8.3%</span></p>
                  <div className="space-y-2">
                    {[
                      { page: '/dashboard', views: '8,421', pct: 34 },
                      { page: '/products', views: '5,832', pct: 23 },
                      { page: '/checkout', views: '4,210', pct: 17 },
                      { page: '/blog', views: '3,645', pct: 15 },
                      { page: '/about', views: '2,784', pct: 11 },
                    ].map((p, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-slate-600 dark:text-slate-400 font-mono">{p.page}</span>
                          <span className="text-slate-500">{p.views}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                          <div className="h-full rounded-full bg-primary-500" style={{ width: `${p.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              }
            />

            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Users size={14} /> Visitors
                </button>
              }
              content={
                <div className="w-64">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-3">Active Visitors</p>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-full border-4 border-primary-500 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">847</span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Online right now</p>
                      <p className="text-xs text-emerald-500 font-medium flex items-center gap-1"><TrendingUp size={10} /> 23% more than usual</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Top Locations</p>
                    {[
                      { country: 'United States', flag: '🇺🇸', visitors: 312 },
                      { country: 'United Kingdom', flag: '🇬🇧', visitors: 186 },
                      { country: 'Germany', flag: '🇩🇪', visitors: 124 },
                      { country: 'Japan', flag: '🇯🇵', visitors: 98 },
                    ].map((loc, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <span>{loc.flag}</span> {loc.country}
                        </span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{loc.visitors}</span>
                      </div>
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        </div>

        {/* Action Menu Popover */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Action Menu Popovers</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Contextual action menus with icons, descriptions, and grouped sections.</p>
          <div className="flex flex-wrap gap-4">
            {/* Social Actions Popover */}
            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Share2 size={14} /> Share
                </button>
              }
              content={
                <div className="w-56">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-2">Share this item</p>
                  <div className="space-y-0.5">
                    {[
                      { icon: Copy, label: 'Copy link', desc: 'Copy to clipboard', color: 'text-slate-500' },
                      { icon: Mail, label: 'Send via email', desc: 'Share with others', color: 'text-blue-500' },
                      { icon: Twitter, label: 'Share on Twitter', desc: 'Post to timeline', color: 'text-sky-500' },
                      { icon: Linkedin, label: 'Share on LinkedIn', desc: 'Professional network', color: 'text-blue-700' },
                    ].map((item, i) => (
                      <button key={i} className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-start">
                        <div className={`w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center ${item.color} shrink-0`}>
                          <item.icon size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
                          <p className="text-[10px] text-slate-400">{item.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              }
            />

            {/* More Actions Popover */}
            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <MoreHorizontal size={14} /> More Actions
                </button>
              }
              content={
                <div className="w-52">
                  <div className="space-y-0.5 mb-2">
                    {[
                      { icon: Edit, label: 'Edit', color: 'text-primary-500' },
                      { icon: Copy, label: 'Duplicate', color: 'text-cyan-500' },
                      { icon: BookmarkPlus, label: 'Save to collection', color: 'text-amber-500' },
                      { icon: Heart, label: 'Add to favorites', color: 'text-rose-500' },
                    ].map((item, i) => (
                      <button key={i} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <item.icon size={14} className={item.color} />
                        <span className="text-xs text-slate-700 dark:text-slate-300">{item.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 size={14} className="text-red-500" />
                      <span className="text-xs text-red-500">Delete</span>
                    </button>
                  </div>
                </div>
              }
            />

            {/* Quick Settings Popover */}
            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Settings size={14} /> Quick Settings
                </button>
              }
              content={
                <div className="w-60">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-3">Quick Settings</p>
                  {[
                    { label: 'Email Notifications', desc: 'Get notified on updates', checked: true },
                    { label: 'Auto-save drafts', desc: 'Save every 30 seconds', checked: true },
                    { label: 'Dark mode', desc: 'Use dark theme', checked: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
                        <p className="text-[10px] text-slate-400">{item.desc}</p>
                      </div>
                      <div className={`w-8 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${item.checked ? 'bg-primary-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}>
                        <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              }
            />

            {/* Status Popover */}
            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <CheckCircle size={14} /> Set Status
                </button>
              }
              content={
                <div className="w-56">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-3">Set your status</p>
                  <div className="space-y-1">
                    {[
                      { emoji: '💻', label: 'Working', desc: 'Heads down, coding', color: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/10' },
                      { emoji: '🍔', label: 'On lunch', desc: 'Back in 30 min', color: 'hover:bg-amber-50 dark:hover:bg-amber-900/10' },
                      { emoji: '🏠', label: 'Working remotely', desc: 'Available online', color: 'hover:bg-sky-50 dark:hover:bg-sky-900/10' },
                      { emoji: '🎧', label: 'In a meeting', desc: 'Do not disturb', color: 'hover:bg-rose-50 dark:hover:bg-rose-900/10' },
                      { emoji: '🌴', label: 'On vacation', desc: 'Back March 20', color: 'hover:bg-violet-50 dark:hover:bg-violet-900/10' },
                    ].map((status, i) => (
                      <button key={i} className={`w-full flex items-center gap-3 p-2 rounded-lg ${status.color} transition-colors text-start`}>
                        <span className="text-lg">{status.emoji}</span>
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{status.label}</p>
                          <p className="text-[10px] text-slate-400">{status.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              }
            />

            {/* Download Popover */}
            <Popover
              trigger={
                <button className="btn btn-outline btn-sm gap-2">
                  <Download size={14} /> Download
                </button>
              }
              content={
                <div className="w-56">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-3">Download As</p>
                  <div className="space-y-1">
                    {[
                      { ext: 'PDF', size: '2.4 MB', icon: '📄', color: 'bg-red-50 dark:bg-red-900/10' },
                      { ext: 'XLSX', size: '1.8 MB', icon: '📊', color: 'bg-emerald-50 dark:bg-emerald-900/10' },
                      { ext: 'CSV', size: '890 KB', icon: '📋', color: 'bg-sky-50 dark:bg-sky-900/10' },
                      { ext: 'PNG', size: '3.2 MB', icon: '🖼️', color: 'bg-violet-50 dark:bg-violet-900/10' },
                    ].map((f, i) => (
                      <button key={i} className={`w-full flex items-center gap-3 p-2.5 rounded-lg ${f.color} hover:opacity-80 transition-all text-start`}>
                        <span className="text-lg">{f.icon}</span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{f.ext} Format</p>
                          <p className="text-[10px] text-slate-400">{f.size}</p>
                        </div>
                        <Download size={12} className="text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
