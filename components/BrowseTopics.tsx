'use client'

import Link from 'next/link'
import { useDeferredValue, useState } from 'react'
import { BrowseTopicItem } from '@/lib/browse-directory'

type BrowseSort = 'new' | 'popular' | 'waiting'

interface Props {
  topics: BrowseTopicItem[]
  waitingCount: number
}

const sortOptions: Array<{ key: BrowseSort; label: string }> = [
  { key: 'new', label: 'New' },
  { key: 'popular', label: 'Popular' },
  { key: 'waiting', label: 'Waiting' },
]

function formatDate(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function BrowseTopics({ topics, waitingCount }: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<BrowseSort>('new')
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  const filteredTopics = [...topics]
    .filter((topic) => {
      if (!normalizedQuery) {
        return true
      }

      const haystack = [
        topic.headline,
        topic.summary,
        ...topic.sampleDaes,
        ...topic.keywords,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
    .sort((a, b) => {
      if (sort === 'popular') {
        const popularityA = a.daeCount * 2 + a.matchedCount + a.waitingCount * 3
        const popularityB = b.daeCount * 2 + b.matchedCount + b.waitingCount * 3

        if (popularityB !== popularityA) {
          return popularityB - popularityA
        }
      }

      if (sort === 'waiting') {
        if (b.waitingCount !== a.waitingCount) {
          return b.waitingCount - a.waitingCount
        }
      }

      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
    })

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 space-y-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shows, places, situations"
              className="w-full rounded-2xl border border-[var(--dae-line)] bg-[var(--dae-surface)] px-4 py-3 text-sm text-[var(--dae-ink)] placeholder:text-[var(--dae-muted)] focus:border-[var(--dae-accent-rose)] focus:outline-none"
            />
            <p className="text-xs text-[var(--dae-muted)]">
              {filteredTopics.length} {filteredTopics.length === 1 ? 'topic' : 'topics'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sortOptions.map((option) => {
              const isActive = option.key === sort

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSort(option.key)}
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

            {waitingCount > 0 ? (
              <Link
                href="/review"
                className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-3 py-1.5 text-sm font-medium text-[var(--dae-accent-warm)] hover:opacity-95"
              >
                Review {waitingCount}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {filteredTopics.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-8 text-center text-sm text-[var(--dae-muted)] shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
          Nothing matched that search.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredTopics.map((topic) => (
            <article
              key={topic.id}
              className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-rose)]">
                    {topic.daeCount} {topic.daeCount === 1 ? 'idea' : 'ideas'}
                  </span>
                  {topic.waitingCount > 0 ? (
                    <span className="rounded-full bg-[var(--dae-accent-warm-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-warm)]">
                      {topic.waitingCount} waiting
                    </span>
                  ) : null}
                  {topic.matchedCount > 0 ? (
                    <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-cool)]">
                      {topic.matchedCount} connected
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-[var(--dae-muted)]">{formatDate(topic.latestAt)}</p>
              </div>

              <p className="mt-4 text-xl font-semibold leading-8 text-[var(--dae-ink)]">{topic.headline}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--dae-muted)]">{topic.summary}</p>

              {topic.keywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {topic.keywords.map((keyword) => (
                    <button
                      key={`${topic.id}-${keyword}`}
                      type="button"
                      onClick={() => setQuery(keyword)}
                      className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-muted)] hover:border-[var(--dae-accent-rose)] hover:text-[var(--dae-accent-rose)]"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              ) : null}

              {topic.sampleDaes.length > 1 ? (
                <div className="mt-4 space-y-2">
                  {topic.sampleDaes.slice(1).map((sample) => (
                    <div
                      key={`${topic.id}-${sample}`}
                      className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3 text-sm leading-6 text-[var(--dae-muted)]"
                    >
                      {sample}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/submit?draft=${encodeURIComponent(topic.headline)}#submit-form`}
                  scroll={false}
                  className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent)] hover:opacity-95"
                >
                  Use
                </Link>
                {waitingCount > 0 ? (
                  <Link
                    href="/review"
                    className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
                  >
                    Review
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
