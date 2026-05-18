import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import {
  Download, Upload, Plus, Trash2, Edit2, Eye, Send, Star, Heart,
  Loader2, ChevronRight, ArrowRight, ChevronDown, Github, Mail,
  Bell, Settings
} from 'lucide-react'

function Section({ title, description, children, wrap = true }) {
  return (
    <div className="card p-6 mb-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {wrap ? (
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      ) : (
        children
      )}
    </div>
  )
}

export default function Buttons() {
  const [loadingStates, setLoadingStates] = useState({ save: false, upload: false, process: false })
  const loadTimeoutsRef = useRef({})

  useEffect(() => () => {
    Object.values(loadTimeoutsRef.current).forEach(id => clearTimeout(id))
  }, [])

  function handleLoad(key) {
    setLoadingStates(prev => ({ ...prev, [key]: true }))
    if (loadTimeoutsRef.current[key]) clearTimeout(loadTimeoutsRef.current[key])
    loadTimeoutsRef.current[key] = setTimeout(
      () => setLoadingStates(prev => ({ ...prev, [key]: false })),
      2500
    )
  }

  return (
    <div>
      <PageHeader
        title="Buttons"
        subtitle="A comprehensive collection of button styles, sizes, states and variants for every use case"
      />

      {/* 1. Solid Variants */}
      <Section
        title="Solid Variants"
        description="Core color variants using primary theme + semantic colors"
      >
        <button className="btn-primary">Primary</button>
        <button className="btn-secondary">Secondary</button>
        <button className="btn-success">Success</button>
        <button className="btn-danger">Danger</button>
        <button className="btn-warning">Warning</button>
        <button className="btn-info">Info</button>
        <button className="btn-ghost">Ghost</button>
      </Section>

      {/* 2. Gradient Buttons */}
      <Section
        title="Gradient Buttons"
        description="Eye-catching gradient styles for CTAs and featured actions"
      >
        <button className="btn bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          Purple Solid
        </button>
        <button className="btn bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2">
          Cyan Solid
        </button>
        <button className="btn bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2">
          Green Solid
        </button>
        <button className="btn bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2">
          Orange Solid
        </button>
        <button className="btn bg-rose-500 hover:bg-rose-600 text-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2">
          Rose Solid
        </button>
      </Section>

      {/* 3. Outline Variants */}
      <Section
        title="Outline Variants"
        description="Bordered buttons ideal for secondary actions and less prominent CTAs"
      >
        <button className="btn border border-primary-500 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2">
          Primary
        </button>
        <button className="btn border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2">
          Success
        </button>
        <button className="btn border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2">
          Danger
        </button>
        <button className="btn border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2">
          Warning
        </button>
        <button className="btn border border-cyan-500 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2">
          Info
        </button>
        <button className="btn-outline">
          Default
        </button>
      </Section>

      {/* 4. Soft / Tinted Buttons */}
      <Section
        title="Soft / Tinted Buttons"
        description="Subtle tinted backgrounds — gentle and non-intrusive"
      >
        <button className="btn bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400 dark:hover:bg-primary-900/50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2">
          Primary Soft
        </button>
        <button className="btn bg-cyan-50 text-cyan-600 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 dark:hover:bg-cyan-900/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2">
          Cyan Soft
        </button>
        <button className="btn bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2">
          Emerald Soft
        </button>
        <button className="btn bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2">
          Amber Soft
        </button>
        <button className="btn bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2">
          Red Soft
        </button>
      </Section>

      {/* 5. Sizes */}
      <Section
        title="Sizes"
        description="Five size variants from extra-small to extra-large"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-primary px-2.5 py-1 text-[11px] leading-tight rounded-md">XS Button</button>
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">XS</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-primary btn-sm">SM Button</button>
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">SM</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-primary">Default Button</button>
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">MD</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-primary btn-lg">LG Button</button>
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">LG</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-primary btn-xl">XL Button</button>
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">XL</span>
          </div>
        </div>
      </Section>

      {/* 6. With Icons */}
      <Section
        title="With Icons"
        description="Pairing icons with text labels for enhanced clarity"
      >
        <button className="btn-primary"><Plus size={16} />Add Item</button>
        <button className="btn-success"><Download size={16} />Download</button>
        <button className="btn-danger"><Trash2 size={16} />Delete</button>
        <button className="btn-warning"><Upload size={16} />Upload</button>
        <button className="btn-info"><Eye size={16} />Preview</button>
        <button className="btn-outline"><Edit2 size={16} />Edit</button>
        <button className="btn-primary">Send <Send size={16} /></button>
        <button className="btn bg-primary-500 hover:bg-primary-600 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          Continue <ChevronRight size={16} />
        </button>
      </Section>

      {/* 7. Icon Only */}
      <Section
        title="Icon Only"
        description="Compact icon-only buttons in round and square styles"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-primary p-2.5 rounded-lg"><Plus size={18} /></button>
            <span className="text-[10px] text-slate-400">Square</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-success p-2.5 rounded-lg"><Download size={18} /></button>
            <span className="text-[10px] text-slate-400">Square</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-danger p-2.5 rounded-lg"><Trash2 size={18} /></button>
            <span className="text-[10px] text-slate-400">Square</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-primary p-2.5 rounded-full"><Bell size={18} /></button>
            <span className="text-[10px] text-slate-400">Round</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-info p-2.5 rounded-full"><Eye size={18} /></button>
            <span className="text-[10px] text-slate-400">Round</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-outline p-2.5 rounded-full"><Star size={18} /></button>
            <span className="text-[10px] text-slate-400">Round</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-ghost p-2.5 rounded-full"><Heart size={18} /></button>
            <span className="text-[10px] text-slate-400">Ghost</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="btn-ghost p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"><Settings size={18} /></button>
            <span className="text-[10px] text-slate-400">Ghost Sq</span>
          </div>
        </div>
      </Section>

      {/* 8. Pill / Rounded */}
      <Section
        title="Pill / Rounded"
        description="Fully rounded pill-style buttons for a modern, friendly aesthetic"
      >
        <button className="btn-primary rounded-full">Primary Pill</button>
        <button className="btn-success rounded-full">Success Pill</button>
        <button className="btn-danger rounded-full">Danger Pill</button>
        <button className="btn-outline rounded-full">Outline Pill</button>
        <button className="btn bg-primary-500 hover:bg-primary-600 text-white shadow-sm rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          <Star size={15} /> Featured
        </button>
      </Section>

      {/* 9. Loading States */}
      <Section
        title="Loading States"
        description="Buttons with animated spinners — click to trigger a 2.5s demo"
      >
        <button
          className="btn-primary"
          disabled={loadingStates.save}
          onClick={() => handleLoad('save')}
        >
          <Loader2 size={16} className={loadingStates.save ? 'animate-spin' : 'hidden'} />
          {loadingStates.save ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          className="btn-success"
          disabled={loadingStates.upload}
          onClick={() => handleLoad('upload')}
        >
          <Loader2 size={16} className={loadingStates.upload ? 'animate-spin' : 'hidden'} />
          {loadingStates.upload ? 'Uploading…' : 'Upload File'}
        </button>
        <button
          className="btn-outline"
          disabled={loadingStates.process}
          onClick={() => handleLoad('process')}
        >
          <Loader2 size={16} className={loadingStates.process ? 'animate-spin' : 'hidden'} />
          {loadingStates.process ? 'Processing…' : 'Process Data'}
        </button>
        <button className="btn bg-primary-500 hover:bg-primary-600 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2" disabled>
          <Loader2 size={16} className="animate-spin" />
          Static Spinner
        </button>
      </Section>

      {/* 10. Social Buttons */}
      <Section
        title="Social Buttons"
        description="Authentication and social login buttons"
      >
        <button className="btn bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 gap-2.5">
          <span className="w-5 h-5 flex items-center justify-center">
            <Github size={18} />
          </span>
          Continue with GitHub
        </button>
        <button className="btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 shadow-sm gap-2.5">
          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">G</span>
          Continue with Google
        </button>
        <button className="btn bg-black hover:bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2 gap-2.5">
          <span className="w-5 h-5 flex items-center justify-center font-bold text-sm">𝕏</span>
          Continue with X
        </button>
        <button className="btn bg-[#0077B5] hover:bg-[#006399] text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 gap-2.5">
          <span className="w-5 h-5 flex items-center justify-center rounded font-bold text-xs bg-white text-[#0077B5] leading-none">in</span>
          Continue with LinkedIn
        </button>
        <button className="btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 shadow-sm gap-2.5">
          <span className="w-5 h-5 flex items-center justify-center">
            <Mail size={16} className="text-red-500" />
          </span>
          Continue with Email
        </button>
      </Section>

      {/* 11. Split Buttons */}
      <Section
        title="Split Buttons"
        description="Combined action + dropdown arrow for multi-option actions"
        wrap={false}
      >
        <div className="flex flex-wrap gap-4">
          <div className="flex">
            <button className="btn-primary rounded-r-none border-r border-primary-700 focus:ring-offset-0">
              <Download size={16} /> Download
            </button>
            <button className="btn-primary rounded-l-none px-2.5 focus:ring-offset-0" aria-label="More download options">
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="flex">
            <button className="btn-success rounded-r-none border-r border-emerald-600 focus:ring-offset-0">
              <Upload size={16} /> Publish
            </button>
            <button className="btn-success rounded-l-none px-2.5 focus:ring-offset-0" aria-label="More publish options">
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="flex">
            <button className="btn-outline rounded-r-none focus:ring-offset-0">
              <Edit2 size={16} /> Edit
            </button>
            <button className="btn-outline rounded-l-none border-l-0 px-2.5 focus:ring-offset-0" aria-label="More edit options">
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="flex">
            <button className="btn bg-primary-500 hover:bg-primary-600 text-white shadow-sm rounded-l-lg rounded-r-none focus:outline-none focus:ring-2 focus:ring-primary-500">
              <Send size={16} /> Send
            </button>
            <button className="btn bg-primary-600 hover:bg-primary-700 text-white shadow-sm rounded-l-none rounded-r-lg border-l border-primary-400 px-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500" aria-label="More send options">
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </Section>

      {/* 12. Block Buttons */}
      <Section
        title="Block Buttons"
        description="Full-width buttons that span the entire container"
        wrap={false}
      >
        <div className="space-y-3 max-w-md">
          <button className="btn-primary w-full justify-center">Full Width Primary</button>
          <button className="btn-outline w-full justify-center">Full Width Outline</button>
          <button className="btn bg-primary-500 hover:bg-primary-600 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full justify-center">
            Full Width Solid <ArrowRight size={16} />
          </button>
        </div>
      </Section>

      {/* 13. Button Groups */}
      <Section
        title="Button Groups"
        description="Grouped buttons for related actions — solid and outline styles"
        wrap={false}
      >
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-3">
            <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Solid Group</span>
            <div className="flex">
              <button className="btn-primary rounded-r-none border-r border-primary-700 focus:z-10">Left</button>
              <button className="btn-primary rounded-none border-x border-primary-700 focus:z-10">Center</button>
              <button className="btn-primary rounded-l-none focus:z-10">Right</button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Outline Group</span>
            <div className="flex">
              <button className="btn-outline rounded-r-none focus:z-10">Left</button>
              <button className="btn-outline rounded-none -ml-px focus:z-10">Center</button>
              <button className="btn-outline rounded-l-none -ml-px focus:z-10">Right</button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Icon Group</span>
            <div className="flex">
              <button className="btn-outline rounded-r-none focus:z-10 px-3"><Edit2 size={15} /></button>
              <button className="btn-outline rounded-none -ml-px focus:z-10 px-3"><Eye size={15} /></button>
              <button className="btn-outline rounded-none -ml-px focus:z-10 px-3"><Download size={15} /></button>
              <button className="btn-outline rounded-l-none -ml-px focus:z-10 px-3"><Trash2 size={15} /></button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Soft Group</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <button className="btn bg-slate-50 hover:bg-primary-50 hover:text-primary-600 dark:bg-slate-800 dark:hover:bg-primary-900/30 dark:hover:text-primary-400 text-slate-600 dark:text-slate-400 rounded-none border-r border-slate-200 dark:border-slate-700 focus:outline-none text-sm px-4 py-2 font-medium">
                Day
              </button>
              <button className="btn bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-none border-r border-slate-200 dark:border-slate-700 focus:outline-none text-sm px-4 py-2 font-medium">
                Week
              </button>
              <button className="btn bg-slate-50 hover:bg-primary-50 hover:text-primary-600 dark:bg-slate-800 dark:hover:bg-primary-900/30 dark:hover:text-primary-400 text-slate-600 dark:text-slate-400 rounded-none focus:outline-none text-sm px-4 py-2 font-medium">
                Month
              </button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
