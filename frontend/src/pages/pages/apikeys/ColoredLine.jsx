const COLOR_MAP = {
  keyword:  'text-violet-400',
  string:   'text-emerald-400',
  comment:  'text-slate-500',
  function: 'text-sky-400',
  number:   'text-amber-400',
  plain:    'text-slate-300',
}

const PATTERNS = [
  { re: /(#.*$|\/\/.*$)/g,                                                  type: 'comment'  },
  { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,          type: 'string'   },
  { re: /\b(curl|import|from|const|await|print|async|new|return|let|var|if|else)\b/g, type: 'keyword' },
  { re: /\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g,                                type: 'function' },
  { re: /\b(\d+)\b/g,                                                       type: 'number'   },
]

export default function ColoredLine({ raw }) {
  const marks = []

  PATTERNS.forEach(({ re, type }) => {
    re.lastIndex = 0
    let m
    while ((m = re.exec(raw)) !== null) {
      const s = m.index
      const e = m.index + m[0].length
      const overlaps = marks.some(mk => s < mk.end && e > mk.start)
      if (!overlaps) marks.push({ start: s, end: e, type })
    }
  })

  marks.sort((a, b) => a.start - b.start)

  const tokens = []
  let cursor = 0
  marks.forEach(mk => {
    if (cursor < mk.start) tokens.push({ type: 'plain', value: raw.slice(cursor, mk.start) })
    tokens.push({ type: mk.type, value: raw.slice(mk.start, mk.end) })
    cursor = mk.end
  })
  if (cursor < raw.length) tokens.push({ type: 'plain', value: raw.slice(cursor) })

  return (
    <span>
      {tokens.map((tok, i) => (
        <span key={i} className={COLOR_MAP[tok.type] || 'text-slate-300'}>{tok.value}</span>
      ))}
    </span>
  )
}
