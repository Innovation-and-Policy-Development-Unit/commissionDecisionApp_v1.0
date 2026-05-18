import { img } from '../../../utils/imgPath'
import Section from './Section'

const posts = [
  {
    img: img('/images/unsplash/dashboard-charts.jpg'),
    category: 'Engineering',
    categoryColor: 'badge-primary',
    title: 'Building Scalable React Architectures in 2026',
    excerpt: 'A deep dive into modern patterns for large-scale React apps — from code splitting to server components and beyond.',
    authorImg: img('/images/avatars/avatar-man-profile.jpg'),
    authorName: 'John Doe',
    date: 'Mar 8, 2026',
    readTime: '6 min read',
  },
  {
    img: img('/images/unsplash/app-wireframes.jpg'),
    category: 'Design',
    categoryColor: 'badge-info',
    title: 'The Art of Micro-Interactions: Delighting Users with Motion',
    excerpt: 'How subtle animations and transitions create memorable interfaces that keep users engaged and reduce cognitive load.',
    authorImg: img('/images/avatars/avatar-woman-sarah-chen.jpg'),
    authorName: 'Sarah Chen',
    date: 'Mar 5, 2026',
    readTime: '4 min read',
  },
  {
    img: img('/images/unsplash/analytics-dashboard.jpg'),
    category: 'Product',
    categoryColor: 'badge-success',
    title: 'Shipping Faster Without Sacrificing Quality',
    excerpt: 'Battle-tested strategies from hyper-growth startups on maintaining engineering excellence under relentless delivery pressure.',
    authorImg: img('/images/avatars/avatar-man-david.jpg'),
    authorName: 'Marcus R.',
    date: 'Mar 1, 2026',
    readTime: '5 min read',
  },
]

export default function MediaCards() {
  return (
    <Section title="Image & Media Cards" subtitle="Blog post preview and media content cards">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {posts.map((post, i) => (
          <div key={i} className="card overflow-hidden group hover:shadow-card-lg transition-all duration-300 hover:-translate-y-1 flex flex-col">
            <div className="h-44 relative overflow-hidden">
              <img src={post.img} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <span className={`badge ${post.categoryColor} absolute top-3 left-3 bg-white/20 text-white border border-white/30 backdrop-blur-sm`}>
                {post.category}
              </span>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {post.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 flex-1">
                {post.excerpt}
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <img src={post.authorImg} alt={post.authorName} className="w-7 h-7 rounded-full object-cover" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{post.authorName}</p>
                    <p className="text-[10px] text-slate-400">{post.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{post.readTime}</span>
                  <button className="btn btn-primary btn-sm text-[11px] px-3 py-1">Read More</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
