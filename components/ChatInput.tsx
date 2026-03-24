'use client'

import { useRef, useState } from 'react'

interface Props {
  onSend: (content: string) => Promise<void>
  error?: string
}

export default function ChatInput({ onSend, error = '' }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const previousText = text
    setSending(true)
    setText('')

    try {
      await onSend(trimmed)
      textareaRef.current?.focus()
    } catch {
      setText(previousText)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  return (
    <div
      className="flex flex-shrink-0 items-end gap-2 border-t border-[var(--dae-line)] bg-[var(--dae-surface)] px-4 py-3"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          rows={1}
          className="max-h-32 w-full resize-none overflow-y-auto rounded-[22px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-4 py-3 text-sm text-[var(--dae-ink)] placeholder:text-[var(--dae-muted)] focus:border-[var(--dae-accent)] focus:outline-none"
          style={{ minHeight: '42px' }}
        />
        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>
      <button
        onClick={() => void handleSend()}
        disabled={!text.trim() || sending}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--dae-accent)] text-white transition-all hover:opacity-95 disabled:opacity-40"
        aria-label="Send message"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
