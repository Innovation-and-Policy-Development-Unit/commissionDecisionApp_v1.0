import { useChat } from '../../context/ChatContext'
import FloatingChatWindow from './FloatingChatWindow'

/** Renders every popped-out chat as a Messenger-style window stacked along
 * the bottom-right of the viewport. Mounted once, globally, in Layout so
 * windows survive route navigation. */
export default function FloatingChatWindows() {
  const { openWindows } = useChat()

  if (openWindows.length === 0) return null

  return (
    <div className="fixed bottom-0 end-4 z-40 flex flex-row-reverse items-end gap-3 pointer-events-none">
      {openWindows.map((w) => (
        <div key={w.id} className="pointer-events-auto">
          <FloatingChatWindow conversationId={w.id} minimized={w.minimized} />
        </div>
      ))}
    </div>
  )
}
