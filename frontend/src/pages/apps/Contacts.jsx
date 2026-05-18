import { useState } from 'react'
import Avatar from '../../components/shared/Avatar'
import Badge from '../../components/shared/Badge'
import PageHeader from '../../components/shared/PageHeader'
import { Search, Plus, Mail, Phone, MapPin, MoreHorizontal, Grid3X3, List, Filter } from 'lucide-react'

const contacts = [
  { id: 1, name: 'Alice Johnson', role: 'Product Manager', company: 'TechCorp', email: 'alice@techcorp.com', phone: '+1 (555) 234-5678', location: 'San Francisco, CA', status: 'active', tags: ['Work', 'VIP'] },
  { id: 2, name: 'Bob Smith', role: 'Senior Developer', company: 'WebSolutions', email: 'bob@websolutions.com', phone: '+1 (555) 345-6789', location: 'Austin, TX', status: 'active', tags: ['Work'] },
  { id: 3, name: 'Carol Williams', role: 'UX Designer', company: 'DesignHub', email: 'carol@designhub.com', phone: '+1 (555) 456-7890', location: 'New York, NY', status: 'inactive', tags: ['Freelance'] },
  { id: 4, name: 'David Brown', role: 'Marketing Director', company: 'GrowthCo', email: 'david@growthco.com', phone: '+1 (555) 567-8901', location: 'Chicago, IL', status: 'active', tags: ['Partner', 'VIP'] },
  { id: 5, name: 'Emma Davis', role: 'QA Lead', company: 'QualityFirst', email: 'emma@qualityfirst.com', phone: '+1 (555) 678-9012', location: 'Seattle, WA', status: 'active', tags: ['Work'] },
  { id: 6, name: 'Frank Wilson', role: 'DevOps Engineer', company: 'CloudBase', email: 'frank@cloudbase.com', phone: '+1 (555) 789-0123', location: 'Denver, CO', status: 'active', tags: ['Work'] },
  { id: 7, name: 'Grace Lee', role: 'Data Scientist', company: 'DataDriven', email: 'grace@datadriven.com', phone: '+1 (555) 890-1234', location: 'Boston, MA', status: 'inactive', tags: ['Consultant'] },
  { id: 8, name: 'Henry Martinez', role: 'CEO', company: 'InnovateCo', email: 'henry@innovateco.com', phone: '+1 (555) 901-2345', location: 'Miami, FL', status: 'active', tags: ['VIP', 'Partner'] },
  { id: 9, name: 'Iris Chen', role: 'Frontend Developer', company: 'WebStudio', email: 'iris@webstudio.com', phone: '+1 (555) 012-3456', location: 'Los Angeles, CA', status: 'active', tags: ['Work'] },
  { id: 10, name: 'James Anderson', role: 'Sales Manager', company: 'SalesPro', email: 'james@salespro.com', phone: '+1 (555) 123-4567', location: 'Phoenix, AZ', status: 'active', tags: ['Partner'] },
  { id: 11, name: 'Kate Thompson', role: 'Content Strategist', company: 'ContentFirst', email: 'kate@contentfirst.com', phone: '+1 (555) 234-5678', location: 'Portland, OR', status: 'inactive', tags: ['Freelance'] },
  { id: 12, name: 'Liam Garcia', role: 'Backend Developer', company: 'APIFirst', email: 'liam@apifirst.com', phone: '+1 (555) 345-6789', location: 'San Diego, CA', status: 'active', tags: ['Work'] },
]

const tagColors = {
  'Work': 'primary',
  'VIP': 'danger',
  'Freelance': 'warning',
  'Partner': 'success',
  'Consultant': 'info',
}

export default function Contacts() {
  const [view, setView] = useState('grid')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contacts in your network`}
        action={
          <button className="btn-primary">
            <Plus size={16} />
            Add Contact
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="input text-sm w-auto"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setView('grid')}
            className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'}`}
          >
            <Grid3X3 size={18} />
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(contact => (
            <div key={contact.id} className="card-hover p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <Avatar name={contact.name} size="lg" status={contact.status === 'active' ? 'online' : 'offline'} />
                <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                  <MoreHorizontal size={16} />
                </button>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">{contact.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{contact.role}</p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5 font-medium">{contact.company}</p>
              </div>

              <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Mail size={13} className="shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={13} className="shrink-0" />
                  <span>{contact.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="shrink-0" />
                  <span>{contact.location}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
                <div className="flex gap-1 flex-wrap">
                  {contact.tags.map(tag => (
                    <Badge key={tag} variant={tagColors[tag] || 'secondary'} className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                    <Mail size={14} />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                    <Phone size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Tags</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(contact => (
                  <tr key={contact.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={contact.name} size="sm" />
                        <span className="font-medium text-slate-800 dark:text-slate-200">{contact.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 dark:text-slate-400">{contact.role}</td>
                    <td className="text-primary-600 dark:text-primary-400 font-medium">{contact.company}</td>
                    <td className="text-slate-600 dark:text-slate-400">{contact.email}</td>
                    <td className="text-slate-600 dark:text-slate-400">{contact.phone}</td>
                    <td className="text-slate-500 dark:text-slate-400">{contact.location}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {contact.tags.map(tag => (
                          <Badge key={tag} variant={tagColors[tag] || 'secondary'} className="text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                    </td>
                    <td><Badge variant={contact.status === 'active' ? 'success' : 'secondary'} dot>{contact.status}</Badge></td>
                    <td>
                      <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                        <MoreHorizontal size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
