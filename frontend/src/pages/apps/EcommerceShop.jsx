import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Search, SlidersHorizontal, Grid3X3, List, ShoppingCart, Heart, Star, Filter, Tag, Palette, Sparkles, RotateCcw, Check } from 'lucide-react'
import { img } from '../../utils/imgPath'

const products = [
  { id: 1, name: 'Premium Wireless Headphones', category: 'Electronics', price: 249.99, rating: 4.8, reviews: 328, image: img('/images/unsplash/wireless-headphones.jpg'), badge: 'Best Seller' },
  { id: 2, name: 'Ergonomic Office Chair', category: 'Furniture', price: 599.00, rating: 4.6, reviews: 156, image: img('/images/unsplash/office-chair.jpg'), badge: 'New' },
  { id: 3, name: 'Mechanical Keyboard Pro', category: 'Electronics', price: 149.99, rating: 4.9, reviews: 512, image: img('/images/unsplash/mechanical-keyboard.jpg'), badge: 'Top Rated' },
  { id: 4, name: 'Minimalist Watch Series 5', category: 'Accessories', price: 319.00, rating: 4.7, reviews: 89, image: img('/images/unsplash/minimalist-watch.jpg'), badge: null },
  { id: 5, name: '4K Curved Monitor 32"', category: 'Electronics', price: 799.99, rating: 4.5, reviews: 234, image: img('/images/unsplash/curved-monitor.jpg'), badge: 'Sale' },
  { id: 6, name: 'Leather Laptop Bag', category: 'Accessories', price: 89.00, rating: 4.4, reviews: 67, image: img('/images/unsplash/leather-laptop-bag.jpg'), badge: null },
  { id: 7, name: 'Smart Home Speaker', category: 'Electronics', price: 129.99, rating: 4.3, reviews: 445, image: img('/images/unsplash/smart-speaker.jpg'), badge: 'Sale' },
  { id: 8, name: 'Standing Desk Electric', category: 'Furniture', price: 899.00, rating: 4.7, reviews: 198, image: img('/images/unsplash/standing-desk.jpg'), badge: 'New' },
  { id: 9, name: 'Webcam 4K Ultra HD', category: 'Electronics', price: 199.99, rating: 4.6, reviews: 312, image: img('/images/unsplash/webcam-device.jpg'), badge: null },
  { id: 10, name: 'Noise Cancelling Earbuds', category: 'Electronics', price: 179.00, rating: 4.8, reviews: 567, image: img('/images/unsplash/wireless-earbuds.jpg'), badge: 'Best Seller' },
  { id: 11, name: 'USB-C Hub 12-in-1', category: 'Electronics', price: 79.99, rating: 4.5, reviews: 243, image: img('/images/unsplash/usb-hub.jpg'), badge: null },
  { id: 12, name: 'Desk Lamp LED Pro', category: 'Furniture', price: 59.99, rating: 4.2, reviews: 88, image: img('/images/unsplash/desk-lamp.jpg'), badge: null },
]

const categories = ['All', 'Electronics', 'Furniture', 'Accessories']

