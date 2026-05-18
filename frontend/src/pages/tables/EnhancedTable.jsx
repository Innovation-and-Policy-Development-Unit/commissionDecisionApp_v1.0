import { useState, useMemo, Fragment } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import Badge from '../../components/shared/Badge'
import {
  ShoppingCart, DollarSign, Package, TrendingUp, TrendingDown,
  Search, Filter, Download, MoreHorizontal, Eye, Edit2, Trash2, Plus,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight as ChevRight,
  CheckCircle2, Clock, Truck, XCircle, RefreshCw,
  Star, Heart, MessageSquare, Share2, Bookmark, ExternalLink,
  Users, Mail, Phone, MapPin, Globe, Calendar, Award, Zap,
  ArrowUpRight, ArrowDownRight, BarChart3, Activity, Layers,
  GripVertical, Copy, Archive, Send, Bell, Settings,
  FileText, Image, Video, Music, Code2,
} from 'lucide-react'
import { img } from '../../utils/imgPath'

// ═══════════════════════════════════════════════════════════════════════════════
// DATASETS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUSES = ['Delivered', 'Processing', 'Shipped', 'Cancelled', 'Refunded']

const orders = [
  { id: '#ORD-7821', customer: 'Alice Johnson',  email: 'alice@example.com',  items: 3, amount: 249.99,  status: 'Delivered',  date: 'Mar 10, 2026', method: 'Credit Card', img: img('/images/avatars/avatar-woman-alice.jpg') },
  { id: '#ORD-7822', customer: 'Bob Smith',       email: 'bob@example.com',    items: 1, amount: 89.00,   status: 'Shipped',    date: 'Mar 10, 2026', method: 'PayPal', img: img('/images/avatars/avatar-man-bob.jpg') },
  { id: '#ORD-7823', customer: 'Carol Williams',  email: 'carol@example.com',  items: 5, amount: 512.50,  status: 'Processing', date: 'Mar 09, 2026', method: 'Stripe', img: img('/images/avatars/avatar-woman-carol.jpg') },
  { id: '#ORD-7824', customer: 'David Brown',     email: 'david@example.com',  items: 2, amount: 134.75,  status: 'Delivered',  date: 'Mar 09, 2026', method: 'Credit Card', img: img('/images/avatars/avatar-man-david.jpg') },
  { id: '#ORD-7825', customer: 'Emma Davis',      email: 'emma@example.com',   items: 4, amount: 378.20,  status: 'Cancelled',  date: 'Mar 08, 2026', method: 'PayPal', img: img('/images/avatars/avatar-woman-grace.jpg') },
  { id: '#ORD-7826', customer: 'Frank Wilson',    email: 'frank@example.com',  items: 1, amount: 59.99,   status: 'Delivered',  date: 'Mar 08, 2026', method: 'Debit Card', img: img('/images/avatars/avatar-man-mike.jpg') },
  { id: '#ORD-7827', customer: 'Grace Lee',       email: 'grace@example.com',  items: 7, amount: 890.00,  status: 'Shipped',    date: 'Mar 07, 2026', method: 'Wire Transfer', img: img('/images/avatars/avatar-woman-jessica.jpg') },
  { id: '#ORD-7828', customer: 'Henry Martinez',  email: 'henry@example.com',  items: 2, amount: 199.99,  status: 'Processing', date: 'Mar 07, 2026', method: 'Credit Card', img: img('/images/avatars/avatar-man-henry.jpg') },
  { id: '#ORD-7829', customer: 'Iris Chen',       email: 'iris@example.com',   items: 3, amount: 310.40,  status: 'Delivered',  date: 'Mar 06, 2026', method: 'Stripe', img: img('/images/avatars/avatar-woman-sarah-kim.jpg') },
  { id: '#ORD-7830', customer: 'James Anderson',  email: 'james@example.com',  items: 6, amount: 755.00,  status: 'Shipped',    date: 'Mar 06, 2026', method: 'PayPal', img: img('/images/avatars/avatar-man-john.jpg') },
  { id: '#ORD-7831', customer: 'Kate Thompson',   email: 'kate@example.com',   items: 1, amount: 44.50,   status: 'Refunded',   date: 'Mar 05, 2026', method: 'Debit Card', img: img('/images/avatars/avatar-woman-emma.jpg') },
  { id: '#ORD-7832', customer: 'Liam Garcia',     email: 'liam@example.com',   items: 4, amount: 423.80,  status: 'Delivered',  date: 'Mar 05, 2026', method: 'Credit Card', img: img('/images/avatars/avatar-man-marcus.jpg') },
  { id: '#ORD-7833', customer: 'Mia Johnson',     email: 'mia@example.com',    items: 2, amount: 162.30,  status: 'Processing', date: 'Mar 04, 2026', method: 'Stripe', img: img('/images/avatars/avatar-woman-eva.jpg') },
  { id: '#ORD-7834', customer: 'Noah Wilson',     email: 'noah@example.com',   items: 8, amount: 1240.00, status: 'Delivered',  date: 'Mar 04, 2026', method: 'Wire Transfer', img: img('/images/avatars/avatar-man-daniel.jpg') },
  { id: '#ORD-7835', customer: 'Olivia Martin',   email: 'olivia@example.com', items: 3, amount: 298.75,  status: 'Shipped',    date: 'Mar 03, 2026', method: 'PayPal', img: img('/images/avatars/avatar-woman-lisa.jpg') },
  { id: '#ORD-7836', customer: 'Peter Clark',     email: 'peter@example.com',  items: 5, amount: 540.00,  status: 'Delivered',  date: 'Mar 03, 2026', method: 'Credit Card', img: img('/images/avatars/avatar-man-oliver.jpg') },
  { id: '#ORD-7837', customer: 'Quinn Roberts',   email: 'quinn@example.com',  items: 1, amount: 72.00,   status: 'Cancelled',  date: 'Mar 02, 2026', method: 'Debit Card', img: img('/images/avatars/avatar-woman-megan.jpg') },
  { id: '#ORD-7838', customer: 'Rachel Scott',    email: 'rachel@example.com', items: 2, amount: 215.60,  status: 'Delivered',  date: 'Mar 02, 2026', method: 'Stripe', img: img('/images/avatars/avatar-woman-carol-white.jpg') },
  { id: '#ORD-7839', customer: 'Sam Turner',      email: 'sam@example.com',    items: 4, amount: 488.90,  status: 'Shipped',    date: 'Mar 01, 2026', method: 'PayPal', img: img('/images/avatars/avatar-man-kevin.jpg') },
  { id: '#ORD-7840', customer: 'Tina Walker',     email: 'tina@example.com',   items: 3, amount: 334.25,  status: 'Refunded',   date: 'Mar 01, 2026', method: 'Credit Card', img: img('/images/avatars/avatar-woman-linda.jpg') },
]

