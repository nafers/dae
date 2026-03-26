import { after } from 'next/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import JoinThreadControl from '@/components/JoinThreadControl'
import ThreadOverviewCard from '@/components/ThreadOverviewCard'
import WaitingDaesList from '@/components/WaitingDaesList'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { fetchRoomOutcomeSummaries, getRoomOutcomeSummary } from '@/lib/room-outcomes'
import { fetchJoinRequestStatesForUser } from '@/lib/thread-join-requests'
import { getRoomModerationState, fetchRoomModerationStates } from '@/lib/moderation-state'
import { getRequestUser } from '@/lib/request-user'
import { canAutoJoinThreadWithFitScore } from '@/lib/thread-join-policy'
import { scoreThreadAttachmentFit } from '@/lib/thread-fit'
import { createAdminClient } from '@/lib/supabase/server'
import { scoreTextPair } from '@/lib/text-similarity'
import { fetchThreadDirectory } from '@/lib/thread-directory'

interface WaitingDae {
  id: string
  text: string
  embedding?: unknown
  created_at: string
}

interface Props {
  searchParams: Promise<{
    topic?: string | string[]
    invite?: string | string[]
    daeId?: string | string[]
    matchId?: string | string[]
  }>
}

function getFitTone(score: number) {
  if (score >= 0.74) {
    return {
      className: 'bg-[var(--dae-accent-soft)] text-[var(--dae-accent)]',
    }
  }

  if (score >= 0.56) {
    return {
      className: 'bg-[var(--dae-accent-warm-soft)] text-[var(--dae-accent-warm)]',
    }
  }

  return {
    className: 'bg-[var(--dae-surface)] text-[var(--dae-muted)]',
  }
}

