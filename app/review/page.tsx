import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import JoinThreadControl from '@/components/JoinThreadControl'
import ThreadOverviewCard from '@/components/ThreadOverviewCard'
import WaitingDaesList from '@/components/WaitingDaesList'
import { isFounderEmail } from '@/lib/founders'
import { getRequestUser } from '@/lib/request-user'
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
  const { topic } = await searchParams
  const focusedTopic = Array.isArray(topic) ? topic[0] ?? '' : topic ?? ''
  const user = await getRequestUser()

  if (!user) redirect('/')

  const admin = createAdminClient()
  const [{ data: waitingDaes }, discoverThreads] = await Promise.all([
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
  ])

  const typedWaitingDaes = (waitingDaes ?? []) as WaitingDae[]
  const suggestionGroups = typedWaitingDaes.map((dae) => ({
    dae,
    focusScore: focusedTopic ? scoreTextPair(focusedTopic, dae.text) : 0,
    suggestions: discoverThreads
      .map((thread) => ({
        thread,
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
        weightedScore: entry.fit.score + entry.focusScore * 0.14,
      }))
      .filter((entry) => entry.weightedScore >= 0.34)
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3),
  }))
    .sort((a, b) =>
      focusedTopic
        ? b.focusScore + (b.suggestions[0]?.weightedScore ?? 0) - (a.focusScore + (a.suggestions[0]?.weightedScore ?? 0))
        : new Date(b.dae.created_at).getTime() - new Date(a.dae.created_at).getTime()
    )

  return (
    <AppShell
      activeTab="review"
      userEmail={user.email ?? ''}
      eyebrow="Review"
      title="Waiting"
      description={focusedTopic ? `Attach or remove. Focused on: ${focusedTopic}` : 'Attach or remove.'}
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
                    {suggestions.map(({ thread, fit }) => {
                      const tone = getFitTone(fit.score)
                      const isBestFit = suggestions[0]?.thread.matchId === thread.matchId

                      return (
                        <ThreadOverviewCard
                          key={`${dae.id}-${thread.matchId}`}
                          thread={thread}
                          showLatestActivity={false}
                          primaryAction={
                            <JoinThreadControl
                              matchId={thread.matchId}
                              availableDaes={[{ id: dae.id, text: dae.text }]}
                              defaultDaeId={dae.id}
                            />
                          }
                          secondaryAction={
                            <div className="flex flex-wrap items-center gap-2">
                              {isBestFit ? (
                                <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-cool)]">
                                  Best fit
                                </span>
                              ) : null}
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${tone.className}`}
                              >
                                {fit.confidenceLabel} / {Math.round(fit.score * 100)}%
                              </span>
                              <span className="text-xs text-[var(--dae-muted)]">{fit.reason}</span>
                            </div>
                          }
                        />
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
