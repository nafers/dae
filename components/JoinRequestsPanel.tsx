'use client'

import { useEffect, useState } from 'react'
import { ThreadJoinRequest } from '@/lib/thread-join-requests'

interface Props {
  matchId: string
  initialRequests: ThreadJoinRequest[]
}

function getSourceLabel(source: ThreadJoinRequest['source']) {
  if (source === 'invite_review') return 'Invite'
  if (source === 'submit_near_match') return 'Submit'
  if (source === 'topic_hub') return 'Topic'
  if (source === 'review_suggestion' || source === 'manual_review') return 'Place'
  return 'Room'
}

export default function JoinRequestsPanel({ matchId, initialRequests }: Props) {
  const [requests, setRequests] = useState<ThreadJoinRequest[]>(initialRequests)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    setRequests(initialRequests)
  }, [initialRequests])

  useEffect(() => {
    let isMounted = true

    async function refreshRequests() {
      try {
        const response = await fetch(`/api/thread-join-requests?matchId=${encodeURIComponent(matchId)}`, {
          cache: 'no-store',
        })
        const data = await response.json()

        if (isMounted && response.ok && Array.isArray(data?.requests)) {
          setRequests(data.requests)
        }
      } catch {
        // Quiet polling fallback.
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshRequests()
      }
    }, 5000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [matchId])

  async function respond(requestId: string, action: 'approve' | 'decline') {
    if (busyId) return

    setBusyId(requestId)

    try {
      const response = await fetch('/api/thread-join-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          requestId,
          matchId,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to update request.')
      }

      setRequests((current) => current.filter((request) => request.requestId !== requestId))
    } catch (error) {
      console.error('Join request response failed:', error)
    } finally {
      setBusyId('')
    }
  }

  if (requests.length === 0) {
    return null
  }

  return (
    <div className="mt-3 rounded-[24px] border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-warm)]">
        Requests to join
      </p>
      <div className="mt-3 space-y-2">
        {requests.map((request) => (
          <div
            key={request.requestId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/85 px-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--dae-ink)]">{request.daeText}</p>
              {request.fitScore !== null || request.fitReason ? (
                <p className="mt-1 text-[11px] text-[var(--dae-muted)]">
                  {request.fitScore !== null ? `${Math.round(request.fitScore * 100)}% fit` : 'Fit pending'}
                  {request.fitReason ? ` | ${request.fitReason}` : ''}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--dae-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-muted)]">
                  {getSourceLabel(request.source)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    request.fitScore !== null && request.fitScore >= 0.56
                      ? 'bg-[var(--dae-accent-soft)] text-[var(--dae-accent)]'
                      : 'bg-[var(--dae-accent-warm-soft)] text-[var(--dae-accent-warm)]'
                  }`}
                >
                  {request.fitScore !== null && request.fitScore >= 0.56 ? 'Strong fit' : 'Needs approval'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--dae-muted)]">
                Requested {new Date(request.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void respond(request.requestId, 'approve')}
                disabled={busyId === request.requestId}
                className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--dae-accent)] hover:opacity-95 disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => void respond(request.requestId, 'decline')}
                disabled={busyId === request.requestId}
                className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)] disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
