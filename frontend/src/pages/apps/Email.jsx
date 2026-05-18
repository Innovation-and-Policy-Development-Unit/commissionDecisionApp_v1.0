import { useState } from 'react'
import Avatar from '../../components/shared/Avatar'
import { Search, Star, Archive, Trash2, RefreshCw, Mail, Inbox, Send, FileText, Plus, X, ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

const folders = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, count: 12 },
  { id: 'sent', label: 'Sent', icon: Send, count: 0 },
  { id: 'drafts', label: 'Drafts', icon: FileText, count: 3 },
  { id: 'starred', label: 'Starred', icon: Star, count: 5 },
  { id: 'trash', label: 'Trash', icon: Trash2, count: 0 },
]

const labels = [
  { id: 'work', label: 'Work', color: 'bg-primary-500' },
  { id: 'personal', label: 'Personal', color: 'bg-cyan-500' },
  { id: 'important', label: 'Important', color: 'bg-red-500' },
  { id: 'finance', label: 'Finance', color: 'bg-emerald-500' },
]

const emails = [
  {
    id: 1, from: 'Alice Johnson', email: 'alice@company.com', subject: 'Q1 Product Roadmap Review',
    preview: 'Hi team, I wanted to share the updated product roadmap for Q1. Please review and provide feedback by EOD...',
    time: '10:24 AM', read: false, starred: true, label: 'work',
    body: `Hi John,

I wanted to share the updated product roadmap for Q1 2026. Please review the attached document and provide your feedback by end of day Friday.

Key highlights:
- Launch of Liner v2.0 with new dashboard features
- Mobile app beta release in March
- API v3 public launch in April
- Partnership integrations with 5 new vendors

Let me know if you have any questions or concerns.

Best regards,
Alice`
  },
  {
    id: 2, from: 'Bob Smith', email: 'bob@company.com', subject: 'PR #247 is ready for review',
    preview: 'Hey, I\'ve just pushed the changes for the new chart components. Would you mind reviewing when you get a chance?',
    time: '9:15 AM', read: false, starred: false, label: 'work',
    body: `Hey John,

I've just pushed the changes for the new chart components. The PR includes:

- Recharts integration with custom tooltips
- Dark mode support for all charts
- Responsive chart containers
- Custom color schemes matching the design system

PR link: https://github.com/liner/admin/pull/247

Would you mind reviewing when you get a chance? I'm available for a quick sync if needed.

Cheers,
Bob`
  },
  {
    id: 3, from: 'Stripe', email: 'noreply@stripe.com', subject: 'Your monthly statement is ready',
    preview: 'Your Stripe statement for February 2026 is now available. Total processed: $48,295.00',
    time: 'Yesterday', read: true, starred: false, label: 'finance',
    body: `Hi John,

Your Stripe statement for February 2026 is now available in your dashboard.

Summary:
- Total processed: $48,295.00
- Successful payments: 1,429
- Refunds: 12 ($847.00)
- Net volume: $47,448.00

Log in to your Stripe dashboard to view the full report.

The Stripe Team`
  },
  {
    id: 4, from: 'Carol Williams', email: 'carol@company.com', subject: 'Updated Figma designs for approval',
    preview: 'Hi! I\'ve updated the Figma file with the new color system and typography. Please check and approve so we can move forward...',
    time: 'Yesterday', read: true, starred: true, label: 'work',
    body: `Hi John,

I've updated the Figma file with the new color system and typography. You can view the designs here: [Figma Link]

Changes made:
- Updated primary color to Indigo-500/Violet-600 gradient
- New typography scale with Inter font
- Revised component library with dark mode variants
- Added new glassmorphism card styles

Please check and approve so we can move forward with implementation.

Carol`
  },
  {
    id: 5, from: 'GitHub', email: 'noreply@github.com', subject: 'Your repository "liner-admin" has been forked 50 times',
    preview: 'Congratulations! Your repository liner-admin has reached 50 forks. Thank you for your open source contribution.',
    time: 'Mar 9', read: true, starred: false, label: 'personal',
    body: `Hi John,

Congratulations! Your repository liner-admin has reached 50 forks.

This means 50 developers are building on top of your work. Thank you for your open source contribution to the community!

Here are your latest stats:
- ⭐ 342 Stars
- 🔀 50 Forks
- 👁️ 1,240 Watchers

Keep up the great work!

GitHub`
  },
  {
    id: 6, from: 'Emma Davis', email: 'emma@company.com', subject: 'Bug Report: Dashboard chart not loading on mobile',
    preview: 'Hi John, I found a bug where the revenue chart on the main dashboard doesn\'t render correctly on mobile devices...',
    time: 'Mar 8', read: true, starred: false, label: 'important',
    body: `Hi John,

I found a bug where the revenue chart on the main dashboard doesn't render correctly on mobile devices (iOS and Android).

Steps to reproduce:
1. Open the dashboard on a mobile device
2. Scroll to the Revenue Overview chart
3. The chart appears blank/doesn't render

Expected: Chart should display correctly
Actual: Blank white area

Device: iPhone 15 Pro (iOS 17.3)
Browser: Safari and Chrome

I've attached screenshots. Let me know if you need more info.

Emma`
  },
]

