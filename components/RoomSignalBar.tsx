'use client'

import { useState } from 'react'
import type { RoomSignalType } from '@/lib/quality-signals'

interface Props {
  matchId: string
  initialCounts: {
    usefulCount: number
    notQuiteCount: number
  }
  initialSignal: RoomSignalType | null
}

export default function RoomSignalBar({ matchId, initialCounts, initialSignal }: Props) {
  const [counts, setCounts] = useState(initialCounts)
  const [selectedSignal, setSelectedSignal] = useState<RoomSignalType | null>(initialSignal)
  const [busySignal, setBusySignal] = useState<RoomSignalType | null>(null)

  async function submitSignal(nextSignal: RoomSignalType) {
    if (busySignal || selectedSignal === nextSignal) {
      return
    }

    const previousSignal = selectedSignal
    const previousCounts = counts
    setBusySignal(nextSignal)
    setSelectedSignal(nextSignal)
    setCounts((current) => ({
      usefulCount:
        current.usefulCount + (nextSignal === 'useful' ? 1 : 0) - (previousSignal === 'useful' ? 1 : 0),
      notQuiteCount:
        current.notQuiteCount +
        (nextSignal === 'not_quite' ? 1 : 0) -
        (previousSignal === 'not_quite' ? 1 : 0),
    }))

    try {
      const response = await fetch('/api/quality-signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: 'room',
          matchId,
          signal: nextSignal,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to save room signal.')
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
        onClick={() => void submitSignal('useful')}
        disabled={busySignal !== null}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60 ${
          selectedSignal === 'useful'
            ? 'border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)]'
            : 'border-[var(--dae-line)] bg-white text-[var(--dae-muted)] hover:border-[var(--dae-accent-cool)] hover:text-[var(--dae-accent-cool)]'
        }`}
      >
        Useful {counts.usefulCount > 0 ? counts.usefulCount : ''}
      </button>
      <button
        type="button"
        onClick={() => void submitSignal('not_quite')}
        disabled={busySignal !== null}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60 ${
          selectedSignal === 'not_quite'
            ? 'border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] text-[var(--dae-accent-warm)]'
            : 'border-[var(--dae-line)] bg-white text-[var(--dae-muted)] hover:border-[var(--dae-accent-warm)] hover:text-[var(--dae-accent-warm)]'
        }`}
      >
        Not quite {counts.notQuiteCount > 0 ? counts.notQuiteCount : ''}
      </button>
    </div>
  )
}
