'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Props {
  active?: boolean
}

export default function ActivityNav({ active = false }: Props) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSummary() {
      try {
        const response = await fetch('/api/activity/summary', {
          cache: 'no-store',
        })
        const data = await response.json()

        if (isMounted && response.ok && typeof data?.count === 'number') {
          setCount(data.count)
        }
      } catch {
        // Quiet fallback. The link still works without a badge.
      }
    }

    void loadSummary()
    const intervalId = window.setInterval(() => {
      void loadSummary()
    }, 30000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <Link
      href="/activity"
      className={`relative rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
        active
          ? 'border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)]'
          : 'border-[var(--dae-line)] bg-[var(--dae-surface-strong)] text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
      }`}
    >
      Activity
      {count && count > 0 ? (
        <span className="ml-2 inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-[var(--dae-accent-cool)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  )
}
