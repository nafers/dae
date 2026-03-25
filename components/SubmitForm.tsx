'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialText?: string
}

const starterPrompts = [
  'replay a conversation for hours after it ends',
  'love the way Scrubs still holds up',
  'hear your heartbeat in your ear sometimes',
  'mentally rehearse ordering before it is your turn',
]

function normalizePrompt(value: string) {
  return value
    .replace(/^\s*does\s+anyone\s+else[\s,.!?-]*/i, '')
    .replace(/^\.\.\.\s*/, '')
    .trim()
}

function getPromptTips(rawText: string) {
  const normalizedText = normalizePrompt(rawText)
  const tips: string[] = []

  if (!rawText.trim()) {
    return [
      'Lead with the specific habit, thought, or feeling. The app already supplies the opening words.',
      'Specific beats broad. "replay a conversation for hours" will match better than "overthink things."',
    ]
  }

  if (rawText.trim() !== normalizedText) {
    tips.push('No need to type "Does anyone else?" again. The app adds it for you.')
  }

  if (normalizedText.length > 0 && normalizedText.length < 28) {
    tips.push('Add the odd detail. The more specific version usually matches better.')
  }

  if (
    !/\b(always|sometimes|mentally|randomly|replay|rehearse|check|count|hear|love|hate|wish|feel|keep|avoid|watch)\b/i.test(
      normalizedText
    )
  ) {
    tips.push('Try phrasing it as the actual thing you do or notice, not a category.')
  }

  return tips.slice(0, 2)
}

export default function SubmitForm({ initialText = '' }: Props) {
  const [text, setText] = useState(initialText)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [error, setError] = useState('')
  const router = useRouter()

  const normalizedText = normalizePrompt(text)
  const charCount = normalizedText.length
  const maxChars = 280
  const minChars = 10
  const promptTips = getPromptTips(text)

  useEffect(() => {
    setText(initialText)
    setError('')
    setStatus('idle')
  }, [initialText])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (normalizedText.length < minChars) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/embed-and-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: normalizedText }),
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
          <p className="text-sm leading-6 text-[var(--dae-ink)]">{normalizedText}</p>
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
          <span
            className={`text-xs ${
              charCount > maxChars * 0.9 ? 'text-[var(--dae-accent-warm)]' : 'text-[var(--dae-muted)]'
            }`}
          >
            {charCount}/{maxChars}
          </span>
        </div>

        <textarea
          id="dae-text"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, maxChars + 24))}
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

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent)]">
              Better matches
            </p>
            <div className="mt-2 space-y-1">
              {promptTips.map((tip) => (
                <p key={tip} className="text-xs leading-5 text-[var(--dae-muted)]">
                  {tip}
                </p>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
              Starter prompts
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setText(prompt)}
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-accent)] hover:text-[var(--dae-accent)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
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
