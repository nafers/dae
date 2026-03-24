import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/founders'

interface AnalyticsEventRow {
  event_name: string
  user_id: string | null
  match_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface DaeRow {
  id: string
  user_id: string
  status: 'matched' | 'unmatched'
  created_at: string
}

interface MessageRow {
  match_id: string
  sender_id: string
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

function formatPercent(numerator: number, denominator: number) {
  if (!denominator) {
    return '0%'
  }

  return `${Math.round((numerator / denominator) * 100)}%`
}

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter(Boolean)).size
}

function getDistinctMatchCount(events: AnalyticsEventRow[]) {
  return new Set(events.map((event) => event.match_id).filter(Boolean)).size
}

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
    <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
      <p className="text-sm text-[var(--dae-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--dae-ink)]">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[var(--dae-muted)]">{detail}</p> : null}
    </div>
  )
}

export default async function MetricsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/?next=/metrics')
  if (!isFounderEmail(user.email)) redirect('/submit')

  const [{ data: analyticsEvents, error: analyticsError }, { data: daes }, { data: messages }] =
    await Promise.all([
      admin
        .from('analytics_events')
        .select('event_name, user_id, match_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(1500),
      admin.from('daes').select('id, user_id, status, created_at').order('created_at', { ascending: false }),
      admin
        .from('messages')
        .select('match_id, sender_id, created_at')
        .order('created_at', { ascending: false })
        .limit(2000),
    ])

  const eventRows = (analyticsEvents ?? []) as AnalyticsEventRow[]
  const daeRows = (daes ?? []) as DaeRow[]
  const messageRows = (messages ?? []) as MessageRow[]

  const authCompleted = eventRows.filter((event) => event.event_name === 'auth_completed')
  const waitingEvents = eventRows.filter((event) => event.event_name === 'dae_waiting')
  const matchedEvents = eventRows.filter((event) => event.event_name === 'dae_matched')
  const attachedEvents = eventRows.filter((event) => event.event_name === 'dae_attached_to_thread')
  const openedEvents = eventRows.filter((event) => event.event_name === 'thread_opened')
  const messageSentEvents = eventRows.filter((event) => event.event_name === 'message_sent')
  const firstThreadMessages = eventRows.filter((event) => event.event_name === 'first_message_in_thread')
  const feedbackEvents = eventRows.filter((event) => event.event_name === 'match_feedback_submitted')
  const messageEmailSent = eventRows.filter((event) => event.event_name === 'message_email_sent')
  const messageEmailSkipped = eventRows.filter((event) => event.event_name === 'message_email_skipped')
  const messageEmailFailed = eventRows.filter((event) => event.event_name === 'message_email_failed')
  const mutedEvents = eventRows.filter((event) => event.event_name === 'thread_muted')
  const hiddenEvents = eventRows.filter((event) => event.event_name === 'thread_hidden')
  const reportedEvents = eventRows.filter((event) => event.event_name === 'thread_reported')

  const totalDaes = daeRows.length
  const waitingDaes = daeRows.filter((dae) => dae.status === 'unmatched').length
  const connectedDaes = totalDaes - waitingDaes
  const uniqueSignedInUsers = uniqueCount(authCompleted.map((event) => event.user_id))
  const uniqueSubmitters = uniqueCount(daeRows.map((dae) => dae.user_id))
  const openedRooms = getDistinctMatchCount(openedEvents)
  const startedThreads = getDistinctMatchCount(firstThreadMessages)

  const messageCountsByThread = new Map<string, number>()
  const sendersByThread = new Map<string, Set<string>>()

  for (const message of messageRows) {
    messageCountsByThread.set(message.match_id, (messageCountsByThread.get(message.match_id) ?? 0) + 1)
    const currentSenders = sendersByThread.get(message.match_id) ?? new Set<string>()
    currentSenders.add(message.sender_id)
    sendersByThread.set(message.match_id, currentSenders)
  }

  const activeThreads = messageCountsByThread.size
  const threadsWithThreePlusMessages = [...messageCountsByThread.values()].filter((count) => count >= 3).length
  const repliedThreads = [...sendersByThread.values()].filter((senders) => senders.size >= 2).length

  const positiveFeedback = feedbackEvents.filter(
    (event) => (event.metadata as { verdict?: string } | null)?.verdict === 'good'
  ).length
  const negativeFeedback = feedbackEvents.filter(
    (event) => (event.metadata as { verdict?: string } | null)?.verdict === 'bad'
  ).length

  const recentReports = reportedEvents.slice(0, 8)
  const recentSignal = eventRows
    .filter((event) => event.event_name !== 'thread_seen')
    .slice(0, 14)

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--dae-accent-cool)]">
              Founder metrics
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--dae-ink)]">
              Friend-test dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--dae-muted)]">
              Fast read on whether prompts are finding people, turning into rooms, and surviving past the first reply.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/submit"
              className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-4 py-2 text-sm font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
            >
              Submit
            </Link>
            <Link
              href="/threads"
              className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-4 py-2 text-sm font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
            >
              Chats
            </Link>
          </div>
        </div>

        {analyticsError ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Unable to load analytics events. The `analytics_events` table may be missing or unavailable.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Signed-in users"
                value={uniqueSignedInUsers}
                detail={`${uniqueSubmitters} have submitted at least one prompt`}
              />
              <MetricCard
                label="Prompts submitted"
                value={totalDaes}
                detail={`${waitingDaes} waiting, ${connectedDaes} connected`}
              />
              <MetricCard
                label="Active rooms"
                value={activeThreads}
                detail={`${repliedThreads} have replies from 2+ people`}
              />
              <MetricCard
                label="Manual rescues"
                value={attachedEvents.length}
                detail={`${waitingEvents.length} waiting events recorded`}
              />
            </div>

            <section className="mt-6 rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--dae-ink)]">Core funnel</h2>
                  <p className="text-sm text-[var(--dae-muted)]">From prompt to actual back-and-forth.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {[
                  { label: 'Submitted', value: totalDaes, detail: 'all prompts posted' },
                  {
                    label: 'Connected',
                    value: connectedDaes,
                    detail: `${formatPercent(connectedDaes, totalDaes)} of submitted`,
                  },
                  {
                    label: 'Opened',
                    value: openedRooms,
                    detail: `${formatPercent(openedRooms, Math.max(getDistinctMatchCount(matchedEvents), 1))} of matched rooms`,
                  },
                  {
                    label: 'Started',
                    value: startedThreads,
                    detail: `${formatPercent(startedThreads, Math.max(openedRooms, 1))} got a first message`,
                  },
                  {
                    label: 'Replying',
                    value: repliedThreads,
                    detail: `${formatPercent(repliedThreads, Math.max(startedThreads, 1))} kept going`,
                  },
                ].map((step) => (
                  <div
                    key={step.label}
                    className="rounded-2xl border border-[var(--dae-line)] bg-[var(--dae-surface)] p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                      {step.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--dae-ink)]">{step.value}</p>
                    <p className="mt-1 text-xs text-[var(--dae-muted)]">{step.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <MetricCard
                label="Message volume"
                value={messageSentEvents.length}
                detail={`${threadsWithThreePlusMessages} rooms reached 3+ messages`}
              />
              <MetricCard
                label="Reply nudges"
                value={messageEmailSent.length}
                detail={`${messageEmailSkipped.length} skipped, ${messageEmailFailed.length} failed`}
              />
              <MetricCard
                label="Match quality"
                value={feedbackEvents.length}
                detail={`${positiveFeedback} good, ${negativeFeedback} weak`}
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <MetricCard
                label="Muted rooms"
                value={mutedEvents.length}
                detail="People turned notifications down"
              />
              <MetricCard
                label="Hidden rooms"
                value={hiddenEvents.length}
                detail="People chose to get a room out of view"
              />
              <MetricCard
                label="Reports"
                value={reportedEvents.length}
                detail="Signal on trust or bad-fit friction"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--dae-ink)]">Recent reports</h2>
                  <p className="text-sm text-[var(--dae-muted)]">Most recent trust issues or bad-fit reports.</p>
                </div>

                <div className="mt-4 space-y-3">
                  {recentReports.length === 0 ? (
                    <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
                      No reports yet.
                    </div>
                  ) : (
                    recentReports.map((event, index) => (
                      <div
                        key={`${event.match_id ?? 'report'}-${event.created_at}-${index}`}
                        className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3"
                      >
                        <p className="text-sm font-medium text-[var(--dae-ink)]">
                          {String((event.metadata as { reason?: string } | null)?.reason ?? 'other')}
                        </p>
                        <p className="mt-1 text-xs text-[var(--dae-muted)]">
                          {event.match_id ? `room ${event.match_id.slice(0, 8)}` : 'no room'} ·{' '}
                          {event.user_id ? `user ${event.user_id.slice(0, 8)}` : 'anonymous'} ·{' '}
                          {formatTimestamp(event.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--dae-ink)]">Recent signal</h2>
                  <p className="text-sm text-[var(--dae-muted)]">Latest meaningful events across the loop.</p>
                </div>

                <div className="mt-4 space-y-3">
                  {recentSignal.map((event, index) => (
                    <div
                      key={`${event.event_name}-${event.created_at}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--dae-surface)] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--dae-ink)]">{event.event_name}</p>
                        <p className="mt-1 text-xs text-[var(--dae-muted)]">
                          {event.match_id ? `room ${event.match_id.slice(0, 8)}` : 'no room'} ·{' '}
                          {event.user_id ? `user ${event.user_id.slice(0, 8)}` : 'anonymous'}
                        </p>
                      </div>
                      <p className="text-xs text-[var(--dae-muted)]">{formatTimestamp(event.created_at)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
