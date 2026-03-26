'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import type { TopicRegistryItem } from '@/lib/topic-registry'
import FollowTopicButton from './FollowTopicButton'
import ShareButton from './ShareButton'

type TopicFilter = 'all' | 'following' | 'rising' | 'fresh' | 'pinned'
type TopicSort = 'activity' | 'people' | 'ideas'

interface Props {
  topics: TopicRegistryItem[]
  waitingCount: number
}

const filters: Array<{ key: TopicFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'following', label: 'Following' },
  { key: 'rising', label: 'Rising' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'pinned', label: 'Pinned' },
]

const sorts: Array<{ key: TopicSort; label: string }> = [
  { key: 'activity', label: 'Active' },
  { key: 'people', label: 'People' },
  { key: 'ideas', label: 'Ideas' },
]

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function TopicCatalog({ topics, waitingCount }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TopicFilter>('all')
  const [sort, setSort] = useState<TopicSort>('activity')
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  const visibleTopics = useMemo(() => {
    return [...topics]
      .filter((topic) => {
        if (filter === 'following' && !topic.isFollowed) return false
        if (filter === 'rising' && topic.trendScore < 8) return false
        if (filter === 'fresh' && topic.freshCount === 0) return false
        if (filter === 'pinned' && !topic.isPinned) return false

        if (!normalizedQuery) {
          return true
        }

        const haystack = [
          topic.label,
          topic.headline,
          topic.summary,
          topic.searchQuery,
          ...topic.keywords,
          ...topic.sampleDaes,
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(normalizedQuery)
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1
        }

        if (sort === 'people' && b.uniqueUserCount !== a.uniqueUserCount) {
          return b.uniqueUserCount - a.uniqueUserCount
        }

        if (sort === 'ideas' && b.daeCount !== a.daeCount) {
          return b.daeCount - a.daeCount
        }

        if (b.trendScore !== a.trendScore) {
          return b.trendScore - a.trendScore
        }

        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
      })
  }, [filter, normalizedQuery, sort, topics])

  const followedCount = visibleTopics.filter((topic) => topic.isFollowed).length
  const risingCount = visibleTopics.filter((topic) => topic.trendScore >= 8).length
  const freshCount = visibleTopics.filter((topic) => topic.freshCount > 0).length

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:items-start">
          <div className="space-y-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics by keyword, feeling, show, habit"
              className="w-full rounded-2xl border border-[var(--dae-line)] bg-[var(--dae-surface)] px-4 py-3 text-sm text-[var(--dae-ink)] placeholder:text-[var(--dae-muted)] focus:border-[var(--dae-accent-rose)] focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {filters.map((option) => {
                const active = option.key === filter

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilter(option.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                      active
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
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                  Topics
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--dae-ink)]">{visibleTopics.length}</p>
              </div>
              <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                  Following
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--dae-ink)]">{followedCount}</p>
              </div>
              <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                  Rising
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--dae-ink)]">{risingCount}</p>
              </div>
              <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                  Fresh
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--dae-ink)]">{freshCount}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {sorts.map((option) => {
                const active = option.key === sort

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSort(option.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                      active
                        ? 'border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)]'
                        : 'border-[var(--dae-line)] bg-white text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
              <Link
                href={waitingCount > 0 ? '/review' : '/submit'}
                className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-3 py-1.5 text-sm font-medium text-[var(--dae-accent-warm)] hover:opacity-95"
              >
                {waitingCount > 0 ? `Place ${waitingCount}` : 'Submit'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {visibleTopics.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-8 text-center text-sm text-[var(--dae-muted)] shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
          No topic hubs matched that search.
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleTopics.map((topic) => (
            <article
              key={topic.topicKey}
              className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)] md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-rose)]">
                      {topic.label}
                    </span>
                    {topic.isPinned ? (
                      <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-cool)]">
                        Pinned
                      </span>
                    ) : null}
                    {topic.isFollowed ? (
                      <span className="rounded-full bg-[var(--dae-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent)]">
                        Following
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold leading-8 text-[var(--dae-ink)]">{topic.headline}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--dae-muted)]">{topic.summary}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                    {topic.daeCount} ideas
                  </span>
                  <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                    {topic.uniqueUserCount} people
                  </span>
                  <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                    {formatTimestamp(topic.latestAt)}
                  </span>
                </div>
              </div>

              {topic.keywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {topic.keywords.map((keyword) => (
                    <button
                      key={`${topic.topicKey}-${keyword}`}
                      type="button"
                      onClick={() => setQuery(keyword)}
                      className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-muted)] hover:border-[var(--dae-accent-rose)] hover:text-[var(--dae-accent-rose)]"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {topic.sampleDaes.slice(0, 3).map((sample) => (
                  <div
                    key={`${topic.topicKey}-${sample}`}
                    className="rounded-2xl bg-[var(--dae-surface)] px-3 py-2.5 text-sm leading-6 text-[var(--dae-muted)]"
                  >
                    {sample}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/topics/${encodeURIComponent(topic.topicKey)}`}
                  className="rounded-full border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-cool)] hover:opacity-95"
                >
                  Open topic
                </Link>
                <Link
                  href={`/submit?draft=${encodeURIComponent(topic.headline)}`}
                  className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent)] hover:opacity-95"
                >
                  Start from this
                </Link>
                {waitingCount > 0 ? (
                  <Link
                    href={`/review?topic=${encodeURIComponent(topic.headline)}`}
                    className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-warm)] hover:opacity-95"
                  >
                    Place waiting DAE
                  </Link>
                ) : null}
                <FollowTopicButton
                  topicKey={topic.topicKey}
                  headline={topic.headline}
                  label={topic.label}
                  searchQuery={topic.searchQuery}
                  initialFollowing={topic.isFollowed}
                />
                <ShareButton
                  path={`/topics/${encodeURIComponent(topic.topicKey)}`}
                  title={`DAE topic: ${topic.label}`}
                  text={topic.summary}
                  label="Share"
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
