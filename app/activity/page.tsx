import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import ActivityFeed from '@/components/ActivityFeed'
import { fetchActivityFeed } from '@/lib/activity'
import { isFounderEmail } from '@/lib/founders'
import { getRequestUser } from '@/lib/request-user'

export default async function ActivityPage() {
  const user = await getRequestUser()
  if (!user) redirect('/')

  const { items, summary } = await fetchActivityFeed(user.id)

  return (
    <AppShell
      activeTab="activity"
      userEmail={user.email ?? ''}
      eyebrow="Activity"
      title="Inbox"
      description={`${summary.totalCount} item${summary.totalCount === 1 ? '' : 's'} to check. ${summary.unreadCount} replies, ${summary.freshMatchCount} fresh room${summary.freshMatchCount === 1 ? '' : 's'}, ${summary.waitingCount} waiting.`}
      actions={
        isFounderEmail(user.email) ? (
          <Link
            href="/metrics"
            className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] shadow-sm hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
          >
            Metrics
          </Link>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-8 text-center shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
          <h2 className="text-2xl font-semibold text-[var(--dae-ink)]">Quiet right now.</h2>
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
        <ActivityFeed initialItems={items} />
      )}
    </AppShell>
  )
}
