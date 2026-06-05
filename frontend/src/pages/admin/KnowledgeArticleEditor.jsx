import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft, Eye, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import PageHeader from '../../components/shared/PageHeader'
import BaseInput from '../../components/shared/BaseInput'
import BaseTextarea from '../../components/shared/BaseTextarea'
import BaseButton from '../../components/shared/BaseButton'
import BaseSwitch from '../../components/shared/BaseSwitch'

export default function KnowledgeArticleEditor() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const toast = useToast()
  const isEdit = Boolean(slug)

  const [categories, setCategories] = useState([])
  const [formData, setFormData] = useState({
    title: '', slug: '', category: '', content: '', is_published: false, is_internal: true,
  })
  const [loading, setLoading] = useState(false)

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await api.get('/knowledge/categories/')
      setCategories(data.results || data)
    } catch {
      toast.error('Failed to load categories.')
    }
  }, [toast])

  const loadArticle = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const { data } = await api.get(`/knowledge/articles/${slug}/`)
      setFormData({
        title: data.title, slug: data.slug, category: data.category,
        content: data.content, is_published: data.is_published, is_internal: data.is_internal,
      })
    } catch {
      toast.error('Failed to load article.')
      navigate('/admin/knowledge-base')
    } finally {
      setLoading(false)
    }
  }, [slug, navigate, toast])

  useEffect(() => {
    loadCategories()
    if (isEdit) loadArticle()
  }, [loadCategories, loadArticle, isEdit])

  const handleTitleChange = (e) => {
    const val = e.target.value
    setFormData(prev => ({
      ...prev,
      title: val,
      slug: isEdit ? prev.slug : val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
    }))
  }

  const handleSave = async () => {
    if (!formData.title || !formData.category || !formData.content) {
      toast.error('Please fill in all required fields.')
      return
    }
    setLoading(true)
    try {
      if (isEdit) {
        await api.patch(`/knowledge/articles/${slug}/`, formData)
        toast.success('Article updated.')
      } else {
        await api.post('/knowledge/articles/', formData)
        toast.success('Article created.')
      }
      navigate('/admin/knowledge-base')
    } catch (error) {
      toast.error(error.response?.data?.slug ? 'Slug already exists.' : 'Failed to save article.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      <div className="flex items-center justify-between">
        <BaseButton icon={<ArrowLeft size={15} />} onClick={() => navigate('/admin/knowledge-base')}>Back to Management</BaseButton>
        <BaseButton variant="primary" icon={<Save size={15} />} onClick={handleSave} disabled={loading}>
          {isEdit ? 'Update Article' : 'Publish Article'}
        </BaseButton>
      </div>

      <PageHeader title={isEdit ? `Edit: ${formData.title}` : 'New Knowledge Article'} subtitle="Create high-quality documentation for OPSC staff and Ministries." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
        {/* Left: Editor */}
        <div className="card p-6 flex flex-col gap-4">
          <BaseInput label="Article Title" required value={formData.title} onChange={handleTitleChange} placeholder="e.g., Guide to Maternity Leave Policy" />
          <BaseInput label="URL Slug (Permanent Link)" required hint="Used in the browser address bar." value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} disabled={isEdit} />

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Category <span className="text-red-600">*</span></span>
              <select className="input w-full" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                <option value="">Select Category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-3 justify-end pb-1">
              <BaseSwitch label="Published" checked={formData.is_published} onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })} />
              <BaseSwitch label="PSC Internal Only" checked={formData.is_internal} onChange={(e) => setFormData({ ...formData, is_internal: e.target.checked })} />
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          <BaseTextarea label="Content (Markdown)" required className="flex-1" value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder={'# Heading 1\nType your documentation here...'}
            inputClassName="min-h-[400px] font-mono" />
        </div>

        {/* Right: Preview */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-2 text-slate-600 dark:text-slate-300">
            <Eye size={16} /><span className="font-semibold">Live Preview</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 max-h-[800px] overflow-y-auto">
            {formData.content ? (
              <div className="kb-markdown"><ReactMarkdown>{formData.content}</ReactMarkdown></div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 italic gap-2">
                <Sparkles size={48} />
                <span>Start typing to see the preview...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
