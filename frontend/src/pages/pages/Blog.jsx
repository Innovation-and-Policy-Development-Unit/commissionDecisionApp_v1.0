import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import Avatar from '../../components/shared/Avatar'
import Badge from '../../components/shared/Badge'
import { Clock, Eye, Heart, MessageSquare, ArrowRight, Search } from 'lucide-react'

const posts = [
  {
    id: 1,
    title: 'Building a Premium React Admin Dashboard with Tailwind CSS',
    excerpt: 'Learn how to create a production-ready admin dashboard using React 18, Vite, and Tailwind CSS. We cover dark mode, responsive design, and component architecture.',
    author: 'John Doe', date: 'Mar 11, 2026', readTime: '8 min read',
    category: 'Tutorial', views: 4231, likes: 342, comments: 28,
    tags: ['React', 'Tailwind', 'Dashboard'],
    solid: 'bg-primary-500',
    featured: true
  },
  {
    id: 2,
    title: 'Mastering Recharts: Advanced Data Visualization Techniques',
    excerpt: 'Deep dive into Recharts library to create beautiful, interactive charts. Covers area charts, bar charts, pie charts, and custom tooltips.',
    author: 'Alice Johnson', date: 'Mar 9, 2026', readTime: '12 min read',
    category: 'Development', views: 2891, likes: 218, comments: 15,
    tags: ['Charts', 'Data Viz', 'React'],
    solid: 'bg-cyan-500',
  },
  {
    id: 3,
    title: 'The Art of Dark Mode: Best Practices for Modern UIs',
    excerpt: "Dark mode is more than just inverting colors. Discover the principles behind great dark mode implementations and how to apply them in your projects.",
    author: 'Carol Williams', date: 'Mar 7, 2026', readTime: '6 min read',
    category: 'Design', views: 3412, likes: 287, comments: 31,
    tags: ['Design', 'Dark Mode', 'UX'],
    solid: 'bg-slate-600',
  },
  {
    id: 4,
    title: 'React Context API vs. Zustand: When to Use What',
    excerpt: 'State management in React can be complex. This article compares Context API and Zustand for different use cases to help you make the right choice.',
    author: 'Bob Smith', date: 'Mar 5, 2026', readTime: '10 min read',
    category: 'Development', views: 5678, likes: 431, comments: 47,
    tags: ['React', 'State Management', 'Performance'],
    solid: 'bg-emerald-500',
  },
  {
    id: 5,
    title: 'Glassmorphism in 2026: Modern UI Design Trends',
    excerpt: 'Glassmorphism continues to dominate UI design. Learn how to implement frosted glass effects, backdrop blur, and transparency to create stunning interfaces.',
    author: 'Carol Williams', date: 'Mar 3, 2026', readTime: '5 min read',
    category: 'Design', views: 2156, likes: 189, comments: 22,
    tags: ['Design', 'CSS', 'UI Trends'],
    solid: 'bg-pink-500',
  },
  {
    id: 6,
    title: 'Performance Optimization for Large React Applications',
    excerpt: 'As your React app grows, performance can suffer. This guide covers code splitting, lazy loading, memoization, and virtual scrolling techniques.',
    author: 'David Brown', date: 'Mar 1, 2026', readTime: '15 min read',
    category: 'Performance', views: 4892, likes: 367, comments: 53,
    tags: ['React', 'Performance', 'Optimization'],
    solid: 'bg-amber-500',
  },
]

const categoryColors = {
  Tutorial: 'primary', Development: 'info', Design: 'purple', Performance: 'warning',
}

export default function Blog() {
  const navigate = useNavigate()
  const featured = posts[0]
  const rest = posts.slice(1)

  return (
    <div>
      <PageHeader
        title="Blog"
        subtitle="Tutorials, insights, and updates from the Liner team"
        action={
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search articles..." className="input pl-9 text-sm" />
          </div>
        }
      />

      {/* Featured Post */}
      <div
        className={`relative overflow-hidden rounded-2xl ${featured.solid} p-6 mb-8 cursor-pointer group`}
        onClick={() => navigate('/pages/blog/post')}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white transform translate-x-16 -translate-y-16" />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white transform -translate-x-8 translate-y-8" />
        </div>
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">{featured.category}</span>
            <span className="text-white/70 text-xs">Featured</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3 group-hover:underline decoration-white/50">{featured.title}</h2>
          <p className="text-white/80 text-sm leading-relaxed mb-4 line-clamp-2">{featured.excerpt}</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar name={featured.author} size="sm" />
              <span className="text-white/80 text-sm">{featured.author}</span>
            </div>
            <span className="text-white/60 text-xs">{featured.date}</span>
            <span className="flex items-center gap-1 text-white/60 text-xs">
              <Clock size={12} />{featured.readTime}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/20">
            <span className="flex items-center gap-1 text-white/60 text-xs"><Eye size={12} />{featured.views.toLocaleString()}</span>
            <span className="flex items-center gap-1 text-white/60 text-xs"><Heart size={12} />{featured.likes}</span>
            <span className="flex items-center gap-1 text-white/60 text-xs"><MessageSquare size={12} />{featured.comments}</span>
          </div>
        </div>
      </div>

      {/* Post Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {rest.map(post => (
          <article
            key={post.id}
            className="card-hover overflow-hidden cursor-pointer group"
            onClick={() => navigate('/pages/blog/post')}
          >
            {/* Card header gradient */}
            <div className={`h-2 ${post.solid}`} />

            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Badge variant={categoryColors[post.category] || 'secondary'}>{post.category}</Badge>
                <span className="text-xs text-slate-400 dark:text-slate-500">{post.readTime}</span>
              </div>

              <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight">
                {post.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 mb-4">
                {post.excerpt}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {post.tags.map(tag => (
                  <span key={tag} className="text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Avatar name={post.author} size="xs" />
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{post.author}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{post.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1"><Eye size={11} />{post.views.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Heart size={11} />{post.likes}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Load more */}
      <div className="flex justify-center mt-8">
        <button className="btn-outline gap-2">
          Load More Articles
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
