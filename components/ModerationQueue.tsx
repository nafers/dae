'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ModerationReportItem } from '@/lib/moderation'

interface Props {
  initialItems: ModerationReportItem[]
}

type QueueFilter = 'open' | 'reviewed'

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ModerationQueue({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [filter, setFilter] = useState<QueueFilter>('open')
  const [busyKey, setBusyKey] = useState('')

  const visibleItems = useMemo(
    () => items.filter((item) => (filter === 'open' ? !item.reviewedAt : Boolean(item.reviewedAt))),
    [filter, items]
  )

  async function reviewReport(reportKey: string, matchId: string | null, decision: 'reviewed' | 'watch' | 'follow_up') {
    if (busyKey) {
      return
    }

    setBusyKey(reportKey)

    try {
      const response = await fetch('/api/moderation/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportKey,
          matchId,
          decision,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to update report.')
      }

      setItems((current) =>
        current.map((item) =>
          item.reportKey === reportKey
            ? {
                ...item,
                reviewedAt: new Date().toISOString(),
                decision,
              }
            : item
        )
      )
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'open' as const, label: 'Open' },
          { key: 'reviewed' as const, label: 'Reviewed' },
        ].map((option) => {
          const isActive = option.key === filter

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                isActive
                  ? 'border-[var(--dae-accent-rose)] bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)]'
                  : 'border-[var(--dae-line)] bg-white text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-6 text-sm text-[var(--dae-muted)]">
          Nothing in this queue.
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleItems.map((item) => (
            <article
              key={item.reportKey}
              className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-rose)]">
                      {item.reason}
                    </span>
                    <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                      {item.matchId ? `Room ${item.matchId.slice(0, 8)}` : 'No room'}
                    </span>
                    {item.decision ? (
                      <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-cool)]">
                        {item.decision.replace('_', ' ')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-[var(--dae-muted)]">
                    Reported {formatTimestamp(item.createdAt)}
                    {item.reporterId ? ` by user ${item.reporterId.slice(0, 8)}` : ''}
                  </p>
                  {item.room ? (
                    <div className="mt-3 rounded-[24px] bg-[var(--dae-surface)] px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                        Room snapshot
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[var(--dae-ink)]">
                        {item.room.participants[0]?.daeText ?? 'Shared room'}
                      </p>
                      <p className="mt-2 text-sm text-[var(--dae-muted)]">
                        {item.room.participantCount} people · {item.room.lastMessageSenderLabel}: {item.room.lastMessagePreview}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {item.matchId ? (
                    <Link
                      href={`/threads/${item.matchId}`}
                      className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                    >
                      Open room
                    </Link>
                  ) : null}
                  {!item.reviewedAt ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void reviewReport(item.reportKey, item.matchId, 'reviewed')}
                        disabled={busyKey === item.reportKey}
                        className="rounded-full border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-cool)] disabled:opacity-60"
                      >
                        Reviewed
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewReport(item.reportKey, item.matchId, 'watch')}
                        disabled={busyKey === item.reportKey}
                        className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-warm)] disabled:opacity-60"
                      >
                        Watch
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewReport(item.reportKey, item.matchId, 'follow_up')}
                        disabled={busyKey === item.reportKey}
                        className="rounded-full border border-[var(--dae-accent-rose)] bg-[var(--dae-accent-rose-soft)] px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-rose)] disabled:opacity-60"
                      >
                        Follow up
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--dae-muted)]">
                      Reviewed {item.reviewedAt ? formatTimestamp(item.reviewedAt) : ''}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
