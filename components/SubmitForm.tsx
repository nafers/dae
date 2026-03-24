'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialText?: string
}

export default function SubmitForm({ initialText = '' }: Props) {
  const [text, setText] = useState(initialText)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [error, setError] = useState('')
  const router = useRouter()

  const charCount = text.length
  const maxChars = 280
  const minChars = 10

  useEffect(() => {
    setText(initialText)
    setError('')
    setStatus('idle')
  }, [initialText])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (text.length < minChars) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/embed-and-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong.')
        setStatus('error')
      } else if (data.status === 'matched') {
        router.push(`/threads/${data.matchId}`)
        return
      } else {
        setStatus('waiting')
      }
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'waiting') {
    return (
      <div className="space-y-4 rounded-[28px] border border-[var(--dae-accent-warm)]/30 bg-[var(--dae-accent-warm-soft)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-warm)]">
              Waiting
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--dae-ink)]">Still looking</h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
            {charCount}/{maxChars}
          </span>
        </div>

        <div className="rounded-2xl bg-white/80 px-4 py-3">
          <p className="text-sm leading-6 text-[var(--dae-ink)]">{text}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setText('')
              setError('')
              setStatus('idle')
            }}
            className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent)] hover:opacity-95"
          >
            New
          </button>
          <Link
            href="/review"
            className="rounded-full border border-[var(--dae-accent-warm)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-accent-warm)] hover:bg-[var(--dae-accent-warm-soft)]"
          >
            Review
          </Link>
          <Link
            href="/browse"
            className="rounded-full border border-[var(--dae-accent-rose)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-accent-rose)] hover:bg-[var(--dae-accent-rose-soft)]"
          >
            Browse
          </Link>
          <Link
            href="/threads"
            className="rounded-full border border-[var(--dae-accent-cool)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-accent-cool)] hover:bg-[var(--dae-accent-cool-soft)]"
          >
            Chats
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="dae-text" className="text-sm font-semibold text-[var(--dae-ink)]">
            Does anyone else?
          </label>
          <span className={`text-xs ${charCount > maxChars * 0.9 ? 'text-[var(--dae-accent-warm)]' : 'text-[var(--dae-muted)]'}`}>
            {charCount}/{maxChars}
          </span>
        </div>

        <textarea
          id="dae-text"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, maxChars))}
          placeholder="love the way Scrubs still holds up"
          rows={5}
          className="mt-4 w-full resize-none bg-transparent text-lg leading-8 text-[var(--dae-ink)] placeholder:text-stone-400 focus:outline-none"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--dae-muted)]">10-280 chars.</p>
          {charCount < minChars && charCount > 0 ? (
            <span className="text-xs text-[var(--dae-muted)]">{minChars - charCount} more</span>
          ) : null}
        </div>
      </div>

      {error ? <p className="px-1 text-sm text-red-500">{error}</p> : null}

      <button
        type="submit"
        disabled={loading || charCount < minChars}
        className="w-full rounded-2xl bg-[var(--dae-accent)] px-6 py-3 text-base font-medium text-white transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Matching...' : 'Post'}
      </button>
    </form>
  )
}
