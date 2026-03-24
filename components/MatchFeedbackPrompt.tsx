'use client'

import { useState } from 'react'

interface Props {
  matchId: string
  initialFeedback: 'good' | 'bad' | null
}

export default function MatchFeedbackPrompt({ matchId, initialFeedback }: Props) {
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(initialFeedback)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submitFeedback(verdict: 'good' | 'bad') {
    if (feedback || submitting) return

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/match-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          verdict,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to save feedback.')
      }

      setFeedback(verdict)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border-t border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--dae-ink)]">Good match?</p>
          {feedback ? (
            <p className="text-xs text-[var(--dae-muted)]">
              {feedback === 'good' ? 'Saved as good.' : 'Saved as weak.'}
            </p>
          ) : null}
        </div>

        {feedback ? null : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submitFeedback('good')}
              disabled={submitting}
              className="rounded-full bg-[var(--dae-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Yes'}
            </button>
            <button
              type="button"
              onClick={() => void submitFeedback('bad')}
              disabled={submitting}
              className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)] disabled:opacity-50"
            >
              No
            </button>
          </div>
        )}
      </div>

      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
