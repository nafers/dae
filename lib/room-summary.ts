import type { ThreadDirectoryItem } from '@/lib/thread-directory'
import { getTopicLabel } from '@/lib/topic-label'

function truncate(value: string, maxLength = 88) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`
}

export function buildRoomSummary(thread: ThreadDirectoryItem) {
  const topicLabel = getTopicLabel(thread.participants.map((participant) => participant.daeText).filter(Boolean))

  if (thread.lastMessagePreview === 'No messages yet') {
    return `${thread.participantCount} people are gathering around ${topicLabel.toLowerCase()}.`
  }

  if (thread.hasUnread) {
    return `${thread.unreadCount} new. ${thread.lastMessageSenderLabel}: ${truncate(thread.lastMessagePreview, 72)}`
  }

  return `${thread.lastMessageSenderLabel}: ${truncate(thread.lastMessagePreview, 72)}`
}
