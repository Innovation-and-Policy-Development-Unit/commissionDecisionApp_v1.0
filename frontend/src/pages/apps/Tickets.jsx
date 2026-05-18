import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import Badge from '../../components/shared/Badge'
import Avatar from '../../components/shared/Avatar'
import { Plus, Search, Filter, Clock, MessageSquare, ChevronDown, Eye } from 'lucide-react'
import clsx from 'clsx'

const tickets = [
  { id: 'TKT-1001', title: 'Dashboard charts not rendering on mobile Safari', category: 'Bug', priority: 'high', status: 'open', assignee: 'Emma Davis', requester: 'Alice Johnson', created: 'Mar 11, 2026', responses: 4 },
  { id: 'TKT-1002', title: 'Request to add CSV export feature for data tables', category: 'Feature', priority: 'medium', status: 'in_progress', assignee: 'Bob Smith', requester: 'David Brown', created: 'Mar 10, 2026', responses: 7 },
  { id: 'TKT-1003', title: 'Dark mode toggle not saving user preference', category: 'Bug', priority: 'high', status: 'resolved', assignee: 'Frank Wilson', requester: 'Carol Williams', created: 'Mar 9, 2026', responses: 12 },
  { id: 'TKT-1004', title: 'Email notification for new orders is delayed', category: 'Bug', priority: 'medium', status: 'open', assignee: 'Grace Lee', requester: 'Henry Martinez', created: 'Mar 9, 2026', responses: 2 },
  { id: 'TKT-1005', title: 'Add multi-language support (i18n)', category: 'Feature', priority: 'low', status: 'open', assignee: 'Iris Chen', requester: 'James Anderson', created: 'Mar 8, 2026', responses: 5 },
  { id: 'TKT-1006', title: 'Performance degradation on Analytics page with large datasets', category: 'Performance', priority: 'high', status: 'in_progress', assignee: 'Bob Smith', requester: 'Emma Davis', created: 'Mar 7, 2026', responses: 8 },
  { id: 'TKT-1007', title: 'Sidebar menu item active state incorrect after page refresh', category: 'Bug', priority: 'medium', status: 'resolved', assignee: 'Iris Chen', requester: 'Frank Wilson', created: 'Mar 6, 2026', responses: 6 },
  { id: 'TKT-1008', title: 'Custom date range filter for reports', category: 'Feature', priority: 'low', status: 'closed', assignee: 'Grace Lee', requester: 'Bob Smith', created: 'Mar 5, 2026', responses: 3 },
]

const statusConfig = {
  open: { label: 'Open', variant: 'primary' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'secondary' },
}

const priorityConfig = {
  high: { label: 'High', variant: 'danger' },
  medium: { label: 'Medium', variant: 'warning' },
  low: { label: 'Low', variant: 'success' },
}

const categoryColors = {
  Bug: 'danger', Feature: 'primary', Performance: 'warning', Enhancement: 'info',
}

const stats = [
  { label: 'Open Tickets', value: 3, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
  { label: 'In Progress', value: 2, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { label: 'Resolved', value: 2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { label: 'Closed', value: 1, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700' },
]

export default function Tickets() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const filtered = tickets.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter
    return matchSearch && matchStatus && matchPriority
  })

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        subtitle="Manage and track customer support requests"
        action={
          <button className="btn-primary">
            <Plus size={16} />
            New Ticket
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {stats.map(stat => (
          <div key={stat.label} className={clsx('card p-4 flex items-center gap-4', stat.bg)}>
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className={`text-sm font-medium ${stat.color.replace('600', '500').replace('400', '300')}`}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-sm w-auto">
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="input text-sm w-auto">
          <option value="all">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Tickets Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Requester</th>
                <th>Created</th>
                <th>Responses</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ticket => {
                const status = statusConfig[ticket.status]
                const priority = priorityConfig[ticket.priority]
                return (
                  <tr key={ticket.id}>
                    <td className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{ticket.id}</td>
                    <td>
                      <div className="max-w-xs">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{ticket.title}</p>
                      </div>
                    </td>
                    <td><Badge variant={categoryColors[ticket.category] || 'secondary'}>{ticket.category}</Badge></td>
                    <td><Badge variant={priority.variant} dot>{priority.label}</Badge></td>
                    <td><Badge variant={status.variant}>{status.label}</Badge></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={ticket.assignee} size="sm" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{ticket.assignee}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 dark:text-slate-400 text-sm">{ticket.requester}</td>
                    <td className="text-slate-500 dark:text-slate-400 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {ticket.created}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <MessageSquare size={13} />
                        <span className="text-sm">{ticket.responses}</span>
                      </div>
                    </td>
                    <td>
                      <button className="btn-outline btn-sm gap-1">
                        <Eye size={13} />
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
