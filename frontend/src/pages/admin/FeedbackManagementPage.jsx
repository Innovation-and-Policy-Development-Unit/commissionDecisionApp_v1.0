import { useState, useEffect, useCallback } from 'react'
import { 
  MessageSquare, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  User as UserIcon,
  Search,
  RefreshCw,
  MoreVertical,
  ExternalLink,
  Eye,
  Trash2,
  Send
} from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import DataTable from '../../components/shared/DataTable'
import api from '../../api/client'
import clsx from 'clsx'
import Badge from '../../components/shared/Badge'
import Modal from '../../components/shared/Modal'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

export default function FeedbackManagementPage() {
  const toast   = useToast()
  const confirm = useConfirm()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isPostingComment, setIsPostingComment] = useState(false)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/feedback/')
      setReports(data.results || data)
    } catch (err) {
      setError('Failed to fetch feedback reports.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleOpenDetail = async (report) => {
    setSelectedReport(report)
    setIsDetailOpen(true)
    // Fetch full detail with comments
    try {
      const { data } = await api.get(`/feedback/${report.id}/`)
      setSelectedReport(data)
    } catch (err) {
      console.error('Failed to fetch feedback detail', err)
    }
  }

  const handleUpdateStatus = async (status) => {
    if (!selectedReport) return
    setIsUpdating(true)
    try {
      const { data } = await api.patch(`/feedback/${selectedReport.id}/`, { status })
      setSelectedReport(prev => ({ ...prev, ...data }))
      setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, status: data.status } : r))
      toast.success('Status updated successfully.')
    } catch (err) {
      toast.error('Failed to update status.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteReport = async () => {
    if (!selectedReport) return
    const ok = await confirm({
      title: 'Delete Feedback',
      message: `Delete "${selectedReport.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await api.delete(`/feedback/${selectedReport.id}/`)
      setReports(prev => prev.filter(r => r.id !== selectedReport.id))
      setIsDetailOpen(false)
      setSelectedReport(null)
      toast.success('Feedback deleted.')
    } catch (err) {
      toast.error('Failed to delete feedback.')
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!selectedReport || !commentText.trim()) return
    setIsPostingComment(true)
    try {
      const { data } = await api.post('/feedback-comments/', {
        report: selectedReport.id,
        text: commentText
      })
      setSelectedReport(prev => ({
        ...prev,
        comments: [...(prev.comments || []), data]
      }))
      setCommentText('')
      toast.success('Note added.')
    } catch (err) {
      toast.error('Failed to post note.')
    } finally {
      setIsPostingComment(false)
    }
  }

  const columns = [
    {
      key: 'title',
      label: 'Feedback',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{val}</span>
          <span className="text-xs text-slate-500 truncate max-w-xs">{row.description}</span>
        </div>
      )
    },
    {
      key: 'feedback_type',
      label: 'Type',
      render: (val) => (
        <Badge variant="outline" className="capitalize">
          {val.replace('_', ' ')}
        </Badge>
      )
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (val) => {
        const variants = {
          low: 'info',
          medium: 'warning',
          high: 'error',
          critical: 'error'
        }
        return (
          <Badge variant={variants[val] || 'default'} className="capitalize">
            {val}
          </Badge>
        )
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        const variants = {
          open: 'warning',
          under_review: 'info',
          in_progress: 'primary',
          resolved: 'success',
          closed: 'default',
          rejected: 'error'
        }
        return (
          <Badge variant={variants[val] || 'default'} dot className="capitalize">
            {val.replace('_', ' ')}
          </Badge>
        )
      }
    },
    {
      key: 'created_by_username',
      label: 'Submitted By',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
            {val?.slice(0, 2).toUpperCase() || 'U'}
          </div>
          <span className="text-sm">{val}</span>
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (val) => (
        <span className="text-sm text-slate-500">
          {new Date(val).toLocaleDateString()}
        </span>
      )
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={() => handleOpenDetail(row)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary-500 transition-colors"
        >
          <Eye size={18} />
        </button>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <PageHeader 
        title="User Feedback Management" 
        subtitle="Review and manage feedback reports submitted by users"
      >
        <button 
          onClick={fetchReports}
          disabled={loading}
          className="btn btn-secondary btn-sm gap-2"
        >
          <RefreshCw size={14} className={clsx(loading && 'animate-spin')} />
          Refresh
        </button>
      </PageHeader>

      <div className="card">
        <DataTable
          columns={columns}
          data={reports}
          loading={loading}
          searchable
          pageSize={10}
        />
      </div>

      {/* Detail Modal */}
      <Modal
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedReport ? `Feedback Detail: #${selectedReport.id}` : 'Feedback Detail'}
        size="lg"
      >
        {selectedReport && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedReport.title}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="capitalize">{selectedReport.feedback_type.replace('_', ' ')}</Badge>
                  <Badge variant={selectedReport.severity === 'critical' || selectedReport.severity === 'high' ? 'error' : 'warning'} className="capitalize">
                    {selectedReport.severity}
                  </Badge>
                  <Badge variant="info" className="capitalize">{selectedReport.status.replace('_', ' ')}</Badge>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={selectedReport.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  disabled={isUpdating}
                  className="input py-1 text-sm min-w-[140px]"
                >
                  <option value="open">Open</option>
                  <option value="under_review">Under Review</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button
                  type="button"
                  onClick={handleDeleteReport}
                  title="Delete feedback"
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Description</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                {selectedReport.description}
              </p>
            </div>

            {selectedReport.screenshot && (
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Screenshot</h4>
                <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                  <img 
                    src={selectedReport.screenshot} 
                    alt="Feedback screenshot" 
                    className="w-full h-auto max-h-[400px] object-contain"
                  />
                  <a 
                    href={selectedReport.screenshot} 
                    target="_blank" 
                    rel="noreferrer"
                    className="absolute top-4 right-4 p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Submission Details</h4>
                <ul className="space-y-2.5">
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Submitted By</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{selectedReport.created_by_username}</span>
                  </li>
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Date</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(selectedReport.created_at).toLocaleString()}</span>
                  </li>
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Page URL</span>
                    <a href={selectedReport.page_url} target="_blank" rel="noreferrer" className="font-medium text-primary-600 truncate max-w-[150px] flex items-center gap-1 hover:underline">
                      View Page <ExternalLink size={10} />
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">System Context</h4>
                <ul className="space-y-2.5">
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Viewport</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{selectedReport.viewport_size}</span>
                  </li>
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Browser</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]" title={selectedReport.browser_info}>
                      {selectedReport.browser_info.split(' ').slice(0, 3).join(' ')}...
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Comments Section */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <MessageSquare size={16} />
                Internal Notes & Comments
              </h4>

              <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mb-4">
                {selectedReport.comments?.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4 italic">No internal notes yet.</p>
                ) : (
                  selectedReport.comments?.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <UserIcon size={14} className="text-slate-400" />
                      </div>
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{comment.author_username}</span>
                          <span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="relative">
                <textarea
                  placeholder="Add an internal note..."
                  className="w-full input py-3 pr-12 min-h-[80px] text-sm"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isPostingComment || !commentText.trim()}
                  className="absolute bottom-3 right-3 p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPostingComment ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