// Products with expandable details
const products = [
  { id: 'PRD-001', name: 'MacBook Pro 16"', category: 'Laptops', price: 2499, stock: 45, sold: 312, rating: 4.8, revenue: 779688, img: img('/images/unsplash/macbook-laptop.jpg'), sku: 'MBP-16-M3', weight: '2.14 kg', warranty: '1 Year', description: 'Apple M3 Pro chip, 18GB RAM, 512GB SSD, Space Black' },
  { id: 'PRD-002', name: 'Sony WH-1000XM5', category: 'Audio', price: 349, stock: 128, sold: 856, rating: 4.7, revenue: 298744, img: img('/images/unsplash/sony-headphones.jpg'), sku: 'SNY-WH5-BK', weight: '250g', warranty: '2 Years', description: 'Industry-leading noise cancellation, 30hr battery life' },
  { id: 'PRD-003', name: 'iPad Air M2', category: 'Tablets', price: 799, stock: 0, sold: 543, rating: 4.6, revenue: 433857, img: img('/images/unsplash/ipad-tablet.jpg'), sku: 'IPA-AIR-M2', weight: '462g', warranty: '1 Year', description: '11-inch Liquid Retina, M2 chip, 128GB, Wi-Fi + Cellular' },
  { id: 'PRD-004', name: 'Mechanical Keyboard', category: 'Accessories', price: 189, stock: 67, sold: 1205, rating: 4.9, revenue: 227745, img: img('/images/unsplash/mechanical-keyboard.jpg'), sku: 'KB-MECH-75', weight: '850g', warranty: '3 Years', description: '75% layout, Gateron Pro switches, hot-swappable, RGB' },
  { id: 'PRD-005', name: 'LG UltraWide 34"', category: 'Monitors', price: 699, stock: 12, sold: 198, rating: 4.5, revenue: 138402, img: img('/images/unsplash/curved-monitor.jpg'), sku: 'LG-UW34-QHD', weight: '7.2 kg', warranty: '3 Years', description: 'QHD 3440x1440, 160Hz, HDR10, USB-C with 90W PD' },
  { id: 'PRD-006', name: 'Logitech MX Master', category: 'Accessories', price: 99, stock: 234, sold: 2341, rating: 4.8, revenue: 231759, img: img('/images/unsplash/wireless-mouse.jpg'), sku: 'LOG-MXM3S', weight: '141g', warranty: '2 Years', description: '8K DPI, MagSpeed scroll, USB-C, connects to 3 devices' },
]