export default function Email() {
  const [activeFolder, setActiveFolder] = useState('inbox')
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [emailList, setEmailList] = useState(emails)
  const [composing, setComposing] = useState(false)
  const [search, setSearch] = useState('')

  const filteredEmails = emailList.filter(e =>
    e.subject.toLowerCase().includes(search.toLowerCase()) ||
    e.from.toLowerCase().includes(search.toLowerCase())
  )

  const toggleStar = (id) => {
    setEmailList(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e))
  }

  const markRead = (email) => {
    setEmailList(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e))
    setSelectedEmail(email)
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {/* Sidebar */}
      <div className="w-52 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0">
        <div className="p-4">
          <button
            onClick={() => setComposing(true)}
            className="w-full btn-gradient text-sm py-2.5"
          >
            <Plus size={15} />
            Compose
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-2">Folders</p>
          {folders.map(folder => {
            const Icon = folder.icon
            return (
              <button
                key={folder.id}
                onClick={() => { setActiveFolder(folder.id); setSelectedEmail(null) }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  activeFolder === folder.id
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                )}
              >
                <Icon size={16} />
                <span className="flex-1 text-left">{folder.label}</span>
                {folder.count > 0 && (
                  <span className="text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-full font-semibold">
                    {folder.count}
                  </span>
                )}
              </button>
            )
          })}

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-2 mt-3">Labels</p>
          {labels.map(label => (
            <button
              key={label.id}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            >
              <span className={clsx('w-2.5 h-2.5 rounded-full', label.color)} />
              {label.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Email List */}
      <div className={clsx(
        'flex flex-col border-r border-slate-200 dark:border-slate-700',
        selectedEmail ? 'w-72 shrink-0' : 'flex-1'
      )}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{activeFolder}</h3>
            <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search emails..."
              className="input pl-8 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredEmails.map(email => (
            <div
              key={email.id}
              onClick={() => markRead(email)}
              className={clsx(
                'email-item',
                !email.read && 'unread',
                selectedEmail?.id === email.id && 'bg-primary-50 dark:bg-primary-900/20'
              )}
            >
              <Avatar name={email.from} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={clsx('text-sm truncate', !email.read ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400')}>
                    {email.from}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0 ml-2">{email.time}</span>
                </div>
                <p className={clsx('text-xs truncate mb-0.5', !email.read ? 'font-medium text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400')}>
                  {email.subject}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{email.preview}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); toggleStar(email.id) }}
                className="p-1 shrink-0"
              >
                <Star size={14} className={email.starred ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Email Detail */}
      {selectedEmail ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSelectedEmail(null)}
              className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <div className="flex gap-2">
              <button className="btn-outline btn-sm"><Archive size={14} /> Archive</button>
              <button className="btn-danger btn-sm"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">{selectedEmail.subject}</h2>
            <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-700">
              <Avatar name={selectedEmail.from} size="lg" />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedEmail.from}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">&lt;{selectedEmail.email}&gt;</p>
                  </div>
                  <span className="text-sm text-slate-400 dark:text-slate-500">{selectedEmail.time}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">To: john@liner.com</p>
              </div>
            </div>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedEmail.body}</pre>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
              <textarea
                placeholder="Write a reply..."
                rows={4}
                className="input resize-none mb-3"
              />
              <div className="flex gap-2">
                <button className="btn-primary btn-sm"><Send size={13} /> Send Reply</button>
                <button className="btn-outline btn-sm">Save Draft</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900/20">
          <div className="text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Mail size={36} className="text-slate-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Select an email to read</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Choose from your inbox on the left</p>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {composing && (
        <div className="absolute bottom-0 right-0 w-96 bg-white dark:bg-slate-800 rounded-t-2xl shadow-card-lg border border-slate-200 dark:border-slate-700 z-50">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-primary rounded-t-2xl">
            <span className="text-white font-semibold text-sm">New Message</span>
            <button onClick={() => setComposing(false)} className="text-white/80 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 space-y-2">
            <input type="text" placeholder="To:" className="input text-sm" />
            <input type="text" placeholder="Subject:" className="input text-sm" />
            <textarea rows={8} placeholder="Write your message..." className="input resize-none text-sm" />
            <div className="flex gap-2 pt-1">
              <button className="btn-primary btn-sm flex-1"><Send size={13} /> Send</button>
              <button className="btn-outline btn-sm">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
