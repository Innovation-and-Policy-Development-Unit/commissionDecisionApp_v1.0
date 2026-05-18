import { useState, useRef, useEffect } from 'react'
import Avatar from '../../components/shared/Avatar'
import { Search, Send, Phone, Video, MoreHorizontal, Smile, Paperclip, Image, Mic } from 'lucide-react'
import clsx from 'clsx'

const contacts = [
  { id: 1, name: 'Alice Johnson', role: 'Product Manager', status: 'online', lastMsg: 'Sounds great! Let me check the timeline.', time: '2m', unread: 3 },
  { id: 2, name: 'Bob Smith', role: 'Developer', status: 'online', lastMsg: 'The PR is ready for review.', time: '15m', unread: 0 },
  { id: 3, name: 'Carol Williams', role: 'Designer', status: 'away', lastMsg: 'I updated the Figma file', time: '1h', unread: 1 },
  { id: 4, name: 'David Brown', role: 'Marketing', status: 'offline', lastMsg: 'See you tomorrow!', time: '3h', unread: 0 },
  { id: 5, name: 'Emma Davis', role: 'QA Engineer', status: 'online', lastMsg: 'Found 3 new bugs in the test...', time: '5h', unread: 0 },
  { id: 6, name: 'Frank Wilson', role: 'DevOps', status: 'busy', lastMsg: 'Deployment finished successfully', time: '1d', unread: 0 },
  { id: 7, name: 'Grace Lee', role: 'Data Analyst', status: 'online', lastMsg: 'The analytics report is ready', time: '2d', unread: 0 },
]

const initialMessages = {
  1: [
    { id: 1, from: 'them', text: 'Hey! Did you check the latest design mockups?', time: '10:24 AM' },
    { id: 2, from: 'me', text: 'Yes, they look amazing! Great work on the dashboard layout.', time: '10:26 AM' },
    { id: 3, from: 'them', text: 'Thanks! I was thinking we could add some glassmorphism effects to the cards. What do you think?', time: '10:28 AM' },
    { id: 4, from: 'me', text: 'That sounds like a great idea! It would give the UI a modern premium feel.', time: '10:30 AM' },
    { id: 5, from: 'them', text: 'Exactly my thought! I can have a prototype ready by tomorrow.', time: '10:32 AM' },
    { id: 6, from: 'me', text: 'Perfect. Let me know when it\'s done and I\'ll review it right away.', time: '10:35 AM' },
    { id: 7, from: 'them', text: 'Sounds great! Let me check the timeline.', time: '10:38 AM' },
  ],
}

export default function Chat() {
  const [activeContact, setActiveContact] = useState(contacts[0])
  const [messages, setMessages] = useState(initialMessages)
  const [inputText, setInputText] = useState('')
  const [search, setSearch] = useState('')
  const messagesEndRef = useRef(null)
  const scrollTimeoutRef = useRef(null)

  useEffect(() => () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
  }, [])

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const activeMessages = messages[activeContact.id] || []

  const sendMessage = () => {
    if (!inputText.trim()) return
    const newMsg = { id: Date.now(), from: 'me', text: inputText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    setMessages(prev => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), newMsg]
    }))
    setInputText('')
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {/* Contact List */}
      <div className="w-72 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-800 dark:text-slate-200 mb-3">Messages</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              className="input pl-8 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredContacts.map(contact => (
            <button
              key={contact.id}
              onClick={() => setActiveContact(contact)}
              className={clsx(
                'w-full flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left',
                activeContact.id === contact.id && 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800/30'
              )}
            >
              <Avatar name={contact.name} size="md" status={contact.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={clsx(
                    'text-sm font-semibold truncate',
                    activeContact.id === contact.id ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-slate-200'
                  )}>
                    {contact.name}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 ml-1">{contact.time}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{contact.lastMsg}</p>
              </div>
              {contact.unread > 0 && (
                <span className="w-5 h-5 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  {contact.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Avatar name={activeContact.name} size="md" status={activeContact.status} />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{activeContact.name}</p>
              <p className="text-xs text-emerald-500 capitalize">{activeContact.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors">
              <Phone size={18} />
            </button>
            <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors">
              <Video size={18} />
            </button>
            <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-slate-50 dark:bg-slate-900/30">
          {activeMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Avatar name={activeContact.name} size="xl" />
              <p className="text-slate-600 dark:text-slate-400 font-medium mt-3">{activeContact.name}</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Start the conversation!</p>
            </div>
          ) : (
            activeMessages.map(msg => (
              <div key={msg.id} className={clsx('flex items-end gap-2', msg.from === 'me' ? 'justify-end' : 'justify-start')}>
                {msg.from === 'them' && <Avatar name={activeContact.name} size="sm" />}
                <div className="max-w-xs">
                  <div className={msg.from === 'me' ? 'chat-bubble-sent' : 'chat-bubble-received'}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                  <p className={clsx('text-[11px] text-slate-400 dark:text-slate-500 mt-1', msg.from === 'me' ? 'text-right' : 'text-left')}>
                    {msg.time}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600">
            <button className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 transition-colors">
              <Paperclip size={18} />
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none"
            />
            <button className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 transition-colors">
              <Smile size={18} />
            </button>
            <button
              onClick={sendMessage}
              className="p-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 hover:shadow-glow transition-all"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
