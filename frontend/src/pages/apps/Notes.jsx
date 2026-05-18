import { useState, memo } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Plus, Search, Star, Trash2, Edit2, Pin, X, Check } from 'lucide-react'
import clsx from 'clsx'

const noteColors = [
  { id: 'yellow', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', dot: 'bg-amber-400' },
  { id: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700', dot: 'bg-blue-400' },
  { id: 'green', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', dot: 'bg-emerald-400' },
  { id: 'purple', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-300 dark:border-violet-700', dot: 'bg-violet-400' },
  { id: 'pink', bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-300 dark:border-pink-700', dot: 'bg-pink-400' },
  { id: 'orange', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', dot: 'bg-orange-400' },
]

const initialNotes = [
  { id: 1, title: 'Dashboard Design Ideas', content: 'Add glassmorphism effects to stat cards. Consider adding a dark mode gradient background. Update typography to use Inter variable font. Add micro-animations for stat counters.', color: 'purple', pinned: true, starred: true, date: 'Mar 11, 2026', tags: ['Design', 'UI'] },
  { id: 2, title: 'Q1 Goals & Objectives', content: 'Launch Liner v2.0 with all new features. Reach 10k GitHub stars. Write 4 blog posts about the design system. Onboard 3 new enterprise clients.', color: 'blue', pinned: true, starred: false, date: 'Mar 10, 2026', tags: ['Goals'] },
  { id: 3, title: 'Meeting Notes - Product Review', content: 'Discussed new chart library migration. Team agreed to use Recharts for consistency. Need to update documentation. Next review scheduled for Mar 18.', color: 'green', pinned: false, starred: true, date: 'Mar 9, 2026', tags: ['Meeting', 'Work'] },
  { id: 4, title: 'API Integration Checklist', content: '☑ Set up authentication\n☑ Define API endpoints\n☐ Write integration tests\n☐ Update API documentation\n☐ Code review\n☐ Deploy to staging', color: 'yellow', pinned: false, starred: false, date: 'Mar 8, 2026', tags: ['Dev', 'API'] },
  { id: 5, title: 'Book Recommendations', content: 'The Design of Everyday Things - Don Norman\nDont Make Me Think - Steve Krug\nRefactoring UI - Adam Wathan\nAtomic Design - Brad Frost', color: 'pink', pinned: false, starred: true, date: 'Mar 7, 2026', tags: ['Books', 'Learning'] },
  { id: 6, title: 'Performance Optimization Notes', content: 'Lazy load heavy chart components. Use memo for StatCard. Implement virtual scrolling for long lists. Bundle size target: < 250kb gzipped.', color: 'orange', pinned: false, starred: false, date: 'Mar 6, 2026', tags: ['Dev', 'Performance'] },
]

function getColorConfig(colorId) {
  return noteColors.find(c => c.id === colorId) || noteColors[0]
}

export default function Notes() {
  const [notes, setNotes] = useState(initialNotes)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState('All')
  const [editingNote, setEditingNote] = useState(null)
  const [showNewNote, setShowNewNote] = useState(false)
  const [newNote, setNewNote] = useState({ title: '', content: '', color: 'yellow', tags: [] })

  const allTags = ['All', ...new Set(notes.flatMap(n => n.tags))]

  const filtered = notes.filter(n => {
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())
    const matchTag = activeTag === 'All' || n.tags.includes(activeTag)
    return matchSearch && matchTag
  })

  const pinned = filtered.filter(n => n.pinned)
  const others = filtered.filter(n => !n.pinned)

  const toggleStar = (id) => setNotes(prev => prev.map(n => n.id === id ? { ...n, starred: !n.starred } : n))
  const togglePin = (id) => setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n))
  const deleteNote = (id) => setNotes(prev => prev.filter(n => n.id !== id))

  const saveNewNote = () => {
    if (!newNote.title.trim() && !newNote.content.trim()) return
    setNotes(prev => [{
      id: Date.now(),
      ...newNote,
      pinned: false,
      starred: false,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }, ...prev])
    setNewNote({ title: '', content: '', color: 'yellow', tags: [] })
    setShowNewNote(false)
  }

  const NoteCard = ({ note }) => {
    const color = getColorConfig(note.color)
    return (
      <div className={clsx('note-card border-l-4 transition-all duration-200', color.bg, color.border, 'hover:shadow-card-md')}>
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-tight pr-2">{note.title}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => togglePin(note.id)} className={clsx('p-1 rounded hover:bg-black/5 transition-colors', note.pinned && 'text-primary-500')}>
              <Pin size={13} />
            </button>
            <button onClick={() => toggleStar(note.id)} className={clsx('p-1 rounded hover:bg-black/5 transition-colors', note.starred && 'text-amber-500')}>
              <Star size={13} className={note.starred ? 'fill-amber-500' : ''} />
            </button>
            <button onClick={() => deleteNote(note.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-4 mb-3 whitespace-pre-line">{note.content}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {note.tags.map(tag => (
              <span key={tag} className="text-[10px] bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{note.date}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle={`${notes.length} notes saved`}
        action={
          <button className="btn-primary" onClick={() => setShowNewNote(true)}>
            <Plus size={16} />
            New Note
          </button>
        }
      />

      {/* New Note Form */}
      {showNewNote && (
        <div className="card p-4 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            {noteColors.map(c => (
              <button
                key={c.id}
                onClick={() => setNewNote(p => ({ ...p, color: c.id }))}
                className={clsx('w-6 h-6 rounded-full transition-all', c.dot, newNote.color === c.id && 'ring-2 ring-offset-2 ring-slate-400')}
              />
            ))}
          </div>
          <input
            type="text"
            placeholder="Note title..."
            value={newNote.title}
            onChange={e => setNewNote(p => ({ ...p, title: e.target.value }))}
            className="w-full text-base font-semibold bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none mb-2"
          />
          <textarea
            placeholder="Write your note here..."
            value={newNote.content}
            onChange={e => setNewNote(p => ({ ...p, content: e.target.value }))}
            rows={4}
            className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-400 placeholder-slate-400 outline-none resize-none"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
            <button onClick={() => setShowNewNote(false)} className="btn-outline btn-sm">Cancel</button>
            <button onClick={saveNewNote} className="btn-primary btn-sm">
              <Check size={13} />
              Save Note
            </button>
          </div>
        </div>
      )}

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                activeTag === tag
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {pinned.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
            <Pin size={12} /> Pinned
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinned.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          {pinned.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Others</h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {others.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Edit2 size={32} className="text-slate-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">No notes found</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Create your first note to get started</p>
          <button onClick={() => setShowNewNote(true)} className="btn-primary mt-4">
            <Plus size={16} /> Create Note
          </button>
        </div>
      )}
    </div>
  )
}