// Team members with skills
const teamMembers = [
  { id: 1, name: 'Sarah Connor', role: 'Lead Designer', email: 'sarah@team.com', phone: '+1 (555) 123-4567', location: 'San Francisco, CA', img: img('/images/avatars/avatar-woman-sarah-chen.jpg'), status: 'online', projects: 12, completion: 94, skills: ['Figma', 'UI/UX', 'Prototyping'], rating: 4.9 },
  { id: 2, name: 'John Wick',    role: 'Senior Engineer', email: 'john@team.com', phone: '+1 (555) 234-5678', location: 'New York, NY', img: img('/images/avatars/avatar-man-profile.jpg'), status: 'online', projects: 18, completion: 97, skills: ['React', 'Node.js', 'TypeScript'], rating: 5.0 },
  { id: 3, name: 'Ellen Ripley', role: 'Product Manager', email: 'ellen@team.com', phone: '+1 (555) 345-6789', location: 'Austin, TX', img: img('/images/avatars/avatar-woman-rachel.jpg'), status: 'away', projects: 8, completion: 88, skills: ['Strategy', 'Analytics', 'Agile'], rating: 4.7 },
  { id: 4, name: 'Tony Stark',   role: 'CTO', email: 'tony@team.com', phone: '+1 (555) 456-7890', location: 'Los Angeles, CA', img: img('/images/avatars/avatar-man-tom.jpg'), status: 'online', projects: 25, completion: 92, skills: ['Architecture', 'AI/ML', 'Cloud'], rating: 4.8 },
  { id: 5, name: 'Diana Prince', role: 'Marketing Lead', email: 'diana@team.com', phone: '+1 (555) 567-8901', location: 'Chicago, IL', img: img('/images/avatars/avatar-woman-natalie.jpg'), status: 'busy', projects: 15, completion: 91, skills: ['SEO', 'Content', 'Analytics'], rating: 4.6 },
  { id: 6, name: 'Bruce Wayne',  role: 'VP Engineering', email: 'bruce@team.com', phone: '+1 (555) 678-9012', location: 'Seattle, WA', img: img('/images/avatars/avatar-man-james.jpg'), status: 'offline', projects: 22, completion: 96, skills: ['Leadership', 'DevOps', 'Security'], rating: 4.9 },
]

// File manager dataset
const files = [
  { id: 1, name: 'Q1 Financial Report.pdf', type: 'pdf', size: '2.4 MB', modified: 'Mar 10, 2026', owner: 'Noah Wilson', ownerImg: img('/images/avatars/avatar-man-daniel.jpg'), shared: 5, starred: true },
  { id: 2, name: 'Product Launch Deck.pptx', type: 'doc', size: '8.7 MB', modified: 'Mar 09, 2026', owner: 'Diana Prince', ownerImg: img('/images/avatars/avatar-woman-natalie.jpg'), shared: 12, starred: true },
  { id: 3, name: 'Brand Assets v3.zip', type: 'image', size: '156 MB', modified: 'Mar 08, 2026', owner: 'Sarah Connor', ownerImg: img('/images/avatars/avatar-woman-sarah-chen.jpg'), shared: 8, starred: false },
  { id: 4, name: 'Sprint Demo Recording.mp4', type: 'video', size: '342 MB', modified: 'Mar 07, 2026', owner: 'John Wick', ownerImg: img('/images/avatars/avatar-man-profile.jpg'), shared: 4, starred: false },
  { id: 5, name: 'Podcast Episode 42.mp3', type: 'audio', size: '45.2 MB', modified: 'Mar 06, 2026', owner: 'Ellen Ripley', ownerImg: img('/images/avatars/avatar-woman-rachel.jpg'), shared: 2, starred: true },
  { id: 6, name: 'API Documentation.md', type: 'code', size: '124 KB', modified: 'Mar 05, 2026', owner: 'Tony Stark', ownerImg: img('/images/avatars/avatar-man-tom.jpg'), shared: 15, starred: false },
  { id: 7, name: 'User Research Notes.docx', type: 'doc', size: '1.8 MB', modified: 'Mar 04, 2026', owner: 'Sarah Connor', ownerImg: img('/images/avatars/avatar-woman-sarah-chen.jpg'), shared: 6, starred: false },
]