export default async function ReviewPage({ searchParams }: Props) {
  const { topic, invite, daeId, matchId } = await searchParams
  const focusedTopic = Array.isArray(topic) ? topic[0] ?? '' : topic ?? ''
  const inviteMatchId = Array.isArray(invite) ? invite[0] ?? '' : invite ?? ''
  const focusedDaeId = Array.isArray(daeId) ? daeId[0] ?? '' : daeId ?? ''
  const focusedMatchId = Array.isArray(matchId) ? matchId[0] ?? '' : matchId ?? ''
  const user = await getRequestUser()

  if (!user) redirect('/')

  const admin = createAdminClient()
  const [{ data: waitingDaes }, discoverThreads, myJoinRequests, invitedThreads] = await Promise.all([
    admin
      .from('daes')
      .select('id, text, embedding, created_at')
      .eq('user_id', user.id)
      .eq('status', 'unmatched')
      .order('created_at', { ascending: false }),
    fetchThreadDirectory({
      currentUserId: user.id,
      scope: 'discover',
      limit: 18,
      includeEmbeddings: true,
      includeState: false,
      includeMessages: false,
    }),
    fetchJoinRequestStatesForUser(user.id),
    inviteMatchId
      ? fetchThreadDirectory({
          currentUserId: user.id,
          scope: 'all',
          limit: 1,
          includeEmbeddings: true,
          includeState: false,
          includeMessages: false,
          matchIds: [inviteMatchId],
        })
      : Promise.resolve([]),
  ])

  const typedWaitingDaes = (waitingDaes ?? []) as WaitingDae[]
  const pendingRequestKeys = new Set(
    myJoinRequests
      .filter((request) => request.state === 'requested')
      .map((request) => `${request.matchId}:${request.daeId}`)
  )
  const roomStates = await fetchRoomModerationStates([
    ...discoverThreads.map((thread) => thread.matchId),
    ...invitedThreads.map((thread) => thread.matchId),
  ])
  const discoverableThreads = discoverThreads.filter(
    (thread) => !getRoomModerationState(roomStates, thread.matchId).hidden
  )
  const roomOutcomes = await fetchRoomOutcomeSummaries(discoverableThreads.map((thread) => thread.matchId))
  const invitedThread = invitedThreads.find(
    (thread) => !getRoomModerationState(roomStates, thread.matchId).hidden
  )
  const suggestionGroups = typedWaitingDaes.map((dae) => ({
    dae,
    focusScore: focusedTopic ? scoreTextPair(focusedTopic, dae.text) : 0,
    suggestions: discoverableThreads
      .map((thread) => ({
        thread,
        moderation: getRoomModerationState(roomStates, thread.matchId),
        fit: scoreThreadAttachmentFit({
          daeText: dae.text,
          daeEmbedding: dae.embedding,
          threadTexts: thread.participants.map((participant) => participant.daeText),
          threadEmbeddings: thread.participants.map((participant) => participant.daeEmbedding),
          latestActivityAt: thread.latestActivityAt,
          participantCount: thread.participantCount,
        }),
        focusScore: focusedTopic
          ? Math.max(
              ...thread.participants.map((participant) => scoreTextPair(focusedTopic, participant.daeText)),
              0
            )
          : 0,
      }))
      .map((entry) => ({
        ...entry,
        outcome: getRoomOutcomeSummary(roomOutcomes, entry.thread.matchId),
        weightedScore:
          entry.fit.score +
          getRoomOutcomeSummary(roomOutcomes, entry.thread.matchId).score * 0.18 +
          entry.focusScore * 0.14 +
          (focusedMatchId && entry.thread.matchId === focusedMatchId ? 0.18 : 0),
      }))
      .filter((entry) => entry.weightedScore >= 0.34)
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3),
  }))
    .sort((a, b) =>
      focusedDaeId
        ? (b.dae.id === focusedDaeId ? 1 : 0) - (a.dae.id === focusedDaeId ? 1 : 0) ||
          new Date(b.dae.created_at).getTime() - new Date(a.dae.created_at).getTime()
        : focusedTopic
          ? b.focusScore + (b.suggestions[0]?.weightedScore ?? 0) - (a.focusScore + (a.suggestions[0]?.weightedScore ?? 0))
          : new Date(b.dae.created_at).getTime() - new Date(a.dae.created_at).getTime()
    )

  const suggestionCount = suggestionGroups.reduce((total, group) => total + group.suggestions.length, 0)
  const autoJoinSuggestionCount = suggestionGroups.reduce(
    (total, group) =>
      total + group.suggestions.filter((suggestion) => canAutoJoinThreadWithFitScore(suggestion.fit.score)).length,
    0
  )
  const approvalSuggestionCount = Math.max(suggestionCount - autoJoinSuggestionCount, 0)

  after(async () => {
    await trackAnalyticsEvent({
      eventName: 'review_suggestions_opened',
      userId: user.id,
      metadata: {
        waitingCount: typedWaitingDaes.length,
        suggestionCount,
        autoJoinSuggestionCount,
        approvalSuggestionCount,
        focusedTopic: focusedTopic || null,
        focusedDaeId: focusedDaeId || null,
        focusedMatchId: focusedMatchId || null,
        inviteMatchId: inviteMatchId || null,
      },
    })
  })

  return (
    <AppShell
      activeTab="review"
      userEmail={user.email ?? ''}
      eyebrow="Place"
      title="Place your waiting DAE"
      description={
        focusedTopic
          ? `Choose where it belongs. Focused on: ${focusedTopic}`
          : 'Choose the best room, request a spot, or leave it in the pool.'
      }
    >
      {typedWaitingDaes.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-8 text-center shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
          <h2 className="text-2xl font-semibold text-[var(--dae-ink)]">Nothing waiting.</h2>
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
        <div className="space-y-5">
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">Waiting</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--dae-ink)]">{typedWaitingDaes.length}</p>
            </div>
            <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">Suggestions</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--dae-ink)]">{suggestionCount}</p>
            </div>
            <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">Join now</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--dae-ink)]">{autoJoinSuggestionCount}</p>
            </div>
            <div className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">Needs approval</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--dae-ink)]">{approvalSuggestionCount}</p>
            </div>
          </section>

          {invitedThread ? (
            <section className="rounded-[28px] border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)]/60 p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
                    Invited room
                  </p>
                  <p className="mt-1 text-sm text-[var(--dae-ink)]">
                    Someone shared this room with you. If one of your waiting prompts fits, place it here.
                  </p>
                </div>
                <Link
                  href="/review"
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                >
                  Clear
                </Link>
              </div>

              <div className="mt-4">
                <ThreadOverviewCard
                  thread={invitedThread}
                  showLatestActivity={false}
                  primaryAction={
                    typedWaitingDaes.length > 0 ? (
                      <JoinThreadControl
                        matchId={invitedThread.matchId}
                        availableDaes={typedWaitingDaes.map((dae) => ({ id: dae.id, text: dae.text }))}
                        initialRequestedDaeIds={typedWaitingDaes
                          .filter((dae) => pendingRequestKeys.has(`${invitedThread.matchId}:${dae.id}`))
                          .map((dae) => dae.id)}
                        joinLocked={getRoomModerationState(roomStates, invitedThread.matchId).joinLocked}
                        sourceContext={{
                          source: 'invite_review',
                        }}
                      />
                    ) : undefined
                  }
                />
              </div>
            </section>
          ) : null}

          {focusedDaeId || focusedMatchId ? (
            <section className="rounded-[24px] border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)]/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                    Near-match spotlight
                  </p>
                  <p className="mt-1 text-sm text-[var(--dae-ink)]">
                    We pulled the closest rooms higher because this prompt already looks close enough to rescue.
                  </p>
                </div>
                <Link
                  href="/review"
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                >
                  Clear
                </Link>
              </div>
            </section>
          ) : null}

          {focusedTopic ? (
            <section className="rounded-[24px] border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-warm)]">
                    Browse handoff
                  </p>
                  <p className="mt-1 text-sm text-[var(--dae-ink)]">
                    Matching your waiting prompts against <strong>{focusedTopic}</strong>.
                  </p>
                </div>
                <Link
                  href="/review"
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                >
                  Clear
                </Link>
              </div>
            </section>
          ) : null}

          <WaitingDaesList waitingDaes={typedWaitingDaes} />

          <div className="space-y-5">
            {suggestionGroups.map(({ dae, suggestions }) => (
              <section
                key={dae.id}
                className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-warm)]">
                      Waiting prompt
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-[var(--dae-ink)]">{dae.text}</h2>
                  </div>
                  <span className="rounded-full bg-[var(--dae-accent-warm-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-warm)]">
                    {suggestions.length} suggestions
                  </span>
                </div>

                {suggestions.length === 0 ? (
                  <div className="mt-4 rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface)] p-4 text-sm text-[var(--dae-muted)]">
                    No close match yet.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {suggestions.map(({ thread, fit, moderation, outcome }) => {
                      const tone = getFitTone(fit.score)
                      const isBestFit = suggestions[0]?.thread.matchId === thread.matchId
                      const isSpotlight = Boolean(
                        (focusedDaeId && dae.id === focusedDaeId) ||
                          (focusedMatchId && thread.matchId === focusedMatchId)
                      )

                      return (
                        <div
                          key={`${dae.id}-${thread.matchId}`}
                          className={
                            isSpotlight
                              ? 'rounded-[30px] border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)]/30 p-1.5'
                              : ''
                          }
                        >
                          <ThreadOverviewCard
                            thread={thread}
                            showLatestActivity={false}
                            primaryAction={
                              <JoinThreadControl
                                matchId={thread.matchId}
                                availableDaes={[{ id: dae.id, text: dae.text }]}
                                defaultDaeId={dae.id}
                                initialRequestedDaeIds={
                                  pendingRequestKeys.has(`${thread.matchId}:${dae.id}`) ? [dae.id] : []
                                }
                                joinLocked={moderation.joinLocked}
                                sourceContext={{
                                  source: inviteMatchId ? 'invite_review' : focusedMatchId ? 'submit_near_match' : focusedTopic ? 'topic_hub' : 'review_suggestion',
                                  fitScore: fit.score,
                                  fitReason: fit.reason,
                                  topic: focusedTopic || undefined,
                                }}
                              />
                            }
                            secondaryAction={
                              <div className="flex flex-wrap items-center gap-2">
                                {isBestFit ? (
                                  <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-cool)]">
                                    Best fit
                                  </span>
                                ) : null}
                                {isSpotlight ? (
                                  <span className="rounded-full bg-[var(--dae-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent)]">
                                    Spotlight
                                  </span>
                                ) : null}
                                {moderation.joinLocked ? (
                                  <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                                    Joins paused
                                  </span>
                                ) : null}
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium ${tone.className}`}
                                >
                                  {fit.confidenceLabel} / {Math.round(fit.score * 100)}%
                                </span>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                                    outcome.label === 'Working'
                                      ? 'bg-[var(--dae-accent-soft)] text-[var(--dae-accent)]'
                                      : outcome.label === 'Risky'
                                        ? 'bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)]'
                                        : 'bg-[var(--dae-surface)] text-[var(--dae-muted)]'
                                  }`}
                                >
                                  {outcome.label}
                                </span>
                                <span className="text-xs text-[var(--dae-muted)]">{fit.reason}</span>
                                <span className="text-xs text-[var(--dae-muted)]">{outcome.detail}</span>
                              </div>
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  )
}
