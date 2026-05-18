import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { X, AlertTriangle, CheckCircle, Info, Trash2, Image, ZoomIn, ZoomOut, Download, Shield, User, Mail, Lock, Star, Crown, Zap, Send, Heart, Share2, Copy, Check, Bell, Clock, CreditCard, Gift, Sparkles, UserPlus, FileText, Settings, Search, ArrowRight, ExternalLink, MapPin, Calendar, Users, Globe, Twitter, Linkedin, Link2, UploadCloud } from 'lucide-react'
import { img } from '../../utils/imgPath'

function Modal({ open, onClose, size = 'md', title, children, footer }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-5xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-white dark:bg-slate-800 rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col animate-scale-in`}>
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-5 border-t border-slate-200 dark:border-slate-700 shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

export default function DialogPage() {
  const [modals, setModals] = useState({})
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef(null)
  const open = (key) => setModals(m => ({ ...m, [key]: true }))
  const close = (key) => setModals(m => ({ ...m, [key]: false }))
  const handleCopy = () => {
    setCopied(true)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Dialog / Modal" subtitle="Overlay dialogs for focused user interactions" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Size examples */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Modal Sizes</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Choose the right size for your content. From compact alerts to full-width layouts.</p>
          <div className="flex flex-wrap gap-3">
            {['sm', 'md', 'lg', 'xl'].map(size => (
              <button key={size} onClick={() => open(`size-${size}`)} className="btn btn-outline btn-sm">
                {size.toUpperCase()} Modal
              </button>
            ))}
          </div>
        </div>

        {/* Special dialogs */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Alert Dialogs</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Purpose-built dialogs for confirmations, success states, and informational messages.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => open('confirm')} className="btn btn-danger btn-sm"><Trash2 size={14} /> Confirm Delete</button>
            <button onClick={() => open('success')} className="btn btn-success btn-sm"><CheckCircle size={14} /> Success</button>
            <button onClick={() => open('info')} className="btn btn-info btn-sm"><Info size={14} /> Info</button>
          </div>
        </div>

        {/* Warning Dialogs */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Warning & Security</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Alert users before potentially dangerous or irreversible actions.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => open('warning')} className="btn btn-sm text-white bg-amber-500 hover:bg-amber-600 transition-all">
              <AlertTriangle size={14} /> Warning
            </button>
            <button onClick={() => open('warningConfirm')} className="btn btn-sm text-white bg-orange-500 hover:bg-orange-600 transition-all">
              <Shield size={14} /> Security Warning
            </button>
          </div>
        </div>

        {/* Image Preview */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Image Preview</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Full-screen image viewer with zoom controls and gallery navigation.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => open('imagePreview')} className="btn btn-sm text-white bg-primary-500 hover:bg-primary-600 transition-all">
              <Image size={14} /> View Gallery
            </button>
            <button onClick={() => open('imageSingle')} className="btn btn-outline btn-sm gap-2">
              <ZoomIn size={14} /> Preview Image
            </button>
          </div>
        </div>

        {/* Profile & User */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Profile & User</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">User profile previews, invite modals, and account settings dialogs.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => open('profile')} className="btn btn-primary btn-sm"><User size={14} /> User Profile</button>
            <button onClick={() => open('invite')} className="btn btn-outline btn-sm"><UserPlus size={14} /> Invite Team</button>
            <button onClick={() => open('form')} className="btn btn-outline btn-sm"><FileText size={14} /> Create User</button>
          </div>
        </div>

        {/* Premium & Pricing */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Pricing & Upgrade</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Upgrade prompts, subscription management, and payment dialogs.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => open('upgrade')} className="btn btn-sm bg-gradient-to-r from-violet-600 to-primary-600 text-white hover:opacity-90 transition-all"><Crown size={14} /> Upgrade to Pro</button>
            <button onClick={() => open('payment')} className="btn btn-outline btn-sm"><CreditCard size={14} /> Payment</button>
          </div>
        </div>

        {/* Share & Social */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Share & Export</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Share content via links, social media, or export to various formats.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => open('share')} className="btn btn-primary btn-sm"><Share2 size={14} /> Share</button>
            <button onClick={() => open('upload')} className="btn btn-outline btn-sm"><UploadCloud size={14} /> Upload Files</button>
          </div>
        </div>

        {/* Notifications & Activity */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Notifications & Activity</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Activity feed, notification center, and scrollable content dialogs.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => open('notifications')} className="btn btn-outline btn-sm"><Bell size={14} /> Notifications</button>
            <button onClick={() => open('scrollable')} className="btn btn-outline btn-sm"><FileText size={14} /> Terms</button>
            <button onClick={() => open('feedback')} className="btn btn-outline btn-sm"><Star size={14} /> Feedback</button>
          </div>
        </div>
      </div>

      {/* ===== All Modals ===== */}

      {/* Size Modals */}
      {['sm', 'md', 'lg', 'xl'].map(size => (
        <Modal key={size} open={!!modals[`size-${size}`]} onClose={() => close(`size-${size}`)} size={size} title={`${size.toUpperCase()} Modal Dialog`}
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => close(`size-${size}`)} className="btn btn-secondary btn-sm">Cancel</button>
              <button onClick={() => close(`size-${size}`)} className="btn btn-primary btn-sm">Confirm</button>
            </div>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            This is a {size.toUpperCase()} sized modal dialog. It can contain any content including forms, images, or complex layouts.
            The modal is responsive and adapts to different screen sizes.
          </p>
          {(size === 'lg' || size === 'xl') && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl overflow-hidden">
                <img src={img('/images/unsplash/coding-laptop.jpg')} alt="Code" className="w-full h-28 object-cover" />
              </div>
              <div className="rounded-xl overflow-hidden">
                <img src={img('/images/unsplash/code-screen-dark.jpg')} alt="Development" className="w-full h-28 object-cover" />
              </div>
            </div>
          )}
          {size === 'xl' && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { icon: Zap, label: 'Fast Performance', desc: 'Optimized for speed', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
                { icon: Shield, label: 'Secure', desc: 'Enterprise-grade security', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
                { icon: Globe, label: 'Global CDN', desc: 'Worldwide delivery', color: 'text-primary-500 bg-primary-50 dark:bg-primary-900/20' },
              ].map((f, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-center">
                  <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mx-auto mb-2`}>
                    <f.icon size={18} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{f.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          )}
        </Modal>
      ))}

      {/* Confirm Delete Dialog */}
      <Modal open={!!modals.confirm} onClose={() => close('confirm')} size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => close('confirm')} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={() => close('confirm')} className="btn btn-danger btn-sm">Delete</button>
          </div>
        }
      >
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={28} className="text-red-500" />
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-2">Delete Item?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">This action cannot be undone. The item will be permanently deleted from our servers.</p>
        </div>
      </Modal>

      {/* Form Dialog */}
      <Modal open={!!modals.form} onClose={() => close('form')} title="Create New User"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => close('form')} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={() => close('form')} className="btn btn-primary btn-sm">Create User</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex justify-center mb-2">
            <div className="relative">
              <img src={img('/images/avatars/avatar-lego.jpg')} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
              <button className="absolute bottom-0 end-0 w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center border-2 border-white dark:border-slate-800">
                <UploadCloud size={12} className="text-white" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">First Name</label>
              <input type="text" className="input text-sm" placeholder="John" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Last Name</label>
              <input type="text" className="input text-sm" placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
            <input type="email" className="input text-sm" placeholder="john@example.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Role</label>
            <select className="input text-sm"><option>Admin</option><option>Editor</option><option>Viewer</option></select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Bio</label>
            <textarea className="input text-sm resize-none" rows={2} placeholder="Tell us about this user..." />
          </div>
        </div>
      </Modal>

      {/* Success Dialog */}
      <Modal open={!!modals.success} onClose={() => close('success')} size="sm">
        <div className="text-center py-4">
          <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-2">Payment Successful!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Your transaction has been completed successfully.</p>
          <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 mb-5 text-start">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Amount</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">$249.99</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Transaction ID</span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-400">TXN-2026031287</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Date</span>
              <span className="text-slate-600 dark:text-slate-400">Mar 12, 2026</span>
            </div>
          </div>
          <button onClick={() => close('success')} className="btn btn-success w-full">Done</button>
        </div>
      </Modal>

      {/* Info Dialog */}
      <Modal open={!!modals.info} onClose={() => close('info')} size="sm">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center mx-auto mb-4">
            <Info size={32} className="text-cyan-500" />
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-2">Scheduled Maintenance</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Our servers will undergo maintenance on March 15, 2026 from 2:00 AM to 6:00 AM UTC.</p>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-800/30 mb-5">
            <Clock size={16} className="text-cyan-500 shrink-0" />
            <p className="text-xs text-cyan-700 dark:text-cyan-400 text-start">During this time, some features may be temporarily unavailable. We apologize for any inconvenience.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => close('info')} className="btn btn-secondary flex-1">Remind Me</button>
            <button onClick={() => close('info')} className="btn btn-info flex-1">Got It</button>
          </div>
        </div>
      </Modal>

      {/* Scrollable Dialog */}
      <Modal open={!!modals.scrollable} onClose={() => close('scrollable')} title="Terms & Conditions"
        footer={
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" />
              <span className="text-xs text-slate-500">I agree to the terms</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => close('scrollable')} className="btn btn-secondary btn-sm">Decline</button>
              <button onClick={() => close('scrollable')} className="btn btn-primary btn-sm">Accept</button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {[
            { title: 'Acceptance of Terms', text: 'By accessing and using this service, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this service.' },
            { title: 'User Accounts', text: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.' },
            { title: 'Intellectual Property', text: 'All content, features, and functionality of this service are owned by us and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.' },
            { title: 'Privacy Policy', text: 'Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your personal information when you use our services. By using our service, you consent to our data practices.' },
            { title: 'Limitation of Liability', text: 'In no event shall we be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.' },
            { title: 'Modifications to Terms', text: 'We reserve the right to modify these terms at any time. We will provide notice of significant changes by posting the new terms on this page and updating the effective date.' },
          ].map((section, i) => (
            <div key={i}>
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{i + 1}. {section.title}</h4>
              <p>{section.text}</p>
            </div>
          ))}
        </div>
      </Modal>

      {/* Warning Dialog */}
      <Modal open={!!modals.warning} onClose={() => close('warning')} size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => close('warning')} className="btn btn-secondary btn-sm">Go Back</button>
            <button onClick={() => close('warning')} className="btn btn-sm text-white bg-amber-500 hover:bg-amber-600 transition-colors">Proceed Anyway</button>
          </div>
        }
      >
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-amber-500" />
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-2">Warning</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">You are about to perform an action that may have unintended consequences.</p>
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3 text-start">
            <ul className="space-y-1.5 text-xs text-amber-700 dark:text-amber-400">
              <li className="flex items-start gap-2"><span className="mt-0.5">&#9679;</span> This will affect all linked records</li>
              <li className="flex items-start gap-2"><span className="mt-0.5">&#9679;</span> Connected integrations may be disrupted</li>
              <li className="flex items-start gap-2"><span className="mt-0.5">&#9679;</span> Changes may take up to 24 hours to propagate</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Security Warning Dialog */}
      <Modal open={!!modals.warningConfirm} onClose={() => close('warningConfirm')} size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => close('warningConfirm')} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={() => close('warningConfirm')} className="btn btn-sm text-white bg-orange-500 hover:bg-orange-600 transition-colors">Confirm Changes</button>
          </div>
        }
      >
        <div className="py-2">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-1">Security Settings Change</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">You are modifying security-sensitive settings that affect your entire organization.</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Two-factor authentication', from: 'Required', to: 'Optional', risk: 'high' },
              { label: 'Session timeout', from: '30 minutes', to: '24 hours', risk: 'medium' },
              { label: 'Password complexity', from: 'Strong', to: 'Moderate', risk: 'high' },
            ].map((change, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600">
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{change.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{change.from} → {change.to}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${change.risk === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                  {change.risk} risk
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Image Gallery Preview Dialog */}
      <Modal open={!!modals.imagePreview} onClose={() => close('imagePreview')} size="full">
        <div className="-m-5">
          <div className="bg-slate-950 rounded-t-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-white">Gallery Preview</span>
              <span className="text-xs text-slate-500">6 images</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <ZoomOut size={14} />
              </button>
              <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <ZoomIn size={14} />
              </button>
              <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="bg-slate-900 p-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { src: img('/images/unsplash/mountain-landscape.jpg'), label: 'Mountain Vista', size: '2.4 MB' },
                { src: img('/images/unsplash/beach-ocean.jpg'), label: 'Ocean Beach', size: '3.1 MB' },
                { src: img('/images/unsplash/forest-path.jpg'), label: 'Forest Path', size: '1.8 MB' },
                { src: img('/images/unsplash/morning-fog.jpg'), label: 'Morning Fog', size: '2.2 MB' },
                { src: img('/images/unsplash/flower-field.jpg'), label: 'Flower Field', size: '1.5 MB' },
                { src: img('/images/unsplash/starry-night-mountain.jpg'), label: 'Starry Night', size: '4.1 MB' },
              ].map((img, i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="aspect-video rounded-xl overflow-hidden relative">
                    <img src={img.src} alt={img.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-slate-300">{img.label}</p>
                    <p className="text-[10px] text-slate-500">{img.size}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-950 rounded-b-2xl p-3 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Click on an image to view full size</span>
            <button onClick={() => close('imagePreview')} className="btn btn-sm text-xs text-slate-400 hover:text-white">Close Gallery</button>
          </div>
        </div>
      </Modal>

      {/* Single Image Preview Dialog */}
      <Modal open={!!modals.imageSingle} onClose={() => close('imageSingle')} size="lg">
        <div className="-m-5">
          <div className="bg-slate-950 rounded-t-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image size={18} className="text-slate-400" />
              <div>
                <p className="text-sm font-medium text-white">landscape_hero.png</p>
                <p className="text-[10px] text-slate-500">1920 x 1080 - 2.4 MB</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <ZoomIn size={14} />
              </button>
              <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="bg-slate-900 p-4 flex items-center justify-center">
            <img src={img('/images/unsplash/mountain-landscape.jpg')} alt="Mountain landscape" className="w-full rounded-xl object-cover" />
          </div>
          <div className="bg-slate-950 rounded-b-2xl p-3 flex items-center justify-center gap-4">
            <button className="text-xs text-slate-400 hover:text-white transition-colors">Original Size</button>
            <span className="text-slate-700">|</span>
            <button className="text-xs text-primary-400 hover:text-primary-300 transition-colors">Fit to Screen</button>
            <span className="text-slate-700">|</span>
            <button className="text-xs text-slate-400 hover:text-white transition-colors">50%</button>
          </div>
        </div>
      </Modal>

      {/* User Profile Dialog */}
      <Modal open={!!modals.profile} onClose={() => close('profile')} size="md">
        <div className="-m-5">
          <div className="h-32 rounded-t-2xl overflow-hidden relative">
            <img src={img('/images/unsplash/beach-ocean.jpg')} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-10 mb-4 relative z-10">
              <img src={img('/images/avatars/avatar-woman-alice.jpg')} alt="Sarah Chen" className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-slate-800 shadow-lg" />
              <div className="pb-1">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Sarah Chen
                  <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center"><Check size={10} className="text-white" /></span>
                </h3>
                <p className="text-sm text-slate-500">Senior Product Designer</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Passionate about creating intuitive user experiences. 8+ years designing products used by millions worldwide.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Projects', value: '42' },
                { label: 'Followers', value: '2.8k' },
                { label: 'Following', value: '186' },
              ].map((stat, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-2 text-sm text-slate-500"><MapPin size={14} /> San Francisco, CA</div>
              <div className="flex items-center gap-2 text-sm text-slate-500"><Mail size={14} /> sarah.chen@example.com</div>
              <div className="flex items-center gap-2 text-sm text-slate-500"><Calendar size={14} /> Joined January 2023</div>
            </div>

            <div className="flex items-center gap-2 mb-5">
              {['Design Systems', 'UI/UX', 'Figma', 'Prototyping'].map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">{tag}</span>
              ))}
            </div>

            <div className="flex gap-3">
              <button className="btn btn-primary flex-1"><UserPlus size={14} /> Follow</button>
              <button className="btn btn-outline flex-1"><Mail size={14} /> Message</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Invite Team Dialog */}
      <Modal open={!!modals.invite} onClose={() => close('invite')} title="Invite Team Members"
        footer={
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">3 of 10 seats used</p>
            <div className="flex gap-2">
              <button onClick={() => close('invite')} className="btn btn-secondary btn-sm">Cancel</button>
              <button onClick={() => close('invite')} className="btn btn-primary btn-sm"><Send size={14} /> Send Invites</button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Email addresses</label>
            <textarea className="input text-sm resize-none" rows={2} placeholder="Enter email addresses, separated by commas..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Viewer', desc: 'Can view only', active: false },
                { label: 'Editor', desc: 'Can edit content', active: true },
                { label: 'Admin', desc: 'Full access', active: false },
              ].map((role, i) => (
                <label key={i} className={`p-3 rounded-xl border-2 cursor-pointer text-center transition-all ${role.active ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{role.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{role.desc}</p>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Current Members</p>
            <div className="space-y-2">
              {[
                { name: 'Sarah Chen', email: 'sarah@example.com', role: 'Admin', img: img('/images/avatars/avatar-woman-alice.jpg') },
                { name: 'Marcus Rivera', email: 'marcus@example.com', role: 'Editor', img: img('/images/avatars/avatar-man-bob.jpg') },
                { name: 'Emily Watson', email: 'emily@example.com', role: 'Viewer', img: img('/images/avatars/avatar-woman-carol.jpg') },
              ].map((member, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                  <img src={member.img} alt={member.name} className="w-9 h-9 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{member.name}</p>
                    <p className="text-xs text-slate-400 truncate">{member.email}</p>
                  </div>
                  <span className="badge badge-secondary text-[10px]">{member.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Upgrade to Pro Dialog */}
      <Modal open={!!modals.upgrade} onClose={() => close('upgrade')} size="md">
        <div className="-m-5">
          <div className="bg-gradient-to-br from-violet-600 via-primary-600 to-cyan-500 p-8 rounded-t-2xl text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-8 w-32 h-32 rounded-full bg-white blur-3xl" />
              <div className="absolute bottom-4 right-8 w-24 h-24 rounded-full bg-white blur-2xl" />
            </div>
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                <Crown size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Upgrade to Pro</h3>
              <p className="text-white/80 text-sm">Unlock all premium features and supercharge your workflow</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { icon: Zap, label: 'Unlimited Projects', desc: 'No limits on creations' },
                { icon: Users, label: 'Team Collaboration', desc: 'Up to 50 members' },
                { icon: Shield, label: 'Priority Support', desc: '24/7 dedicated help' },
                { icon: Sparkles, label: 'AI Features', desc: 'Smart automation tools' },
                { icon: Globe, label: 'Custom Domain', desc: 'Your brand, your URL' },
                { icon: Gift, label: 'Early Access', desc: 'New features first' },
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                    <feature.icon size={16} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{feature.label}</p>
                    <p className="text-[10px] text-slate-400">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-center">
                <p className="text-xs text-slate-500 mb-1">Monthly</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">$19<span className="text-sm font-normal text-slate-400">/mo</span></p>
              </div>
              <div className="p-4 rounded-xl border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-center relative">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary-500 text-white text-[10px] font-bold">SAVE 33%</span>
                <p className="text-xs text-primary-600 dark:text-primary-400 mb-1">Yearly</p>
                <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">$12<span className="text-sm font-normal text-primary-400">/mo</span></p>
              </div>
            </div>

            <button onClick={() => close('upgrade')} className="btn w-full bg-gradient-to-r from-violet-600 to-primary-600 text-white hover:opacity-90 transition-all py-3">
              <Sparkles size={16} /> Start Pro Trial — 14 days free
            </button>
            <p className="text-center text-[10px] text-slate-400 mt-2">No credit card required. Cancel anytime.</p>
          </div>
        </div>
      </Modal>

      {/* Payment Dialog */}
      <Modal open={!!modals.payment} onClose={() => close('payment')} title="Payment Details"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => close('payment')} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={() => close('payment')} className="btn btn-primary btn-sm"><Lock size={14} /> Pay $249.99</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="flex justify-between items-start mb-8">
                <div className="w-10 h-7 rounded bg-amber-400/80" />
                <CreditCard size={20} className="text-white/40" />
              </div>
              <p className="font-mono text-lg tracking-widest mb-4">•••• •••• •••• 4532</p>
              <div className="flex justify-between">
                <div>
                  <p className="text-[10px] text-white/50 uppercase">Card Holder</p>
                  <p className="text-sm font-medium">John Doe</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/50 uppercase">Expires</p>
                  <p className="text-sm font-medium">09/28</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Card Number</label>
            <input type="text" className="input text-sm font-mono" placeholder="1234 5678 9012 3456" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Expiry Date</label>
              <input type="text" className="input text-sm font-mono" placeholder="MM / YY" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">CVV</label>
              <input type="text" className="input text-sm font-mono" placeholder="•••" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Name on Card</label>
            <input type="text" className="input text-sm" placeholder="John Doe" />
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400">
            <Shield size={14} />
            <p className="text-xs font-medium">256-bit SSL encrypted payment</p>
          </div>
        </div>
      </Modal>

      {/* Share Dialog */}
      <Modal open={!!modals.share} onClose={() => close('share')} title="Share This Project">
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
            <img src={img('/images/unsplash/coding-laptop.jpg')} alt="Project" className="w-12 h-12 rounded-xl object-cover shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Dashboard Redesign</p>
              <p className="text-xs text-slate-400">Last edited 2 hours ago</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Share Link</label>
            <div className="flex gap-2">
              <input type="text" className="input text-sm flex-1 font-mono" value="https://app.liner.io/p/dsh-redesign" readOnly />
              <button onClick={handleCopy} className={`btn btn-sm shrink-0 ${copied ? 'btn-success' : 'btn-primary'}`}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">Share via</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: Mail, label: 'Email', color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200' },
                { icon: Twitter, label: 'Twitter', color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-500 hover:bg-sky-100' },
                { icon: Linkedin, label: 'LinkedIn', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100' },
                { icon: Link2, label: 'Embed', color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 hover:bg-violet-100' },
              ].map((item, i) => (
                <button key={i} className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${item.color}`}>
                  <item.icon size={20} />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">People with access</p>
            <div className="space-y-2">
              {[
                { name: 'You', email: 'you@example.com', role: 'Owner', img: img('/images/avatars/avatar-man-john.jpg') },
                { name: 'Alice Chen', email: 'alice@example.com', role: 'Can edit', img: img('/images/avatars/avatar-woman-alice.jpg') },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <img src={p.img} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.name}</p>
                    <p className="text-xs text-slate-400 truncate">{p.email}</p>
                  </div>
                  <span className="text-xs text-slate-500">{p.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Upload Files Dialog */}
      <Modal open={!!modals.upload} onClose={() => close('upload')} title="Upload Files"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => close('upload')} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={() => close('upload')} className="btn btn-primary btn-sm"><UploadCloud size={14} /> Upload All</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-primary-400 transition-colors cursor-pointer">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-3">
              <UploadCloud size={24} className="text-primary-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Drag & drop files here</p>
            <p className="text-xs text-slate-400 mb-3">or click to browse from your computer</p>
            <p className="text-[10px] text-slate-400">Supports: JPG, PNG, GIF, SVG, PDF up to 10MB</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Uploading (2 files)</p>
            {[
              { name: 'hero-banner.png', size: '2.4 MB', progress: 85 },
              { name: 'product-shots.zip', size: '8.1 MB', progress: 42 },
            ].map((file, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-primary-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{file.size}</p>
                  </div>
                  <span className="text-xs font-semibold text-primary-600">{file.progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
                  <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${file.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Notifications Dialog */}
      <Modal open={!!modals.notifications} onClose={() => close('notifications')} title="Notifications"
        footer={
          <div className="flex justify-between items-center">
            <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">Mark all as read</button>
            <button onClick={() => close('notifications')} className="btn btn-primary btn-sm">Done</button>
          </div>
        }
      >
        <div className="space-y-1 -mx-1">
          {[
            { img: img('/images/avatars/avatar-woman-alice.jpg'), name: 'Sarah Chen', action: 'commented on your design', project: 'Dashboard Redesign', time: '2 min ago', unread: true, icon: '💬' },
            { img: img('/images/avatars/avatar-man-bob.jpg'), name: 'Marcus Rivera', action: 'approved your pull request', project: 'Feature: Auth Flow', time: '15 min ago', unread: true, icon: '✅' },
            { img: img('/images/avatars/avatar-woman-carol.jpg'), name: 'Emily Watson', action: 'shared a file with you', project: 'Q1 Marketing Assets', time: '1 hour ago', unread: true, icon: '📎' },
            { img: img('/images/avatars/avatar-man-david.jpg'), name: 'Alex Kim', action: 'mentioned you in a comment', project: 'Sprint Planning', time: '3 hours ago', unread: false, icon: '@' },
            { img: img('/images/avatars/avatar-woman-grace.jpg'), name: 'Lisa Park', action: 'invited you to a project', project: 'Mobile App v2', time: '5 hours ago', unread: false, icon: '📨' },
            { img: img('/images/avatars/avatar-man-mike.jpg'), name: 'James Wilson', action: 'completed a task', project: 'Bug Fixes', time: '1 day ago', unread: false, icon: '🎯' },
          ].map((notif, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${notif.unread ? 'bg-primary-50/50 dark:bg-primary-900/10 hover:bg-primary-50 dark:hover:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
              <div className="relative shrink-0">
                <img src={notif.img} alt={notif.name} className="w-10 h-10 rounded-full object-cover" />
                <span className="absolute -bottom-0.5 -end-0.5 text-xs">{notif.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">{notif.name}</span>{' '}{notif.action}
                </p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">{notif.project}</p>
                <p className="text-xs text-slate-400 mt-0.5">{notif.time}</p>
              </div>
              {notif.unread && <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 shrink-0" />}
            </div>
          ))}
        </div>
      </Modal>

      {/* Feedback Dialog */}
      <Modal open={!!modals.feedback} onClose={() => close('feedback')} size="sm">
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
            <Star size={28} className="text-amber-500" />
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-1">How was your experience?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Your feedback helps us improve our product.</p>

          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map(star => (
              <button key={star} className="w-11 h-11 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center transition-colors group">
                <Star size={24} className="text-slate-300 group-hover:text-amber-400 group-hover:fill-amber-400 transition-colors" />
              </button>
            ))}
          </div>

          <textarea className="input text-sm resize-none mb-4 w-full" rows={3} placeholder="Tell us what you think... (optional)" />

          <div className="flex gap-2">
            <button onClick={() => close('feedback')} className="btn btn-secondary flex-1">Skip</button>
            <button onClick={() => close('feedback')} className="btn btn-primary flex-1"><Send size={14} /> Submit</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
