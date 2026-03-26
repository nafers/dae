import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import ModerationQueue from '@/components/ModerationQueue'
import { isFounderEmail } from '@/lib/founders'
import { fetchFounderRiskRooms, fetchModerationQueue } from '@/lib/moderation'
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

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default async function ModerationPage() {
  const user = await getRequestUser()

  if (!user) redirect('/?next=/moderation')
  if (!isFounderEmail(user.email)) redirect('/now')

  const [{ items, unresolved, resolved }, riskRooms] = await Promise.all([
    fetchModerationQueue(user.id),
    fetchFounderRiskRooms(user.id),
  ])
  const followUpCount = resolved.filter((item) => item.decision === 'follow_up').length
  const hiddenRoomCount = items.filter((item) => item.roomHidden).length
  const lockedRoomCount = items.filter((item) => item.joinLocked).length
  const riskyRoomCount = riskRooms.filter((room) => room.outcome.label === 'Risky').length

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

        <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_10px_26px_rgba(32,26,22,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--dae-ink)]">Trust watchlist</h2>
              <p className="text-sm text-[var(--dae-muted)]">
                Rooms surfacing the strongest combined moderation and room-quality risk.
              </p>
            </div>
            <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
              {riskRooms.length} flagged now / {riskyRoomCount} risky
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {riskRooms.length === 0 ? (
              <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                No rooms need extra trust attention right now.
              </div>
            ) : (
              riskRooms.map((item) => (
                <div
                  key={item.room.matchId}
                  className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            item.outcome.label === 'Working'
                              ? 'bg-[var(--dae-accent-soft)] text-[var(--dae-accent)]'
                              : item.outcome.label === 'Risky'
                                ? 'bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)]'
                                : 'bg-white text-[var(--dae-muted)]'
                          }`}
                        >
                          {item.outcome.label}
                        </span>
                        {item.reportCount > 0 ? (
                          <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-rose)]">
                            {item.reportCount} report{item.reportCount === 1 ? '' : 's'}
                          </span>
                        ) : null}
                        {item.joinLocked ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                            Joins paused
                          </span>
                        ) : null}
                        {item.roomHidden ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                            Hidden
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-base font-semibold text-[var(--dae-ink)]">
                        {item.room.participants[0]?.daeText ?? `Room ${item.room.matchId.slice(0, 8)}`}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--dae-muted)]">
                        {item.outcome.detail}
                      </p>
                      <p className="mt-2 text-xs text-[var(--dae-muted)]">
                        {item.room.participantCount} people | Active {formatTimestamp(item.room.latestActivityAt)}
                        {item.lastActionAt ? ` | Moderated ${formatTimestamp(item.lastActionAt)}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/threads/${item.room.matchId}`}
                        className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                      >
                        Open room
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <ModerationQueue initialItems={items} />
      </div>
    </AppShell>
  )
}
