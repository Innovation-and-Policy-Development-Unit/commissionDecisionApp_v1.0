import PageHeader from '../../components/shared/PageHeader'
import {
  Quote, Code, ArrowRight, ExternalLink,
  TrendingUp, Star, Zap, CheckCircle, AlertTriangle, Info, Clock, User
} from 'lucide-react'

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, span = '', children }) {
  return (
    <div className={`card p-6 ${span}`}>
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5 pb-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

// ─── Label for demos ──────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <span className="inline-block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest mb-1">
      {children}
    </span>
  )
}

// ─── 1. Headings ─────────────────────────────────────────────────────────────
function HeadingsSection() {
  return (
    <Section title="Headings" span="lg:col-span-2">
      <div className="space-y-4">
        {[
          { tag: 'H1', size: 'text-5xl', weight: 'font-extrabold', label: 'text-5xl / 800' },
          { tag: 'H2', size: 'text-4xl', weight: 'font-bold', label: 'text-4xl / 700' },
          { tag: 'H3', size: 'text-3xl', weight: 'font-bold', label: 'text-3xl / 700' },
          { tag: 'H4', size: 'text-2xl', weight: 'font-semibold', label: 'text-2xl / 600' },
          { tag: 'H5', size: 'text-xl', weight: 'font-semibold', label: 'text-xl / 600' },
          { tag: 'H6', size: 'text-base', weight: 'font-semibold', label: 'text-base / 600' },
        ].map(({ tag, size, weight, label }) => (
          <div key={tag} className="flex items-baseline gap-4">
            <div className="w-16 shrink-0 flex justify-end">
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{tag}</span>
            </div>
            <div className="flex-1 flex items-baseline justify-between gap-4">
              <span className={`${size} ${weight} text-slate-900 dark:text-slate-100 leading-tight`}>
                The quick brown fox jumps
              </span>
              <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:inline">{label}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── 2. Body Text ─────────────────────────────────────────────────────────────
function BodyTextSection() {
  return (
    <Section title="Body Text">
      <div className="space-y-5">
        {[
          { cls: 'text-2xl', label: 'text-2xl — Lead / Hero', sample: 'Large intro paragraph text used for page leads and hero sections.' },
          { cls: 'text-xl', label: 'text-xl — Large Body', sample: 'Slightly larger body text for introductory paragraphs and featured content.' },
          { cls: 'text-base', label: 'text-base — Default Body', sample: 'Standard body text for main content areas, articles, and paragraphs. This is the default size used throughout the interface.' },
          { cls: 'text-sm', label: 'text-sm — Small', sample: 'Small text for secondary content, captions, form help text, and sidebar descriptions.' },
          { cls: 'text-xs', label: 'text-xs — Extra Small', sample: 'Extra small text for labels, timestamps, metadata, and fine print.' },
        ].map(({ cls, label, sample }) => (
          <div key={cls}>
            <Label>{label}</Label>
            <p className={`${cls} text-slate-700 dark:text-slate-300 leading-relaxed`}>{sample}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── 3. Font Weights ──────────────────────────────────────────────────────────
function FontWeightsSection() {
  return (
    <Section title="Font Weights">
      <div className="space-y-3">
        {[
          { cls: 'font-thin', label: 'font-thin (100)', num: 100 },
          { cls: 'font-extralight', label: 'font-extralight (200)', num: 200 },
          { cls: 'font-light', label: 'font-light (300)', num: 300 },
          { cls: 'font-normal', label: 'font-normal (400)', num: 400 },
          { cls: 'font-medium', label: 'font-medium (500)', num: 500 },
          { cls: 'font-semibold', label: 'font-semibold (600)', num: 600 },
          { cls: 'font-bold', label: 'font-bold (700)', num: 700 },
          { cls: 'font-extrabold', label: 'font-extrabold (800)', num: 800 },
          { cls: 'font-black', label: 'font-black (900)', num: 900 },
        ].map(({ cls, label }) => (
          <div key={cls} className="flex items-baseline gap-3">
            <span className="text-[10px] font-mono text-slate-400 w-36 shrink-0">{label}</span>
            <span className={`text-lg text-slate-800 dark:text-slate-200 ${cls}`}>The quick brown fox</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── 4. Text Colors ───────────────────────────────────────────────────────────
function TextColorsSection() {
  return (
    <Section title="Text Colors">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Slate Scale</p>
        {[
          ['text-slate-900 dark:text-slate-100', 'slate-900', 'Darkest — headings and primary text'],
          ['text-slate-700 dark:text-slate-300', 'slate-700', 'Default body text'],
          ['text-slate-600 dark:text-slate-400', 'slate-600', 'Secondary body text'],
          ['text-slate-500', 'slate-500', 'Muted / placeholder text'],
          ['text-slate-400', 'slate-400', 'Disabled and hint text'],
        ].map(([cls, label, desc]) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`text-sm font-medium w-48 shrink-0 ${cls}`}>{label}</span>
            <span className="text-xs text-slate-400">{desc}</span>
          </div>
        ))}

        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-5 mb-3">Semantic Colors</p>
        {[
          ['text-primary-600 dark:text-primary-400', 'Primary — interactive elements, links'],
          ['text-emerald-600 dark:text-emerald-400', 'Success — positive states, confirmations'],
          ['text-amber-600 dark:text-amber-400', 'Warning — caution, pending states'],
          ['text-red-600 dark:text-red-400', 'Danger — errors, destructive actions'],
          ['text-cyan-600 dark:text-cyan-400', 'Info — informational, neutral notice'],
          ['text-violet-600 dark:text-violet-400', 'Violet — premium, creative contexts'],
          ['text-rose-600 dark:text-rose-400', 'Rose — love, favorites, highlights'],
        ].map(([cls, desc]) => (
          <div key={cls} className="flex items-center gap-3">
            <span className={`text-sm font-semibold w-48 shrink-0 ${cls}`}>{cls.split(' ')[0].replace('text-', '')}</span>
            <span className="text-xs text-slate-400">{desc}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── 5. Special Text ──────────────────────────────────────────────────────────
function SpecialTextSection() {
  return (
    <Section title="Special Text Styles" span="lg:col-span-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Gradient */}
        <div>
          <Label>Gradient Text</Label>
          <div className="space-y-2">
            <p className="text-2xl font-extrabold text-primary-500">Gradient Heading</p>
            <p className="text-xl font-bold text-emerald-500">Green to Cyan</p>
            <p className="text-xl font-bold text-amber-500">Amber to Red</p>
            <p className="text-xl font-bold text-pink-500">Pink to Violet</p>
          </div>
        </div>

        {/* Decorations */}
        <div>
          <Label>Text Decorations</Label>
          <div className="space-y-2.5 text-sm">
            <p className="line-through text-slate-500">Strikethrough — discontinued</p>
            <p className="underline text-slate-700 dark:text-slate-300 decoration-primary-500 underline-offset-2">Custom underline color</p>
            <p className="underline decoration-wavy decoration-red-500 text-slate-700 dark:text-slate-300 underline-offset-2">Wavy underline</p>
            <p className="underline decoration-dotted decoration-slate-500 text-slate-700 dark:text-slate-300 underline-offset-2">Dotted underline</p>
            <p className="line-through decoration-2 text-red-500">Double strikethrough</p>
            <p className="overline text-slate-700 dark:text-slate-300">Overline text</p>
          </div>
        </div>

        {/* Style variants */}
        <div>
          <Label>Style Variants</Label>
          <div className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
            <p><em>Italic — emphasis and titles</em></p>
            <p><strong>Bold — strong importance</strong></p>
            <p className="uppercase tracking-widest text-xs text-slate-500">Uppercase tracking</p>
            <p className="lowercase">Lowercase text example</p>
            <p className="capitalize">capitalize each word</p>
            <p className="tabular-nums font-mono text-slate-500">1,234,567.89 tabular</p>
          </div>
        </div>

        {/* Inline Code + KBD */}
        <div>
          <Label>Code & Keyboard</Label>
          <div className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
            <p>Run <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-primary-600 dark:text-primary-400 font-mono text-xs">npm install</code> to start</p>
            <p>Press <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm">C</kbd> to copy</p>
            <p>Use <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm">⌘ K</kbd> to open the palette</p>
            <p>Component: <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-violet-600 dark:text-violet-400 font-mono text-xs">{'<Button />'}</code></p>
          </div>
        </div>

        {/* Text sizing combos */}
        <div>
          <Label>Size + Weight Combos</Label>
          <div className="space-y-2">
            <p className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-tight">Display Bold</p>
            <p className="text-xl font-semibold text-slate-700 dark:text-slate-300">Section Title</p>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Overline Caption</p>
            <p className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest">Category Label</p>
          </div>
        </div>

        {/* Truncation */}
        <div>
          <Label>Truncation & Overflow</Label>
          <div className="space-y-2.5 text-sm">
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">Single line truncate</p>
              <p className="truncate text-slate-700 dark:text-slate-300 max-w-[180px]">This is a very long text that will be truncated</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">2-line clamp</p>
              <p className="line-clamp-2 text-slate-600 dark:text-slate-400">This paragraph has multiple lines of text. When it exceeds two lines it will be gracefully cut off with an ellipsis at the end of the second line.</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">Break words</p>
              <p className="break-all text-slate-500 text-xs max-w-[200px]">averylongwordthatbreaks acrosslines</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── 6. Blockquotes ───────────────────────────────────────────────────────────
function BlockquotesSection() {
  return (
    <Section title="Blockquotes">
      <div className="space-y-5">
        <blockquote className="border-l-4 border-primary-500 pl-5 py-2 bg-primary-50 dark:bg-primary-900/10 rounded-r-xl">
          <Quote size={20} className="text-primary-400 mb-2" />
          <p className="text-base text-slate-700 dark:text-slate-300 italic leading-relaxed">
            "Design is not just what it looks like and feels like. Design is how it works."
          </p>
          <cite className="block mt-2 text-sm font-semibold text-slate-500 not-italic">— Steve Jobs, Apple</cite>
        </blockquote>

        <blockquote className="border-l-4 border-emerald-500 pl-5 py-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-r-xl">
          <Quote size={20} className="text-emerald-400 mb-2" />
          <p className="text-base text-slate-700 dark:text-slate-300 italic leading-relaxed">
            "The best way to predict the future is to invent it. The computer was supposed to be a tool that amplified human intelligence."
          </p>
          <cite className="block mt-2 text-sm font-semibold text-slate-500 not-italic">— Alan Kay, PARC</cite>
        </blockquote>

        <blockquote className="relative pl-6 py-3 border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/10 rounded-xl overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-violet-500 rounded-l-xl" />
          <Quote size={24} className="text-violet-300 mb-2" />
          <p className="text-base text-slate-700 dark:text-slate-300 italic leading-relaxed">
            "Simplicity is the ultimate sophistication. What is not there is just as important as what is there."
          </p>
          <cite className="block mt-2 text-sm font-semibold text-violet-600 dark:text-violet-400 not-italic">— Leonardo da Vinci</cite>
        </blockquote>
      </div>
    </Section>
  )
}

// ─── 7. Lists ────────────────────────────────────────────────────────────────
function ListsSection() {
  return (
    <Section title="Lists" span="lg:col-span-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Unordered */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Unordered</p>
          <ul className="space-y-2">
            {['Real-time collaboration', 'Advanced analytics', 'API integrations', 'Custom dashboards'].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Ordered */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Ordered</p>
          <ol className="space-y-2">
            {['Create an account', 'Set up your workspace', 'Invite your team', 'Start building'].map((item, i) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </div>

        {/* Check List */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Check List</p>
          <ul className="space-y-2">
            {[
              { text: 'Design system', done: true },
              { text: 'Component library', done: true },
              { text: 'Documentation', done: true },
              { text: 'Unit tests', done: false },
              { text: 'Deploy to production', done: false },
            ].map(item => (
              <li key={item.text} className="flex items-center gap-2 text-sm">
                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${item.done ? 'bg-emerald-500' : 'border-2 border-slate-300 dark:border-slate-600'}`}>
                  {item.done && (
                    <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className={item.done ? 'text-slate-400 line-through' : 'text-slate-600 dark:text-slate-400'}>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Description List */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Description</p>
          <dl className="space-y-2.5">
            {[
              ['Name', 'Alexandra Thompson'],
              ['Role', 'Lead Designer'],
              ['Team', 'Product Design'],
              ['Location', 'San Francisco'],
              ['Joined', 'March 2023'],
            ].map(([dt, dd]) => (
              <div key={dt} className="flex gap-2 text-sm">
                <dt className="font-semibold text-slate-600 dark:text-slate-400 w-20 shrink-0">{dt}</dt>
                <dd className="text-slate-500 dark:text-slate-400">{dd}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  )
}

// ─── 8. Badges / Inline Labels ────────────────────────────────────────────────
function BadgesSection() {
  return (
    <Section title="Badges & Inline Labels">
      <div className="space-y-5">
        {/* Size variants */}
        <div>
          <Label>Sizes</Label>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">XS</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">SM</span>
            <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">MD</span>
            <span className="px-3 py-1.5 rounded-lg text-base font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">LG</span>
          </div>
        </div>

        {/* Color variants */}
        <div>
          <Label>Color Variants (Solid)</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {[
              ['bg-primary-600 text-white', 'Primary'],
              ['bg-emerald-500 text-white', 'Success'],
              ['bg-amber-500 text-white', 'Warning'],
              ['bg-red-500 text-white', 'Danger'],
              ['bg-cyan-500 text-white', 'Info'],
              ['bg-violet-500 text-white', 'Violet'],
              ['bg-slate-700 dark:bg-slate-600 text-white', 'Dark'],
              ['bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300', 'Neutral'],
            ].map(([cls, label]) => (
              <span key={label} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
            ))}
          </div>
        </div>

        {/* Soft variants */}
        <div>
          <Label>Color Variants (Soft)</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {[
              ['bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400', 'Primary'],
              ['bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', 'Success'],
              ['bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', 'Warning'],
              ['bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', 'Danger'],
              ['bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400', 'Info'],
              ['bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400', 'Violet'],
            ].map(([cls, label]) => (
              <span key={label} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
            ))}
          </div>
        </div>

        {/* Outlined */}
        <div>
          <Label>Outlined</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {[
              ['border border-primary-500 text-primary-600 dark:text-primary-400', 'Primary'],
              ['border border-emerald-500 text-emerald-600 dark:text-emerald-400', 'Success'],
              ['border border-amber-500 text-amber-600 dark:text-amber-400', 'Warning'],
              ['border border-red-500 text-red-600 dark:text-red-400', 'Danger'],
            ].map(([cls, label]) => (
              <span key={label} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
            ))}
          </div>
        </div>

        {/* With dot */}
        <div>
          <Label>With Status Dot</Label>
          <div className="flex flex-wrap gap-3 mt-1.5">
            {[
              ['bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', 'bg-emerald-500', 'Active'],
              ['bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', 'bg-amber-500', 'Pending'],
              ['bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', 'bg-red-500', 'Inactive'],
              ['bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300', 'bg-slate-400', 'Draft'],
            ].map(([cls, dot, label]) => (
              <span key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── 9. Links ────────────────────────────────────────────────────────────────
function LinksSection() {
  return (
    <Section title="Link Styles">
      <div className="space-y-4 text-sm">
        <div>
          <Label>Default Links</Label>
          <div className="flex flex-wrap gap-4 mt-1.5">
            <a href="#" onClick={(e) => e.preventDefault()} className="text-primary-600 dark:text-primary-400 hover:underline">Standard link</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-primary-600 dark:text-primary-400 underline underline-offset-2">Always underlined</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-700">Bold link</a>
          </div>
        </div>

        <div>
          <Label>With Icons</Label>
          <div className="flex flex-wrap gap-4 mt-1.5">
            <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline">
              Learn more <ArrowRight size={14} />
            </a>
            <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline" target="_blank" rel="noopener noreferrer">
              Open externally <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div>
          <Label>Color Variants</Label>
          <div className="flex flex-wrap gap-4 mt-1.5">
            <a href="#" onClick={(e) => e.preventDefault()} className="text-emerald-600 dark:text-emerald-400 hover:underline">Success link</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-amber-600 dark:text-amber-400 hover:underline">Warning link</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-red-600 dark:text-red-400 hover:underline">Danger link</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-violet-600 dark:text-violet-400 hover:underline">Violet link</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline">Muted link</a>
          </div>
        </div>

        <div>
          <Label>Button-Style Links</Label>
          <div className="flex flex-wrap gap-3 mt-1.5">
            <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors text-xs">
              View Docs <ArrowRight size={12} />
            </a>
            <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs">
              GitHub <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div>
          <Label>Inline in Paragraph</Label>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mt-1.5">
            Visit our <a href="#" onClick={(e) => e.preventDefault()} className="text-primary-600 dark:text-primary-400 underline underline-offset-2 hover:text-primary-700">documentation</a> to get started.
            If you need help, check the <a href="#" onClick={(e) => e.preventDefault()} className="text-primary-600 dark:text-primary-400 underline underline-offset-2 hover:text-primary-700">FAQ</a> or{' '}
            <a href="#" onClick={(e) => e.preventDefault()} className="text-primary-600 dark:text-primary-400 underline underline-offset-2 hover:text-primary-700">contact support</a>.
          </p>
        </div>
      </div>
    </Section>
  )
}

// ─── 10. Text with Backgrounds ───────────────────────────────────────────────
function TextBackgroundsSection() {
  return (
    <Section title="Text with Backgrounds & Highlights">
      <div className="space-y-5">
        {/* Highlight / Mark */}
        <div>
          <Label>Highlight / Mark</Label>
          <div className="space-y-2 mt-1.5 text-sm text-slate-700 dark:text-slate-300">
            <p>
              This sentence contains a <mark className="bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 px-0.5 rounded">highlighted word</mark> for emphasis.
            </p>
            <p>
              Search result: The word <mark className="bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 px-0.5 rounded-sm">React</mark> appears in the documentation.
            </p>
            <p>
              Deleted <del className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-0.5 rounded line-through">old version</del> and added <ins className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-0.5 rounded no-underline">new version</ins>.
            </p>
          </div>
        </div>

        {/* Code Block */}
        <div>
          <Label>Code Block</Label>
          <pre className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 overflow-x-auto text-sm mt-1.5">
            <code>
              <span className="text-pink-400">const</span>{' '}
              <span className="text-cyan-300">Button</span>{' '}
              <span className="text-pink-400">=</span>{' '}
              <span className="text-yellow-300">{'({'}</span>
              <span className="text-orange-300">children</span>
              <span className="text-yellow-300">{'}'}</span>
              <span className="text-pink-400">{' =>'}</span>
              <span className="text-yellow-300">{' {'}</span>
              {'\n  '}
              <span className="text-pink-400">return</span>
              <span className="text-slate-300">{' ('}</span>
              {'\n    '}
              <span className="text-green-300">{'<button'}</span>
              {' '}
              <span className="text-sky-300">className</span>
              <span className="text-slate-300">="</span>
              <span className="text-amber-300">btn btn-primary</span>
              <span className="text-slate-300">"</span>
              <span className="text-green-300">{'>'}</span>
              {'\n      '}
              <span className="text-yellow-300">{'{'}</span>
              <span className="text-cyan-300">children</span>
              <span className="text-yellow-300">{'}'}</span>
              {'\n    '}
              <span className="text-green-300">{'</button>'}</span>
              {'\n  '}
              <span className="text-slate-300">)</span>
              {'\n'}
              <span className="text-yellow-300">{'}'}</span>
            </code>
          </pre>
        </div>

        {/* Callout boxes */}
        <div>
          <Label>Text Callouts</Label>
          <div className="space-y-2 mt-1.5">
            {[
              { color: 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800 text-primary-800 dark:text-primary-300', label: 'ℹ Note', text: 'This is an informational note with some important context for the reader.' },
              { color: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300', label: '⚠ Warning', text: 'This action cannot be undone. Make sure you have a backup before proceeding.' },
              { color: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300', label: '✓ Tip', text: 'Use keyboard shortcuts to speed up your workflow. Press Ctrl+K to open quick commands.' },
            ].map(c => (
              <div key={c.label} className={`flex gap-2.5 p-3 rounded-xl border text-xs ${c.color}`}>
                <span className="font-bold shrink-0">{c.label}:</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── NEW 11. Gradient Text ─────────────────────────────────────────────────────
function GradientTextSection() {
  const gradients = [
    {
      label: 'Primary',
      cls: 'text-primary-500',
      badge: 'text-primary-500',
    },
    {
      label: 'Violet',
      cls: 'text-violet-500',
      badge: 'text-violet-500',
    },
    {
      label: 'Emerald',
      cls: 'text-emerald-500',
      badge: 'text-emerald-500',
    },
    {
      label: 'Amber',
      cls: 'text-amber-500',
      badge: 'text-amber-500',
    },
  ]

  return (
    <Section title="Gradient Text" span="lg:col-span-2">
      <div className="space-y-6">
        <p className="text-sm text-slate-500">
          CSS gradient fills applied via <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-violet-600 dark:text-violet-400 font-mono text-xs">bg-clip-text text-transparent</code>. Ideal for hero headings, display titles, and marketing pages.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {gradients.map(({ label, cls, badge }) => (
            <div key={label} className="space-y-2">
              <Label>{label}</Label>
              <p className={`text-5xl font-black leading-tight ${cls}`}>Bold Display</p>
              <p className={`text-3xl font-extrabold leading-tight ${cls}`}>Section Headline</p>
              <p className={`text-xl font-bold ${cls}`}>Subheading Text</p>
              <code className="inline-block text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mt-1">{badge}</code>
            </div>
          ))}
        </div>

        {/* Full-width hero example */}
        <div className="mt-4 p-8 rounded-2xl bg-slate-900 text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Hero Usage Example</p>
          <h2 className="text-6xl font-black text-primary-500 leading-tight mb-3">
            Build Faster,<br />Ship Smarter
          </h2>
          <p className="text-slate-400 text-lg max-w-md mx-auto leading-relaxed">
            The modern design system for teams that move at the speed of ideas.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="px-4 py-2 rounded-full bg-primary-600 text-white text-sm font-semibold">Get Started</span>
            <span className="px-4 py-2 rounded-full border border-slate-600 text-slate-300 text-sm font-semibold flex items-center gap-1.5">View Demo <ArrowRight size={14} /></span>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── NEW 12. Display / Hero Sizes ─────────────────────────────────────────────
function DisplaySizesSection() {
  return (
    <Section title="Display / Hero Sizes" span="lg:col-span-2">
      <div className="space-y-2">
        <p className="text-sm text-slate-500 mb-6">
          Extra-large sizes for hero banners, landing pages, and editorial layouts. Pair with light weights for elegance or black weight for impact.
        </p>

        {[
          { size: 'text-8xl', label: 'text-8xl', weight: 'font-black', sample: 'Display' },
          { size: 'text-7xl', label: 'text-7xl', weight: 'font-extrabold', sample: 'Hero Title' },
          { size: 'text-6xl', label: 'text-6xl', weight: 'font-bold', sample: 'Page Header' },
          { size: 'text-5xl', label: 'text-5xl', weight: 'font-semibold', sample: 'Section Lead' },
        ].map(({ size, label, weight, sample }) => (
          <div key={size} className="flex items-baseline gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span className="text-[10px] font-mono text-slate-400 w-20 shrink-0">{label}</span>
            <span className={`${size} ${weight} text-slate-900 dark:text-slate-100 leading-none flex-1`}>{sample}</span>
          </div>
        ))}

        {/* Weight samples at display size */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Label>text-6xl — Weight Samples</Label>
          <div className="space-y-1 mt-3">
            {[
              ['font-light', '300 — Light'],
              ['font-normal', '400 — Normal'],
              ['font-semibold', '600 — Semibold'],
              ['font-extrabold', '800 — Extrabold'],
              ['font-black', '900 — Black'],
            ].map(([cls, label]) => (
              <div key={cls} className="flex items-baseline gap-4">
                <span className="text-[10px] font-mono text-slate-400 w-28 shrink-0">{label}</span>
                <span className={`text-5xl text-slate-900 dark:text-slate-100 leading-none ${cls}`}>Aa</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── NEW 13. Lead & Article Text ──────────────────────────────────────────────
function ArticleTextSection() {
  return (
    <Section title="Lead & Article Text" span="lg:col-span-2">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Full Article Layout Example</p>

        {/* Category + meta row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">Design Systems</span>
          <span className="text-xs text-slate-400">March 11, 2026</span>
          <span className="text-xs text-slate-400">·</span>
          <span className="flex items-center gap-1 text-xs text-slate-400"><Clock size={11} /> 8 min read</span>
        </div>

        {/* H1 Headline */}
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight mb-4">
          Building a Scalable Typography System for Modern Web Apps
        </h1>

        {/* Lead paragraph */}
        <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed font-normal mb-6 border-l-2 border-primary-400 pl-4">
          A well-crafted type scale is the invisible backbone of every great interface. It creates rhythm, hierarchy, and readability without drawing attention to itself.
        </p>

        {/* Body paragraphs */}
        <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
          Typography is far more than choosing a typeface. It encompasses the full system of sizes, weights, spacing, and color that together create a readable, scannable, and accessible experience. When teams invest in a proper type scale early, they reduce design debt and accelerate development.
        </p>

        <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
          Start with a base size of <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-primary-600 dark:text-primary-400 font-mono text-xs">16px</code> and build a modular scale around it. Tools like{' '}
          <a href="#" onClick={(e) => e.preventDefault()} className="text-primary-600 dark:text-primary-400 underline underline-offset-2">Tailwind CSS</a> provide a carefully considered scale out of the box, though you can always override it for brand-specific needs. The key is consistency: once defined, the scale should be applied uniformly across all surfaces.
        </p>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-8 mb-3">Why Line Height Matters</h2>
        <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
          Cramped text reduces comprehension. Studies in reading science consistently show that generous line heights — typically between <strong>1.4 and 1.8 times</strong> the font size — improve reading speed and retention, especially for body copy. Navigation labels and headings, by contrast, often benefit from tighter leading.
        </p>

        {/* Pull quote */}
        <blockquote className="my-8 border-l-4 border-cyan-500 pl-6 py-3 bg-cyan-50 dark:bg-cyan-900/10 rounded-r-2xl">
          <Quote size={22} className="text-cyan-400 mb-2" />
          <p className="text-xl font-semibold text-slate-700 dark:text-slate-300 italic leading-relaxed">
            "Consistency in typography is not a constraint — it's the foundation of a system that feels intentional."
          </p>
          <cite className="block mt-3 text-sm font-semibold text-cyan-600 dark:text-cyan-400 not-italic">— Adapted from "Elements of Typographic Style"</cite>
        </blockquote>

        {/* Conclusion */}
        <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
          The best type systems are invisible — readers never notice them. They simply feel at home, can scan at a glance, and read deeply without fatigue. If your typography is calling attention to itself, it's time to simplify. Invest in the scale, the weights, and the rhythm. Everything else follows.
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-slate-200 dark:border-slate-700">
          {['Typography', 'Design', 'CSS', 'Tailwind', 'UI Systems'].map(tag => (
            <span key={tag} className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── NEW 14. Letter Spacing & Line Height ─────────────────────────────────────
function SpacingRhythmSection() {
  return (
    <Section title="Letter Spacing & Line Height" span="lg:col-span-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* Letter Spacing */}
        <div>
          <Label>Letter Spacing (tracking)</Label>
          <div className="space-y-4 mt-3">
            {[
              { cls: 'tracking-tighter', label: 'tracking-tighter', desc: '-0.05em', sample: 'Display headlines, bold large type' },
              { cls: 'tracking-tight', label: 'tracking-tight', desc: '-0.025em', sample: 'Subheadings and hero text' },
              { cls: 'tracking-normal', label: 'tracking-normal', desc: '0em', sample: 'Default body text spacing' },
              { cls: 'tracking-wide', label: 'tracking-wide', desc: '0.025em', sample: 'Small UI labels and captions' },
              { cls: 'tracking-wider', label: 'tracking-wider', desc: '0.05em', sample: 'Category labels and metadata' },
              { cls: 'tracking-widest', label: 'tracking-widest', desc: '0.1em', sample: 'UPPERCASE OVERLINES' },
            ].map(({ cls, label, desc, sample }) => (
              <div key={cls} className="group">
                <div className="flex items-center gap-3 mb-0.5">
                  <code className="text-[10px] font-mono text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 rounded">{label}</code>
                  <span className="text-[10px] font-mono text-slate-400">{desc}</span>
                </div>
                <p className={`text-sm text-slate-700 dark:text-slate-300 ${cls}`}>{sample}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Line Height */}
        <div>
          <Label>Line Height (leading)</Label>
          <div className="space-y-5 mt-3">
            {[
              { cls: 'leading-none', label: 'leading-none', desc: '1', sample: 'Tight headings. Great for large display type where gaps between lines look excessive.' },
              { cls: 'leading-tight', label: 'leading-tight', desc: '1.25', sample: 'Compact headings and navigation items. Slightly more breathing room than none.' },
              { cls: 'leading-snug', label: 'leading-snug', desc: '1.375', sample: 'Card titles and short paragraph previews benefit from this comfortable spacing.' },
              { cls: 'leading-normal', label: 'leading-normal', desc: '1.5', sample: 'Default for body text. Readable without feeling too spacious for most screen densities.' },
              { cls: 'leading-relaxed', label: 'leading-relaxed', desc: '1.625', sample: 'Long-form articles and documentation content. Reduces eye fatigue on extended reads.' },
              { cls: 'leading-loose', label: 'leading-loose', desc: '2', sample: 'Very open. Used for code blocks, poetry, and sparse editorial layouts on wide screens.' },
            ].map(({ cls, label, desc, sample }) => (
              <div key={cls}>
                <div className="flex items-center gap-3 mb-1">
                  <code className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded">{label}</code>
                  <span className="text-[10px] font-mono text-slate-400">{desc}</span>
                </div>
                <p className={`text-sm text-slate-700 dark:text-slate-300 ${cls} bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2`}>{sample}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── NEW 15. Text Decoration Deep Dive ────────────────────────────────────────
function TextDecorationSection() {
  return (
    <Section title="Text Decoration & Overflow" span="lg:col-span-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">

        {/* Underline styles */}
        <div>
          <Label>Underline Styles</Label>
          <div className="space-y-3 mt-2 text-sm">
            {[
              { cls: 'underline decoration-solid decoration-primary-500 underline-offset-2', label: 'decoration-solid', text: 'Solid underline' },
              { cls: 'underline decoration-dashed decoration-amber-500 underline-offset-2', label: 'decoration-dashed', text: 'Dashed underline' },
              { cls: 'underline decoration-dotted decoration-emerald-500 underline-offset-2', label: 'decoration-dotted', text: 'Dotted underline' },
              { cls: 'underline decoration-wavy decoration-rose-500 underline-offset-4', label: 'decoration-wavy', text: 'Wavy underline' },
              { cls: 'underline decoration-double decoration-violet-500 underline-offset-2', label: 'decoration-double', text: 'Double underline' },
            ].map(({ cls, label, text }) => (
              <div key={label}>
                <code className="text-[10px] font-mono text-slate-400 block mb-0.5">{label}</code>
                <span className={`text-slate-700 dark:text-slate-300 ${cls}`}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Other decorations */}
        <div>
          <Label>Other Decorations</Label>
          <div className="space-y-3 mt-2 text-sm">
            <div>
              <code className="text-[10px] font-mono text-slate-400 block mb-0.5">line-through</code>
              <span className="line-through text-slate-500">Discontinued feature</span>
            </div>
            <div>
              <code className="text-[10px] font-mono text-slate-400 block mb-0.5">overline</code>
              <span className="overline text-slate-700 dark:text-slate-300">Overline heading text</span>
            </div>
            <div>
              <code className="text-[10px] font-mono text-slate-400 block mb-0.5">no-underline</code>
              <a href="#" onClick={(e) => e.preventDefault()} className="no-underline text-primary-600 dark:text-primary-400">No underline link</a>
            </div>
            <div>
              <code className="text-[10px] font-mono text-slate-400 block mb-0.5">line-through decoration-red-500</code>
              <span className="line-through decoration-red-500 decoration-2 text-slate-700 dark:text-slate-300">Price $99.00 → $49.00</span>
            </div>
            <div>
              <code className="text-[10px] font-mono text-slate-400 block mb-0.5">decoration-4</code>
              <span className="underline decoration-4 decoration-primary-400 underline-offset-4 text-slate-700 dark:text-slate-300 font-semibold">Thick underline emphasis</span>
            </div>
          </div>
        </div>

        {/* Truncation */}
        <div>
          <Label>Truncation & Clamping</Label>
          <div className="space-y-4 mt-2 text-sm">
            <div>
              <code className="text-[10px] font-mono text-slate-400 block mb-1">truncate</code>
              <div className="w-48 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
                <p className="truncate text-slate-700 dark:text-slate-300">This very long title will be truncated with ellipsis</p>
              </div>
            </div>
            <div>
              <code className="text-[10px] font-mono text-slate-400 block mb-1">line-clamp-2</code>
              <div className="w-48 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
                <p className="line-clamp-2 text-slate-600 dark:text-slate-400">This paragraph continues beyond two lines and will be clamped. The third line and beyond will be hidden gracefully.</p>
              </div>
            </div>
            <div>
              <code className="text-[10px] font-mono text-slate-400 block mb-1">line-clamp-3</code>
              <div className="w-48 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
                <p className="line-clamp-3 text-slate-600 dark:text-slate-400">A three-line clamp is perfect for card previews and search results. It shows enough context without overwhelming the layout or pushing other cards out of alignment.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── NEW 16. Content Badges & Labels ──────────────────────────────────────────
function ContentBadgesSection() {
  return (
    <Section title="Content Badges & Labels" span="lg:col-span-2">
      <div className="space-y-6">

        {/* Inline content labels */}
        <div>
          <Label>Inline Content Labels — Pill Style</Label>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {[
              { text: 'New', cls: 'bg-primary-600 text-white' },
              { text: 'Hot', cls: 'bg-rose-500 text-white' },
              { text: 'Beta', cls: 'bg-amber-500 text-white' },
              { text: 'Pro', cls: 'bg-violet-600 text-white' },
              { text: 'Sale', cls: 'bg-emerald-600 text-white' },
              { text: 'Popular', cls: 'bg-cyan-600 text-white' },
              { text: 'Free', cls: 'bg-slate-700 text-white' },
              { text: 'Limited', cls: 'bg-red-600 text-white' },
            ].map(({ text, cls }) => (
              <span key={text} className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${cls}`}>{text}</span>
            ))}
          </div>
        </div>

        {/* Square style */}
        <div>
          <Label>Inline Content Labels — Square Style</Label>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {[
              { text: 'NEW', cls: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800' },
              { text: 'HOT', cls: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800' },
              { text: 'BETA', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' },
              { text: 'PRO', cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800' },
              { text: 'SALE', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' },
              { text: 'TOP', cls: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800' },
            ].map(({ text, cls }) => (
              <span key={text} className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest ${cls}`}>{text}</span>
            ))}
          </div>
        </div>

        {/* Badges in context */}
        <div>
          <Label>Badges In Context — Navigation & Menu Items</Label>
          <div className="mt-2 space-y-1 max-w-xs">
            {[
              { label: 'Dashboard', badge: null },
              { label: 'Components', badge: { text: 'New', cls: 'bg-primary-600 text-white' } },
              { label: 'Documentation', badge: { text: 'Beta', cls: 'bg-amber-500 text-white' } },
              { label: 'Pricing', badge: { text: 'Sale', cls: 'bg-emerald-600 text-white' } },
              { label: 'Pro Features', badge: { text: 'Pro', cls: 'bg-violet-600 text-white' } },
              { label: 'Analytics', badge: { text: '3', cls: 'bg-rose-500 text-white' } },
            ].map(({ label, badge }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{label}</span>
                {badge && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>{badge.text}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Feature comparison badges */}
        <div>
          <Label>Feature / Pricing Badges</Label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { plan: 'Starter', badge: 'Free', badgeCls: 'bg-slate-700 text-white', features: ['5 projects', '2GB storage', 'Community support'] },
              { plan: 'Pro', badge: 'Popular', badgeCls: 'bg-primary-600 text-white', features: ['50 projects', '50GB storage', 'Priority support'] },
              { plan: 'Enterprise', badge: 'Sale 20%', badgeCls: 'bg-emerald-600 text-white', features: ['Unlimited', '1TB storage', 'Dedicated support'] },
            ].map(({ plan, badge, badgeCls, features }) => (
              <div key={plan} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{plan}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeCls}`}>{badge}</span>
                </div>
                <ul className="space-y-1.5">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <CheckCircle size={11} className="text-emerald-500 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── NEW 17. Text with Icons ───────────────────────────────────────────────────
function TextWithIconsSection() {
  return (
    <Section title="Text with Icons" span="lg:col-span-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">

        {/* Checklist with icons */}
        <div>
          <Label>Feature Checklist</Label>
          <ul className="space-y-2.5 mt-2">
            {[
              'Real-time collaboration',
              'Automatic backups',
              'End-to-end encryption',
              'Role-based permissions',
              'Custom domain support',
            ].map(item => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Warning / alert text */}
        <div>
          <Label>Warning & Alert Text</Label>
          <div className="space-y-3 mt-2">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">Your trial expires in 3 days. Upgrade to avoid interruption.</p>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800">
              <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">Two-factor authentication is not enabled on your account.</p>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800">
              <Info size={15} className="text-primary-500 shrink-0 mt-0.5" />
              <p className="text-xs text-primary-800 dark:text-primary-300 leading-relaxed">A new version of the app is available. Refresh to update.</p>
            </div>
          </div>
        </div>

        {/* Stats text */}
        <div>
          <Label>Stats & Metrics Text</Label>
          <div className="space-y-3 mt-2">
            {[
              { icon: TrendingUp, value: '+42%', label: 'Growth this quarter', color: 'text-emerald-500' },
              { icon: Star, value: '4.9/5', label: 'Average rating', color: 'text-amber-500' },
              { icon: Zap, value: '200ms', label: 'Average load time', color: 'text-primary-500' },
              { icon: User, value: '128k', label: 'Active users', color: 'text-violet-500' },
            ].map(({ icon: Icon, value, label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 ${color}`}>
                  <Icon size={15} />
                </div>
                <div>
                  <p className={`text-base font-bold leading-none ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Icon + text nav items */}
        <div>
          <Label>Navigation Items with Icons</Label>
          <nav className="space-y-1 mt-2">
            {[
              { icon: TrendingUp, label: 'Analytics', badge: 'New', badgeCls: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' },
              { icon: Star, label: 'Favorites', badge: '12', badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
              { icon: Zap, label: 'Automations', badge: 'Beta', badgeCls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
              { icon: CheckCircle, label: 'Completed', badge: '48', badgeCls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
            ].map(({ icon: Icon, label, badge, badgeCls }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <Icon size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeCls}`}>{badge}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* Inline icon text */}
        <div>
          <Label>Inline Icon Text Patterns</Label>
          <div className="space-y-3 mt-2 text-sm text-slate-600 dark:text-slate-400">
            <p className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400 shrink-0" />
              Last updated 2 hours ago
            </p>
            <p className="flex items-center gap-2">
              <User size={14} className="text-slate-400 shrink-0" />
              Created by <span className="text-slate-800 dark:text-slate-200 font-medium ml-1">Alex Thompson</span>
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500 shrink-0" />
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Deployment successful</span>
            </p>
            <p className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span className="text-amber-700 dark:text-amber-400 font-medium">3 warnings detected</span>
            </p>
            <p className="flex items-center gap-2">
              <TrendingUp size={14} className="text-primary-500 shrink-0" />
              Revenue up <strong className="text-primary-600 dark:text-primary-400 ml-1">+18%</strong> this month
            </p>
          </div>
        </div>

        {/* CTA text patterns */}
        <div>
          <Label>CTA Text Patterns</Label>
          <div className="space-y-3 mt-2">
            <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:gap-3 transition-all">
              View all features <ArrowRight size={14} />
            </a>
            <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:gap-3 transition-all">
              <CheckCircle size={14} /> Start free trial
            </a>
            <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:gap-3 transition-all">
              <Zap size={14} /> Upgrade to Pro
            </a>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Info size={14} className="text-primary-400 shrink-0" />
              No credit card required
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Star size={14} className="text-amber-400 shrink-0" />
              Rated 4.9 by 2,400+ teams
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── NEW 18. Prose Article Preview Card ────────────────────────────────────────
function ProsePreviewSection() {
  return (
    <Section title="Prose — Rich Article Preview" span="lg:col-span-2">
      <div className="space-y-6">
        <p className="text-sm text-slate-500">A complete editorial card layout demonstrating how typography components combine into a premium reading experience.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Full article card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Header image placeholder */}
            <div className="h-40 bg-primary-500 flex items-end p-5">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-sm border border-white/30">Design Systems</span>
            </div>

            <div className="p-6">
              {/* Meta */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center">
                  <User size={12} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">Alex Thompson</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Senior Designer</p>
                </div>
                <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><Clock size={10} />8 min</span>
                  <span>Mar 11, 2026</span>
                </div>
              </div>

              {/* Headline */}
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug mb-2">
                Why Typography Is the Most Underrated Part of Your Design System
              </h2>

              {/* Lead */}
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3 mb-4">
                Teams spend weeks on color palettes and component APIs, then ship inconsistent type scales. Here's how to fix that — and why it will make everything else feel more cohesive.
              </p>

              {/* Pull quote */}
              <blockquote className="border-l-3 border-primary-400 pl-3 py-1 mb-4">
                <p className="text-sm italic text-slate-600 dark:text-slate-400 leading-relaxed">
                  "Good typography is invisible. Bad typography screams."
                </p>
              </blockquote>

              {/* Tags + CTA */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex gap-1.5">
                  {['Type', 'CSS', 'UX'].map(t => (
                    <span key={t} className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">#{t}</span>
                  ))}
                </div>
                <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:gap-2 transition-all">
                  Read more <ArrowRight size={12} />
                </a>
              </div>
            </div>
          </div>

          {/* Compact list cards */}
          <div className="space-y-4">
            {[
              {
                cat: 'Tutorial', catCls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
                title: 'Mastering Line Height for Better Readability',
                excerpt: 'A practical guide to leading values that work across all screen densities and type sizes.',
                time: '5 min', date: 'Mar 9',
                author: 'Jordan Lee',
              },
              {
                cat: 'Deep Dive', catCls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
                title: 'Fluid Typography with CSS clamp()',
                excerpt: 'Responsive font scaling without media queries. Set it once and let the browser handle the rest.',
                time: '12 min', date: 'Mar 7',
                author: 'Sam Rivera',
              },
              {
                cat: 'Quick Tip', catCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                title: 'When to Use Tracking and When to Avoid It',
                excerpt: 'Letter spacing adds elegance to uppercase labels but destroys lowercase body text legibility.',
                time: '3 min', date: 'Mar 5',
                author: 'Casey Morgan',
              },
            ].map(({ cat, catCls, title, excerpt, time, date, author }) => (
              <div key={title} className="flex gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all cursor-pointer group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${catCls}`}>{cat}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{excerpt}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><User size={9} /> {author}</span>
                    <span className="flex items-center gap-1"><Clock size={9} /> {time}</span>
                    <span>{date}</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center">
                  <ArrowRight size={14} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TypographyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Typography"
        subtitle="Headings, body text, font weights, colors, gradient text, display sizes, letter spacing, line height, decorations, badges, icon patterns, and full prose examples"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HeadingsSection />
        <BodyTextSection />
        <FontWeightsSection />
        <TextColorsSection />
        <SpecialTextSection />
        <BlockquotesSection />
        <BadgesSection />
        <ListsSection />
        <LinksSection />
        <TextBackgroundsSection />

        {/* ── New premium sections ── */}
        <GradientTextSection />
        <DisplaySizesSection />
        <ArticleTextSection />
        <SpacingRhythmSection />
        <TextDecorationSection />
        <ContentBadgesSection />
        <TextWithIconsSection />
        <ProsePreviewSection />
      </div>
    </div>
  )
}
