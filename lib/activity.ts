import { createAdminClient } from '@/lib/supabase/server'
import { fetchCachedBrowseTopics } from '@/lib/browse-directory'
import { fetchThreadDirectory, type ThreadDirectoryItem } from '@/lib/thread-directory'
import { fetchJoinRequestsForMatches, fetchJoinRequestStatesForUser } from '@/lib/thread-join-requests'
import { fetchActiveTopicFollows } from '@/lib/topic-follows'
import { chooseRepresentativeText, getTopicLabel } from '@/lib/topic-label'

interface WaitingDaeRow {
  id: string
  text: string
  created_at: string
}

interface ActivityDismissEventRow {
  metadata: Record<string, unknown> | null
}

export interface ActivityItem {
  id: string
  kind: 'reply' | 'match' | 'waiting' | 'follow' | 'request'
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

async function fetchDismissedActivityIds(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('analytics_events')
    .select('metadata')
    .eq('user_id', userId)
    .eq('event_name', 'activity_dismissed')
    .order('created_at', { ascending: false })
    .limit(200)

  const dismissedItemIds = new Set<string>()

  for (const row of (data ?? []) as ActivityDismissEventRow[]) {
    const itemId = typeof row.metadata?.itemId === 'string' ? row.metadata.itemId : null
    if (itemId) {
      dismissedItemIds.add(itemId)
    }
  }

  return dismissedItemIds
}

export async function fetchActivityFeed(currentUserId: string) {
  const admin = createAdminClient()
  const [threadCards, { data: waitingDaes }, followedTopics, browseTopics, myJoinRequests] =
    await Promise.all([
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
      fetchActiveTopicFollows(currentUserId),
      fetchCachedBrowseTopics(),
      fetchJoinRequestStatesForUser(currentUserId),
    ])

  const visibleThreads = threadCards.filter((thread) => !thread.isHidden)
  const unreadThreads = visibleThreads.filter((thread) => thread.hasUnread)
  const quietFreshMatches = visibleThreads.filter((thread) => thread.lastMessagePreview === 'No messages yet')
  const waitingRows = (waitingDaes ?? []) as WaitingDaeRow[]
  const unreadMatchIds = new Set(unreadThreads.map((thread) => thread.matchId))
  const incomingJoinRequests = (await fetchJoinRequestsForMatches(visibleThreads.map((thread) => thread.matchId)))
    .filter((request) => request.state === 'requested' && request.requesterId !== currentUserId)
  const dismissedItemIds = await fetchDismissedActivityIds(currentUserId)

  const browseTopicByKey = new Map(browseTopics.map((topic) => [topic.topicKey, topic] as const))
  const followedTopicItems = [...followedTopics.values()]
    .map((follow) => {
      const topic = browseTopicByKey.get(follow.topicKey)
      if (!topic) {
        return null
      }

      if (new Date(topic.latestAt).getTime() <= new Date(follow.followedAt).getTime()) {
        return null
      }

      return {
        id: `follow:${follow.topicKey}:${topic.latestAt}`,
        kind: 'follow' as const,
        title: follow.label,
        detail: topic.summary,
        href: `/topics/${encodeURIComponent(follow.topicKey)}`,
        timestamp: topic.latestAt,
        tone: 'rose' as const,
      }
    })
    .filter((item) => item !== null)

  const threadByMatchId = new Map(visibleThreads.map((thread) => [thread.matchId, thread] as const))

  const requestItems: ActivityItem[] = [
    ...incomingJoinRequests.map((request) => {
      const thread = threadByMatchId.get(request.matchId)
      const threadTitle = thread ? buildThreadHeadline(thread) : 'Your room'

      return {
        id: `request:${request.requestId}:requested`,
        kind: 'request' as const,
        title: threadTitle,
        detail: `Someone wants in with: ${request.daeText}`,
        href: `/threads/${request.matchId}?focus=requests`,
        timestamp: request.createdAt,
        tone: 'warm' as const,
      }
    }),
    ...myJoinRequests.map((request) => {
      const stateLabel =
        request.state === 'requested'
          ? 'Waiting on approval.'
          : request.state === 'approved'
            ? 'Approved. Your DAE was attached.'
            : request.state === 'declined'
              ? 'Declined. Try another room.'
              : 'Canceled.'

      return {
        id: `request:${request.requestId}:${request.state}:${request.resolvedAt ?? request.createdAt}`,
        kind: 'request' as const,
        title: request.daeText,
        detail: stateLabel,
        href: request.state === 'approved' ? `/threads/${request.matchId}?jump=latest` : '/place',
        timestamp: request.resolvedAt ?? request.createdAt,
        tone: request.state === 'approved' ? ('cool' as const) : ('warm' as const),
      }
    }),
  ]

  const items: ActivityItem[] = [
    ...unreadThreads.map((thread) => ({
      id: `reply:${thread.matchId}:${thread.latestActivityAt}`,
      kind: 'reply' as const,
      title: buildThreadHeadline(thread),
      detail: `${thread.lastMessageSenderLabel}: ${thread.lastMessagePreview}`,
      href: `/threads/${thread.matchId}?jump=unread`,
      timestamp: thread.latestActivityAt,
      tone: 'cool' as const,
    })),
    ...quietFreshMatches
      .filter((thread) => !unreadMatchIds.has(thread.matchId))
      .map((thread) => ({
        id: `match:${thread.matchId}:${thread.createdAt}`,
        kind: 'match' as const,
        title: buildThreadHeadline(thread),
        detail: `${thread.participantCount} people connected around ${buildThreadTopic(thread)}`,
        href: `/threads/${thread.matchId}`,
        timestamp: thread.createdAt,
        tone: 'rose' as const,
      })),
    ...requestItems,
    ...followedTopicItems,
    ...waitingRows.map((dae) => ({
      id: `waiting:${dae.id}`,
      kind: 'waiting' as const,
      title: dae.text,
      detail: 'Still waiting. Place it into the best room or leave it in the pool.',
      href: '/place',
      timestamp: dae.created_at,
      tone: 'warm' as const,
    })),
  ]
    .filter((item) => !dismissedItemIds.has(item.id))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return {
    items,
    summary: {
      totalCount: items.length,
      unreadCount: items.filter((item) => item.kind === 'reply').length,
      waitingCount: items.filter((item) => item.kind === 'waiting').length,
      freshMatchCount: items.filter((item) => item.kind === 'match').length,
    } satisfies ActivitySummary,
  }
}