export default function EcommerceShop() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sortBy, setSortBy] = useState('featured')
  const [viewMode, setViewMode] = useState('grid')
  const [wishlist, setWishlist] = useState(new Set())
  const [cart, setCart] = useState(new Set())
  const [priceRange, setPriceRange] = useState([0, 1000])

  const filtered = products.filter(p =>
    (category === 'All' || p.category === category) &&
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    p.price >= priceRange[0] && p.price <= priceRange[1]
  ).sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price
    if (sortBy === 'price-desc') return b.price - a.price
    if (sortBy === 'rating') return b.rating - a.rating
    return 0
  })

  const toggleWishlist = (id) => setWishlist(w => { const n = new Set(w); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleCart = (id) => setCart(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shop"
        subtitle="Discover our premium products"
        action={
          <div className="flex items-center gap-2">
            <button className="btn btn-outline btn-sm relative">
              <ShoppingCart size={16} />
              {cart.size > 0 && <span className="absolute -top-1.5 -end-1.5 w-4 h-4 rounded-full bg-primary-500 text-white text-[9px] flex items-center justify-center font-bold">{cart.size}</span>}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="space-y-4">
          {/* Filter Header */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm">
                  <Filter size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Filters</h3>
                  <p className="text-[10px] text-slate-400">{filtered.length} results</p>
                </div>
              </div>
              <button onClick={() => { setCategory('All'); setPriceRange([0, 1000]); setSearch('') }} className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:text-primary-700 transition-colors">
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          </div>

          {/* Category */}
          <div className="card p-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Grid3X3 size={12} className="text-primary-500" /> Category
            </h4>
            <div className="space-y-1">
              {categories.map(cat => {
                const count = cat === 'All' ? products.length : products.filter(p => p.category === cat).length
                const active = category === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 shadow-sm border border-primary-100 dark:border-primary-800/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                  >
                    {active && <Check size={13} className="text-primary-500 shrink-0" />}
                    <span className="flex-1 text-start">{cat}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${active ? 'bg-primary-100 dark:bg-primary-800/40 text-primary-600 dark:text-primary-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price Range */}
          <div className="card p-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Tag size={12} className="text-emerald-500" /> Price Range
            </h4>
            <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 mb-3 border border-emerald-100/60 dark:border-emerald-800/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">$0</span>
                <span className="text-[10px] text-slate-400">to</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">${priceRange[1]}</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              value={priceRange[1]}
              onChange={e => setPriceRange([0, +e.target.value])}
              className="w-full accent-emerald-600 mb-3"
            />
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Under $100', val: 100 },
                { label: 'Under $300', val: 300 },
                { label: 'Under $500', val: 500 },
                { label: 'All Prices', val: 1000 },
              ].map(p => (
                <button
                  key={p.val}
                  onClick={() => setPriceRange([0, p.val])}
                  className={`text-[11px] font-medium py-2 rounded-lg border transition-all ${priceRange[1] === p.val ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div className="card p-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Star size={12} className="text-amber-500 fill-amber-500" /> Rating
            </h4>
            <div className="space-y-1.5">
              {[
                { min: 4.5, label: 'Exceptional' },
                { min: 4.0, label: 'Excellent' },
                { min: 3.5, label: 'Very Good' },
                { min: 3.0, label: 'Good' },
              ].map(r => (
                <label key={r.min} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                  <input type="checkbox" className="w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-slate-600" />
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={13} className={i < Math.floor(r.min) ? 'text-amber-400 fill-amber-400' : i < r.min ? 'text-amber-400 fill-amber-400 opacity-50' : 'text-slate-200 dark:text-slate-600'} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="card p-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Palette size={12} className="text-violet-500" /> Colors
            </h4>
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'Black', color: 'bg-slate-900' },
                { name: 'White', color: 'bg-white border border-slate-200 dark:border-slate-600' },
                { name: 'Red', color: 'bg-red-500' },
                { name: 'Blue', color: 'bg-blue-500' },
                { name: 'Green', color: 'bg-emerald-500' },
                { name: 'Purple', color: 'bg-violet-500' },
                { name: 'Orange', color: 'bg-orange-500' },
                { name: 'Pink', color: 'bg-pink-500' },
              ].map(c => (
                <button key={c.name} title={c.name} className={`w-8 h-8 rounded-full ${c.color} hover:ring-2 hover:ring-offset-2 hover:ring-primary-400 dark:hover:ring-offset-slate-800 transition-all`} />
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="card p-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles size={12} className="text-rose-500" /> Availability
            </h4>
            <div className="space-y-1.5">
              {[
                { label: 'In Stock', count: 9, dot: 'bg-emerald-500' },
                { label: 'Pre-Order', count: 2, dot: 'bg-amber-500' },
                { label: 'Out of Stock', count: 1, dot: 'bg-red-400' },
              ].map(a => (
                <label key={a.label} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <input type="checkbox" className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-600" />
                  <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                  <span className="text-sm text-slate-600 dark:text-slate-400 flex-1">{a.label}</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">{a.count}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Deals Banner */}
          <div className="rounded-2xl bg-primary-500 p-5 text-center relative overflow-hidden">
            <svg className="absolute top-0 left-0 w-full h-full opacity-10" viewBox="0 0 200 200"><circle cx="30" cy="30" r="50" fill="currentColor"/><circle cx="170" cy="170" r="60" fill="currentColor"/></svg>
            <div className="relative">
              <span className="text-3xl">🔥</span>
              <h4 className="text-white font-bold mt-2">Flash Sale!</h4>
              <p className="text-white/70 text-xs mt-1">Up to 40% off on electronics</p>
              <button className="mt-3 w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-white text-xs font-bold transition-colors">Shop Now</button>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="lg:col-span-3">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
            <div className="relative flex-1 w-full">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search products..." className="input ps-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select className="input text-sm py-2 w-40" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
              </select>
              <button onClick={() => setViewMode('grid')} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'btn btn-outline'}`}>
                <Grid3X3 size={16} />
              </button>
              <button onClick={() => setViewMode('list')} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'btn btn-outline'}`}>
                <List size={16} />
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-500 mb-4">{filtered.length} products found</p>

          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5' : 'space-y-4'}>
            {filtered.map(product => (
              viewMode === 'grid' ? (
                <div key={product.id} className="card overflow-hidden group cursor-pointer hover:shadow-card-md transition-all duration-200 hover:-translate-y-0.5">
                  <div className="h-44 relative overflow-hidden bg-slate-50 dark:bg-slate-700/30">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {product.badge && (
                      <span className={`absolute top-3 start-3 badge text-white ${product.badge === 'Sale' ? 'bg-red-500' : product.badge === 'New' ? 'bg-emerald-500' : product.badge === 'Top Rated' ? 'bg-amber-500' : 'bg-primary-600'}`}>
                        {product.badge}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id) }}
                      className={`absolute top-3 end-3 w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-white ${wishlist.has(product.id) ? 'text-rose-500' : 'text-slate-400'}`}
                    >
                      <Heart size={14} fill={wishlist.has(product.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-slate-400 mb-1">{product.category}</p>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-2 line-clamp-1">{product.name}</h3>
                    <div className="flex items-center gap-1.5 mb-3">
                      <div className="flex items-center">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < Math.floor(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">{product.rating} ({product.reviews})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg text-slate-800 dark:text-slate-200">${product.price}</span>
                      <button
                        onClick={() => toggleCart(product.id)}
                        className={`btn btn-sm ${cart.has(product.id) ? 'btn-success' : 'btn-primary'}`}
                      >
                        <ShoppingCart size={13} />
                        {cart.has(product.id) ? 'Added' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={product.id} className="card p-4 flex items-center gap-4">
                  <img src={product.image} alt={product.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400">{product.category}</p>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{product.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={11} className={i < Math.floor(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                      ))}
                      <span className="text-xs text-slate-500 ms-1">{product.rating}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-slate-800 dark:text-slate-200">${product.price}</span>
                    <button onClick={() => toggleCart(product.id)} className={`btn btn-sm ${cart.has(product.id) ? 'btn-success' : 'btn-primary'}`}>
                      {cart.has(product.id) ? 'Added' : 'Add'}
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
