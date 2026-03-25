import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import ShareButton from '@/components/ShareButton'
import ThreadOverviewCard from '@/components/ThreadOverviewCard'
import { getRequestUser } from '@/lib/request-user'
import { fetchThreadDirectory } from '@/lib/thread-directory'

interface Props {
  searchParams: Promise<{
    hidden?: string | string[]
  }>
}

export default async function ThreadsPage({ searchParams }: Props) {
  const { hidden } = await searchParams
  const showHidden = Array.isArray(hidden) ? hidden[0] === '1' : hidden === '1'
  const user = await getRequestUser()

  if (!user) redirect('/')

  const threadCards = await fetchThreadDirectory({
    currentUserId: user.id,
    scope: 'joined',
    limit: 24,
  })
  const hiddenCount = threadCards.filter((thread) => thread.isHidden).length
  const unreadCount = threadCards.filter((thread) => thread.hasUnread && !thread.isHidden).length
  const visibleThreadCards = threadCards.filter((thread) => (showHidden ? thread.isHidden : !thread.isHidden))

  return (
    <AppShell
      activeTab="threads"
      userEmail={user.email ?? ''}
      eyebrow="Chats"
      title="Your rooms"
      description={
        visibleThreadCards.length > 0
          ? `${visibleThreadCards.length} ${showHidden ? 'hidden' : 'active'} room${visibleThreadCards.length === 1 ? '' : 's'}.`
          : showHidden
            ? 'No hidden rooms.'
            : 'No rooms yet.'
      }
      actions={
        <>
          {hiddenCount > 0 ? (
            <Link
              href={showHidden ? '/threads' : '/threads?hidden=1'}
              className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] shadow-sm hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
            >
              {showHidden ? 'Active rooms' : `Hidden ${hiddenCount}`}
            </Link>
          ) : null}
        </>
      }
    >
      {visibleThreadCards.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-8 text-center shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
          <h2 className="text-2xl font-semibold text-[var(--dae-ink)]">
            {showHidden ? 'No hidden chats.' : 'No chats yet.'}
          </h2>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/submit"
              className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent)] hover:opacity-95"
            >
              Submit
            </Link>
            <Link
              href="/browse"
              className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
            >
              Browse
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-4 py-3 shadow-[0_10px_26px_rgba(32,26,22,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                Active
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--dae-ink)]">
                {threadCards.length - hiddenCount}
              </p>
            </div>
            <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-4 py-3 shadow-[0_10px_26px_rgba(32,26,22,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                New
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--dae-ink)]">{unreadCount}</p>
            </div>
            <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-4 py-3 shadow-[0_10px_26px_rgba(32,26,22,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                Hidden
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--dae-ink)]">{hiddenCount}</p>
            </div>
          </section>

          <div className="grid gap-3 xl:grid-cols-2">
            {visibleThreadCards.map((thread) => (
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
                secondaryAction={
                  <ShareButton
                    path={`/invite/${encodeURIComponent(thread.matchId)}`}
                    title={`DAE room invite: ${thread.matchId.slice(0, 8)}`}
                    text="See if your DAE fits this room."
                    label="Invite"
                  />
                }
              />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  )
}
