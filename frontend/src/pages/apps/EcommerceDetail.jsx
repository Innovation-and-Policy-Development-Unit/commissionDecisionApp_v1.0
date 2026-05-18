import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Star, Heart, ShoppingCart, Truck, ShieldCheck, RefreshCw, Minus, Plus, ChevronRight } from 'lucide-react'
import { img } from '../../utils/imgPath'

const images = [
  { src: img('/images/unsplash/wireless-headphones.jpg') },
  { src: img('/images/unsplash/headphones-black.jpg') },
  { src: img('/images/unsplash/headphones-gold.jpg') },
  { src: img('/images/unsplash/headphones-white.jpg') },
]

const specs = [
  ['Brand', 'AudioPro'], ['Model', 'WH-1000XM5'], ['Connectivity', 'Bluetooth 5.2'],
  ['Battery Life', '30 hours'], ['Noise Cancellation', 'Active (ANC)'], ['Driver Size', '40mm'],
  ['Frequency Response', '20Hz - 20kHz'], ['Weight', '250g'],
]

const reviews = [
  { author: 'Sarah M.', rating: 5, date: 'Mar 05, 2026', comment: 'Absolutely amazing sound quality. The noise cancellation is the best I\'ve ever experienced.', avatar: img('/images/avatars/avatar-woman-carol.jpg') },
  { author: 'James K.', rating: 4, date: 'Feb 28, 2026', comment: 'Great headphones overall. Battery life is excellent. Only wish the ear cups were a bit softer.', avatar: img('/images/avatars/avatar-man-mike.jpg') },
  { author: 'Linda T.', rating: 5, date: 'Feb 20, 2026', comment: 'Best purchase I\'ve made this year. Crystal clear calls and music sounds incredible.', avatar: img('/images/avatars/avatar-woman-jessica.jpg') },
]

export default function EcommerceDetail() {
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedColor, setSelectedColor] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [liked, setLiked] = useState(false)
  const [inCart, setInCart] = useState(false)

  const colors = ['bg-slate-900', 'bg-white border', 'bg-primary-500', 'bg-rose-500']
  const colorNames = ['Midnight Black', 'Pearl White', 'Ocean Blue', 'Rose Gold']

  return (
    <div className="space-y-6">
      <PageHeader title="Product Detail" subtitle="View product information" />

      {/* Product Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Images */}
        <div className="space-y-3">
          <div className="h-80 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-700/30 cursor-zoom-in">
            <img src={images[selectedImage].src} alt="Product" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-3">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={`w-16 h-16 rounded-xl overflow-hidden transition-all ${selectedImage === i ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-slate-900' : 'opacity-60 hover:opacity-100'}`}
              >
                <img src={img.src} alt={`View ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div>
            <span className="badge badge-primary mb-2">Electronics</span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Premium Wireless Headphones WH-1000XM5</h1>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className={i < 4 ? 'text-amber-400 fill-amber-400' : i < 5 ? 'text-amber-200 fill-amber-200' : 'text-slate-300'} />
                ))}
              </div>
              <span className="text-sm text-slate-500">4.8 (328 reviews)</span>
              <span className="text-xs text-emerald-600 font-semibold">✓ In Stock</span>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">$249.99</span>
            <span className="text-lg text-slate-400 line-through">$349.99</span>
            <span className="badge bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400">-29%</span>
          </div>

          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Experience industry-leading noise cancellation with the premium wireless headphones. Featuring 30-hour battery life, adaptive sound control, and crystal clear audio quality for an immersive listening experience.
          </p>

          {/* Color */}
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Color: <span className="font-normal text-slate-500">{colorNames[selectedColor]}</span></p>
            <div className="flex gap-2">
              {colors.map((color, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedColor(i)}
                  className={`w-8 h-8 rounded-full ${color} ${selectedColor === i ? 'ring-2 ring-primary-500 ring-offset-2' : ''} transition-all`}
                />
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Quantity</p>
            <div className="flex items-center gap-0">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-s-xl border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <Minus size={14} />
              </button>
              <div className="w-14 h-10 border-y border-slate-200 dark:border-slate-600 flex items-center justify-center text-sm font-semibold text-slate-800 dark:text-slate-200">
                {quantity}
              </div>
              <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 rounded-e-xl border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setInCart(c => !c)}
              className={`btn flex-1 ${inCart ? 'btn-success' : 'btn-primary'}`}
            >
              <ShoppingCart size={16} />
              {inCart ? 'Added to Cart' : 'Add to Cart'}
            </button>
            <button
              onClick={() => setLiked(l => !l)}
              className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${liked ? 'border-rose-300 bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:text-rose-500'}`}
            >
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { icon: Truck, label: 'Free Shipping', sub: 'Orders over $100' },
              { icon: ShieldCheck, label: '2 Year Warranty', sub: 'Manufacturer' },
              { icon: RefreshCw, label: 'Easy Returns', sub: '30 day policy' },
            ].map((f, i) => (
              <div key={i} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <f.icon size={18} className="text-primary-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{f.label}</p>
                <p className="text-[10px] text-slate-400">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Specs */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Product Specifications</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
          {specs.map(([key, val], i) => (
            <div key={i} className={`flex items-center gap-4 py-3 px-2 ${i % 2 === 0 ? 'sm:border-e border-slate-100 dark:border-slate-700' : ''} ${i < specs.length - 2 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
              <span className="text-sm text-slate-500 w-36 shrink-0">{key}</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Customer Reviews</h3>
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={16} className={i < 5 ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
            ))}
            <span className="font-bold text-slate-800 dark:text-slate-200">4.8</span>
            <span className="text-sm text-slate-500">(328 reviews)</span>
          </div>
        </div>
        <div className="space-y-5">
          {reviews.map((review, i) => (
            <div key={i} className="flex gap-4 pb-5 border-b border-slate-100 dark:border-slate-700 last:border-0 last:pb-0">
              <img src={review.avatar} alt={review.author} className="w-10 h-10 rounded-full object-cover shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{review.author}</span>
                  <span className="text-xs text-slate-400">{review.date}</span>
                </div>
                <div className="flex items-center gap-0.5 mb-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={12} className={j < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                  ))}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{review.comment}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-outline w-full mt-4">Load More Reviews</button>
      </div>
    </div>
  )
}
