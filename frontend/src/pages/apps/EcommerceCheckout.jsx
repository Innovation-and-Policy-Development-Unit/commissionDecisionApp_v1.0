import { useState, Fragment } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { CreditCard, Wallet, ShoppingCart, Shield, Truck, CheckCircle } from 'lucide-react'
import { img } from '../../utils/imgPath'

const cartItems = [
  { name: 'Premium Wireless Headphones', qty: 1, price: 249.99, image: img('/images/unsplash/wireless-headphones.jpg') },
  { name: 'Mechanical Keyboard Pro', qty: 2, price: 149.99, image: img('/images/unsplash/mechanical-keyboard.jpg') },
  { name: 'Webcam 4K Ultra HD', qty: 1, price: 199.99, image: img('/images/unsplash/webcam-device.jpg') },
]

export default function EcommerceCheckout() {
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [sameAddress, setSameAddress] = useState(true)
  const [placed, setPlaced] = useState(false)

  const subtotal = cartItems.reduce((a, b) => a + b.price * b.qty, 0)
  const shipping = 12.00
  const tax = subtotal * 0.08
  const total = subtotal + shipping + tax

  if (placed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-6">
          <CheckCircle size={48} className="text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Order Placed Successfully!</h2>
        <p className="text-slate-500 mb-6">Your order #ORD-20260311 has been placed and is being processed.</p>
        <div className="flex gap-3">
          <button className="btn btn-outline">Track Order</button>
          <button className="btn btn-primary" onClick={() => setPlaced(false)}>Continue Shopping</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Checkout" subtitle="Complete your purchase" />

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-0 mb-2">
        {['Cart', 'Shipping', 'Payment', 'Confirm'].map((step, i) => (
          <Fragment key={i}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= 2 ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                {i < 2 ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className="text-xs text-slate-500 mt-1 hidden sm:block">{step}</span>
            </div>
            {i < 3 && <div className={`w-16 sm:w-24 h-0.5 mb-4 ${i < 2 ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
          </Fragment>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Forms */}
        <div className="lg:col-span-2 space-y-5">
          {/* Billing */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Billing Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">First Name *</label>
                <input type="text" className="input" placeholder="John" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Last Name *</label>
                <input type="text" className="input" placeholder="Doe" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Email *</label>
                <input type="email" className="input" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Phone</label>
                <input type="tel" className="input" placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Company</label>
                <input type="text" className="input" placeholder="Optional" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Address *</label>
                <input type="text" className="input" placeholder="123 Main Street" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">City *</label>
                <input type="text" className="input" placeholder="San Francisco" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">ZIP Code *</label>
                <input type="text" className="input" placeholder="94105" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Country *</label>
                <select className="input">
                  <option>United States</option>
                  <option>Canada</option>
                  <option>United Kingdom</option>
                  <option>Australia</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">State *</label>
                <select className="input">
                  <option>California</option>
                  <option>New York</option>
                  <option>Texas</option>
                </select>
              </div>
            </div>
          </div>

          {/* Shipping */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Shipping Address</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sameAddress} onChange={e => setSameAddress(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Same as billing</span>
              </label>
            </div>
            {!sameAddress && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Address *</label>
                  <input type="text" className="input" placeholder="456 Shipping Street" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">City *</label>
                  <input type="text" className="input" placeholder="City" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">ZIP Code *</label>
                  <input type="text" className="input" placeholder="ZIP" />
                </div>
              </div>
            )}
            {sameAddress && (
              <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                Using billing address for shipping.
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Standard', time: '5-7 business days', price: '$12.00', icon: Truck },
                { label: 'Express', time: '2-3 business days', price: '$24.00', icon: Truck },
                { label: 'Overnight', time: 'Next business day', price: '$45.00', icon: Truck },
              ].map((opt, i) => (
                <label key={i} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-primary-400 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/10 transition-all">
                  <input type="radio" name="shipping" defaultChecked={i === 0} className="mt-1 text-primary-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{opt.label}</p>
                    <p className="text-xs text-slate-400">{opt.time}</p>
                    <p className="text-xs font-bold text-primary-600 dark:text-primary-400 mt-1">{opt.price}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Payment Method</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { id: 'card', label: 'Credit Card', icon: CreditCard },
                { id: 'paypal', label: 'PayPal', icon: Wallet },
              ].map(method => (
                <label key={method.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === method.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                  <input type="radio" name="payment" value={method.id} checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} className="hidden" />
                  <method.icon size={20} className={paymentMethod === method.id ? 'text-primary-600' : 'text-slate-400'} />
                  <span className={`font-medium text-sm ${paymentMethod === method.id ? 'text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400'}`}>{method.label}</span>
                </label>
              ))}
            </div>

            {paymentMethod === 'card' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Card Number *</label>
                  <input type="text" className="input font-mono" placeholder="1234 5678 9012 3456" maxLength={19} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Expiry Date *</label>
                    <input type="text" className="input font-mono" placeholder="MM / YY" maxLength={7} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">CVV *</label>
                    <input type="text" className="input font-mono" placeholder="•••" maxLength={4} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Name on Card *</label>
                  <input type="text" className="input" placeholder="John Doe" />
                </div>
              </div>
            )}
            {paymentMethod === 'paypal' && (
              <div className="text-center py-8 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                <Wallet size={40} className="text-blue-500 mx-auto mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-400">You will be redirected to PayPal to complete your payment.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Order Summary</h3>
            <div className="space-y-4 mb-5">
              {cartItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-slate-400">Qty: {item.qty}</p>
                  </div>
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">${(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 py-4 border-t border-b border-slate-200 dark:border-slate-700">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Shipping</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">${shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tax (8%)</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">${tax.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <span className="font-bold text-slate-800 dark:text-slate-200">Total</span>
              <span className="font-bold text-xl text-primary-600 dark:text-primary-400">${total.toFixed(2)}</span>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Coupon Code</label>
              <div className="flex gap-2">
                <input type="text" className="input text-sm flex-1" placeholder="Enter code" />
                <button className="btn btn-outline btn-sm shrink-0">Apply</button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300">
            <Shield size={16} />
            <p className="text-xs font-medium">Secure SSL encrypted payment</p>
          </div>

          <button onClick={() => setPlaced(true)} className="btn btn-primary w-full btn-lg">
            <ShoppingCart size={18} /> Place Order · ${total.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  )
}
