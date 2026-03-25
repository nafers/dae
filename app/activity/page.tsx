import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { fetchActivityFeed } from '@/lib/activity'
import { isFounderEmail } from '@/lib/founders'
import { getRequestUser } from '@/lib/request-user'

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const toneClasses = {
  cool: 'bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)]',
  warm: 'bg-[var(--dae-accent-warm-soft)] text-[var(--dae-accent-warm)]',
  rose: 'bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)]',
} as const

export default async function ActivityPage() {
  const user = await getRequestUser()
  if (!user) redirect('/')

  const { items, summary } = await fetchActivityFeed(user.id)

  return (
    <AppShell
      activeTab="activity"
      userEmail={user.email ?? ''}
      eyebrow="Activity"
      title="What changed"
      description={`${summary.unreadCount} new replies, ${summary.freshMatchCount} fresh room${summary.freshMatchCount === 1 ? '' : 's'}, ${summary.waitingCount} waiting.`}
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
        <div className="grid gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_10px_26px_rgba(32,26,22,0.04)] transition-transform hover:-translate-y-0.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${toneClasses[item.tone]}`}>
                    {item.kind === 'reply' ? 'New reply' : item.kind === 'match' ? 'New room' : 'Still waiting'}
                  </span>
                  <h2 className="mt-3 text-lg font-semibold text-[var(--dae-ink)]">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--dae-muted)]">{item.detail}</p>
                </div>
                <p className="text-[11px] text-[var(--dae-muted)]">{formatTimestamp(item.timestamp)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}
