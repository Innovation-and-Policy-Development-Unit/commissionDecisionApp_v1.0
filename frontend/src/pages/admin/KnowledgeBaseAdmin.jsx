import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Plus, Folder, FileText, Save, X, Eye } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'
import BaseInput from '../../components/shared/BaseInput'
import BaseTextarea from '../../components/shared/BaseTextarea'
import BaseButton from '../../components/shared/BaseButton'

const TH = 'px-3 py-2 text-xs uppercase tracking-wide text-slate-500'
const TD = 'px-3 py-2 text-sm text-slate-700 dark:text-slate-300'

export default function KnowledgeBaseAdmin() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const [categories, setCategories] = useState([])
  const [articles, setArticles] = useState([])
  const [, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [catModalOpen, setCatModalOpen] = useState(false)
  const [currentCat, setCurrentCat] = useState(null)
  const [catForm, setCatForm] = useState({ title: '', description: '', icon_name: '', display_order: 0 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [catRes, artRes] = await Promise.all([
        api.get('/knowledge/categories/'),
        api.get('/knowledge/articles/'),
      ])
      setCategories(catRes.data.results || catRes.data)
      setArticles(artRes.data.results || artRes.data)
    } catch (error) {
      const status = error?.response?.status
      setFetchError(status === 404
        ? 'Knowledge base endpoints are not available yet on this server.'
        : 'Failed to load knowledge base data.')
      if (status !== 404) toastRef.current.error('Failed to load knowledge base data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleEditCategory = (cat) => {
    setCurrentCat(cat)
    setCatForm({ title: cat.title, description: cat.description || '', icon_name: cat.icon_name || '', display_order: cat.display_order || 0 })
    setCatModalOpen(true)
  }

  const handleAddCategory = () => {
    setCurrentCat(null)
    setCatForm({ title: '', description: '', icon_name: 'Folder', display_order: categories.length })
    setCatModalOpen(true)
  }

  const saveCategory = async () => {
    try {
      if (currentCat) {
        await api.patch(`/knowledge/categories/${currentCat.id}/`, catForm)
        toast.success('Category updated.')
      } else {
        await api.post('/knowledge/categories/', catForm)
        toast.success('Category created.')
      }
      setCatModalOpen(false)
      fetchData()
    } catch {
      toast.error('Failed to save category.')
    }
  }

  const deleteCategory = async (cat) => {
    const ok = await confirm({ title: 'Delete Category', message: `Are you sure you want to delete "${cat.title}"? This will also delete all articles in this category.`, confirmLabel: 'Delete' })
    if (!ok) return
    try {
      await api.delete(`/knowledge/categories/${cat.id}/`)
      toast.success('Category deleted.')
      fetchData()
    } catch {
      toast.error('Failed to delete category.')
    }
  }

  const deleteArticle = async (art) => {
    const ok = await confirm({ title: 'Delete Article', message: `Are you sure you want to delete "${art.title}"?`, confirmLabel: 'Delete' })
    if (!ok) return
    try {
      await api.delete(`/knowledge/articles/${art.slug}/`)
      toast.success('Article deleted.')
      fetchData()
    } catch {
      toast.error('Failed to delete article.')
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      <PageHeader title="Knowledge Base Management" subtitle="Manage official OPSC documentation, SOPs, and circulars." />

      {fetchError && (
        <div className="p-4 rounded-lg flex items-center gap-3 border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20">
          <span>⚠️</span>
          <div>
            <span className="font-semibold block text-slate-800 dark:text-slate-100">Knowledge Base Unavailable</span>
            <span className="block text-sm text-slate-600 dark:text-slate-300">{fetchError}</span>
            <BaseButton size="sm" variant="ghost" onClick={fetchData} className="mt-1">Retry</BaseButton>
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="card p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2"><Folder size={24} className="text-primary-500" /><span className="font-bold text-lg text-slate-800 dark:text-slate-100">Knowledge Categories</span></div>
          <BaseButton icon={<Plus size={15} />} variant="primary" onClick={handleAddCategory}>Add Category</BaseButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 dark:border-slate-700"><tr>
              <th className={TH}>Title</th><th className={TH}>Description</th><th className={TH}>Articles</th><th className={TH}>Order</th><th className={`${TH} w-24`}>Actions</th>
            </tr></thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className={TD}><div className="flex items-center gap-2"><Folder size={16} className="text-slate-400" /><span className="font-semibold text-slate-800 dark:text-slate-100">{cat.title}</span></div></td>
                  <td className={TD}><span className="text-slate-500 truncate block max-w-xs">{cat.description}</span></td>
                  <td className={TD}>{cat.article_count}</td>
                  <td className={TD}>{cat.display_order}</td>
                  <td className={TD}><div className="flex gap-1">
                    <BaseButton variant="ghost" size="icon" iconOnly icon={<Pencil size={15} />} onClick={() => handleEditCategory(cat)} aria-label="Edit" />
                    <BaseButton variant="ghost" size="icon" iconOnly icon={<Trash2 size={15} />} onClick={() => deleteCategory(cat)} aria-label="Delete" />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Articles */}
      <div className="card p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2"><FileText size={24} className="text-primary-500" /><span className="font-bold text-lg text-slate-800 dark:text-slate-100">Knowledge Articles</span></div>
          <BaseButton icon={<Plus size={15} />} variant="primary" onClick={() => navigate('/admin/knowledge-base/new')} disabled={categories.length === 0}>Create Article</BaseButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 dark:border-slate-700"><tr>
              <th className={TH}>Title</th><th className={TH}>Category</th><th className={TH}>Visibility</th><th className={TH}>Status</th><th className={TH}>Last Updated</th><th className={`${TH} w-28`}>Actions</th>
            </tr></thead>
            <tbody>
              {articles.map((art) => (
                <tr key={art.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className={TD}><div className="flex items-center gap-2"><FileText size={16} className="text-slate-400" /><span className="font-semibold text-slate-800 dark:text-slate-100">{art.title}</span></div></td>
                  <td className={TD}>{art.category_title}</td>
                  <td className={TD}><span className={art.is_internal ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>{art.is_internal ? 'PSC Internal' : 'Public/Ministry'}</span></td>
                  <td className={TD}><span className={art.is_published ? 'text-emerald-600 font-bold' : 'text-slate-400 italic'}>{art.is_published ? 'Published' : 'Draft'}</span></td>
                  <td className={TD}>{new Date(art.updated_at).toLocaleDateString()}</td>
                  <td className={TD}><div className="flex gap-1">
                    <BaseButton variant="ghost" size="icon" iconOnly icon={<Eye size={15} />} onClick={() => navigate(`/wiki/${art.slug}`)} aria-label="View" />
                    <BaseButton variant="ghost" size="icon" iconOnly icon={<Pencil size={15} />} onClick={() => navigate(`/admin/knowledge-base/edit/${art.slug}`)} aria-label="Edit" />
                    <BaseButton variant="ghost" size="icon" iconOnly icon={<Trash2 size={15} />} onClick={() => deleteArticle(art)} aria-label="Delete" />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Modal */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={currentCat ? 'Edit Category' : 'Add Knowledge Category'}
        footer={(
          <>
            <BaseButton variant="secondary" icon={<X size={15} />} onClick={() => setCatModalOpen(false)}>Cancel</BaseButton>
            <BaseButton variant="primary" icon={<Save size={15} />} onClick={saveCategory}>Save Category</BaseButton>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          <BaseInput label="Title" required value={catForm.title} onChange={(e) => setCatForm({ ...catForm, title: e.target.value })} />
          <BaseTextarea label="Description" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <BaseInput label="Icon Name" value={catForm.icon_name} onChange={(e) => setCatForm({ ...catForm, icon_name: e.target.value })} />
            <BaseInput label="Display Order" type="number" value={catForm.display_order} onChange={(e) => setCatForm({ ...catForm, display_order: parseInt(e.target.value) })} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
