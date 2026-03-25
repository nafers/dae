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
  initialRequestedDaeIds?: string[]
  joinLocked?: boolean
}

export default function JoinThreadControl({
  matchId,
  availableDaes,
  defaultDaeId,
  initialRequestedDaeIds = [],
  joinLocked = false,
}: Props) {
  const router = useRouter()
  const [selectedDaeId, setSelectedDaeId] = useState(defaultDaeId ?? availableDaes[0]?.id ?? '')
  const [requesting, setRequesting] = useState(false)
  const [requestedDaeIds, setRequestedDaeIds] = useState<string[]>(initialRequestedDaeIds)
  const [error, setError] = useState('')
  const requested = selectedDaeId ? requestedDaeIds.includes(selectedDaeId) : false

  useEffect(() => {
    setSelectedDaeId(defaultDaeId ?? availableDaes[0]?.id ?? '')
    setRequestedDaeIds(initialRequestedDaeIds)
    setError('')
  }, [availableDaes, defaultDaeId, initialRequestedDaeIds])

  async function requestJoin() {
    if (!selectedDaeId || requesting || requested || joinLocked) return

    setRequesting(true)
    setError('')

    try {
      const response = await fetch('/api/thread-join-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'request',
          matchId,
          daeId: selectedDaeId,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Unable to request this chat.'
        )
      }

      setRequestedDaeIds((current) =>
        current.includes(selectedDaeId) ? current : [...current, selectedDaeId]
      )
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to request this chat.')
    } finally {
      setRequesting(false)
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
          onClick={() => void requestJoin()}
          disabled={!selectedDaeId || requesting || requested || joinLocked}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            joinLocked
              ? 'border border-[var(--dae-line)] bg-[var(--dae-surface)] text-[var(--dae-muted)]'
              : requested
              ? 'border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)]'
              : 'bg-[var(--dae-accent-rose)] text-white hover:opacity-95'
          }`}
        >
          {joinLocked
            ? 'Joins paused'
            : requesting
              ? 'Requesting...'
              : requested
                ? 'Requested'
                : 'Request to join'}
        </button>
        <p className="text-xs text-[var(--dae-muted)]">
          {joinLocked
            ? 'A founder paused new joins for this room.'
            : requested
              ? 'Waiting for someone in the room to approve.'
              : 'Send your waiting DAE into review for this room.'}
        </p>
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
