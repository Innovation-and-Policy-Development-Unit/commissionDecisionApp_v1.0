import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, BookOpen, Folder, ChevronRight, Lock } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import BaseInput from '../../components/shared/BaseInput'
import BaseBadge from '../../components/shared/BaseBadge'
import BaseButton from '../../components/shared/BaseButton'

export default function KnowledgeBaseBrowse() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [articles, setArticles] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setUnavailable(false)
    try {
      const [catRes, artRes] = await Promise.all([
        api.get('/knowledge/categories/'),
        api.get('/knowledge/articles/'),
      ])
      setCategories(catRes.data.results || catRes.data)
      setArticles(artRes.data.results || artRes.data)
    } catch (error) {
      console.error('KB Error:', error)
      if (error?.response?.status === 404) setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredArticles = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.category_title.toLowerCase().includes(search.toLowerCase()),
  )

  const articleItem = 'flex items-center justify-between px-3 py-2 rounded-md cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50'

  if (unavailable) {
    return (
      <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
        <PageHeader title="OPSC Wiki & Knowledge Base" subtitle="Policies, circulars, and role-based user guides (HR Manager, Unit Manager, Secretary)." />
        <div className="text-center px-6 py-12 text-slate-500">
          <BookOpen size={48} className="mx-auto opacity-30" />
          <span className="block text-base font-semibold mt-4 text-slate-700 dark:text-slate-200">Knowledge Base Coming Soon</span>
          <span className="block text-sm mt-2">This feature is not yet available on this server. Please check back later.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      <PageHeader title="OPSC Wiki & Knowledge Base" subtitle="Policies, circulars, and role-based user guides (HR Manager, Unit Manager, Secretary)." />

      <div className="card p-6">
        <BaseInput hideLabel label="Search" placeholder="Search for policies, circulars, or help guides..."
          contentBefore={<Search size={16} className="text-slate-400" />}
          value={search} onChange={(e) => setSearch(e.target.value)} className="w-full" />
      </div>

      {loading ? null : search ? (
        <div className="space-y-4">
          <span className="font-semibold text-slate-800 dark:text-slate-100">Search Results ({filteredArticles.length})</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map(art => (
              <div key={art.id} className={`card ${articleItem}`} onClick={() => navigate(`/wiki/${art.slug}`)}>
                <div className="flex items-center gap-3">
                  <BookOpen size={18} className="text-slate-400" />
                  <div>
                    <span className="font-semibold block text-slate-800 dark:text-slate-100">{art.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-tight">{art.category_title}</span>
                      {art.is_internal && <BaseBadge size="small" color="outline" icon={<Lock size={11} />}>Internal</BaseBadge>}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {categories.map(cat => {
            const catArticles = articles.filter(a => a.category === cat.id).slice(0, 5)
            if (catArticles.length === 0) return null
            return (
              <div key={cat.id} className="card card-hover p-4">
                <div className="flex items-center gap-2">
                  <Folder size={24} className="text-primary-500" />
                  <span className="font-bold text-lg text-slate-800 dark:text-slate-100">{cat.title}</span>
                </div>
                {cat.description && <p className="text-sm text-slate-500 mt-1">{cat.description}</p>}

                <div className="mt-4 space-y-1">
                  {catArticles.map(art => (
                    <div key={art.id} className={articleItem} onClick={() => navigate(`/wiki/${art.slug}`)}>
                      <span className="text-sm truncate text-slate-700 dark:text-slate-300">{art.title}</span>
                      {art.is_internal && <Lock size={14} className="text-amber-500 shrink-0" />}
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <BaseButton variant="ghost" size="sm" onClick={() => navigate(`/wiki/${catArticles[0].slug}`)}>
                    View all {cat.article_count} articles <ChevronRight size={14} />
                  </BaseButton>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
