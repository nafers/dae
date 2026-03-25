'use client'

import { useState } from 'react'
import type { TopicSignalType } from '@/lib/quality-signals'

interface Props {
  topicKey: string
  headline: string
  label: string
  initialCounts: {
    sameHereCount: number
    notForMeCount: number
  }
  initialSignal: TopicSignalType | null
}

export default function TopicSignalBar({
  topicKey,
  headline,
  label,
  initialCounts,
  initialSignal,
}: Props) {
  const [counts, setCounts] = useState(initialCounts)
  const [selectedSignal, setSelectedSignal] = useState<TopicSignalType | null>(initialSignal)
  const [busySignal, setBusySignal] = useState<TopicSignalType | null>(null)

  async function submitSignal(nextSignal: TopicSignalType) {
    if (busySignal || selectedSignal === nextSignal) {
      return
    }

    const previousSignal = selectedSignal
    const previousCounts = counts
    setBusySignal(nextSignal)
    setSelectedSignal(nextSignal)
    setCounts((current) => ({
      sameHereCount:
        current.sameHereCount + (nextSignal === 'same_here' ? 1 : 0) - (previousSignal === 'same_here' ? 1 : 0),
      notForMeCount:
        current.notForMeCount +
        (nextSignal === 'not_for_me' ? 1 : 0) -
        (previousSignal === 'not_for_me' ? 1 : 0),
    }))

    try {
      const response = await fetch('/api/quality-signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: 'topic',
          topicKey,
          headline,
          label,
          signal: nextSignal,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to save topic signal.')
      }
    } catch {
      setSelectedSignal(previousSignal)
      setCounts(previousCounts)
    } finally {
      setBusySignal(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void submitSignal('same_here')}
        disabled={busySignal !== null}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60 ${
          selectedSignal === 'same_here'
            ? 'border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] text-[var(--dae-accent)]'
            : 'border-[var(--dae-line)] bg-white text-[var(--dae-muted)] hover:border-[var(--dae-accent)] hover:text-[var(--dae-accent)]'
        }`}
      >
        Same here {counts.sameHereCount > 0 ? counts.sameHereCount : ''}
      </button>
      <button
        type="button"
        onClick={() => void submitSignal('not_for_me')}
        disabled={busySignal !== null}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60 ${
          selectedSignal === 'not_for_me'
            ? 'border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] text-[var(--dae-accent-warm)]'
            : 'border-[var(--dae-line)] bg-white text-[var(--dae-muted)] hover:border-[var(--dae-accent-warm)] hover:text-[var(--dae-accent-warm)]'
        }`}
      >
        Not for me {counts.notForMeCount > 0 ? counts.notForMeCount : ''}
      </button>
    </div>
  )
}
