'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useState } from 'react'
import { BrowseTopicItem } from '@/lib/browse-directory'
import FollowTopicButton from './FollowTopicButton'

type BrowseSort = 'trending' | 'new' | 'waiting'
type BrowseFilter = 'all' | 'trending' | 'waiting' | 'connected' | 'fresh'

interface Props {
  topics: BrowseTopicItem[]
  waitingCount: number
  initialQuery?: string
  followedTopicKeys?: string[]
}

const sortOptions: Array<{ key: BrowseSort; label: string }> = [
  { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'New' },
  { key: 'waiting', label: 'Waiting' },
]

const filterOptions: Array<{ key: BrowseFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'trending', label: 'Trending' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'connected', label: 'Connected' },
  { key: 'fresh', label: 'Fresh' },
]

function formatDate(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getSignalLabel(topic: BrowseTopicItem) {
  if (topic.freshCount >= 3) {
    return `${topic.freshCount} new today`
  }

  if (topic.recentCount >= 4) {
    return `${topic.recentCount} this week`
  }

  if (topic.waitingCount > 0) {
    return `${topic.waitingCount} waiting`
  }

  return `${topic.matchedCount} connected`
}

export default function BrowseTopics({
  topics,
  waitingCount,
  initialQuery = '',
  followedTopicKeys = [],
}: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState<BrowseSort>('trending')
  const [filter, setFilter] = useState<BrowseFilter>('all')
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim().toLowerCase()
  const followedTopicKeySet = new Set(followedTopicKeys)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const filteredTopics = [...topics]
    .filter((topic) => {
      if (filter === 'trending' && topic.trendScore < 8) {
        return false
      }

      if (filter === 'waiting' && topic.waitingCount === 0) {
        return false
      }

      if (filter === 'connected' && topic.matchedCount === 0) {
        return false
      }

      if (filter === 'fresh' && topic.freshCount === 0) {
        return false
      }

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
      if (sort === 'trending') {
        if (b.trendScore !== a.trendScore) {
          return b.trendScore - a.trendScore
        }
      }

      if (sort === 'waiting') {
        if (b.waitingCount !== a.waitingCount) {
          return b.waitingCount - a.waitingCount
        }
      }

      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
    })
  const visibleIdeaCount = filteredTopics.reduce((total, topic) => total + topic.daeCount, 0)
  const visibleWaitingCount = filteredTopics.reduce((total, topic) => total + topic.waitingCount, 0)
  const visibleTrendingCount = filteredTopics.filter((topic) => topic.trendScore >= 8).length

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start">
          <div className="space-y-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by keyword, show, habit, feeling"
              className="w-full rounded-2xl border border-[var(--dae-line)] bg-[var(--dae-surface)] px-4 py-3 text-sm text-[var(--dae-ink)] placeholder:text-[var(--dae-muted)] focus:border-[var(--dae-accent-rose)] focus:outline-none"
            />
            <p className="text-xs text-[var(--dae-muted)]">
              Browse stays at the topic and DAE level. Room conversations stay inside chats.
            </p>
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
                        ? 'border-[var(--dae-accent-rose)] bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)]'
                        : 'border-[var(--dae-line)] bg-white text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                  Ideas
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--dae-ink)]">{visibleIdeaCount}</p>
              </div>
              <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                  Waiting
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--dae-ink)]">{visibleWaitingCount}</p>
              </div>
              <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                  Rising
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--dae-ink)]">{visibleTrendingCount}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/topics"
                className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
              >
                Open hubs
              </Link>
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
                  Place {waitingCount}
                </Link>
              ) : null}
            </div>

            <p className="text-xs text-[var(--dae-muted)]">
              {filteredTopics.length} {filteredTopics.length === 1 ? 'topic' : 'topics'} in view
            </p>
          </div>
        </div>
      </section>

      {filteredTopics.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-8 text-center text-sm text-[var(--dae-muted)] shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
          Nothing matched that search.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredTopics.map((topic) => (
            <article
              key={topic.id}
              className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)] md:p-5"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-rose)]">
                      {topic.label}
                    </p>
                    {topic.trendScore >= 8 ? (
                      <span className="rounded-full bg-[var(--dae-accent)] px-2.5 py-1 text-[11px] font-medium text-white">
                        Rising
                      </span>
                    ) : null}
                    {topic.waitingCount > 0 ? (
                      <span className="rounded-full bg-[var(--dae-accent-warm-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-accent-warm)]">
                        {topic.waitingCount} waiting
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xl font-semibold leading-8 text-[var(--dae-ink)]">{topic.headline}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--dae-muted)]">{topic.summary}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--dae-muted)]">
                    <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 font-medium">
                      {topic.daeCount} {topic.daeCount === 1 ? 'DAE' : 'DAEs'}
                    </span>
                    <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 font-medium">
                      {topic.uniqueUserCount} {topic.uniqueUserCount === 1 ? 'person' : 'people'}
                    </span>
                    <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 font-medium">
                      {getSignalLabel(topic)}
                    </span>
                    <span>{formatDate(topic.latestAt)}</span>
                  </div>

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
                </div>

                <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                    Example DAEs
                  </p>
                  <div className="mt-3 space-y-2">
                    {topic.sampleDaes.slice(0, 3).map((sample) => (
                      <div
                        key={`${topic.id}-${sample}`}
                        className="rounded-2xl bg-white px-3 py-2.5 text-sm leading-6 text-[var(--dae-muted)]"
                      >
                        {sample}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/topics/${encodeURIComponent(topic.topicKey)}`}
                  className="rounded-full border border-[var(--dae-accent-rose)] bg-[var(--dae-accent-rose-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-rose)] hover:opacity-95"
                >
                  Explore topic
                </Link>
                <Link
                  href={`/submit?draft=${encodeURIComponent(topic.headline)}#submit-form`}
                  scroll={false}
                  className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent)] hover:opacity-95"
                >
                  Start from this
                </Link>
                {waitingCount > 0 ? (
                  <Link
                    href={`/review?topic=${encodeURIComponent(topic.headline)}`}
                    className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-warm)] hover:opacity-95"
                  >
                    Attach a waiting DAE
                  </Link>
                ) : null}
                <FollowTopicButton
                  topicKey={topic.topicKey}
                  headline={topic.headline}
                  label={topic.label}
                  searchQuery={topic.searchQuery}
                  initialFollowing={followedTopicKeySet.has(topic.topicKey)}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
