import { useState } from 'react'
import { Check, X, Plus, Sun, Wind, Droplets } from 'lucide-react'
import Section from './Section'
import { initialTodos, forecast, quickLinks } from './data'

let todoIdSeq = initialTodos.length

function TodoWidget() {
  const [todos, setTodos] = useState(() =>
    initialTodos.map((t, idx) => ({ ...t, id: idx + 1 }))
  )
  const [newTodo, setNewTodo] = useState('')

  const toggleTodo = (id) => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  const removeTodo = (id) => setTodos(prev => prev.filter(t => t.id !== id))
  const addTodo = () => {
    const text = newTodo.trim()
    if (!text) return
    setTodos(prev => [...prev, { id: ++todoIdSeq, text, done: false }])
    setNewTodo('')
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-900 dark:text-slate-100">My Tasks</h3>
        <div className="flex items-center gap-2">
          <span className="badge badge-primary">{todos.filter(t => !t.done).length} left</span>
        </div>
      </div>
      <div className="space-y-1 mb-4">
        {todos.map(todo => (
          <div key={todo.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 group transition-colors">
            <button onClick={() => toggleTodo(todo.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${todo.done ? 'bg-primary-500 border-primary-500' : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'}`}>
              {todo.done && <Check size={11} className="text-white" />}
            </button>
            <span className={`flex-1 text-sm transition-colors ${todo.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>{todo.text}</span>
            <button onClick={() => removeTodo(todo.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"><X size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
        <input type="text" value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder="Add a new task…" className="input flex-1" />
        <button onClick={addTodo} className="btn btn-primary px-3"><Plus size={16} /></button>
      </div>
    </div>
  )
}

function WeatherWidget() {
  return (
    <div className="card overflow-hidden">
      <div className="bg-sky-500 p-5 text-white">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold">San Francisco</p>
            <p className="text-xs opacity-70">California, USA</p>
          </div>
          <Sun size={36} className="opacity-90 text-yellow-200" />
        </div>
        <div className="flex items-end gap-3">
          <p className="text-5xl font-bold tracking-tight">72°F</p>
          <div className="pb-1">
            <p className="text-sm font-medium opacity-90">Sunny</p>
            <p className="text-xs opacity-70">Feels like 69°F</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/20 text-xs opacity-80">
          <span className="flex items-center gap-1"><Wind size={12} /> 12 mph</span>
          <span className="flex items-center gap-1"><Droplets size={12} /> 45%</span>
          <span className="ml-auto">H: 76° / L: 65°</span>
        </div>
      </div>
      <div className="grid grid-cols-5 divide-x divide-slate-100 dark:divide-slate-700 p-1">
        {forecast.map((day, i) => (
          <div key={i} className="flex flex-col items-center py-3 gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{day.day}</span>
            <span className="text-xl">{day.icon}</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{day.hi}°</span>
            <span className="text-xs text-slate-400">{day.lo}°</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickActionsWidget() {
  return (
    <div className="card p-5">
      <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-3">
        {quickLinks.map((link, i) => (
          <button key={i} className="flex flex-col items-center gap-2.5 p-3 rounded-2xl hover:shadow-card-md transition-all duration-200 hover:-translate-y-0.5 border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 group">
            <div className={`w-10 h-10 rounded-xl ${link.bg} flex items-center justify-center transition-transform group-hover:scale-110 duration-200`}>
              <link.icon size={18} className={link.iconColor} />
            </div>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">{link.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function InteractiveWidgets() {
  return (
    <Section title="Interactive Widgets" subtitle="Todo list, weather conditions, and quick actions">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <TodoWidget />
        <WeatherWidget />
        <QuickActionsWidget />
      </div>
    </Section>
  )
}
