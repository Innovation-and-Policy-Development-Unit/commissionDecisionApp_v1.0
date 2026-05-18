import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import Badge from '../../components/shared/Badge'
import { Plus, Trash2, Check, Star, Calendar, Tag, Filter, Search } from 'lucide-react'
import clsx from 'clsx'

const priorities = { high: { label: 'High', variant: 'danger' }, medium: { label: 'Medium', variant: 'warning' }, low: { label: 'Low', variant: 'success' } }

const initialTodos = [
  { id: 1, text: 'Review Q1 product roadmap and provide feedback to the team', done: false, priority: 'high', category: 'Work', dueDate: '2026-03-12', starred: true },
  { id: 2, text: 'Update dashboard color scheme to match new brand guidelines', done: false, priority: 'high', category: 'Design', dueDate: '2026-03-13', starred: false },
  { id: 3, text: 'Write unit tests for the StatCard and ChartCard components', done: true, priority: 'medium', category: 'Dev', dueDate: '2026-03-10', starred: false },
  { id: 4, text: 'Schedule team meeting for sprint planning session', done: false, priority: 'medium', category: 'Work', dueDate: '2026-03-14', starred: true },
  { id: 5, text: 'Update the README documentation with new screenshots', done: false, priority: 'low', category: 'Dev', dueDate: '2026-03-15', starred: false },
  { id: 6, text: 'Research best practices for React performance optimization', done: true, priority: 'low', category: 'Learning', dueDate: '2026-03-09', starred: false },
  { id: 7, text: 'Set up CI/CD pipeline for automated deployments', done: false, priority: 'high', category: 'DevOps', dueDate: '2026-03-16', starred: true },
  { id: 8, text: 'Create marketing assets for the product launch campaign', done: false, priority: 'medium', category: 'Marketing', dueDate: '2026-03-18', starred: false },
  { id: 9, text: 'Conduct user interviews for the new onboarding flow', done: true, priority: 'high', category: 'Research', dueDate: '2026-03-08', starred: false },
  { id: 10, text: 'Fix mobile responsiveness issues on the Calendar page', done: false, priority: 'medium', category: 'Dev', dueDate: '2026-03-17', starred: false },
  { id: 11, text: 'Prepare presentation slides for the investor meeting', done: false, priority: 'high', category: 'Work', dueDate: '2026-03-19', starred: true },
  { id: 12, text: 'Update npm dependencies to latest stable versions', done: true, priority: 'low', category: 'Dev', dueDate: '2026-03-07', starred: false },
]

const categoryColors = {
  Work: 'primary', Design: 'purple', Dev: 'info', Learning: 'success',
  DevOps: 'warning', Marketing: 'danger', Research: 'secondary',
}

const filters = ['All', 'Active', 'Completed', 'Starred', 'High Priority']

export default function Todo() {
  const [todos, setTodos] = useState(initialTodos)
  const [activeFilter, setActiveFilter] = useState('All')
  const [newText, setNewText] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newCategory, setNewCategory] = useState('Work')
  const [search, setSearch] = useState('')

  const filtered = todos.filter(t => {
    const matchSearch = !search || t.text.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      activeFilter === 'All' ||
      (activeFilter === 'Active' && !t.done) ||
      (activeFilter === 'Completed' && t.done) ||
      (activeFilter === 'Starred' && t.starred) ||
      (activeFilter === 'High Priority' && t.priority === 'high')
    return matchSearch && matchFilter
  })

  const toggle = (id) => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  const toggleStar = (id) => setTodos(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
  const deleteTodo = (id) => setTodos(prev => prev.filter(t => t.id !== id))

  const addTodo = () => {
    if (!newText.trim()) return
    setTodos(prev => [{
      id: Date.now(), text: newText, done: false,
      priority: newPriority, category: newCategory,
      dueDate: '', starred: false
    }, ...prev])
    setNewText('')
  }

  const completedCount = todos.filter(t => t.done).length
  const progress = Math.round((completedCount / todos.length) * 100)

  return (
    <div>
      <PageHeader title="Todo List" subtitle="Manage your tasks and stay productive" />

      {/* Progress */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Overall Progress</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{completedCount} of {todos.length} tasks completed</p>
          </div>
          <span className="text-2xl font-bold text-primary-500">{progress}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid grid-cols-4 gap-4 mt-4">
          {[
            { label: 'Total', value: todos.length, color: 'text-slate-600 dark:text-slate-400' },
            { label: 'Active', value: todos.filter(t => !t.done).length, color: 'text-primary-600 dark:text-primary-400' },
            { label: 'Done', value: completedCount, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'High Priority', value: todos.filter(t => t.priority === 'high' && !t.done).length, color: 'text-red-600 dark:text-red-400' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add new todo */}
      <div className="card p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Add a new task..."
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            className="input flex-1 min-w-48"
          />
          <select
            value={newPriority}
            onChange={e => setNewPriority(e.target.value)}
            className="input w-auto"
          >
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="input w-auto"
          >
            {Object.keys(categoryColors).map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={addTodo} className="btn-primary">
            <Plus size={16} />
            Add Task
          </button>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8 text-sm w-48"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeFilter === f
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Todo list */}
      <div className="space-y-2">
        {filtered.map(todo => {
          const priority = priorities[todo.priority]
          return (
            <div
              key={todo.id}
              className={clsx(
                'card flex items-start gap-4 p-4 transition-all duration-200',
                todo.done && 'opacity-60'
              )}
            >
              <button
                onClick={() => toggle(todo.id)}
                className={clsx(
                  'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                  todo.done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'
                )}
              >
                {todo.done && <Check size={12} />}
              </button>

              <div className="flex-1 min-w-0">
                <p className={clsx(
                  'text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed',
                  todo.done && 'line-through text-slate-400 dark:text-slate-500'
                )}>
                  {todo.text}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant={priority.variant}>{priority.label}</Badge>
                  <Badge variant={categoryColors[todo.category] || 'secondary'}>{todo.category}</Badge>
                  {todo.dueDate && (
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <Calendar size={11} />
                      {new Date(todo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleStar(todo.id)}
                  className={clsx('p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors', todo.starred && 'text-amber-500')}
                >
                  <Star size={15} className={todo.starred ? 'fill-amber-500' : 'text-slate-300 dark:text-slate-600'} />
                </button>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Check size={28} className="text-slate-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">No tasks found</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Add a new task above to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}
