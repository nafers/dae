import { after } from 'next/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRequestUser } from '@/lib/request-user'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { fetchRoomModerationStates, getRoomModerationState } from '@/lib/moderation-state'
import { getTopicPresentation } from '@/lib/topic-intelligence'
import { fetchThreadDirectory } from '@/lib/thread-directory'

interface Props {
  params: Promise<{
    matchId: string
  }>
}

export default async function InvitePage({ params }: Props) {
  const { matchId } = await params
  const user = await getRequestUser()

  if (user) {
    redirect(`/review?invite=${matchId}`)
  }

  const [thread] = await fetchThreadDirectory({
    currentUserId: '__guest__',
    scope: 'all',
    includeState: false,
    matchIds: [matchId],
    limit: 1,
  })

  if (!thread) {
    notFound()
  }
  const roomStates = await fetchRoomModerationStates([matchId])
  const moderationState = getRoomModerationState(roomStates, matchId)

  if (moderationState.hidden) {
    notFound()
  }

  const daeTexts = [...new Set(thread.participants.map((participant) => participant.daeText).filter(Boolean))]
  const presentation = await getTopicPresentation(daeTexts, {
    matchedCount: Math.max(thread.participantCount - 1, 0),
    forceAI: true,
  })

  after(async () => {
    await trackAnalyticsEvent({
      eventName: 'invite_landing_opened',
      matchId,
      metadata: {
        topicKey: presentation.topicKey,
      },
    })
  })

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--dae-accent-rose)]">
            DAE invite
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--dae-ink)]">
            {presentation.headline}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--dae-muted)]">{presentation.summary}</p>
        </div>

        <div className="rounded-[32px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-6 shadow-[0_18px_40px_rgba(32,26,22,0.06)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-rose)]">
              {presentation.label}
            </span>
            <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
              {thread.participantCount} {thread.participantCount === 1 ? 'person' : 'people'}
            </span>
            <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
              Room {matchId.slice(0, 8)}
            </span>
            {moderationState.joinLocked ? (
              <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                Joins paused
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {thread.participants.map((participant, index) => (
              <div
                key={`${participant.userId}-${participant.daeId}`}
                className={`rounded-[24px] border p-4 ${
                  index % 2 === 0
                    ? 'border-[var(--dae-accent)] bg-[var(--dae-accent-soft)]/60'
                    : 'border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)]/60'
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
                  {participant.handle}
                </p>
                <p className="mt-2 text-base leading-7 text-[var(--dae-ink)]">{participant.daeText}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] bg-[var(--dae-surface)] px-4 py-4">
            <p className="text-sm font-medium text-[var(--dae-ink)]">How joining works</p>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-[var(--dae-muted)]">
              <p>1. Sign in.</p>
              <p>2. Keep or submit a DAE that means the same thing.</p>
              <p>3. {moderationState.joinLocked ? 'This room is paused for new joins right now, but you can still follow the topic.' : 'Request to join this room from Review.'}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={
                moderationState.joinLocked
                  ? `/?next=${encodeURIComponent(`/topics/${presentation.topicKey}`)}`
                  : `/?next=${encodeURIComponent(`/review?invite=${matchId}`)}`
              }
              className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent)] hover:opacity-95"
            >
              {moderationState.joinLocked ? 'Sign in to follow topic' : 'Sign in to join'}
            </Link>
            <Link
              href={`/?next=${encodeURIComponent(`/submit?draft=${presentation.searchQuery}&invite=${matchId}`)}`}
              className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
            >
              Add your DAE
            </Link>
            <Link
              href={`/topics/${encodeURIComponent(presentation.topicKey)}`}
              className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
            >
              Open topic
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
