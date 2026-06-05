// Renders a comment body, turning @[Name](user:ID) tokens into highlighted chips.
// Mirrors the backend token format in tracker/mentions.py.

const MENTION_RE = /@\[([^\]]+)\]\(user:(\d+)\)/g

export default function MentionText({ body, className = '' }) {
  if (!body) return null
  const nodes = []
  let last = 0
  let m
  MENTION_RE.lastIndex = 0
  let key = 0
  while ((m = MENTION_RE.exec(body)) !== null) {
    if (m.index > last) nodes.push(body.slice(last, m.index))
    nodes.push(
      <span
        key={`mn-${key++}`}
        className="font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 rounded px-1"
      >
        @{m[1]}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < body.length) nodes.push(body.slice(last))

  return <p className={`whitespace-pre-wrap break-words ${className}`}>{nodes}</p>
}
