import { useState, ReactNode, FC } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Clock, Eye, Heart, MessageSquare, Share2, Bookmark, Twitter, Linkedin, ArrowLeft, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { img } from '../../utils/imgPath'

const relatedPosts = [
  { title: 'The Complete Guide to Tailwind CSS 4.0', category: 'CSS', readTime: '12 min', image: img('/images/unsplash/code-editor.jpg') },
  { title: 'Mastering React Server Components', category: 'React', readTime: '15 min', image: img('/images/unsplash/code-screen-dark.jpg') },
  { title: 'State Management in 2026: Beyond Redux', category: 'React', readTime: '9 min', image: img('/images/unsplash/coding-laptop.jpg') },
]

const comments = [
  { author: 'Alice Chen', time: '2 hours ago', content: 'Excellent article! The TypeScript patterns section was particularly helpful. I\'ve been looking for a clear explanation of how to properly type context providers.', avatar: img('/images/avatars/avatar-woman-alice.jpg'), likes: 12 },
  { author: 'Bob Martinez', time: '5 hours ago', content: 'Great writeup. One thing I\'d add is the importance of using the "satisfies" operator in TypeScript 4.9+ — it works really well with these patterns.', avatar: img('/images/avatars/avatar-man-bob.jpg'), likes: 8 },
  { author: 'Carol Johnson', time: '1 day ago', content: 'I\'ve been using a similar approach but struggled with circular dependencies in large module trees. This article explains exactly how to avoid that issue!', avatar: img('/images/avatars/avatar-woman-carol-white.jpg'), likes: 5 },
]

export default function BlogDetail() {
  const [liked, setLiked] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [comment, setComment] = useState('')

  return (
    <div className="space-y-6">
      <PageHeader title="Blog Detail" subtitle="Read the full article" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Hero */}
          <div className="card overflow-hidden">
            <div className="h-72 relative">
              <img src={img('/images/unsplash/react-code.jpg')} alt="Building Scalable React Applications" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute bottom-0 p-6">
                <span className="badge bg-white/20 text-white border-white/30 backdrop-blur-sm mb-3">Development</span>
                <h1 className="text-2xl font-bold text-white leading-tight">
                  Building Scalable React Applications with TypeScript
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-white/80 text-sm">
                  <div className="flex items-center gap-2">
                    <img src={img('/images/avatars/avatar-man-john.jpg')} alt="John Doe" className="w-7 h-7 rounded-full object-cover border border-white/30" />
                    <span>John Doe</span>
                  </div>
                  <span className="flex items-center gap-1"><Clock size={13} /> 8 min read</span>
                  <span className="flex items-center gap-1"><Eye size={13} /> 2,847</span>
                  <span>Mar 08, 2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* Article Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLiked(l => !l)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${liked ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' : 'btn btn-outline'}`}
              >
                <Heart size={15} fill={liked ? 'currentColor' : 'none'} /> {liked ? '143' : '142'} Likes
              </button>
              <button className="btn btn-outline btn-sm"><MessageSquare size={14} /> 23 Comments</button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBookmarked(b => !b)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${bookmarked ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'btn btn-outline'}`}
              >
                <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
              </button>
              <button className="w-9 h-9 rounded-xl btn btn-outline flex items-center justify-center"><Share2 size={16} /></button>
              <button className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-500 flex items-center justify-center hover:bg-sky-100 transition-colors"><Twitter size={16} /></button>
              <button className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"><Linkedin size={16} /></button>
            </div>
          </div>

          {/* Content */}
          <div className="card p-8">
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">Introduction</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Building large-scale React applications requires careful planning and architecture decisions. TypeScript has become an essential tool for teams working on complex projects, providing type safety, better IDE support, and improved code maintainability.
              </p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                In this article, we'll explore proven patterns and best practices for structuring React applications with TypeScript that can grow with your team and requirements.
              </p>

              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">Component Architecture</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                The foundation of any scalable React application is a well-thought-out component architecture. We recommend following the Atomic Design methodology — building UI from atoms, molecules, organisms, and templates.
              </p>
              <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-5 mb-6 overflow-x-auto">
                <pre className="text-sm text-slate-100"><code>{`interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  onClick?: () => void
}

export const Button: FC<ButtonProps> = ({
  variant,
  size = 'md',
  children,
  onClick
}) => {
  return (
    <button className={clsx(buttonStyles[variant], sizeStyles[size])} onClick={onClick}>
      {children}
    </button>
  )
}`}</code></pre>
              </div>

              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">State Management Patterns</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                For state management, we recommend using React's built-in Context API for global UI state, and React Query or SWR for server state. This separation of concerns makes your codebase much easier to reason about.
              </p>

              <blockquote className="border-s-4 border-primary-500 ps-5 py-1 my-6 bg-primary-50 dark:bg-primary-900/10 rounded-e-xl">
                <p className="text-slate-700 dark:text-slate-300 italic">"The best architecture is the one your team can understand and maintain. Complexity for its own sake is always a mistake."</p>
                <cite className="text-sm text-slate-500 mt-2 block">— Dan Abramov</cite>
              </blockquote>

              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">Conclusion</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Building scalable React applications with TypeScript is a journey, not a destination. Start with these patterns and adapt them to your team's needs. The most important thing is consistency and clear documentation.
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
              {['React', 'TypeScript', 'Architecture', 'Best Practices', 'Frontend'].map(tag => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Author Card */}
          <div className="card p-6">
            <div className="flex items-start gap-5">
              <img src={img('/images/avatars/avatar-man-john.jpg')} alt="John Doe" className="w-16 h-16 rounded-2xl object-cover shrink-0" />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">John Doe</h3>
                <p className="text-sm text-slate-500 mb-2">Senior Frontend Developer at TechCorp</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Passionate developer with 8+ years building web applications. Specializes in React, TypeScript, and modern CSS. Open source contributor and occasional speaker at tech conferences.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button className="btn btn-sm btn-primary">Follow</button>
                  <button className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-500 hover:bg-sky-100 transition-colors"><Twitter size={14} /></button>
                  <button className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"><Linkedin size={14} /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5">Comments ({comments.length})</h3>
            <div className="space-y-5 mb-6">
              {comments.map((c, i) => (
                <div key={i} className="flex gap-4">
                  <img src={c.avatar} alt={c.author} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{c.author}</span>
                      <span className="text-xs text-slate-400">{c.time}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{c.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 transition-colors">
                        <Heart size={12} /> {c.likes}
                      </button>
                      <button className="text-xs text-slate-400 hover:text-primary-600 transition-colors">Reply</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-5 border-t border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 text-sm">Leave a Comment</h4>
              <textarea
                className="input resize-none mb-3"
                rows={3}
                placeholder="Write your comment..."
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
              <button className="btn btn-primary btn-sm"><Send size={14} /> Post Comment</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Related Posts</h3>
            <div className="space-y-4">
              {relatedPosts.map((post, i) => (
                <div key={i} className="cursor-pointer group">
                  <img src={post.image} alt={post.title} className="h-24 w-full rounded-xl object-cover mb-2" />
                  <span className="badge badge-secondary text-xs">{post.category}</span>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                    {post.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Clock size={10} /> {post.readTime}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
