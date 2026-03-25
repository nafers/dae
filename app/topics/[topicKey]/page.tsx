import { after } from 'next/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import FollowTopicButton from '@/components/FollowTopicButton'
import ShareButton from '@/components/ShareButton'
import ThreadOverviewCard from '@/components/ThreadOverviewCard'
import TopicCurationControls from '@/components/TopicCurationControls'
import TopicSignalBar from '@/components/TopicSignalBar'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { isFounderEmail } from '@/lib/founders'
import { fetchTopicHubData, fetchTopicByKey } from '@/lib/topic-hubs'
import { buildTopicActivityFeed } from '@/lib/topic-activity'
import { fetchTopicCurationStates, getTopicCurationState } from '@/lib/topic-curation'
import { fetchRelatedTopics } from '@/lib/topic-registry'
import { fetchTopicSignalSummaries } from '@/lib/quality-signals'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchActiveTopicFollows } from '@/lib/topic-follows'

interface Props {
  params: Promise<{
    topicKey: string
  }>
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default async function TopicHubPage({ params }: Props) {
  const { topicKey } = await params
  const user = await getRequestUser()
  const topic = await fetchTopicByKey(topicKey)

  if (!topic) {
    notFound()
  }

  const founder = isFounderEmail(user?.email)
  const topicCurationState = getTopicCurationState(
    await fetchTopicCurationStates([topic.topicKey]),
    topic.topicKey
  )

  if (topicCurationState.hidden && !founder) {
    notFound()
  }

  const [{ waitingPrompts, relatedRooms }, signalMap, followedTopics, waitingCount, relatedTopics] = await Promise.all([
    fetchTopicHubData({
      topic,
      currentUserId: user?.id ?? null,
    }),
    fetchTopicSignalSummaries({
      topicKeys: [topic.topicKey],
      currentUserId: user?.id ?? null,
    }),
    user ? fetchActiveTopicFollows(user.id) : Promise.resolve(new Map()),
    user
      ? createAdminClient()
          .from('daes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'unmatched')
          .then((result) => result.count ?? 0)
      : Promise.resolve(0),
    fetchRelatedTopics(topic.topicKey, 4),
  ])

  const signalSummary = signalMap.get(topic.topicKey)
  const following = followedTopics.has(topic.topicKey)
  const activityItems = buildTopicActivityFeed({
    relatedRooms,
    waitingPrompts,
  }).slice(0, 6)

  after(async () => {
    if (!user) {
      return
    }

    await trackAnalyticsEvent({
      eventName: 'topic_hub_opened',
      userId: user.id,
      metadata: {
        topicKey: topic.topicKey,
      },
    })
  })

  return (
    <AppShell
      activeTab="browse"
      userEmail={user?.email ?? ''}
      eyebrow="Topic"
      title={topic.headline}
      description={topic.summary}
    >
      <div className="space-y-5">
        <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-rose)]">
                  {topic.label}
                </span>
                {topicCurationState.pinned ? (
                  <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-cool)]">
                    Pinned
                  </span>
                ) : null}
                {topicCurationState.hidden ? (
                  <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                    Hidden from browse
                  </span>
                ) : null}
                <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                  {topic.daeCount} {topic.daeCount === 1 ? 'idea' : 'ideas'}
                </span>
                <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                  {topic.uniqueUserCount} {topic.uniqueUserCount === 1 ? 'person' : 'people'}
                </span>
                <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                  {relatedRooms.length} active room{relatedRooms.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--dae-muted)]">
                Latest activity {formatTimestamp(topic.latestAt)}
              </p>
            </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/topics"
              className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
            >
              All topics
            </Link>
            <Link
              href={user ? `/submit?draft=${encodeURIComponent(topic.headline)}` : `/?next=${encodeURIComponent(`/submit?draft=${topic.searchQuery}`)}`}
              className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent)] hover:opacity-95"
              >
                Start from this
              </Link>
              {user ? (
                <Link
                  href={waitingCount > 0 ? `/review?topic=${encodeURIComponent(topic.headline)}` : '/submit'}
                  className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-warm)] hover:opacity-95"
                >
                  {waitingCount > 0 ? 'Attach a waiting DAE' : 'Submit yours'}
                </Link>
              ) : (
                <Link
                  href={`/?next=${encodeURIComponent(`/topics/${topic.topicKey}`)}`}
                  className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-warm)] hover:opacity-95"
                >
                  Sign in to join
                </Link>
              )}
              <ShareButton
                path={`/topics/${encodeURIComponent(topic.topicKey)}`}
                title={`DAE topic: ${topic.label}`}
                text={topic.summary}
                label="Share topic"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {topic.keywords.map((keyword) => (
              <span
                key={`${topic.topicKey}-${keyword}`}
                className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-muted)]"
              >
                {keyword}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {signalSummary ? (
              <TopicSignalBar
                topicKey={topic.topicKey}
                headline={topic.headline}
                label={topic.label}
                initialCounts={{
                  sameHereCount: signalSummary.sameHereCount,
                  notForMeCount: signalSummary.notForMeCount,
                }}
                initialSignal={signalSummary.mySignal}
              />
            ) : null}
            {user ? (
              <FollowTopicButton
                topicKey={topic.topicKey}
                headline={topic.headline}
                label={topic.label}
                searchQuery={topic.searchQuery}
                initialFollowing={following}
              />
            ) : null}
            {founder ? (
              <TopicCurationControls
                topicKey={topic.topicKey}
                initialHidden={topicCurationState.hidden}
                initialPinned={topicCurationState.pinned}
              />
            ) : null}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
                    Active rooms
                  </p>
                  <p className="mt-1 text-sm text-[var(--dae-muted)]">
                    Anonymous rooms people are already using for this idea.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {relatedRooms.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                    No active rooms yet.
                  </div>
                ) : (
                  relatedRooms.map((thread) => (
                    <ThreadOverviewCard
                      key={thread.matchId}
                      thread={thread}
                      compact
                      showLatestActivity={false}
                      primaryAction={
                        thread.isJoined ? (
                          <Link
                            href={`/threads/${thread.matchId}`}
                            className="rounded-full border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-cool)] hover:opacity-95"
                          >
                            Open
                          </Link>
                        ) : (
                          <Link
                            href={user ? `/review?invite=${encodeURIComponent(thread.matchId)}` : `/?next=${encodeURIComponent(`/review?invite=${thread.matchId}`)}`}
                            className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-warm)] hover:opacity-95"
                          >
                            {user ? 'See fit' : 'Sign in to join'}
                          </Link>
                        )
                      }
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
                Topic activity
              </p>
              <p className="mt-1 text-sm text-[var(--dae-muted)]">
                The latest motion around this idea, across rooms and still-waiting prompts.
              </p>

              <div className="mt-4 space-y-2">
                {activityItems.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                    Quiet right now.
                  </div>
                ) : (
                  activityItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block rounded-2xl bg-[var(--dae-surface)] px-4 py-3 transition-colors hover:bg-white"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                        {item.kind === 'room' ? 'Room activity' : 'Waiting prompt'}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--dae-ink)]">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--dae-muted)]">{item.detail}</p>
                      <p className="mt-1 text-[11px] text-[var(--dae-muted)]">{formatTimestamp(item.timestamp)}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-rose)]">
                Nearby topics
              </p>
              <p className="mt-1 text-sm text-[var(--dae-muted)]">
                Other hubs that feel close to the same underlying idea.
              </p>

              <div className="mt-4 space-y-2">
                {relatedTopics.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                    Nothing nearby yet.
                  </div>
                ) : (
                  relatedTopics.map((relatedTopic) => (
                    <Link
                      key={relatedTopic.topicKey}
                      href={`/topics/${encodeURIComponent(relatedTopic.topicKey)}`}
                      className="block rounded-2xl bg-[var(--dae-surface)] px-4 py-3 transition-colors hover:bg-white"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-rose)]">
                        {relatedTopic.label}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--dae-ink)]">{relatedTopic.headline}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--dae-muted)]">{relatedTopic.summary}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-warm)]">
                Waiting prompts
              </p>
              <p className="mt-1 text-sm text-[var(--dae-muted)]">
                Recent DAEs circling this topic, even if they have not landed in a room yet.
              </p>

              <div className="mt-4 space-y-2">
                {waitingPrompts.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                    Nothing waiting right now.
                  </div>
                ) : (
                  waitingPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3 text-sm leading-6 text-[var(--dae-ink)]"
                    >
                      <p>{prompt.text}</p>
                      <p className="mt-1 text-[11px] text-[var(--dae-muted)]">{formatTimestamp(prompt.created_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent)]">
                Invite people in
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--dae-muted)]">
                Topic hubs are the cleanest share surface in DAE right now. Send this page, then let people bring their own DAE into it.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ShareButton
                  path={`/topics/${encodeURIComponent(topic.topicKey)}`}
                  title={`Does anyone else: ${topic.label}`}
                  text={topic.summary}
                  label="Invite to topic"
                />
                <Link
                  href={user ? `/submit?draft=${encodeURIComponent(topic.searchQuery)}` : `/?next=${encodeURIComponent(`/submit?draft=${topic.searchQuery}`)}`}
                  className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
                >
                  Write a matching DAE
                </Link>
              </div>
            </div>

            {!user ? (
              <div className="rounded-[28px] border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)]/70 p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
                  New here?
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--dae-muted)]">
                  <p>1. Sign in once.</p>
                  <p>2. Write the version of this idea that sounds most like you.</p>
                  <p>3. DAE will either match you automatically or tee up the closest rooms to rescue into.</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/?next=${encodeURIComponent(`/submit?draft=${topic.searchQuery}`)}`}
                    className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent)] hover:opacity-95"
                  >
                    Add your DAE
                  </Link>
                  <Link
                    href={`/?next=${encodeURIComponent(`/topics/${topic.topicKey}`)}`}
                    className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
                  >
                    Sign in first
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
