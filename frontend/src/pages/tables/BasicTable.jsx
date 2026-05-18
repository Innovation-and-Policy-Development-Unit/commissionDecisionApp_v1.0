import { useState, useMemo } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import Badge from '../../components/shared/Badge'
import {
  Search, Download, Plus, Filter,
  ChevronLeft, ChevronRight, Users, UserCheck, Calendar, Building2,
  Edit2, Trash2, Eye, Star, TrendingUp, TrendingDown, ArrowUpRight,
  ShoppingCart, Package, Clock, CheckCircle2, XCircle, AlertCircle,
  Globe, Mail, Phone, MapPin,
} from 'lucide-react'
import { img } from '../../utils/imgPath'

// ─── Dataset ────────────────────────────────────────────────────────────────

const MAX_SALARY = 180000

const employees = [
  { id: 'EMP-001', name: 'Alice Johnson',   department: 'Product',     role: 'Product Manager',    email: 'alice@company.com',  status: 'active',   salaryRaw: 95000,  joinDate: 'Jan 15, 2024', img: img('/images/avatars/avatar-woman-alice.jpg') },
  { id: 'EMP-002', name: 'Bob Smith',       department: 'Engineering', role: 'Senior Developer',   email: 'bob@company.com',    status: 'active',   salaryRaw: 115000, joinDate: 'Mar 10, 2023', img: img('/images/avatars/avatar-man-bob.jpg') },
  { id: 'EMP-003', name: 'Carol Williams',  department: 'Design',      role: 'UX Designer',        email: 'carol@company.com',  status: 'on_leave', salaryRaw: 85000,  joinDate: 'Jun 22, 2023', img: img('/images/avatars/avatar-woman-carol.jpg') },
  { id: 'EMP-004', name: 'David Brown',     department: 'Marketing',   role: 'Marketing Director', email: 'david@company.com',  status: 'active',   salaryRaw: 105000, joinDate: 'Sep 05, 2022', img: img('/images/avatars/avatar-man-david.jpg') },
  { id: 'EMP-005', name: 'Emma Davis',      department: 'QA',          role: 'QA Lead',            email: 'emma@company.com',   status: 'active',   salaryRaw: 88000,  joinDate: 'Nov 18, 2023', img: img('/images/avatars/avatar-woman-grace.jpg') },
  { id: 'EMP-006', name: 'Frank Wilson',    department: 'DevOps',      role: 'DevOps Engineer',    email: 'frank@company.com',  status: 'inactive', salaryRaw: 110000, joinDate: 'Apr 02, 2022', img: img('/images/avatars/avatar-man-mike.jpg') },
  { id: 'EMP-007', name: 'Grace Lee',       department: 'Data',        role: 'Data Scientist',     email: 'grace@company.com',  status: 'active',   salaryRaw: 120000, joinDate: 'Feb 14, 2024', img: img('/images/avatars/avatar-woman-jessica.jpg') },
  { id: 'EMP-008', name: 'Henry Martinez',  department: 'Management',  role: 'CTO',                email: 'henry@company.com',  status: 'active',   salaryRaw: 180000, joinDate: 'Jan 01, 2020', img: img('/images/avatars/avatar-man-henry.jpg') },
  { id: 'EMP-009', name: 'Iris Chen',       department: 'Engineering', role: 'Frontend Developer', email: 'iris@company.com',   status: 'active',   salaryRaw: 95000,  joinDate: 'Jul 08, 2023', img: img('/images/avatars/avatar-woman-sarah-kim.jpg') },
  { id: 'EMP-010', name: 'James Anderson',  department: 'Sales',       role: 'Sales Manager',      email: 'james@company.com',  status: 'active',   salaryRaw: 90000,  joinDate: 'May 22, 2022', img: img('/images/avatars/avatar-man-john.jpg') },
  { id: 'EMP-011', name: 'Kate Thompson',   department: 'Content',     role: 'Content Strategist', email: 'kate@company.com',   status: 'on_leave', salaryRaw: 72000,  joinDate: 'Oct 15, 2023', img: img('/images/avatars/avatar-woman-emma.jpg') },
  { id: 'EMP-012', name: 'Liam Garcia',     department: 'Engineering', role: 'Backend Developer',  email: 'liam@company.com',   status: 'active',   salaryRaw: 105000, joinDate: 'Aug 30, 2023', img: img('/images/avatars/avatar-man-marcus.jpg') },
  { id: 'EMP-013', name: 'Mia Johnson',     department: 'HR',          role: 'HR Manager',         email: 'mia@company.com',    status: 'active',   salaryRaw: 78000,  joinDate: 'Dec 01, 2022', img: img('/images/avatars/avatar-woman-eva.jpg') },
  { id: 'EMP-014', name: 'Noah Wilson',     department: 'Finance',     role: 'CFO',                email: 'noah@company.com',   status: 'active',   salaryRaw: 165000, joinDate: 'Mar 15, 2021', img: img('/images/avatars/avatar-man-daniel.jpg') },
  { id: 'EMP-015', name: 'Olivia Martin',   department: 'Design',      role: 'Graphic Designer',   email: 'olivia@company.com', status: 'inactive', salaryRaw: 68000,  joinDate: 'Jan 20, 2024', img: img('/images/avatars/avatar-woman-lisa.jpg') },
].map(e => ({ ...e, salary: `$${e.salaryRaw.toLocaleString()}` }))

