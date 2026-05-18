import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Search, Clock, Eye, Heart, MessageSquare, Tag, TrendingUp } from 'lucide-react'
import { img } from '../../utils/imgPath'

const posts = [
  { id: 1, title: 'Building Scalable React Applications with TypeScript', category: 'Development', excerpt: 'Learn how to architect React apps that scale with modern TypeScript patterns and best practices.', author: 'John Doe', avatar: img('/images/avatars/avatar-man-john.jpg'), date: 'Mar 08, 2026', readTime: '8 min', views: 2847, likes: 142, comments: 23, image: img('/images/unsplash/react-code.jpg') },
  { id: 2, title: 'The Complete Guide to Tailwind CSS 4.0', category: 'CSS', excerpt: 'Explore all the new features and improvements in Tailwind CSS version 4 with practical examples.', author: 'Alice Chen', avatar: img('/images/avatars/avatar-woman-alice.jpg'), date: 'Mar 06, 2026', readTime: '12 min', views: 5120, likes: 298, comments: 54, image: img('/images/unsplash/code-editor.jpg') },
  { id: 3, title: 'Mastering React Server Components', category: 'React', excerpt: 'Deep dive into React Server Components and how they change the way we build web applications.', author: 'Bob Smith', avatar: img('/images/avatars/avatar-man-bob.jpg'), date: 'Mar 04, 2026', readTime: '15 min', views: 3960, likes: 187, comments: 41, image: img('/images/unsplash/code-screen-dark.jpg') },
  { id: 4, title: 'UI/UX Design Trends to Watch in 2026', category: 'Design', excerpt: 'The most impactful design trends shaping digital experiences this year and beyond.', author: 'Carol White', avatar: img('/images/avatars/avatar-woman-carol-white.jpg'), date: 'Mar 02, 2026', readTime: '6 min', views: 7840, likes: 412, comments: 89, image: img('/images/unsplash/brand-identity-design.jpg') },
  { id: 5, title: 'Node.js Performance Optimization Techniques', category: 'Backend', excerpt: 'Practical techniques to dramatically improve your Node.js application performance.', author: 'David Lee', avatar: img('/images/avatars/avatar-man-david.jpg'), date: 'Feb 28, 2026', readTime: '10 min', views: 2340, likes: 105, comments: 19, image: img('/images/unsplash/server-room.jpg') },
  { id: 6, title: 'Getting Started with GraphQL and Apollo Client', category: 'API', excerpt: 'A comprehensive beginner guide to GraphQL queries, mutations, and subscriptions with React.', author: 'Eva Brown', avatar: img('/images/avatars/avatar-woman-eva.jpg'), date: 'Feb 25, 2026', readTime: '11 min', views: 3100, likes: 156, comments: 33, image: img('/images/unsplash/developer-coding.jpg') },
  { id: 7, title: 'Docker & Kubernetes for Frontend Developers', category: 'DevOps', excerpt: 'How to containerize and orchestrate your frontend applications with modern DevOps tools.', author: 'Frank Wilson', avatar: img('/images/avatars/avatar-man-frank.jpg'), date: 'Feb 22, 2026', readTime: '14 min', views: 1890, likes: 98, comments: 15, image: img('/images/unsplash/docker-containers.jpg') },
  { id: 8, title: 'State Management in 2026: Beyond Redux', category: 'React', excerpt: 'Comparing modern state management solutions: Zustand, Jotai, Valtio, and React Query.', author: 'Grace Kim', avatar: img('/images/avatars/avatar-woman-grace.jpg'), date: 'Feb 20, 2026', readTime: '9 min', views: 4560, likes: 231, comments: 48, image: img('/images/unsplash/coding-laptop.jpg') },
  { id: 9, title: 'Web Accessibility: Building Inclusive UIs', category: 'Accessibility', excerpt: 'Essential accessibility principles and techniques for creating web applications everyone can use.', author: 'Henry Davis', avatar: img('/images/avatars/avatar-man-henry.jpg'), date: 'Feb 18, 2026', readTime: '7 min', views: 2200, likes: 118, comments: 27, image: img('/images/unsplash/web-accessibility.jpg') },
]

const categories = ['All', 'Development', 'CSS', 'React', 'Design', 'Backend', 'API', 'DevOps', 'Accessibility']
const popularTags = ['React', 'TypeScript', 'CSS', 'Node.js', 'Docker', 'GraphQL', 'UI/UX', 'Performance', 'API', 'Testing']

const categoryColors = {
  Development: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  CSS: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  React: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  Design: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  Backend: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  API: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  DevOps: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Accessibility: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
}

export default function BlogPosts() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = posts.filter(post =>
    (activeCategory === 'All' || post.category === activeCategory) &&
    post.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog Posts"
        subtitle="Explore articles, tutorials and insights"
        action={<button className="btn btn-primary">Write Post</button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-5">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search posts..." className="input ps-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`btn btn-sm shrink-0 ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(post => (
              <div key={post.id} className="card overflow-hidden group cursor-pointer hover:shadow-card-md transition-all duration-200 hover:-translate-y-0.5">
                <div className="h-40 relative overflow-hidden">
                  <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <span className={`absolute top-3 start-3 badge ${categoryColors[post.category] || 'badge-secondary'}`}>
                    {post.category}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-snug mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3 line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <img src={post.avatar} alt={post.author} className="w-5 h-5 rounded-full object-cover" />
                      <span>{post.author}</span>
                    </div>
                    <span className="flex items-center gap-1"><Clock size={10} />{post.readTime}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Eye size={11} />{post.views.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Heart size={11} />{post.likes}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={11} />{post.comments}</span>
                    <span className="ms-auto">{post.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Popular Posts */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-500" /> Popular Posts
            </h3>
            <div className="space-y-4">
              {posts.slice(0, 4).map((post, i) => (
                <div key={i} className="flex gap-3 cursor-pointer group">
                  <img src={post.image} alt={post.title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {post.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{post.views.toLocaleString()} views</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Tag size={16} className="text-primary-500" /> Popular Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {popularTags.map(tag => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Categories</h3>
            <div className="space-y-2">
              {categories.slice(1).map(cat => (
                <div key={cat} className="flex items-center justify-between cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{cat}</span>
                  <span className="badge badge-secondary">{posts.filter(p => p.category === cat).length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
