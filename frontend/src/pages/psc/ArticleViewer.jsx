import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Calendar, User, Lock, Folder, Printer } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { userIsAdmin } from '../../utils/adminAccess'
import { formatApiError } from '../../utils/apiError'
import BaseButton from '../../components/shared/BaseButton'
import BaseBadge from '../../components/shared/BaseBadge'
import BaseSpinner from '../../components/shared/BaseSpinner'

export default function ArticleViewer() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const { user } = useAuth()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [htmlAvailable, setHtmlAvailable] = useState(null)

  const loadArticle = useCallback(async () => {
    setLoading(true)
    setAccessError('')
    try {
      const { data } = await api.get(`/knowledge/articles/${slug}/`)
      setArticle(data)
    } catch (error) {
      console.error('KB Load Error:', error)
      if (error?.response?.status === 403) {
        setAccessError(formatApiError(error, 'You do not have access to this guide.'))
      } else {
        navigate('/wiki')
      }
    } finally {
      setLoading(false)
    }
  }, [slug, navigate])

  useEffect(() => { loadArticle() }, [loadArticle])

  useEffect(() => {
    if (!article || article.content_type !== 'html_iframe' || !article.html_asset) {
      setHtmlAvailable(null)
      return
    }
    fetch(`/guides/${article.html_asset}`, { method: 'HEAD' })
      .then((r) => setHtmlAvailable(r.ok))
      .catch(() => setHtmlAvailable(false))
  }, [article])

  if (loading) {
    return <div className="flex items-center justify-center h-96"><BaseSpinner size="lg" label="Loading article..." /></div>
  }

  if (accessError) {
    return (
      <div className="flex flex-col gap-6 max-w-[900px] mx-auto pb-20">
        <BaseButton icon={<ArrowLeft size={15} />} onClick={() => navigate('/wiki')}>Back to Wiki</BaseButton>
        <div className="card p-6">
          <span className="font-semibold text-lg text-slate-800 dark:text-slate-100">Access restricted</span>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{accessError}</p>
        </div>
      </div>
    )
  }

  if (!article) return null

  const canEdit = user && (userIsAdmin(user) || user.role === 'psc_admin' || user.is_staff)
  const isHtmlGuide = article.content_type === 'html_iframe' && article.html_asset

  if (isHtmlGuide) {
    return (
      <div className="flex flex-col w-full mx-auto" style={{ height: 'calc(100vh - 8rem)' }}>
        <div className="shrink-0 flex items-center justify-between gap-2 px-1 py-2 no-print">
          <BaseButton icon={<ArrowLeft size={15} />} onClick={() => navigate('/wiki')}>Back to Wiki</BaseButton>
          {canEdit && (
            <BaseButton variant="primary" icon={<Pencil size={15} />} onClick={() => navigate(`/admin/knowledge-base/edit/${slug}`)}>Edit</BaseButton>
          )}
        </div>
        {htmlAvailable === false ? (
          <div className="card flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-slate-600 dark:text-slate-300">
              Guide HTML is not deployed yet. Render the Quarto source into{' '}
              <code>frontend/public/guides/{article.html_asset}</code> and redeploy the web app.
            </p>
          </div>
        ) : htmlAvailable === true ? (
          <iframe src={`/guides/${article.html_asset}`} className="flex-1 w-full rounded-lg border border-slate-200 dark:border-slate-700" title={article.title} />
        ) : (
          <div className="flex-1 flex items-center justify-center"><BaseSpinner label="Loading guide..." /></div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-[900px] mx-auto pb-20">
      <div className="flex items-center justify-between no-print">
        <BaseButton icon={<ArrowLeft size={15} />} onClick={() => navigate('/wiki')}>Back to Wiki</BaseButton>
        <div className="flex gap-2">
          <BaseButton icon={<Printer size={15} />} onClick={() => window.print()}>Print</BaseButton>
          {canEdit && (
            <BaseButton variant="primary" icon={<Pencil size={15} />} onClick={() => navigate(`/admin/knowledge-base/edit/${slug}`)}>Edit Article</BaseButton>
          )}
        </div>
      </div>

      <div className="card bg-white text-slate-900 p-10 min-h-[600px]">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-4 no-print">
            <BaseBadge color="primary" icon={<Folder size={13} />}>{article.category_title}</BaseBadge>
            {article.is_internal && <BaseBadge color="warning" icon={<Lock size={13} />}>PSC Internal</BaseBadge>}
            {!article.is_published && <BaseBadge color="info">Draft</BaseBadge>}
          </div>

          <h1 className="text-4xl font-extrabold text-slate-900 mb-6">{article.title}</h1>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-slate-400 mb-8">
            <span className="flex items-center gap-1.5 text-sm"><User size={16} /> {article.author_username || 'OPSC Secretariat'}</span>
            <span className="flex items-center gap-1.5 text-sm"><Calendar size={16} /> Last updated {new Date(article.updated_at).toLocaleDateString()}</span>
          </div>

          <hr className="mb-10 border-slate-200" />

          <div className="kb-markdown">
            <ReactMarkdown>{article.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
