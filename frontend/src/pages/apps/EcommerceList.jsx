import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Search, Plus, Edit, Trash2, Eye, Package, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react'
import { img } from '../../utils/imgPath'

const products = [
  { id: 1, name: 'Premium Wireless Headphones', category: 'Electronics', stock: 245, price: 249.99, status: 'In Stock', sales: 1240, image: img('/images/unsplash/wireless-headphones.jpg') },
  { id: 2, name: 'Ergonomic Office Chair', category: 'Furniture', stock: 32, price: 599.00, status: 'Low Stock', sales: 389, image: img('/images/unsplash/office-chair.jpg') },
  { id: 3, name: 'Mechanical Keyboard Pro', category: 'Electronics', stock: 0, price: 149.99, status: 'Out of Stock', sales: 892, image: img('/images/unsplash/mechanical-keyboard.jpg') },
  { id: 4, name: 'Minimalist Watch Series 5', category: 'Accessories', stock: 78, price: 319.00, status: 'In Stock', sales: 456, image: img('/images/unsplash/minimalist-watch.jpg') },
  { id: 5, name: '4K Curved Monitor 32"', category: 'Electronics', stock: 15, price: 799.99, status: 'Low Stock', sales: 234, image: img('/images/unsplash/curved-monitor.jpg') },
  { id: 6, name: 'Leather Laptop Bag', category: 'Accessories', stock: 120, price: 89.00, status: 'In Stock', sales: 678, image: img('/images/unsplash/leather-laptop-bag.jpg') },
  { id: 7, name: 'Smart Home Speaker', category: 'Electronics', stock: 0, price: 129.99, status: 'Out of Stock', sales: 1120, image: img('/images/unsplash/smart-speaker.jpg') },
  { id: 8, name: 'Standing Desk Electric', category: 'Furniture', stock: 8, price: 899.00, status: 'Low Stock', sales: 167, image: img('/images/unsplash/standing-desk.jpg') },
  { id: 9, name: 'Webcam 4K Ultra HD', category: 'Electronics', stock: 190, price: 199.99, status: 'In Stock', sales: 543, image: img('/images/unsplash/webcam-device.jpg') },
  { id: 10, name: 'Noise Cancelling Earbuds', category: 'Electronics', stock: 312, price: 179.00, status: 'In Stock', sales: 1876, image: img('/images/unsplash/wireless-earbuds.jpg') },
  { id: 11, name: 'USB-C Hub 12-in-1', category: 'Electronics', stock: 67, price: 79.99, status: 'In Stock', sales: 890, image: img('/images/unsplash/usb-hub.jpg') },
  { id: 12, name: 'Desk Lamp LED Pro', category: 'Furniture', stock: 4, price: 59.99, status: 'Low Stock', sales: 234, image: img('/images/unsplash/desk-lamp.jpg') },
]

const statusStyle = {
  'In Stock': 'badge-success',
  'Low Stock': 'badge-warning',
  'Out of Stock': 'badge-danger',
}

export default function EcommerceList() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const filtered = products.filter(p =>
    (filter === 'All' || p.status === filter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalProducts = products.length
  const totalRevenue = products.reduce((a, b) => a + b.price * b.sales, 0)
  const totalSales = products.reduce((a, b) => a + b.sales, 0)
  const lowStock = products.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle="Manage your product inventory"
        action={<button className="btn btn-primary"><Plus size={16} /> Add Product</button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: totalProducts, icon: Package, color: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' },
          { label: 'Total Revenue', value: `$${(totalRevenue / 1000).toFixed(0)}k`, icon: DollarSign, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
          { label: 'Total Sales', value: totalSales.toLocaleString(), icon: ShoppingCart, color: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400' },
          { label: 'Low/Out of Stock', value: lowStock, icon: TrendingUp, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
        ].map((stat, i) => (
          <div key={i} className="card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search products..." className="input ps-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['All', 'In Stock', 'Low Stock', 'Out of Stock'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}>{f}</button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Product</th><th>Category</th><th>Stock</th><th>Price</th><th>Sales</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(product => (
                <tr key={product.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{product.name}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-secondary">{product.category}</span></td>
                  <td className="font-medium">{product.stock}</td>
                  <td className="font-semibold">${product.price.toFixed(2)}</td>
                  <td className="text-slate-500">{product.sales.toLocaleString()}</td>
                  <td><span className={`badge ${statusStyle[product.status]}`}>{product.status}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="w-7 h-7 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center justify-center text-slate-400 hover:text-primary-600 transition-colors"><Eye size={14} /></button>
                      <button className="w-7 h-7 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-900/20 flex items-center justify-center text-slate-400 hover:text-cyan-600 transition-colors"><Edit size={14} /></button>
                      <button className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
