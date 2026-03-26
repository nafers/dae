interface ThreadRecapParticipant {
  userId: string
  handle: string
}

interface ThreadRecapMessage {
  sender_id: string
  content: string
  created_at: string
}

function truncate(value: string, maxLength = 84) {
  const trimmed = value.trim()

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`
}

function extractKeywords(messages: ThreadRecapMessage[]) {
  const stopwords = new Set([
    'about',
    'after',
    'again',
    'also',
    'been',
    'from',
    'have',
    'just',
    'know',
    'like',
    'made',
    'make',
    'more',
    'really',
    'said',
    'some',
    'that',
    'their',
    'there',
    'they',
    'this',
    'were',
    'what',
    'when',
    'with',
    'would',
    'your',
  ])
  const counts = new Map<string, number>()

  for (const message of messages) {
    for (const word of message.content.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
      if (stopwords.has(word)) {
        continue
      }

      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([word]) => word)
}

export function buildThreadRecap({
  participants,
  messages,
  lastSeenAt,
  currentUserId,
}: {
  participants: ThreadRecapParticipant[]
  messages: ThreadRecapMessage[]
  lastSeenAt: string | null
  currentUserId: string
}) {
  const unreadMessages = lastSeenAt
    ? messages.filter(
        (message) =>
          message.sender_id !== currentUserId &&
          new Date(message.created_at).getTime() > new Date(lastSeenAt).getTime()
      )
    : []
  const relevantMessages = unreadMessages.length > 0 ? unreadMessages : messages.slice(-3)

  if (relevantMessages.length === 0) {
    return null
  }

  const distinctSpeakers = [...new Set(relevantMessages.map((message) => message.sender_id))]
  const speakerLabels = distinctSpeakers
    .map(
      (speakerId) =>
        participants.find((participant) => participant.userId === speakerId)?.handle ?? 'Someone'
    )
    .slice(0, 3)
  const latestMessage = relevantMessages[relevantMessages.length - 1]
  const latestSpeaker =
    participants.find((participant) => participant.userId === latestMessage.sender_id)?.handle ?? 'Someone'
  const keywords = extractKeywords(relevantMessages)

  if (unreadMessages.length === 0) {
    return {
      headline: 'Nothing new since your last look',
      detail: `${latestSpeaker} was the last to speak: "${truncate(latestMessage.content)}"`,
      keywords,
      unreadCount: 0,
    }
  }

  const speakerLine =
    speakerLabels.length === 1
      ? speakerLabels[0]
      : speakerLabels.length === 2
        ? `${speakerLabels[0]} and ${speakerLabels[1]}`
        : `${speakerLabels[0]}, ${speakerLabels[1]}, and ${speakerLabels.length - 2} more`
  const keywordLine =
    keywords.length > 0 ? `Mostly around ${keywords.join(', ')}.` : 'Worth jumping back in.'

  return {
    headline: `${unreadMessages.length} new from ${speakerLine}`,
    detail: `${keywordLine} Latest: ${latestSpeaker} said "${truncate(latestMessage.content)}"`,
    keywords,
    unreadCount: unreadMessages.length,
  }
}
