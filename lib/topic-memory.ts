import type { ThreadDirectoryItem } from '@/lib/thread-directory'
import { chooseRepresentativeText } from '@/lib/topic-label'

interface WaitingPrompt {
  id: string
  text: string
  created_at: string
}

export function buildTopicMemorySummary({
  relatedRooms,
  waitingPrompts,
}: {
  relatedRooms: ThreadDirectoryItem[]
  waitingPrompts: WaitingPrompt[]
}) {
  if (relatedRooms.length === 0 && waitingPrompts.length === 0) {
    return 'Nothing has gathered around this topic yet.'
  }

  const leadRoom = relatedRooms[0]
  const leadPrompt = waitingPrompts[0]
  const pieces: string[] = []

  if (leadRoom) {
    const roomHeadline = chooseRepresentativeText(
      leadRoom.participants.map((participant) => participant.daeText).filter(Boolean)
    )
    pieces.push(
      `${relatedRooms.length} active room${relatedRooms.length === 1 ? '' : 's'} are circling ${roomHeadline}.`
    )
  }

  if (leadPrompt) {
    pieces.push(
      `${waitingPrompts.length} waiting prompt${waitingPrompts.length === 1 ? ' is' : 's are'} still trying to land here.`
    )
    pieces.push(`Latest wording in the pool: ${leadPrompt.text}`)
  }

  return pieces.join(' ')
}
