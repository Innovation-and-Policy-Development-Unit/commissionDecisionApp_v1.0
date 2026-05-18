import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/shared/Avatar'
import Badge from '../../components/shared/Badge'
import { ArrowLeft, Clock, Eye, Heart, MessageSquare, Share2, Bookmark, Twitter, Linkedin, Link2 } from 'lucide-react'

export default function BlogPost() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/pages/blog')}
        className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Blog
      </button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-primary-500 p-8 mb-8 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white transform translate-x-16 -translate-y-16" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="primary" className="bg-white/20 text-white border-0">Tutorial</Badge>
            <span className="text-white/60 text-xs">Mar 11, 2026</span>
          </div>
          <h1 className="text-3xl font-bold mb-4 leading-tight">
            Building a Premium React Admin Dashboard with Tailwind CSS
          </h1>
          <p className="text-white/80 text-base leading-relaxed mb-6">
            Learn how to create a production-ready admin dashboard using React 18, Vite, and Tailwind CSS.
            We cover dark mode, responsive design, and component architecture.
          </p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Avatar name="John Doe" size="md" />
              <div>
                <p className="font-semibold">John Doe</p>
                <p className="text-white/60 text-xs">Administrator</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-white/60 text-sm">
              <span className="flex items-center gap-1.5"><Clock size={14} />8 min read</span>
              <span className="flex items-center gap-1.5"><Eye size={14} />4,231 views</span>
              <span className="flex items-center gap-1.5"><Heart size={14} />342 likes</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Article Content */}
        <article className="xl:col-span-3 card p-8">
          <div className="prose max-w-none">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">Introduction</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Building a premium admin dashboard requires careful consideration of design principles, component architecture,
              and performance. In this comprehensive guide, we'll walk through creating a production-ready dashboard
              that includes dark mode, RTL support, collapsible sidebar, and beautiful data visualizations.
            </p>

            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 mt-6">Project Setup</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              We'll use Vite as our build tool for its exceptional developer experience and fast hot module replacement.
              Combined with React 18's concurrent features, we get a blazing-fast development experience.
            </p>
            <div className="bg-slate-900 rounded-xl p-4 mb-4">
              <pre className="text-emerald-400 text-sm overflow-x-auto">
{`npm create vite@latest my-dashboard -- --template react
cd my-dashboard
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p`}
              </pre>
            </div>

            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 mt-6">Theme Context</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              The heart of our theming system is the ThemeContext, which manages dark mode, RTL direction,
              sidebar state, and color presets. We persist user preferences to localStorage for a consistent experience.
            </p>
            <div className="bg-slate-900 rounded-xl p-4 mb-4">
              <pre className="text-blue-400 text-sm overflow-x-auto">
{`const [isDark, setIsDark] = useState(() => {
  const saved = localStorage.getItem('liner-dark')
  return saved ? JSON.parse(saved) : false
})

useEffect(() => {
  document.documentElement.classList.toggle('dark', isDark)
  localStorage.setItem('liner-dark', JSON.stringify(isDark))
}, [isDark])`}
              </pre>
            </div>

            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 mt-6">The Design System</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              A well-defined design system is crucial for consistency. We use a custom Tailwind configuration
              with carefully chosen colors, spacing, and typography scales. The primary gradient uses Indigo-500
              to Violet-600, creating a unique and premium feel.
            </p>

            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 mt-6">Components Architecture</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              We organize our components into layout components (Sidebar, Header, Layout) and shared
              components (StatCard, ChartCard, DataTable). This separation of concerns keeps the codebase
              maintainable and each component focused on a single responsibility.
            </p>

            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 mt-6">Data Visualization with Recharts</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Recharts is our chart library of choice for its React-native API and beautiful default styling.
              We use AreaChart for revenue trends, PieChart for traffic sources, BarChart for comparisons,
              and RadarChart for performance metrics.
            </p>

            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 mt-6">Conclusion</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Building a premium admin dashboard is a significant undertaking, but with the right tools and architecture,
              it becomes manageable and enjoyable. The combination of React, Tailwind CSS, and Recharts provides
              everything you need to create a world-class admin experience.
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
            {['React', 'Tailwind CSS', 'Dashboard', 'Dark Mode', 'Recharts'].map(tag => (
              <span key={tag} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer transition-colors">
                #{tag}
              </span>
            ))}
          </div>

          {/* Author bio */}
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 flex items-start gap-4">
            <Avatar name="John Doe" size="lg" />
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200">John Doe</h4>
              <p className="text-sm text-primary-600 dark:text-primary-400">Administrator & Lead Developer</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Full-stack developer with 10+ years of experience building enterprise applications.
                Passionate about React, design systems, and developer experience.
              </p>
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Share */}
          <div className="card p-4">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Share Article</h4>
            <div className="space-y-2">
              {[
                { icon: Twitter, label: 'Share on Twitter', color: 'hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:text-sky-600' },
                { icon: Linkedin, label: 'Share on LinkedIn', color: 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600' },
                { icon: Link2, label: 'Copy Link', color: 'hover:bg-slate-100 dark:hover:bg-slate-700' },
              ].map(({ icon: Icon, label, color }) => (
                <button key={label} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-slate-600 dark:text-slate-400 text-sm font-medium transition-colors ${color}`}>
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="card p-4">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Article Stats</h4>
            <div className="space-y-3">
              {[
                { icon: Eye, label: 'Views', value: '4,231' },
                { icon: Heart, label: 'Likes', value: '342' },
                { icon: MessageSquare, label: 'Comments', value: '28' },
                { icon: Bookmark, label: 'Saves', value: '156' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Icon size={15} />
                    <span className="text-sm">{label}</span>
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Related posts */}
          <div className="card p-4">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Related Articles</h4>
            <div className="space-y-3">
              {[
                'Mastering Recharts Data Visualization',
                'The Art of Dark Mode Design',
                'React Performance Optimization Tips',
              ].map(title => (
                <button key={title} className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors leading-snug">{title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">5 min read</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