// ─── Product dataset ─────────────────────────────────────────────────────────

const products = [
  { id: 1, name: 'MacBook Pro 16"', category: 'Laptops', price: 2499, stock: 45, sold: 312, rating: 4.8, img: img('/images/unsplash/macbook-laptop.jpg'), status: 'In Stock' },
  { id: 2, name: 'Sony WH-1000XM5', category: 'Audio', price: 349, stock: 128, sold: 856, rating: 4.7, img: img('/images/unsplash/sony-headphones.jpg'), status: 'In Stock' },
  { id: 3, name: 'iPad Air M2', category: 'Tablets', price: 799, stock: 0, sold: 543, rating: 4.6, img: img('/images/unsplash/ipad-tablet.jpg'), status: 'Out of Stock' },
  { id: 4, name: 'Mechanical Keyboard', category: 'Accessories', price: 189, stock: 67, sold: 1205, rating: 4.9, img: img('/images/unsplash/mechanical-keyboard.jpg'), status: 'In Stock' },
  { id: 5, name: 'LG UltraWide 34"', category: 'Monitors', price: 699, stock: 12, sold: 198, rating: 4.5, img: img('/images/unsplash/curved-monitor.jpg'), status: 'Low Stock' },
  { id: 6, name: 'Logitech MX Master', category: 'Accessories', price: 99, stock: 234, sold: 2341, rating: 4.8, img: img('/images/unsplash/wireless-mouse.jpg'), status: 'In Stock' },
]

// ─── Orders dataset ──────────────────────────────────────────────────────────

