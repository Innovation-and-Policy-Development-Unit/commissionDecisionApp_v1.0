import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Star, Heart, ThumbsUp, Zap } from 'lucide-react'

function StarRating({ value = 0, onChange, max = 5, size = 20, readonly = false, half = false, icon: Icon = Star }) {
  const [hover, setHover] = useState(0)
  const display = hover || value

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = display >= i + 1
        const halfFilled = half && display >= i + 0.5 && display < i + 1
        return (
          <button
            key={i}
            disabled={readonly}
            onClick={() => onChange && onChange(i + 1)}
            onMouseEnter={() => !readonly && setHover(i + 1)}
            onMouseLeave={() => !readonly && setHover(0)}
            className={`transition-all ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          >
            <Icon
              size={size}
              className={`transition-colors ${filled ? 'text-amber-400 fill-amber-400' : halfFilled ? 'text-amber-300 fill-amber-200' : 'text-slate-300 dark:text-slate-600'}`}
            />
          </button>
        )
      })}
    </div>
  )
}

const products = [
  { name: 'Wireless Headphones', rating: 4.8, count: 328, color: 'bg-primary-500' },
  { name: 'Office Chair', rating: 4.3, count: 156, color: 'bg-cyan-500' },
  { name: 'Mechanical Keyboard', rating: 4.9, count: 512, color: 'bg-emerald-500' },
]

export default function RatingPage() {
  const [ratings, setRatings] = useState({ interactive: 3, heart: 2, zap: 4, size1: 3, size2: 3, size3: 3 })
  const [submitted, setSubmitted] = useState(null)
  const [emojiRating, setEmojiRating] = useState(null)
  const [colorRatings, setColorRatings] = useState({ quality: 4, speed: 3, value: 5, support: 2, design: 4 })

  return (
    <div className="space-y-6">
      <PageHeader title="Rating" subtitle="Star ratings and review components" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Interactive Rating</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-2">Click to rate (current: {ratings.interactive}/5)</p>
              <StarRating value={ratings.interactive} onChange={v => setRatings(r => ({ ...r, interactive: v }))} size={28} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Heart icons (current: {ratings.heart}/5)</p>
              <StarRating value={ratings.heart} onChange={v => setRatings(r => ({ ...r, heart: v }))} size={24} icon={Heart} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Zap icons (current: {ratings.zap}/5)</p>
              <StarRating value={ratings.zap} onChange={v => setRatings(r => ({ ...r, zap: v }))} size={24} icon={Zap} />
            </div>
          </div>
        </div>

        {/* Read-only */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Read-only Ratings</h3>
          <div className="space-y-4">
            {[5, 4, 3, 2, 1].map(v => (
              <div key={v} className="flex items-center gap-3">
                <StarRating value={v} max={5} readonly />
                <span className="text-sm text-slate-500">{v}.0 / 5.0</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sizes */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Different Sizes</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-2">Small (size=12)</p>
              <StarRating value={4} readonly size={12} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Medium (size=20)</p>
              <StarRating value={4} readonly size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Large (size=32)</p>
              <StarRating value={4} readonly size={32} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Extra Large (size=40)</p>
              <StarRating value={4} readonly size={40} />
            </div>
          </div>
        </div>

        {/* With Count */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Rating with Review Count</h3>
          <div className="space-y-4">
            {products.map((product, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${product.color} shrink-0`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{product.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRating value={Math.round(product.rating)} readonly size={13} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{product.rating}</span>
                    <span className="text-xs text-slate-400">({product.count} reviews)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rating Breakdown */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Rating Breakdown</h3>
          <div className="flex items-start gap-6">
            <div className="text-center">
              <p className="text-5xl font-bold text-slate-900 dark:text-slate-100">4.8</p>
              <StarRating value={5} readonly size={16} />
              <p className="text-xs text-slate-400 mt-1">328 reviews</p>
            </div>
            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map(star => {
                const pct = [78, 14, 5, 2, 1][5 - star]
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-3">{star}</span>
                    <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-6">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Submit Rating */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Submit Your Rating</h3>
          {submitted ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">Thank you for your rating!</p>
              <p className="text-sm text-slate-500 mt-1">You rated {submitted} out of 5 stars.</p>
              <button onClick={() => setSubmitted(null)} className="btn btn-outline btn-sm mt-3">Rate Again</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">How would you rate your experience?</p>
              <div className="flex justify-center">
                <StarRating value={ratings.interactive} onChange={v => setRatings(r => ({ ...r, interactive: v }))} size={36} />
              </div>
              <p className="text-center text-sm text-slate-500">
                {['', 'Very Poor', 'Poor', 'Average', 'Good', 'Excellent'][ratings.interactive]}
              </p>
              <button onClick={() => setSubmitted(ratings.interactive)} className="btn btn-primary w-full" disabled={!ratings.interactive}>
                Submit Rating
              </button>
            </div>
          )}
        </div>

        {/* Emoji Ratings */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Emoji Ratings</h3>
          <p className="text-sm text-slate-500 mb-4">Express your feedback with emoji-based ratings</p>
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-3">
              {[
                { emoji: '😡', label: 'Terrible', value: 1, color: 'bg-red-100 dark:bg-red-900/30 ring-red-500' },
                { emoji: '😕', label: 'Poor', value: 2, color: 'bg-orange-100 dark:bg-orange-900/30 ring-orange-500' },
                { emoji: '😐', label: 'Okay', value: 3, color: 'bg-amber-100 dark:bg-amber-900/30 ring-amber-500' },
                { emoji: '😊', label: 'Good', value: 4, color: 'bg-lime-100 dark:bg-lime-900/30 ring-lime-500' },
                { emoji: '🤩', label: 'Amazing', value: 5, color: 'bg-emerald-100 dark:bg-emerald-900/30 ring-emerald-500' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setEmojiRating(item.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${emojiRating === item.value ? `${item.color} ring-2 scale-110` : 'hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:scale-105'}`}
                >
                  <span className="text-3xl">{item.emoji}</span>
                  <span className={`text-xs font-medium ${emojiRating === item.value ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}>{item.label}</span>
                </button>
              ))}
            </div>
            {emojiRating && (
              <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  You selected: <span className="font-semibold text-slate-800 dark:text-slate-200">{['', 'Terrible', 'Poor', 'Okay', 'Good', 'Amazing'][emojiRating]}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Color-coded Ratings */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Color-coded Ratings</h3>
          <p className="text-sm text-slate-500 mb-4">Visual rating scale from red (low) to green (high)</p>
          <div className="space-y-4">
            {[
              { label: 'Quality', key: 'quality' },
              { label: 'Speed', key: 'speed' },
              { label: 'Value', key: 'value' },
              { label: 'Support', key: 'support' },
              { label: 'Design', key: 'design' },
            ].map((item) => {
              const val = colorRatings[item.key]
              const barColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500']
              const textColors = ['text-red-600 dark:text-red-400', 'text-orange-600 dark:text-orange-400', 'text-amber-600 dark:text-amber-400', 'text-lime-600 dark:text-lime-400', 'text-emerald-600 dark:text-emerald-400']
              const labels = ['Poor', 'Fair', 'Good', 'Great', 'Excellent']
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                    <span className={`text-xs font-semibold ${textColors[val - 1]}`}>{labels[val - 1]}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setColorRatings(r => ({ ...r, [item.key]: level }))}
                        className={`flex-1 h-3 rounded-full transition-all ${level <= val ? barColors[val - 1] : 'bg-slate-200 dark:bg-slate-700'} ${level <= val ? 'scale-y-110' : ''} hover:opacity-80`}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Overall Average</span>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const avg = Math.round(Object.values(colorRatings).reduce((a, b) => a + b, 0) / Object.values(colorRatings).length)
                    const barColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500']
                    return <div key={level} className={`w-5 h-2 rounded-full ${level <= avg ? barColors[avg - 1] : 'bg-slate-200 dark:bg-slate-700'}`} />
                  })}
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {(Object.values(colorRatings).reduce((a, b) => a + b, 0) / Object.values(colorRatings).length).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
