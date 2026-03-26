import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import ThreadOverviewCard from '@/components/ThreadOverviewCard'
import { fetchActivityFeed } from '@/lib/activity'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchThreadDirectory } from '@/lib/thread-directory'
import { fetchTopicRegistry } from '@/lib/topic-registry'

interface WaitingDaeRow {
  id: string
  text: string
  created_at: string
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getActivityBadgeClass(kind: string) {
  if (kind === 'reply') {
    return 'bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)]'
  }

  if (kind === 'waiting' || kind === 'request') {
    return 'bg-[var(--dae-accent-warm-soft)] text-[var(--dae-accent-warm)]'
  }

  return 'bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)]'
}

export default async function NowPage() {
  const user = await getRequestUser()
  if (!user) {
    redirect('/')
  }

  const admin = createAdminClient()
  const [{ items, summary }, joinedThreads, topicRegistry, { data: waitingDaes }] = await Promise.all([
    fetchActivityFeed(user.id),
    fetchThreadDirectory({
      currentUserId: user.id,
      scope: 'joined',
      limit: 4,
    }),
    fetchTopicRegistry(user.id),
    admin
      .from('daes')
      .select('id, text, created_at')
      .eq('user_id', user.id)
      .eq('status', 'unmatched')
      .order('created_at', { ascending: false })
      .limit(4),
  ])

  const waitingRows = (waitingDaes ?? []) as WaitingDaeRow[]
  const attentionItems = items.slice(0, 5)
  const topicItems = (topicRegistry.followed.length > 0 ? topicRegistry.followed : topicRegistry.rising).slice(0, 4)
  const primaryNextStep =
    attentionItems[0]
      ? {
          eyebrow: 'Best next step',
          title: attentionItems[0].title,
          detail: attentionItems[0].detail,
          href: attentionItems[0].href,
          label:
            attentionItems[0].kind === 'reply'
              ? 'Open unread'
              : attentionItems[0].kind === 'request'
                ? 'Handle request'
                : attentionItems[0].kind === 'follow'
                  ? 'Open topic'
                  : 'Open now',
        }
      : waitingRows[0]
        ? {
            eyebrow: 'Best next step',
            title: waitingRows[0].text,
            detail: 'This DAE is still waiting. Review rescue options or keep it in the pool.',
            href: `/review?daeId=${encodeURIComponent(waitingRows[0].id)}`,
            label: 'Review fit',
          }
        : topicItems[0]
          ? {
              eyebrow: 'Best next step',
              title: topicItems[0].headline,
              detail: topicItems[0].summary,
              href: `/topics/${encodeURIComponent(topicItems[0].topicKey)}`,
              label: 'Open topic',
            }
          : null

  return (
    <AppShell
      activeTab="now"
      userEmail={user.email ?? ''}
      eyebrow="Now"
      title="What needs you"
      description={`${summary.unreadCount} replies, ${summary.waitingCount} waiting prompts, ${summary.freshMatchCount} fresh room${summary.freshMatchCount === 1 ? '' : 's'}.`}
    >
      <div className="space-y-5">
        {primaryNextStep ? (
          <section className="rounded-[28px] border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)]/50 p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
              {primaryNextStep.eyebrow}
            </p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold text-[var(--dae-ink)]">{primaryNextStep.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--dae-muted)]">{primaryNextStep.detail}</p>
              </div>
              <Link
                href={primaryNextStep.href}
                className="rounded-full border border-[var(--dae-accent-cool)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-accent-cool)] hover:opacity-95"
              >
                {primaryNextStep.label}
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4">
          {[
            { label: 'Replies', value: summary.unreadCount, tone: 'cool' },
            { label: 'Waiting', value: summary.waitingCount, tone: 'warm' },
            { label: 'New rooms', value: summary.freshMatchCount, tone: 'rose' },
            { label: 'Following', value: topicRegistry.followed.length, tone: 'cool' },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                {card.label}
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--dae-ink)]">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <div className="space-y-5">
            <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
                    Needs attention
                  </p>
                  <p className="mt-1 text-sm text-[var(--dae-muted)]">
                    The fastest way back into the loop.
                  </p>
                </div>
                <Link
                  href="/activity"
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                >
                  Open inbox
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {attentionItems.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                    Quiet right now. Submit something new or browse topics.
                  </div>
                ) : (
                  attentionItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block rounded-2xl bg-[var(--dae-surface)] px-4 py-3 transition-colors hover:bg-white"
                    >
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium ${getActivityBadgeClass(item.kind)}`}
                      >
                        {item.kind === 'reply'
                          ? 'Reply'
                          : item.kind === 'match'
                            ? 'New room'
                            : item.kind === 'request'
                              ? 'Join request'
                              : item.kind === 'follow'
                                ? 'Topic moved'
                                : 'Still waiting'}
                      </span>
                      <p className="mt-3 text-base font-semibold text-[var(--dae-ink)]">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--dae-muted)]">{item.detail}</p>
                      <p className="mt-2 text-[11px] text-[var(--dae-muted)]">{formatTimestamp(item.timestamp)}</p>
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
                    Jump back in
                  </p>
                  <p className="mt-1 text-sm text-[var(--dae-muted)]">
                    Your most active rooms right now.
                  </p>
                </div>
                <Link
                  href="/threads"
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                >
                  All chats
                </Link>
              </div>

              <div className="mt-4 grid gap-3">
                {joinedThreads.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                    No rooms yet.
                  </div>
                ) : (
                  joinedThreads.map((thread) => (
                    <ThreadOverviewCard
                      key={thread.matchId}
                      thread={thread}
                      compact
                      primaryAction={
                        <Link
                          href={`/threads/${thread.matchId}`}
                          className="rounded-full border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-cool)] hover:opacity-95"
                        >
                          Open
                        </Link>
                      }
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-warm)]">
                    Waiting to place
                  </p>
                  <p className="mt-1 text-sm text-[var(--dae-muted)]">
                    These can still match automatically or be rescued into a room.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/review"
                    className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-warm)] hover:opacity-95"
                  >
                    Review
                  </Link>
                  <Link
                    href="/submit"
                    className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                  >
                    Submit
                  </Link>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {waitingRows.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                    Nothing waiting.
                  </div>
                ) : (
                  waitingRows.map((dae) => (
                    <Link
                      key={dae.id}
                      href={`/review?daeId=${encodeURIComponent(dae.id)}`}
                      className="block rounded-2xl bg-[var(--dae-surface)] px-4 py-3 transition-colors hover:bg-white"
                    >
                      <p className="text-sm font-medium text-[var(--dae-ink)]">{dae.text}</p>
                      <p className="mt-1 text-[11px] text-[var(--dae-muted)]">{formatTimestamp(dae.created_at)}</p>
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-rose)]">
                    Topics moving
                  </p>
                  <p className="mt-1 text-sm text-[var(--dae-muted)]">
                    {topicRegistry.followed.length > 0
                      ? 'What you follow that is picking up motion.'
                      : 'The strongest topic hubs right now.'}
                  </p>
                </div>
                <Link
                  href="/topics"
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                >
                  All topics
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {topicItems.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                    No topics yet.
                  </div>
                ) : (
                  topicItems.map((topic) => (
                    <Link
                      key={topic.topicKey}
                      href={`/topics/${encodeURIComponent(topic.topicKey)}`}
                      className="block rounded-2xl bg-[var(--dae-surface)] px-4 py-3 transition-colors hover:bg-white"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-3 py-1 text-[11px] font-medium text-[var(--dae-accent-rose)]">
                          {topic.label}
                        </span>
                        {topic.isPinned ? (
                          <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-[11px] font-medium text-[var(--dae-accent-cool)]">
                            Pinned
                          </span>
                        ) : null}
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[var(--dae-muted)]">
                          {topic.daeCount} ideas
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-[var(--dae-ink)]">{topic.headline}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--dae-muted)]">{topic.summary}</p>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