const orders = [
  { id: '#ORD-7841', customer: 'Sarah Connor', email: 'sarah@email.com', img: img('/images/avatars/avatar-woman-sarah-chen.jpg'), items: 3, total: 459.99, date: 'Mar 10, 2026', status: 'Delivered', method: 'Credit Card' },
  { id: '#ORD-7842', customer: 'John Wick',    email: 'john@email.com',  img: img('/images/avatars/avatar-man-profile.jpg'),  items: 1, total: 2499.00, date: 'Mar 11, 2026', status: 'Processing', method: 'PayPal' },
  { id: '#ORD-7843', customer: 'Ellen Ripley', email: 'ellen@email.com', img: img('/images/avatars/avatar-woman-rachel.jpg'), items: 5, total: 187.50, date: 'Mar 11, 2026', status: 'Shipped', method: 'Debit Card' },
  { id: '#ORD-7844', customer: 'Tony Stark',   email: 'tony@email.com',  img: img('/images/avatars/avatar-man-tom.jpg'),  items: 2, total: 1249.00, date: 'Mar 12, 2026', status: 'Pending', method: 'Credit Card' },
  { id: '#ORD-7845', customer: 'Diana Prince', email: 'diana@email.com', img: img('/images/avatars/avatar-woman-natalie.jpg'), items: 4, total: 324.75, date: 'Mar 12, 2026', status: 'Cancelled', method: 'PayPal' },
  { id: '#ORD-7846', customer: 'Bruce Wayne',  email: 'bruce@email.com', img: img('/images/avatars/avatar-man-james.jpg'),  items: 7, total: 3150.00, date: 'Mar 12, 2026', status: 'Delivered', method: 'Wire Transfer' },
]

// ─── Country stats dataset ───────────────────────────────────────────────────

const countryStats = [
  { country: 'United States', flag: '🇺🇸', users: 12453, revenue: 245800, growth: 12.5, conversion: 3.2 },
  { country: 'United Kingdom', flag: '🇬🇧', users: 8721, revenue: 178400, growth: 8.3, conversion: 2.8 },
  { country: 'Germany', flag: '🇩🇪', users: 6534, revenue: 134200, growth: 15.1, conversion: 3.5 },
  { country: 'Canada', flag: '🇨🇦', users: 5892, revenue: 112300, growth: -2.4, conversion: 2.1 },
  { country: 'Australia', flag: '🇦🇺', users: 4231, revenue: 98700, growth: 6.7, conversion: 2.9 },
  { country: 'Japan', flag: '🇯🇵', users: 3867, revenue: 87500, growth: 22.3, conversion: 4.1 },
  { country: 'France', flag: '🇫🇷', users: 3456, revenue: 76800, growth: -1.2, conversion: 1.9 },
  { country: 'India', flag: '🇮🇳', users: 15234, revenue: 45600, growth: 34.5, conversion: 1.2 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  active:   { variant: 'success',   label: 'Active' },
  inactive: { variant: 'secondary', label: 'Inactive' },
  on_leave: { variant: 'warning',   label: 'On Leave' },
}

const DEPT_COLORS = {
  Engineering: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  Product:     'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Design:      'bg-pink-100   text-pink-700   dark:bg-pink-900/40   dark:text-pink-300',
  Marketing:   'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  QA:          'bg-cyan-100   text-cyan-700   dark:bg-cyan-900/40   dark:text-cyan-300',
  DevOps:      'bg-teal-100   text-teal-700   dark:bg-teal-900/40   dark:text-teal-300',
  Data:        'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  Management:  'bg-rose-100   text-rose-700   dark:bg-rose-900/40   dark:text-rose-300',
  Sales:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Content:     'bg-lime-100   text-lime-700   dark:bg-lime-900/40   dark:text-lime-300',
  HR:          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Finance:     'bg-sky-100    text-sky-700    dark:bg-sky-900/40    dark:text-sky-300',
}

const DEPARTMENTS = [...new Set(employees.map(e => e.department))]

const deptBreakdown = DEPARTMENTS.map(dept => {
  const members = employees.filter(e => e.department === dept)
  const avgSalary = Math.round(members.reduce((s, e) => s + e.salaryRaw, 0) / members.length)
  return { dept, count: members.length, avgSalary }
}).sort((a, b) => b.count - a.count).slice(0, 6)

const maxDeptCount = Math.max(...deptBreakdown.map(d => d.count))

const ORDER_STATUS_STYLES = {
  Delivered:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Shipped:    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  Pending:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Cancelled:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const ORDER_STATUS_ICONS = {
  Delivered:  CheckCircle2,
  Processing: Clock,
  Shipped:    Package,
  Pending:    AlertCircle,
  Cancelled:  XCircle,
}

const PRODUCT_STATUS_STYLES = {
  'In Stock':     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Out of Stock': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Low Stock':    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, iconBg, iconColor, trend }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{value}</p>
        {trend && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{trend}</p>}
      </div>
    </div>
  )
}