// Timeline / changelog
const changelog = [
  { id: 1, version: 'v2.4.0', date: 'Mar 12, 2026', type: 'feature', title: 'AI-powered search', description: 'Added semantic search with natural language queries', author: 'John Wick', authorImg: img('/images/avatars/avatar-man-profile.jpg'), changes: 24 },
  { id: 2, version: 'v2.3.2', date: 'Mar 08, 2026', type: 'fix', title: 'Payment gateway hotfix', description: 'Fixed timeout issue with Stripe webhook processing', author: 'Tony Stark', authorImg: img('/images/avatars/avatar-man-tom.jpg'), changes: 3 },
  { id: 3, version: 'v2.3.1', date: 'Mar 05, 2026', type: 'improvement', title: 'Dashboard performance', description: 'Reduced initial load time by 40% with lazy loading', author: 'Bruce Wayne', authorImg: img('/images/avatars/avatar-man-james.jpg'), changes: 12 },
  { id: 4, version: 'v2.3.0', date: 'Mar 01, 2026', type: 'feature', title: 'Team collaboration', description: 'Real-time editing, comments, and @mentions in documents', author: 'Ellen Ripley', authorImg: img('/images/avatars/avatar-woman-rachel.jpg'), changes: 38 },
  { id: 5, version: 'v2.2.5', date: 'Feb 26, 2026', type: 'security', title: 'Security patch', description: 'Updated auth tokens, added rate limiting on API endpoints', author: 'Bruce Wayne', authorImg: img('/images/avatars/avatar-man-james.jpg'), changes: 8 },
]

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const totalRevenue = orders.reduce((s, o) => s + o.amount, 0)
const avgOrderValue = totalRevenue / orders.length
const deliveredCount = orders.filter(o => o.status === 'Delivered').length
const fulfillmentRate = Math.round((deliveredCount / orders.length) * 100)

