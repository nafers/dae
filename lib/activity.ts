import { createAdminClient } from '@/lib/supabase/server'
import { fetchThreadDirectory, type ThreadDirectoryItem } from '@/lib/thread-directory'
import { chooseRepresentativeText, getTopicLabel } from '@/lib/topic-label'

interface WaitingDaeRow {
  id: string
  text: string
  created_at: string
}

export interface ActivityItem {
  id: string
  kind: 'reply' | 'match' | 'waiting'
  title: string
  detail: string
  href: string
  timestamp: string
  tone: 'cool' | 'warm' | 'rose'
}

export interface ActivitySummary {
  totalCount: number
  unreadCount: number
  waitingCount: number
  freshMatchCount: number
}

function buildThreadHeadline(thread: ThreadDirectoryItem) {
  return chooseRepresentativeText(thread.participants.map((participant) => participant.daeText).filter(Boolean))
}

function buildThreadTopic(thread: ThreadDirectoryItem) {
  return getTopicLabel(thread.participants.map((participant) => participant.daeText).filter(Boolean))
}

export async function fetchActivityFeed(currentUserId: string) {
  const admin = createAdminClient()
  const [threadCards, { data: waitingDaes }] = await Promise.all([
    fetchThreadDirectory({
      currentUserId,
      scope: 'joined',
      limit: 18,
    }),
    admin
      .from('daes')
      .select('id, text, created_at')
      .eq('user_id', currentUserId)
      .eq('status', 'unmatched')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const visibleThreads = threadCards.filter((thread) => !thread.isHidden)
  const unreadThreads = visibleThreads.filter((thread) => thread.hasUnread)
  const quietFreshMatches = visibleThreads.filter((thread) => thread.lastMessagePreview === 'No messages yet')
  const waitingRows = (waitingDaes ?? []) as WaitingDaeRow[]
  const unreadMatchIds = new Set(unreadThreads.map((thread) => thread.matchId))

  const items: ActivityItem[] = [
    ...unreadThreads.map((thread) => ({
      id: `reply-${thread.matchId}`,
      kind: 'reply' as const,
      title: buildThreadHeadline(thread),
      detail: `${thread.lastMessageSenderLabel}: ${thread.lastMessagePreview}`,
      href: `/threads/${thread.matchId}`,
      timestamp: thread.latestActivityAt,
      tone: 'cool' as const,
    })),
    ...quietFreshMatches
      .filter((thread) => !unreadMatchIds.has(thread.matchId))
      .map((thread) => ({
        id: `match-${thread.matchId}`,
        kind: 'match' as const,
        title: buildThreadHeadline(thread),
        detail: `${thread.participantCount} people connected around ${buildThreadTopic(thread)}`,
        href: `/threads/${thread.matchId}`,
        timestamp: thread.createdAt,
        tone: 'rose' as const,
      })),
    ...waitingRows.map((dae) => ({
      id: `waiting-${dae.id}`,
      kind: 'waiting' as const,
      title: dae.text,
      detail: 'Still waiting. Review or browse to attach it somewhere useful.',
      href: '/review',
      timestamp: dae.created_at,
      tone: 'warm' as const,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return {
    items,
    summary: {
      totalCount: unreadThreads.length + waitingRows.length + quietFreshMatches.filter((thread) => !unreadMatchIds.has(thread.matchId)).length,
      unreadCount: unreadThreads.length,
      waitingCount: waitingRows.length,
      freshMatchCount: quietFreshMatches.filter((thread) => !unreadMatchIds.has(thread.matchId)).length,
    } satisfies ActivitySummary,
  }
}