// ─── Salary Bar ───────────────────────────────────────────────────────────────

function SalaryBar({ raw, label }) {
  const pct = Math.round((raw / MAX_SALARY) * 100)
  return (
    <div>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
      <div className="mt-1 h-1 w-20 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Section Title ────────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BasicTable() {
  const [search, setSearch]     = useState('')
  const [deptFilter, setDept]   = useState('All')
  const [page, setPage]         = useState(1)
  const PER_PAGE = 10

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return employees.filter(e =>
      (deptFilter === 'All' || e.department === deptFilter) &&
      (!q || e.name.toLowerCase().includes(q) ||
            e.email.toLowerCase().includes(q) ||
            e.role.toLowerCase().includes(q) ||
            e.id.toLowerCase().includes(q))
    )
  }, [search, deptFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePages  = Math.min(totalPages, page)
  const paged      = filtered.slice((safePages - 1) * PER_PAGE, safePages * PER_PAGE)

  const changePage = (p) => setPage(Math.max(1, Math.min(totalPages, p)))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Table Styles"
        subtitle="Different table variations and styles for various use cases"
      />

      {/* ════════════════════════════════════════════════════════════════════════
          1. EMPLOYEE DIRECTORY — Full-featured table with toolbar & pagination
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Employee Directory" subtitle="Full-featured table with search, filters, and pagination" />

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard icon={Users} label="Total Employees" value="15" iconBg="bg-primary-100 dark:bg-primary-900/30" iconColor="text-primary-600 dark:text-primary-400" trend="+2 this month" />
          <StatCard icon={UserCheck} label="Active" value="11" iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400" trend="73% of team" />
          <StatCard icon={Calendar} label="On Leave" value="2" iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400" />
          <StatCard icon={Building2} label="Departments" value="10" iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600 dark:text-violet-400" />
        </div>

        <div className="card overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="text" placeholder="Search employees…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="input pl-9 text-sm w-full" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select className="input pl-8 text-sm pr-8 appearance-none" value={deptFilter} onChange={e => { setDept(e.target.value); setPage(1) }}>
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.sort().map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button className="btn-outline gap-1.5 text-sm"><Download size={13} /> CSV</button>
              <button className="btn-gradient gap-1.5 text-sm"><Plus size={13} /> New</button>
            </div>
          </div>

          {/* Table */}
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Salary</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400 dark:text-slate-500">
                      <Users size={32} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No employees match your filters</p>
                    </td>
                  </tr>
                ) : paged.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td><span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap">{row.id}</span></td>
                    <td>
                      <div className="flex items-center gap-3">
                        <img src={row.img} alt={row.name} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap">{row.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${DEPT_COLORS[row.department] || 'bg-slate-100 text-slate-600'}`}>{row.department}</span></td>
                    <td><span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.role}</span></td>
                    <td><SalaryBar raw={row.salaryRaw} label={row.salary} /></td>
                    <td><span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{row.joinDate}</span></td>
                    <td>{(() => { const meta = STATUS_META[row.status] || { variant: 'secondary', label: row.status }; return <Badge variant={meta.variant} dot className="capitalize whitespace-nowrap">{meta.label}</Badge> })()}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Eye size={13} /></button>
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"><Edit2 size={13} /></button>
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length === 0 ? 0 : (safePages - 1) * PER_PAGE + 1}</span> – <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(safePages * PER_PAGE, filtered.length)}</span> of <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span> employees
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => changePage(safePages - 1)} disabled={safePages === 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1
                if (totalPages > 5 && safePages > 3) p = safePages - 2 + i
                if (p > totalPages) return null
                return <button key={p} onClick={() => changePage(p)} className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${safePages === p ? 'bg-primary-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>{p}</button>
              })}
              <button onClick={() => changePage(safePages + 1)} disabled={safePages === totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          2. STRIPED TABLE — Alternating row colors
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Striped Table" subtitle="Alternating row backgrounds for easier reading" />
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Salary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.slice(0, 8).map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-800/50'}>
                    <td>
                      <div className="flex items-center gap-3">
                        <img src={row.img} alt={row.name} className="w-8 h-8 rounded-full object-cover" />
                        <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{row.name}</span>
                      </div>
                    </td>
                    <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${DEPT_COLORS[row.department]}`}>{row.department}</span></td>
                    <td className="text-sm text-slate-600 dark:text-slate-300">{row.role}</td>
                    <td className="text-sm font-semibold text-slate-700 dark:text-slate-300">{row.salary}</td>
                    <td>{(() => { const meta = STATUS_META[row.status]; return <Badge variant={meta.variant} dot>{meta.label}</Badge> })()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          3. BORDERED TABLE — Full grid borders
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Bordered Table" subtitle="Full borders on all cells for a classic grid look" />
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">Name</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">Email</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">Department</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">Role</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">Join Date</th>
                </tr>
              </thead>
              <tbody>
                {employees.slice(0, 6).map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{row.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{row.department}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{row.role}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{row.joinDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          4. COMPACT TABLE — Dense data display
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Compact / Dense Table" subtitle="Reduced padding for high-density data display" />
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">ID</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dept</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Role</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Salary</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employees.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-1.5 text-xs font-mono text-primary-600 dark:text-primary-400">{row.id}</td>
                    <td className="px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200">{row.name}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400">{row.department}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400">{row.role}</td>
                    <td className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{row.salary}</td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${row.status === 'active' ? 'bg-emerald-500' : row.status === 'on_leave' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                      <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">{row.status.replace('_', ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ════════════════════════════════════════════════════════════════════
            5. PRODUCT TABLE — With images, ratings, and stock
            ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionTitle title="Product Inventory" subtitle="Table with product images, ratings, and stock status" />
          <div className="card overflow-hidden">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Sold</th>
                    <th>Rating</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td>
                        <div className="flex items-center gap-3">
                          <img src={p.img} alt={p.name} className="w-10 h-10 rounded-xl object-cover" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm font-bold text-slate-800 dark:text-slate-200">${p.price}</td>
                      <td className="text-sm text-slate-600 dark:text-slate-300">{p.stock}</td>
                      <td>
                        <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                          <ShoppingCart size={12} className="text-slate-400" />
                          {p.sold.toLocaleString()}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Star size={13} className="text-amber-400 fill-amber-400" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.rating}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PRODUCT_STATUS_STYLES[p.status]}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            6. ORDER TABLE — With status icons and avatars
            ════════════════════════════════════════════════════════════════════ */}
        <div>
          <SectionTitle title="Recent Orders" subtitle="Order tracking with status indicators and customer info" />
          <div className="card overflow-hidden">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const StatusIcon = ORDER_STATUS_ICONS[o.status] || AlertCircle
                    return (
                      <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td>
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{o.id}</p>
                            <p className="text-xs text-slate-400">{o.items} items · {o.method}</p>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <img src={o.img} alt={o.customer} className="w-8 h-8 rounded-full object-cover" />
                            <div>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{o.customer}</p>
                              <p className="text-xs text-slate-400">{o.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-sm font-bold text-slate-800 dark:text-slate-200">${o.total.toLocaleString()}</td>
                        <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{o.date}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${ORDER_STATUS_STYLES[o.status]}`}>
                            <StatusIcon size={12} />
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          7. GRADIENT HEADER TABLE — Colorful gradient header
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Gradient Header Table" subtitle="Eye-catching gradient header with clean data rows" />
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gradient-to-r from-primary-600 to-indigo-600">
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-white/90">Country</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-white/90">Users</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-white/90">Revenue</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-white/90">Growth</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-white/90">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {countryStats.map(c => (
                  <tr key={c.country} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{c.flag}</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{c.country}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">{c.users.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-200">${(c.revenue / 1000).toFixed(1)}k</td>
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-1 text-sm font-semibold ${c.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {c.growth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {c.growth >= 0 ? '+' : ''}{c.growth}%
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary-500" style={{ width: `${(c.conversion / 5) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{c.conversion}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          8. HOVERABLE CARD TABLE — Card-style rows with hover effects
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Card-Style Rows" subtitle="Each row styled as a card with hover elevation effect" />
        <div className="space-y-2">
          {employees.slice(0, 6).map(row => (
            <div key={row.id} className="card p-4 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
              <img src={row.img} alt={row.name} className="w-12 h-12 rounded-2xl object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{row.name}</p>
                <p className="text-xs text-slate-400">{row.role} · {row.department}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Mail size={12} />
                  {row.email}
                </div>
              </div>
              <div className="hidden md:block text-sm font-bold text-slate-700 dark:text-slate-300">{row.salary}</div>
              <div>
                {(() => { const meta = STATUS_META[row.status]; return <Badge variant={meta.variant} dot>{meta.label}</Badge> })()}
              </div>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors opacity-0 group-hover:opacity-100">
                <ArrowUpRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          9. DARK HEADER TABLE — Dark/inverted header
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Dark Header Table" subtitle="Inverted dark header with contrasting body rows" />
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900 dark:bg-slate-950">
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-300">Employee</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-300">Contact</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-300">Department</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-300">Salary</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employees.slice(0, 7).map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={row.img} alt={row.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-700" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{row.name}</p>
                          <p className="text-xs text-slate-400">{row.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Mail size={11} /> {row.email}</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400"><MapPin size={11} /> New York, US</div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${DEPT_COLORS[row.department]}`}>{row.department}</span></td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-200">{row.salary}</td>
                    <td className="px-4 py-3">{(() => { const meta = STATUS_META[row.status]; return <Badge variant={meta.variant} dot>{meta.label}</Badge> })()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          10. CHECKBOX / SELECTABLE TABLE
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Selectable Table" subtitle="Table with checkboxes for bulk actions" />
        <div className="card overflow-hidden">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Select items to perform bulk actions</p>
            <div className="flex items-center gap-2">
              <button className="btn-outline text-xs gap-1.5"><Trash2 size={12} /> Delete</button>
              <button className="btn-outline text-xs gap-1.5"><Download size={12} /> Export</button>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"><input type="checkbox" className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500" /></th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Salary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.slice(0, 8).map(row => (
                  <tr key={row.id} className="hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors">
                    <td><input type="checkbox" className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500" /></td>
                    <td>
                      <div className="flex items-center gap-3">
                        <img src={row.img} alt={row.name} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{row.name}</p>
                          <p className="text-xs text-slate-400">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${DEPT_COLORS[row.department]}`}>{row.department}</span></td>
                    <td className="text-sm text-slate-600 dark:text-slate-300">{row.role}</td>
                    <td className="text-sm font-semibold text-slate-700 dark:text-slate-300">{row.salary}</td>
                    <td>{(() => { const meta = STATUS_META[row.status]; return <Badge variant={meta.variant} dot>{meta.label}</Badge> })()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Department breakdown ─────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">Department Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {deptBreakdown.map(({ dept, count, avgSalary }) => {
            const pct = Math.round((count / maxDeptCount) * 100)
            return (
              <div key={dept} className="card p-4 hover:shadow-md transition-shadow">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${DEPT_COLORS[dept] || 'bg-slate-100 text-slate-600'}`}>{dept}</span>
                <p className="mt-3 text-2xl font-bold text-slate-800 dark:text-slate-100">{count}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Avg&nbsp;${Math.round(avgSalary / 1000)}k</p>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
