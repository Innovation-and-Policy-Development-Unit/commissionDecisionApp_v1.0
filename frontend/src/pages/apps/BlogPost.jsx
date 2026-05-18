import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, Link2, Image, Eye, Save, Send, X, Plus } from 'lucide-react'

export default function BlogPost() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState(['React', 'TypeScript'])
  const [tagInput, setTagInput] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(t => [...t, tagInput.trim()])
      setTagInput('')
    }
  }

  const removeTag = (tag) => setTags(t => t.filter(x => x !== tag))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Blog Post"
        subtitle="Write and publish your new article"
        action={
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm"><Eye size={14} /> Preview</button>
            <button className="btn btn-secondary btn-sm"><Save size={14} /> Save Draft</button>
            <button className="btn btn-primary btn-sm"><Send size={14} /> Publish</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Post Title *</label>
            <input
              type="text"
              placeholder="Enter your blog post title..."
              className="input text-lg font-semibold"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Editor Area */}
          <div className="card overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-3 border-b border-slate-200 dark:border-slate-700 flex-wrap">
              {[
                [Bold, 'Bold'], [Italic, 'Italic'], [Underline, 'Underline'],
              ].map(([Icon, label], i) => (
                <button key={i} title={label} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                  <Icon size={15} />
                </button>
              ))}
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              {[
                [AlignLeft, 'Left'], [AlignCenter, 'Center'], [AlignRight, 'Right'],
              ].map(([Icon, label], i) => (
                <button key={i} title={label} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                  <Icon size={15} />
                </button>
              ))}
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              <button title="List" className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                <List size={15} />
              </button>
              <button title="Link" className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                <Link2 size={15} />
              </button>
              <button title="Image" className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                <Image size={15} />
              </button>
              <div className="ms-auto flex gap-1">
                {['h1', 'h2', 'h3', 'p', 'code'].map(tag => (
                  <button key={tag} className="px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors font-mono">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="w-full p-5 text-sm text-slate-700 dark:text-slate-300 bg-transparent resize-none focus:outline-none min-h-80 leading-relaxed"
              placeholder="Start writing your amazing article here...

You can format text using the toolbar above. Here are some tips:
• Use headings to structure your content
• Add images to make it more engaging
• Write clear, concise paragraphs
• Include code examples when relevant"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400">
              <span>{content.split(/\s+/).filter(Boolean).length} words</span>
              <span>{Math.ceil(content.split(/\s+/).filter(Boolean).length / 200)} min read</span>
            </div>
          </div>

          {/* Image Upload */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">Featured Image</h3>
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-primary-400 transition-colors cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Image size={22} className="text-primary-500" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Drop your image here or <span className="text-primary-600 dark:text-primary-400">browse</span></p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP up to 5MB</p>
            </div>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">Post Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Category</label>
                <select className="input text-sm" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">Select category</option>
                  <option>Development</option>
                  <option>Design</option>
                  <option>CSS</option>
                  <option>React</option>
                  <option>Backend</option>
                  <option>DevOps</option>
                  <option>Tutorial</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add tag..."
                    className="input text-sm flex-1"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                  />
                  <button onClick={addTag} className="btn btn-sm btn-primary"><Plus size={14} /></button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Status</label>
                <select className="input text-sm">
                  <option>Draft</option>
                  <option>Published</option>
                  <option>Scheduled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Author</label>
                <input type="text" className="input text-sm" defaultValue="John Doe" />
              </div>
            </div>
          </div>

          {/* SEO */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">SEO Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Meta Title</label>
                <input
                  type="text"
                  placeholder="SEO title (60 chars max)"
                  className="input text-sm"
                  value={seoTitle}
                  onChange={e => setSeoTitle(e.target.value)}
                  maxLength={60}
                />
                <p className="text-xs text-slate-400 mt-1">{seoTitle.length}/60 characters</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Meta Description</label>
                <textarea
                  placeholder="SEO description (160 chars max)"
                  className="input text-sm resize-none"
                  rows={3}
                  value={seoDesc}
                  onChange={e => setSeoDesc(e.target.value)}
                  maxLength={160}
                />
                <p className="text-xs text-slate-400 mt-1">{seoDesc.length}/160 characters</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Canonical URL</label>
                <input type="url" placeholder="https://..." className="input text-sm" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn btn-secondary flex-1"><Save size={14} /> Save Draft</button>
            <button className="btn btn-primary flex-1"><Send size={14} /> Publish</button>
          </div>
        </div>
      </div>
    </div>
  )
}
