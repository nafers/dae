'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  matchId: string
  initialMuted?: boolean
  initialHidden?: boolean
}

type ExitMode = 'leave' | 'detach'
type ThreadAction = 'mute' | 'unmute' | 'hide' | 'unhide' | 'report'

const reportReasons = [
  { value: 'not-a-fit', label: 'Not a fit' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'other', label: 'Other' },
]

export default function ThreadExitControls({
  matchId,
  initialMuted = false,
  initialHidden = false,
}: Props) {
  const router = useRouter()
  const [pendingMode, setPendingMode] = useState<ExitMode | null>(null)
  const [pendingAction, setPendingAction] = useState<ThreadAction | null>(null)
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(initialMuted)
  const [hidden, setHidden] = useState(initialHidden)
  const [reportReason, setReportReason] = useState(reportReasons[0]?.value ?? 'not-a-fit')

  async function submitExit(mode: ExitMode) {
    if (pendingMode || pendingAction) return

    setPendingMode(mode)
    setError('')

    try {
      const response = await fetch('/api/threads/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          mode,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to update this chat.')
      }

      router.push(typeof data?.redirectTo === 'string' ? data.redirectTo : '/threads')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update this chat.')
      setPendingMode(null)
    }
  }

  async function submitAction(action: ThreadAction) {
    if (pendingMode || pendingAction) return

    setPendingAction(action)
    setError('')

    try {
      const response = await fetch('/api/threads/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          action,
          reason: action === 'report' ? reportReason : undefined,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to update this chat.')
      }

      if (action === 'mute') {
        setMuted(true)
      }

      if (action === 'unmute') {
        setMuted(false)
      }

      if (action === 'hide') {
        setHidden(true)
        router.push('/threads?hidden=1')
        return
      }

      if (action === 'unhide') {
        setHidden(false)
      }

      if (action === 'report') {
        router.refresh()
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update this chat.')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-[var(--dae-surface)] px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-rose)]">
            Room controls
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {muted ? (
              <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-accent-cool)]">
                Muted
              </span>
            ) : null}
            {hidden ? (
              <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-accent-rose)]">
                Hidden
              </span>
            ) : null}
            <p className="text-xs text-[var(--dae-muted)]">Detach also deletes your messages.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submitAction(muted ? 'unmute' : 'mute')}
          disabled={pendingMode !== null || pendingAction !== null}
          className="rounded-full border border-[var(--dae-accent-cool)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-cool)] hover:bg-[var(--dae-accent-cool-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAction === 'mute' || pendingAction === 'unmute'
            ? muted
              ? 'Unmuting...'
              : 'Muting...'
            : muted
              ? 'Unmute'
              : 'Mute'}
        </button>
        <button
          type="button"
          onClick={() => void submitAction(hidden ? 'unhide' : 'hide')}
          disabled={pendingMode !== null || pendingAction !== null}
          className="rounded-full border border-[var(--dae-accent-rose)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-rose)] hover:bg-[var(--dae-accent-rose-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAction === 'hide' || pendingAction === 'unhide'
            ? hidden
              ? 'Restoring...'
              : 'Hiding...'
            : hidden
              ? 'Unhide'
              : 'Hide'}
        </button>
        <button
          type="button"
          onClick={() => void submitExit('leave')}
          disabled={pendingMode !== null || pendingAction !== null}
          className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingMode === 'leave' ? 'Leaving...' : 'Leave'}
        </button>
        <button
          type="button"
          onClick={() => void submitExit('detach')}
          disabled={pendingMode !== null || pendingAction !== null}
          className="rounded-full bg-[var(--dae-accent-rose)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingMode === 'detach' ? 'Detaching...' : 'Detach'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
          disabled={pendingMode !== null || pendingAction !== null}
          className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-ink)] focus:border-[var(--dae-accent-rose)] focus:outline-none disabled:opacity-50"
        >
          {reportReasons.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void submitAction('report')}
          disabled={pendingMode !== null || pendingAction !== null}
          className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAction === 'report' ? 'Reporting...' : 'Report'}
        </button>
      </div>

      {error ? <p className="w-full text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
