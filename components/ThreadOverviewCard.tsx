import { getParticipantTheme } from '@/lib/chat-theme'
import { ThreadDirectoryItem } from '@/lib/thread-directory'
import { chooseRepresentativeText, getTopicLabel } from '@/lib/topic-label'

interface Props {
  thread: ThreadDirectoryItem
  primaryAction?: React.ReactNode
  secondaryAction?: React.ReactNode
  showLatestActivity?: boolean
}

function formatDate(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ThreadOverviewCard({
  thread,
  primaryAction,
  secondaryAction,
  showLatestActivity = true,
}: Props) {
  const daeTexts = [...new Set(thread.participants.map((participant) => participant.daeText).filter(Boolean))]
  const headline = chooseRepresentativeText(daeTexts)
  const topicLabel = getTopicLabel(daeTexts)
  const supportingDaes = daeTexts.filter((text) => text !== headline).slice(0, 2)

  return (
    <article className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
            {topicLabel}
          </p>
          <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-7 text-[var(--dae-ink)]">
            {headline}
          </h2>
        </div>

        {primaryAction}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {thread.hasUnread ? (
          <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-cool)]">
            {thread.unreadCount > 1 ? `${thread.unreadCount} new` : 'New'}
          </span>
        ) : null}
        {thread.isMuted ? (
          <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
            Muted
          </span>
        ) : null}
        {thread.isHidden ? (
          <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-rose)]">
            Hidden
          </span>
        ) : null}
        <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
          {thread.participantCount} {thread.participantCount === 1 ? 'person' : 'people'}
        </span>
        <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
          Room {thread.matchId.slice(0, 8)}
        </span>
        <span className="text-xs text-[var(--dae-muted)]">{formatDate(thread.latestActivityAt)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {thread.participants.map((participant, index) => {
          const theme = getParticipantTheme(index)

          return (
            <span
              key={`${thread.matchId}-${participant.userId}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${theme.chipClass}`}
            >
              <span className={`h-2 w-2 rounded-full ${theme.dotClass}`} />
              {participant.isMe ? `You (${participant.handle})` : participant.handle}
            </span>
          )
        })}
      </div>

      {supportingDaes.length > 0 ? (
        <div className="mt-3 space-y-2">
          {supportingDaes.map((text) => (
            <div
              key={`${thread.matchId}-${text}`}
              className="rounded-2xl bg-[var(--dae-surface)] px-3 py-2.5 text-sm leading-6 text-[var(--dae-muted)]"
            >
              {text}
            </div>
          ))}
        </div>
      ) : null}

      {showLatestActivity && (
        <div className="mt-3 rounded-2xl bg-[var(--dae-surface)] px-3 py-3">
          <p className="line-clamp-2 text-sm leading-6 text-[var(--dae-muted)]">
            <span className="font-medium text-[var(--dae-ink)]">{thread.lastMessageSenderLabel}</span>
            {' '}
            {thread.lastMessagePreview}
          </p>
        </div>
      )}

      {secondaryAction ? <div className="mt-4 flex flex-wrap items-center gap-3">{secondaryAction}</div> : null}
    </article>
  )
}
