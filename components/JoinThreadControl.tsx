'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { canAutoJoinThreadWithFitScore } from '@/lib/thread-join-policy'

interface WaitingDaeOption {
  id: string
  text: string
}

interface JoinSourceContext {
  source:
    | 'review_suggestion'
    | 'invite_review'
    | 'topic_hub'
    | 'submit_near_match'
    | 'manual_review'
  fitScore?: number
  fitReason?: string
  topic?: string
}

interface Props {
  matchId: string
  availableDaes: WaitingDaeOption[]
  defaultDaeId?: string
  initialRequestedDaeIds?: string[]
  joinLocked?: boolean
  sourceContext?: JoinSourceContext
}

export default function JoinThreadControl({
  matchId,
  availableDaes,
  defaultDaeId,
  initialRequestedDaeIds = [],
  joinLocked = false,
  sourceContext,
}: Props) {
  const router = useRouter()
  const [selectedDaeId, setSelectedDaeId] = useState(defaultDaeId ?? availableDaes[0]?.id ?? '')
  const [requesting, setRequesting] = useState(false)
  const [requestedDaeIds, setRequestedDaeIds] = useState<string[]>(initialRequestedDaeIds)
  const [error, setError] = useState('')
  const requested = selectedDaeId ? requestedDaeIds.includes(selectedDaeId) : false
  const fitScore = typeof sourceContext?.fitScore === 'number' ? sourceContext.fitScore : null
  const canAutoJoin = canAutoJoinThreadWithFitScore(fitScore)
  const fitPercent = fitScore === null ? null : Math.round(fitScore * 100)
  const policyLabel = joinLocked ? 'Paused' : canAutoJoin ? 'Auto-admit' : 'Needs room approval'
  const policyDetail = joinLocked
    ? 'A founder paused new joins for this room.'
    : canAutoJoin
      ? `Strong fit (${fitPercent ?? 0}%). You can join right away.`
      : requested
        ? 'Waiting for someone in the room to approve.'
        : fitScore !== null
          ? `${fitPercent ?? 0}% fit. Someone in the room has to admit it.`
          : 'Send your waiting DAE into Place for this room.'
  const policySubdetail =
    joinLocked
      ? 'You can still keep following the topic and come back later.'
      : canAutoJoin
        ? 'You will enter immediately with a fresh anonymous handle for this room.'
        : requested
          ? 'Once approved, your DAE will attach to this room and you will land in the chat.'
          : 'This keeps weaker rescue fits from dropping directly into a room unannounced.'

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
      const response = await fetch(canAutoJoin ? '/api/threads/join' : '/api/thread-join-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          canAutoJoin
            ? {
                matchId,
                daeId: selectedDaeId,
                sourceContext,
              }
            : {
                action: 'request',
                matchId,
                daeId: selectedDaeId,
                sourceContext,
              }
        ),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : canAutoJoin
              ? 'Unable to join this chat.'
              : 'Unable to request this chat.'
        )
      }

      if (canAutoJoin) {
        router.push(`/threads/${matchId}`)
        return
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
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-medium ${
            joinLocked
              ? 'bg-[var(--dae-surface)] text-[var(--dae-muted)]'
              : canAutoJoin
                ? 'bg-[var(--dae-accent-soft)] text-[var(--dae-accent)]'
                : 'bg-[var(--dae-accent-warm-soft)] text-[var(--dae-accent-warm)]'
          }`}
        >
          {policyLabel}
        </span>
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
              ? canAutoJoin
                ? 'Joining...'
                : 'Requesting...'
              : requested
                ? 'Requested'
                : canAutoJoin
                  ? 'Join now'
                  : 'Request to join'}
        </button>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-[var(--dae-muted)]">{policyDetail}</p>
        <p className="text-[11px] text-[var(--dae-muted)]/80">{policySubdetail}</p>
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
