import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Plus, MoreHorizontal, Calendar, User, Flag, Paperclip, MessageSquare } from 'lucide-react'

const initialColumns = [
  {
    id: 'backlog',
    title: 'Backlog',
    color: 'bg-slate-500',
    cards: [
      { id: 1, title: 'Research competitor products', priority: 'Low', assignee: 'AJ', date: 'Mar 20', tags: ['Research'], comments: 2, attachments: 0 },
      { id: 2, title: 'Set up analytics tracking', priority: 'Medium', assignee: 'BS', date: 'Mar 22', tags: ['Dev'], comments: 0, attachments: 1 },
      { id: 3, title: 'Create email templates', priority: 'Low', assignee: 'CW', date: 'Mar 25', tags: ['Design'], comments: 3, attachments: 2 },
    ]
  },
  {
    id: 'inprogress',
    title: 'In Progress',
    color: 'bg-primary-500',
    cards: [
      { id: 4, title: 'Redesign landing page hero section', priority: 'High', assignee: 'DL', date: 'Mar 12', tags: ['Design', 'Dev'], comments: 5, attachments: 3 },
      { id: 5, title: 'Implement OAuth2 authentication', priority: 'High', assignee: 'EB', date: 'Mar 11', tags: ['Dev', 'Security'], comments: 4, attachments: 0 },
      { id: 6, title: 'Write API documentation', priority: 'Medium', assignee: 'FW', date: 'Mar 14', tags: ['Docs'], comments: 1, attachments: 1 },
      { id: 7, title: 'Fix responsive layout issues', priority: 'High', assignee: 'AJ', date: 'Mar 11', tags: ['Bug', 'Dev'], comments: 7, attachments: 0 },
    ]
  },
  {
    id: 'review',
    title: 'Review',
    color: 'bg-amber-500',
    cards: [
      { id: 8, title: 'Dashboard analytics charts', priority: 'Medium', assignee: 'BS', date: 'Mar 10', tags: ['Dev'], comments: 3, attachments: 2 },
      { id: 9, title: 'User onboarding flow', priority: 'High', assignee: 'CW', date: 'Mar 09', tags: ['Design', 'UX'], comments: 8, attachments: 4 },
      { id: 10, title: 'Performance optimization', priority: 'Medium', assignee: 'DL', date: 'Mar 10', tags: ['Dev'], comments: 2, attachments: 0 },
    ]
  },
  {
    id: 'done',
    title: 'Done',
    color: 'bg-emerald-500',
    cards: [
      { id: 11, title: 'Set up project repository', priority: 'Low', assignee: 'EB', date: 'Mar 01', tags: ['Dev'], comments: 0, attachments: 0 },
      { id: 12, title: 'Create design system tokens', priority: 'Medium', assignee: 'CW', date: 'Mar 03', tags: ['Design'], comments: 2, attachments: 5 },
      { id: 13, title: 'Deploy staging environment', priority: 'High', assignee: 'FW', date: 'Mar 05', tags: ['DevOps'], comments: 1, attachments: 0 },
      { id: 14, title: 'Stakeholder presentation', priority: 'High', assignee: 'EB', date: 'Mar 07', tags: ['Management'], comments: 3, attachments: 2 },
    ]
  },
]

const priorityColors = {
  High: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  Medium: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
  Low: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
}

const tagColors = [
  'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
]

const avatarColors = {
  AJ: 'bg-primary-500',
  BS: 'bg-cyan-500',
  CW: 'bg-emerald-500',
  DL: 'bg-amber-500',
  EB: 'bg-rose-500',
  FW: 'bg-primary-500',
}

function KanbanCard({ card }) {
  return (
    <div className="card p-4 cursor-grab hover:shadow-card-md transition-all duration-200 hover:-translate-y-0.5 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-wrap gap-1">
          {card.tags.map((tag, i) => (
            <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tagColors[i % tagColors.length]}`}>
              {tag}
            </span>
          ))}
        </div>
        <button className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-all">
          <MoreHorizontal size={14} />
        </button>
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 leading-snug">{card.title}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1 text-xs">
            <Calendar size={11} />
            {card.date}
          </span>
          {card.comments > 0 && (
            <span className="flex items-center gap-1 text-xs">
              <MessageSquare size={11} />
              {card.comments}
            </span>
          )}
          {card.attachments > 0 && (
            <span className="flex items-center gap-1 text-xs">
              <Paperclip size={11} />
              {card.attachments}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityColors[card.priority]}`}>
            {card.priority}
          </span>
          <div className={`w-7 h-7 rounded-full ${avatarColors[card.assignee] || 'bg-slate-500'} flex items-center justify-center`}>
            <span className="text-white text-[10px] font-bold">{card.assignee}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Kanban() {
  const [columns] = useState(initialColumns)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kanban Board"
        subtitle="Track and manage your project tasks"
        action={
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm"><Plus size={14} /> Add Column</button>
            <button className="btn btn-primary btn-sm"><Plus size={14} /> Add Task</button>
          </div>
        }
      />

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6">
        {columns.map(column => (
          <div key={column.id} className="min-w-[280px] w-72 shrink-0">
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${column.color}`} />
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">{column.title}</h3>
                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                  {column.cards.length}
                </span>
              </div>
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <MoreHorizontal size={16} />
              </button>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {column.cards.map(card => (
                <KanbanCard key={card.id} card={card} />
              ))}
              <button className="w-full flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-all text-sm">
                <Plus size={14} />
                Add card
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
