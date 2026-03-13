'use client'

import { useState, useRef } from 'react'

interface Props {
  onSend: (content: string) => Promise<void>
}

export default function ChatInput({ onSend }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    setText('')
    await onSend(trimmed)
    setSending(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="flex-shrink-0 bg-white border-t border-stone-200 px-4 py-3 flex gap-2 items-end"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        rows={1}
        className="flex-1 resize-none bg-stone-100 rounded-xl px-4 py-2.5 text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 max-h-32 overflow-y-auto"
        style={{ minHeight: '42px' }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending}
        className="flex-shrink-0 w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-stone-700 transition-colors"
        aria-label="Send message"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
