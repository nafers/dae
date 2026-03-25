interface ThreadMemoryParticipant {
  userId: string
  handle: string
  dae: string
}

interface ThreadMemoryMessage {
  sender_id: string
  content: string
}

function truncateContent(value: string, maxLength = 90) {
  const trimmed = value.trim()

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`
}

export function buildThreadMemorySummary({
  participants,
  messages,
  matchReason,
}: {
  participants: ThreadMemoryParticipant[]
  messages: ThreadMemoryMessage[]
  matchReason: string
}) {
  if (messages.length === 0) {
    return `This room exists because ${matchReason.toLowerCase()}. Nobody has spoken yet.`
  }

  const latestMessage = messages[messages.length - 1]
  const latestSpeaker =
    participants.find((participant) => participant.userId === latestMessage.sender_id)?.handle ?? 'Someone'
  const distinctSpeakers = new Set(messages.map((message) => message.sender_id)).size

  return `${distinctSpeakers} ${
    distinctSpeakers === 1 ? 'person has' : 'people have'
  } posted so far. Latest: ${latestSpeaker} said “${truncateContent(latestMessage.content)}”.`
}
