import type { ThreadDirectoryItem } from '@/lib/thread-directory'

interface TopicActivityPrompt {
  id: string
  text: string
  created_at: string
}

export interface TopicActivityItem {
  id: string
  kind: 'room' | 'waiting'
  title: string
  detail: string
  href: string
  timestamp: string
}

function buildRoomDetail(thread: ThreadDirectoryItem) {
  if (thread.lastMessagePreview !== 'No messages yet') {
    return `${thread.lastMessageSenderLabel}: ${thread.lastMessagePreview}`
  }

  return `${thread.participantCount} people are circling this room.`
}

export function buildTopicActivityFeed({
  relatedRooms,
  waitingPrompts,
}: {
  relatedRooms: ThreadDirectoryItem[]
  waitingPrompts: TopicActivityPrompt[]
}) {
  return [
    ...relatedRooms.map((thread) => ({
      id: `room:${thread.matchId}:${thread.latestActivityAt}`,
      kind: 'room' as const,
      title: `Room ${thread.matchId.slice(0, 8)}`,
      detail: buildRoomDetail(thread),
      href: `/threads/${thread.matchId}`,
      timestamp: thread.latestActivityAt,
    })),
    ...waitingPrompts.map((prompt) => ({
      id: `waiting:${prompt.id}`,
      kind: 'waiting' as const,
      title: prompt.text,
      detail: 'Still waiting for the right rescue or match.',
      href: '/review',
      timestamp: prompt.created_at,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
