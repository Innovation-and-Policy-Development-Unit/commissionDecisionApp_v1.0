import { useState } from 'react'

// Single-codepoint-ish emoji only (no joined sequences), so each fits a reaction.
const GROUPS = [
  ['😀', ['😀','😃','😄','😁','😆','😅','😂','🤣','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😋','😛','😜','🤪','🤗','🤔','🤐','😐','😑','😶','😏','😒','🙄','😬','😌','😔','😪','😴','😷','🤒','🤕','🤢','🥵','🥶','😵','🤯','🥳','😎','🤓','😕','😟','🙁','😮','😲','😳','🥺','😢','😭','😱','😖','😞','😓','😩','😫','😤','😡','😠','🤬','😈','💀','💩','🤡','👻','👽','🤖']],
  ['👍', ['👍','👎','👌','✌️','🤞','🤟','🤘','👈','👉','👆','👇','✋','🤚','👋','🤙','💪','🙏','👏','🙌','👐','🤝','✍️','🙋','🤷','🤦','💁','🙇','👀','🧠']],
  ['❤️', ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','💖','💗','💯','💥','💫','💦','🔥','⭐','🌟','✨','⚡','🎉','🎊','🎈','🎁','🏆','🥇','🎯']],
  ['🐶', ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐢','🐍','🐙','🐠','🐬','🐳','🦋','🐝','🌸','🌺','🌻','🌴','🌿','🍀','🌈','☀️','🌙','☁️','🌧️','🌊']],
  ['🍎', ['🍎','🍌','🍉','🍇','🍓','🍍','🥥','🥭','🍋','🍊','🥕','🌽','🍔','🍟','🍕','🌭','🍗','🍖','🍚','🍜','🍣','🍰','🍪','🍩','☕','🍵','🥤','🍺','🍷']],
  ['✅', ['✅','❌','⚠️','❓','❗','➕','➖','✔️','📌','📎','📝','📄','📁','📅','📞','💻','📱','📷','🔔','🔒','🔑','⏰','⌛','🚀','🚗','✈️','🏠','🏢','🌍','💡','📣','👍🏽']],
]

const RECENT_KEY = 'scdms-chat-recent-emoji'
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] } }
const saveRecent = (e) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...readRecent().filter((x) => x !== e)].slice(0, 16))) } catch { /* private mode */ }
}

/** Compact emoji grid with category tabs and "recently used". `onPick(emoji)` gets the character. */
export default function EmojiPicker({ onPick, className = '' }) {
  const recent = readRecent()
  const groups = recent.length ? [['🕘', recent], ...GROUPS] : GROUPS
  const [tab, setTab] = useState(0)
  const pick = (e) => { saveRecent(e); onPick(e) }
  return (
    <div className={`w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg ${className}`}>
      <div className="flex border-b border-slate-100 dark:border-slate-700 px-1">
        {groups.map(([icon], i) => (
          <button key={icon + i} type="button" onClick={() => setTab(i)} aria-label={`Emoji group ${i + 1}`}
            className={`flex-1 py-1.5 text-base leading-none ${tab === i ? 'border-b-2 border-primary-500' : 'opacity-60 hover:opacity-100'}`}>{icon}</button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 p-1.5 h-40 overflow-y-auto">
        {(groups[tab] || groups[0])[1].map((e) => (
          <button key={e} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => pick(e)}
            className="text-xl leading-none p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">{e}</button>
        ))}
      </div>
    </div>
  )
}
