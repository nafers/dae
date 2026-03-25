'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ActivityItem } from '@/lib/activity'

type ActivityFilter = 'all' | 'rooms' | 'requests' | 'following' | 'waiting'

interface Props {
  initialItems: ActivityItem[]
}

const toneClasses = {
  cool: 'bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)]',
  warm: 'bg-[var(--dae-accent-warm-soft)] text-[var(--dae-accent-warm)]',
  rose: 'bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)]',
} as const

const filterOptions: Array<{ key: ActivityFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'requests', label: 'Requests' },
  { key: 'following', label: 'Following' },
  { key: 'waiting', label: 'Waiting' },
]

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function matchesFilter(item: ActivityItem, filter: ActivityFilter) {
  if (filter === 'all') return true
  if (filter === 'rooms') return item.kind === 'reply' || item.kind === 'match'
  if (filter === 'requests') return item.kind === 'request'
  if (filter === 'following') return item.kind === 'follow'
  return item.kind === 'waiting'
}

function getBadgeLabel(item: ActivityItem) {
  switch (item.kind) {
    case 'reply':
      return 'New reply'
    case 'match':
      return 'New room'
    case 'request':
      return 'Join request'
    case 'follow':
      return 'Following'
    default:
      return 'Still waiting'
  }
}

export default function ActivityFeed({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [busyId, setBusyId] = useState('')

  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [filter, items]
  )

  async function dismissItem(itemId: string) {
    if (busyId) return

    setBusyId(itemId)

    try {
      const response = await fetch('/api/activity/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
        }),
      })

      if (response.ok) {
        setItems((current) => current.filter((item) => item.id !== itemId))
      }
    } finally {
      setBusyId('')
    }
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => {
          const isActive = option.key === filter

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                isActive
                  ? 'border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)]'
                  : 'border-[var(--dae-line)] bg-white text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-6 text-sm text-[var(--dae-muted)]">
          Nothing in that section right now.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_10px_26px_rgba(32,26,22,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link href={item.href} className="min-w-0 flex-1">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${toneClasses[item.tone]}`}>
                    {getBadgeLabel(item)}
                  </span>
                  <h2 className="mt-3 text-lg font-semibold text-[var(--dae-ink)]">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--dae-muted)]">{item.detail}</p>
                  <p className="mt-3 text-[11px] text-[var(--dae-muted)]">{formatTimestamp(item.timestamp)}</p>
                </Link>

                <button
                  type="button"
                  onClick={() => void dismissItem(item.id)}
                  disabled={busyId === item.id}
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)] disabled:opacity-60"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
