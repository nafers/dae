'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface WaitingDaeOption {
  id: string
  text: string
}

interface Props {
  matchId: string
  availableDaes: WaitingDaeOption[]
  defaultDaeId?: string
}

export default function JoinThreadControl({ matchId, availableDaes, defaultDaeId }: Props) {
  const router = useRouter()
  const [selectedDaeId, setSelectedDaeId] = useState(defaultDaeId ?? availableDaes[0]?.id ?? '')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSelectedDaeId(defaultDaeId ?? availableDaes[0]?.id ?? '')
    setError('')
  }, [availableDaes, defaultDaeId])

  async function joinThread() {
    if (!selectedDaeId || joining) return

    setJoining(true)
    setError('')

    try {
      const response = await fetch('/api/threads/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          daeId: selectedDaeId,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to join this chat.')
      }

      router.push(`/threads/${matchId}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to join this chat.')
      setJoining(false)
    }
  }

  if (availableDaes.length === 0) {
    return null
  }

  const showSelector = !defaultDaeId && availableDaes.length > 1

  return (
    <div className="flex min-w-[220px] flex-1 flex-col gap-2">
      {showSelector ? (
        <select
          value={selectedDaeId}
          onChange={(event) => setSelectedDaeId(event.target.value)}
          className="rounded-2xl border border-[var(--dae-line)] bg-[var(--dae-surface)] px-3 py-2.5 text-sm text-[var(--dae-ink)] focus:border-[var(--dae-accent)] focus:outline-none"
        >
          {availableDaes.map((dae) => (
            <option key={dae.id} value={dae.id}>
              {dae.text}
            </option>
          ))}
        </select>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void joinThread()}
          disabled={!selectedDaeId || joining}
          className="rounded-full bg-[var(--dae-accent-rose)] px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {joining ? 'Joining...' : 'Join with this DAE'}
        </button>
        <p className="text-xs text-[var(--dae-muted)]">Adds your waiting prompt to this room.</p>
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