const STATUS_CONFIG = {
  Delivered:  { variant: 'success',   icon: CheckCircle2, iconClass: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  Processing: { variant: 'info',      icon: Clock,        iconClass: 'text-cyan-500',    bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
  Shipped:    { variant: 'primary',   icon: Truck,        iconClass: 'text-primary-500', bg: 'bg-primary-100 dark:bg-primary-900/40' },
  Cancelled:  { variant: 'danger',    icon: XCircle,      iconClass: 'text-red-500',     bg: 'bg-red-100 dark:bg-red-900/40' },
  Refunded:   { variant: 'warning',   icon: RefreshCw,    iconClass: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/40' },
}

const FILE_ICONS = {
  pdf: { icon: FileText, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/40' },
  doc: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  image: { icon: Image, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/40' },
  video: { icon: Video, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  audio: { icon: Music, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  code: { icon: Code2, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
}

const CHANGELOG_TYPE = {
  feature: { label: 'Feature', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500' },
  fix: { label: 'Bug Fix', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', dot: 'bg-red-500' },
  improvement: { label: 'Improvement', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', dot: 'bg-blue-500' },
  security: { label: 'Security', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', dot: 'bg-amber-500' },
}

const TEAM_STATUS = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
  offline: 'bg-slate-400',
}

const activityFeed = [
  { id: 1, text: 'Order #ORD-7840 was refunded',            sub: 'Tina Walker · $334.25',  time: '2m ago',  color: 'bg-amber-500' },
  { id: 2, text: 'Order #ORD-7839 shipped via FedEx',       sub: 'Sam Turner · $488.90',   time: '18m ago', color: 'bg-primary-500' },
  { id: 3, text: 'New order #ORD-7840 placed',              sub: 'Rachel Scott · $215.60', time: '45m ago', color: 'bg-emerald-500' },
  { id: 4, text: 'Order #ORD-7837 was cancelled',           sub: 'Quinn Roberts · $72.00', time: '1h ago',  color: 'bg-red-500' },
  { id: 5, text: 'Payment confirmed for #ORD-7836',         sub: 'Peter Clark · $540.00',  time: '2h ago',  color: 'bg-cyan-500' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function KpiCard({ icon: Icon, label, value, sub, iconBg, iconColor, trend, trendUp }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
          {trend && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend}
            </span>
          )}
        </div>
        {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown size={12} className="text-slate-300 dark:text-slate-600" />
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-primary-500" />
    : <ChevronDown size={12} className="text-primary-500" />
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EnhancedTable() {
  // Orders state
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('All')
  const [sortField, setSortField]   = useState('id')
  const [sortDir, setSortDir]       = useState('asc')
  const [page, setPage]             = useState(1)
  const [openMenu, setOpenMenu]     = useState(null)
  const [selectedOrders, setSelectedOrders] = useState([])
  const PER_PAGE = 8

  // Expandable products state
  const [expandedProduct, setExpandedProduct] = useState(null)

  // File manager state
  const [starredFiles, setStarredFiles] = useState(files.filter(f => f.starred).map(f => f.id))

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orders
      .filter(o =>
        (statusFilter === 'All' || o.status === statusFilter) &&
        (!q || o.id.toLowerCase().includes(q) ||
               o.customer.toLowerCase().includes(q) ||
               o.email.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const va = a[sortField], vb = b[sortField]
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [search, statusFilter, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)
  const changePage = (p) => setPage(Math.max(1, Math.min(totalPages, p)))

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length
    return acc
  }, {})

  const toggleOrder = (id) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const toggleAllOrders = () => {
    setSelectedOrders(prev => prev.length === paged.length ? [] : paged.map(o => o.id))
  }

  const toggleStar = (id) => {
    setStarredFiles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const headerCols = [
    { label: '', field: null, checkbox: true },
    { label: 'Order ID',  field: 'id' },
    { label: 'Customer',  field: 'customer' },
    { label: 'Items',     field: 'items' },
    { label: 'Amount',    field: 'amount' },
    { label: 'Method',    field: 'method' },
    { label: 'Status',    field: 'status' },
    { label: 'Date',      field: 'date' },
    { label: 'Actions',   field: null },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Enhanced Tables"
        subtitle="Advanced table components with sorting, expanding, selection, and more"
        action={
          <div className="flex items-center gap-2">
            <button className="btn-outline gap-2 text-sm"><Download size={14} /> Export All</button>
            <button className="btn-gradient gap-2 text-sm"><Plus size={14} /> New Entry</button>
          </div>
        }
      />

      {/* ════════════════════════════════════════════════════════════════════════
          1. ORDERS TABLE — Sortable, selectable with bulk actions
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Orders Management" subtitle="Sortable table with multi-select, bulk actions, and status filters" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <KpiCard icon={ShoppingCart} label="Total Orders" value={orders.length} sub={`${orders.filter(o => o.status === 'Processing').length} processing`} iconBg="bg-primary-100 dark:bg-primary-900/30" iconColor="text-primary-600 dark:text-primary-400" trend="+12%" trendUp />
          <KpiCard icon={DollarSign} label="Revenue" value={`$${Math.round(totalRevenue / 1000)}k`} sub="This month" iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400" trend="+8.2%" trendUp />
          <KpiCard icon={Package} label="Avg Order Value" value={`$${avgOrderValue.toFixed(0)}`} sub="Per order" iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400" trend="-2.1%" trendUp={false} />
          <KpiCard icon={TrendingUp} label="Fulfillment" value={`${fulfillmentRate}%`} sub={`${deliveredCount} delivered`} iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600 dark:text-violet-400" trend="+5%" trendUp />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 card overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="text" placeholder="Search orders…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="input pl-9 text-sm w-full" />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select className="input pl-8 text-sm pr-7 appearance-none" value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }}>
                    <option value="All">All Statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {selectedOrders.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{selectedOrders.length} selected</span>
                    <button className="btn-outline text-xs gap-1 py-1"><Archive size={11} /> Archive</button>
                    <button className="btn-outline text-xs gap-1 py-1 text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"><Trash2 size={11} /> Delete</button>
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    {headerCols.map(col => (
                      <th key={col.label || 'check'} onClick={() => col.field && handleSort(col.field)} className={col.field ? 'cursor-pointer select-none' : ''}>
                        {col.checkbox ? (
                          <input type="checkbox" checked={selectedOrders.length === paged.length && paged.length > 0} onChange={toggleAllOrders} className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            {col.label}
                            {col.field && <SortIcon active={sortField === col.field} dir={sortDir} />}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-slate-400 dark:text-slate-500"><ShoppingCart size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No orders found</p></td></tr>
                  ) : paged.map(order => {
                    const cfg = STATUS_CONFIG[order.status]
                    const StatusIcon = cfg.icon
                    const isSelected = selectedOrders.includes(order.id)
                    return (
                      <tr key={order.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                        <td><input type="checkbox" checked={isSelected} onChange={() => toggleOrder(order.id)} className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500" /></td>
                        <td><span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{order.id}</span></td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <img src={order.img} alt={order.customer} className="w-8 h-8 rounded-full object-cover" />
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{order.customer}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">{order.email}</p>
                            </div>
                          </div>
                        </td>
                        <td><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">{order.items}</span></td>
                        <td><span className="text-sm font-bold text-slate-800 dark:text-slate-200">${order.amount.toFixed(2)}</span></td>
                        <td><span className="text-xs text-slate-500 dark:text-slate-400">{order.method}</span></td>
                        <td>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.iconClass}`}>
                            <StatusIcon size={11} />
                            {order.status}
                          </span>
                        </td>
                        <td><span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{order.date}</span></td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Eye size={13} /></button>
                            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"><Edit2 size={13} /></button>
                            <div className="relative">
                              <button onClick={() => setOpenMenu(openMenu === order.id ? null : order.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><MoreHorizontal size={13} /></button>
                              {openMenu === order.id && (
                                <div className="absolute right-0 top-8 z-10 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
                                  <button className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Copy size={11} /> Duplicate</button>
                                  <button className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Send size={11} /> Send Invoice</button>
                                  <button className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Archive size={11} /> Archive</button>
                                  <hr className="my-1 border-slate-100 dark:border-slate-700" />
                                  <button onClick={() => setOpenMenu(null)} className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"><XCircle size={11} /> Cancel Order</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length === 0 ? '0' : (safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, filtered.length)} of <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span> orders</p>
              <div className="flex items-center gap-1">
                <button onClick={() => changePage(safePage - 1)} disabled={safePage === 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"><ChevronLeft size={16} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1
                  if (totalPages > 5 && safePage > 3) p = safePage - 2 + i
                  if (p > totalPages) return null
                  return <button key={p} onClick={() => changePage(p)} className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${safePage === p ? 'bg-primary-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>{p}</button>
                })}
                <button onClick={() => changePage(safePage + 1)} disabled={safePage === totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-5">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Status Breakdown</h3>
              <div className="space-y-3">
                {STATUSES.map(s => {
                  const cfg = STATUS_CONFIG[s]
                  const count = statusCounts[s]
                  const pct = Math.round((count / orders.length) * 100)
                  const StatusIcon = cfg.icon
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <StatusIcon size={14} className={cfg.iconClass} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{s}</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 w-8 text-right shrink-0">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card p-5 flex-1">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {activityFeed.map(item => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">{item.text}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{item.sub}</p>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          2. EXPANDABLE TABLE — Product inventory with expandable details
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Expandable Product Table" subtitle="Click rows to expand and see product details, specs, and revenue breakdown" />
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Sold</th>
                  <th>Revenue</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const isExpanded = expandedProduct === p.id
                  const stockStatus = p.stock === 0 ? 'Out of Stock' : p.stock < 20 ? 'Low Stock' : 'In Stock'
                  const stockStyle = p.stock === 0 ? 'text-red-500' : p.stock < 20 ? 'text-amber-500' : 'text-emerald-500'
                  return (
                    <Fragment key={p.id}>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => setExpandedProduct(isExpanded ? null : p.id)}>
                        <td>
                          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <img src={p.img} alt={p.name} className="w-10 h-10 rounded-xl object-cover" />
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{p.name}</p>
                              <p className="text-xs text-slate-400">{p.category}</p>
                            </div>
                          </div>
                        </td>
                        <td><span className="font-mono text-xs text-slate-500 dark:text-slate-400">{p.sku}</span></td>
                        <td className="text-sm font-bold text-slate-800 dark:text-slate-200">${p.price}</td>
                        <td>
                          <span className={`text-sm font-semibold ${stockStyle}`}>{p.stock}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                            <ShoppingCart size={12} className="text-slate-400" />
                            {p.sold.toLocaleString()}
                          </div>
                        </td>
                        <td className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${(p.revenue / 1000).toFixed(0)}k</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Star size={13} className="text-amber-400 fill-amber-400" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.rating}</span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-800/30">
                          <td colSpan={8} className="!p-0">
                            <div className="p-5 border-t border-slate-100 dark:border-slate-700">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Product details */}
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Product Details</h4>
                                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{p.description}</p>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-500">Weight</span>
                                      <span className="font-medium text-slate-700 dark:text-slate-300">{p.weight}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-500">Warranty</span>
                                      <span className="font-medium text-slate-700 dark:text-slate-300">{p.warranty}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-500">Status</span>
                                      <span className={`font-semibold ${stockStyle}`}>{stockStatus}</span>
                                    </div>
                                  </div>
                                </div>
                                {/* Revenue breakdown */}
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Revenue Breakdown</h4>
                                  <div className="space-y-3">
                                    {['Online Store', 'Marketplace', 'Wholesale'].map((ch, i) => {
                                      const vals = [60, 25, 15]
                                      const rev = Math.round(p.revenue * vals[i] / 100)
                                      return (
                                        <div key={ch}>
                                          <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-500">{ch}</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">${(rev / 1000).toFixed(0)}k</span>
                                          </div>
                                          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${i === 0 ? 'bg-primary-500' : i === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${vals[i]}%` }} />
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                                {/* Quick actions */}
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Quick Actions</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button className="btn-outline text-xs gap-1.5 justify-center"><Edit2 size={12} /> Edit</button>
                                    <button className="btn-outline text-xs gap-1.5 justify-center"><Copy size={12} /> Duplicate</button>
                                    <button className="btn-outline text-xs gap-1.5 justify-center"><BarChart3 size={12} /> Analytics</button>
                                    <button className="btn-outline text-xs gap-1.5 justify-center text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800"><Archive size={12} /> Archive</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          3. TEAM MEMBERS — Rich profile cards in table format
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Team Directory" subtitle="Rich team member profiles with skills, ratings, and project stats" />
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Contact</th>
                  <th>Skills</th>
                  <th>Projects</th>
                  <th>Completion</th>
                  <th>Rating</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src={m.img} alt={m.name} className="w-10 h-10 rounded-2xl object-cover" />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${TEAM_STATUS[m.status]}`} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.role}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Mail size={11} /> {m.email}</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400"><MapPin size={11} /> {m.location}</div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {m.skills.map(s => (
                          <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Layers size={13} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{m.projects}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${m.completion >= 95 ? 'bg-emerald-500' : m.completion >= 90 ? 'bg-primary-500' : 'bg-amber-500'}`} style={{ width: `${m.completion}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{m.completion}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Star size={13} className="text-amber-400 fill-amber-400" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{m.rating}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><MessageSquare size={13} /></button>
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"><Phone size={13} /></button>
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"><Mail size={13} /></button>
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
          4. FILE MANAGER TABLE — With icons, stars, sharing
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="File Manager" subtitle="Interactive file table with starring, sharing indicators, and file type icons" />
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="btn-gradient text-xs gap-1.5"><Plus size={12} /> Upload</button>
              <button className="btn-outline text-xs gap-1.5"><Layers size={12} /> New Folder</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{files.length} files · {files.reduce((s, f) => s + parseFloat(f.size), 0).toFixed(0)} MB total</span>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Modified</th>
                  <th>Owner</th>
                  <th>Shared</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => {
                  const ft = FILE_ICONS[f.type] || FILE_ICONS.doc
                  const FileIcon = ft.icon
                  const isStarred = starredFiles.includes(f.id)
                  return (
                    <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td>
                        <button onClick={() => toggleStar(f.id)} className="transition-colors">
                          <Star size={14} className={isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'} />
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ft.bg}`}>
                            <FileIcon size={16} className={ft.color} />
                          </div>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{f.name}</span>
                        </div>
                      </td>
                      <td className="text-sm text-slate-500 dark:text-slate-400">{f.size}</td>
                      <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{f.modified}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <img src={f.ownerImg} alt={f.owner} className="w-6 h-6 rounded-full object-cover" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{f.owner}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-slate-400" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{f.shared}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Download size={13} /></button>
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"><Share2 size={13} /></button>
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          5. CHANGELOG / TIMELINE TABLE
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Changelog Timeline" subtitle="Version history with change types, authors, and release details" />
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900">
                  <th className="text-slate-300 text-xs font-bold uppercase tracking-wider">Version</th>
                  <th className="text-slate-300 text-xs font-bold uppercase tracking-wider">Type</th>
                  <th className="text-slate-300 text-xs font-bold uppercase tracking-wider">Title</th>
                  <th className="text-slate-300 text-xs font-bold uppercase tracking-wider">Author</th>
                  <th className="text-slate-300 text-xs font-bold uppercase tracking-wider">Changes</th>
                  <th className="text-slate-300 text-xs font-bold uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {changelog.map((entry, i) => {
                  const typeInfo = CHANGELOG_TYPE[entry.type]
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className={`w-2.5 h-2.5 rounded-full ${typeInfo.dot}`} />
                            {i < changelog.length - 1 && (
                              <div className="absolute top-3 left-1 w-0.5 h-8 bg-slate-200 dark:bg-slate-700" />
                            )}
                          </div>
                          <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">{entry.version}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
                      </td>
                      <td>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{entry.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{entry.description}</p>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <img src={entry.authorImg} alt={entry.author} className="w-7 h-7 rounded-full object-cover" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{entry.author}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Activity size={12} className="text-slate-400" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{entry.changes}</span>
                          <span className="text-xs text-slate-400">files</span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{entry.date}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          6. DRAGGABLE-STYLE PRIORITY LIST
          ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle title="Priority Task List" subtitle="Drag-style task table with priority levels and assignees" />
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Task</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Due Date</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: 1, task: 'Redesign landing page', desc: 'Update hero section and CTA flow', priority: 'Critical', assignee: teamMembers[0], due: 'Mar 15', progress: 75, status: 'In Progress' },
                  { id: 2, task: 'API rate limiting', desc: 'Implement throttling for public endpoints', priority: 'High', assignee: teamMembers[1], due: 'Mar 18', progress: 40, status: 'In Progress' },
                  { id: 3, task: 'User onboarding flow', desc: 'Create guided tour for new signups', priority: 'High', assignee: teamMembers[2], due: 'Mar 20', progress: 90, status: 'Review' },
                  { id: 4, task: 'Mobile responsive fixes', desc: 'Fix navigation and sidebar on tablet', priority: 'Medium', assignee: teamMembers[3], due: 'Mar 22', progress: 20, status: 'To Do' },
                  { id: 5, task: 'Analytics dashboard', desc: 'Add conversion funnel visualization', priority: 'Medium', assignee: teamMembers[4], due: 'Mar 25', progress: 55, status: 'In Progress' },
                  { id: 6, task: 'Documentation update', desc: 'Update API docs for v2.4 release', priority: 'Low', assignee: teamMembers[5], due: 'Mar 28', progress: 10, status: 'To Do' },
                ].map(t => {
                  const prioStyle = t.priority === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                    t.priority === 'High' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                                    t.priority === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  const statusStyle = t.status === 'In Progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                      t.status === 'Review' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' :
                                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td><GripVertical size={14} className="text-slate-300 dark:text-slate-600 cursor-grab" /></td>
                      <td>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.task}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                        </div>
                      </td>
                      <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${prioStyle}`}>{t.priority}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <img src={t.assignee.img} alt={t.assignee.name} className="w-7 h-7 rounded-full object-cover" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{t.assignee.name}</span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.due}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${t.progress >= 80 ? 'bg-emerald-500' : t.progress >= 50 ? 'bg-primary-500' : t.progress >= 25 ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${t.progress}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t.progress}%</span>
                        </div>
                      </td>
                      <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle}`}>{t.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
