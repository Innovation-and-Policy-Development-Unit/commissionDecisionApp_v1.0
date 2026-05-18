import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Search, Filter, Plus, Download, Eye, Edit, Trash2, FileText, DollarSign, Clock, AlertCircle } from 'lucide-react'

const invoices = [
  { id: 'INV-001', customer: 'Acme Corp', email: 'billing@acme.com', amount: 2400.00, status: 'Paid', date: 'Jan 15, 2026', due: 'Feb 15, 2026' },
  { id: 'INV-002', customer: 'TechStart Inc', email: 'accounts@techstart.io', amount: 1850.50, status: 'Pending', date: 'Jan 20, 2026', due: 'Feb 20, 2026' },
  { id: 'INV-003', customer: 'Digital Agency', email: 'finance@digital.co', amount: 5200.00, status: 'Paid', date: 'Jan 22, 2026', due: 'Feb 22, 2026' },
  { id: 'INV-004', customer: 'StartupXYZ', email: 'cfo@startupxyz.com', amount: 950.00, status: 'Overdue', date: 'Dec 10, 2025', due: 'Jan 10, 2026' },
  { id: 'INV-005', customer: 'Global Media', email: 'ap@globalmedia.net', amount: 3750.00, status: 'Paid', date: 'Feb 01, 2026', due: 'Mar 01, 2026' },
  { id: 'INV-006', customer: 'Creative Studio', email: 'billing@creative.studio', amount: 1200.00, status: 'Pending', date: 'Feb 05, 2026', due: 'Mar 05, 2026' },
  { id: 'INV-007', customer: 'Enterprise Corp', email: 'accounts@enterprise.com', amount: 8900.00, status: 'Paid', date: 'Feb 08, 2026', due: 'Mar 08, 2026' },
  { id: 'INV-008', customer: 'Freelance Pro', email: 'pay@freelancepro.io', amount: 640.00, status: 'Overdue', date: 'Dec 20, 2025', due: 'Jan 20, 2026' },
  { id: 'INV-009', customer: 'Cloud Services', email: 'billing@cloudsvcs.com', amount: 4200.00, status: 'Paid', date: 'Feb 10, 2026', due: 'Mar 10, 2026' },
  { id: 'INV-010', customer: 'NextGen Labs', email: 'finance@nextgenlabs.ai', amount: 2850.00, status: 'Pending', date: 'Feb 12, 2026', due: 'Mar 12, 2026' },
  { id: 'INV-011', customer: 'Bright Ideas', email: 'ap@brightideas.co', amount: 1500.00, status: 'Paid', date: 'Feb 14, 2026', due: 'Mar 14, 2026' },
  { id: 'INV-012', customer: 'Blue Ocean LLC', email: 'billing@blueocean.llc', amount: 3100.00, status: 'Pending', date: 'Feb 15, 2026', due: 'Mar 15, 2026' },
]

const statusStyle = {
  Paid: 'badge-success',
  Pending: 'badge-warning',
  Overdue: 'badge-danger',
}

export default function InvoiceList() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(1)
  const perPage = 8

  const filtered = invoices.filter(inv =>
    (filter === 'All' || inv.status === filter) &&
    (inv.customer.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase()))
  )

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'Paid').reduce((a, b) => a + b.amount, 0),
    pending: invoices.filter(i => i.status === 'Pending').length,
    overdue: invoices.filter(i => i.status === 'Overdue').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Management"
        subtitle="Manage and track all your invoices"
        action={
          <button className="btn btn-primary"><Plus size={16} /> New Invoice</button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <FileText size={18} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{stats.total}</p>
              <p className="text-xs text-slate-500">Total Invoices</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">${stats.paid.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Total Paid</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{stats.pending}</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <AlertCircle size={18} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{stats.overdue}</p>
              <p className="text-xs text-slate-500">Overdue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              className="input ps-9"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex gap-2">
            {['All', 'Paid', 'Pending', 'Overdue'].map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1) }}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="btn btn-outline btn-sm shrink-0"><Download size={14} /> Export</button>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th><th>Due Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(inv => (
                <tr key={inv.id}>
                  <td className="font-semibold text-primary-600 dark:text-primary-400">{inv.id}</td>
                  <td>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{inv.customer}</p>
                      <p className="text-xs text-slate-400">{inv.email}</p>
                    </div>
                  </td>
                  <td className="font-semibold">${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td><span className={`badge ${statusStyle[inv.status]}`}>{inv.status}</span></td>
                  <td className="text-slate-500 text-xs">{inv.date}</td>
                  <td className="text-slate-500 text-xs">{inv.due}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="w-7 h-7 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center justify-center text-slate-400 hover:text-primary-600 transition-colors">
                        <Eye size={14} />
                      </button>
                      <button className="w-7 h-7 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-900/20 flex items-center justify-center text-slate-400 hover:text-cyan-600 transition-colors">
                        <Edit size={14} />
                      </button>
                      <button className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Showing {Math.min((page - 1) * perPage + 1, filtered.length)}–{Math.min(page * perPage, filtered.length)} of {filtered.length} invoices</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-sm btn-outline disabled:opacity-40">Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-outline'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-sm btn-outline disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
