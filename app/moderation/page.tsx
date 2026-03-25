import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import ModerationQueue from '@/components/ModerationQueue'
import { isFounderEmail } from '@/lib/founders'
import { fetchModerationQueue } from '@/lib/moderation'
import { getRequestUser } from '@/lib/request-user'

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: number | string
  detail?: string
}) {
  return (
    <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-4 py-4 shadow-[0_10px_26px_rgba(32,26,22,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--dae-ink)]">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[var(--dae-muted)]">{detail}</p> : null}
    </div>
  )
}

export default async function ModerationPage() {
  const user = await getRequestUser()

  if (!user) redirect('/?next=/moderation')
  if (!isFounderEmail(user.email)) redirect('/now')

  const { items, unresolved, resolved } = await fetchModerationQueue(user.id)
  const followUpCount = resolved.filter((item) => item.decision === 'follow_up').length
  const hiddenRoomCount = items.filter((item) => item.roomHidden).length
  const lockedRoomCount = items.filter((item) => item.joinLocked).length

  return (
    <AppShell
      activeTab="moderation"
      userEmail={user.email ?? ''}
      eyebrow="Moderation"
      title="Founder queue"
      description="Review reports, spot recurring bad-fit rooms, and keep friend testing safe."
    >
      <div className="space-y-4">
        <section className="grid gap-3 md:grid-cols-5">
          <MetricCard label="Open reports" value={unresolved.length} detail="Not yet reviewed" />
          <MetricCard label="Reviewed" value={resolved.length} detail="Already triaged" />
          <MetricCard label="Follow up" value={followUpCount} detail="Needs another pass" />
          <MetricCard label="Hidden rooms" value={hiddenRoomCount} detail="Removed from discovery" />
          <MetricCard label="Joins paused" value={lockedRoomCount} detail="No new rescue joins" />
        </section>

        <ModerationQueue initialItems={items} />
      </div>
    </AppShell>
  )
}
