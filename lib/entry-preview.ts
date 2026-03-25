import { fetchTopicByKey } from '@/lib/topic-hubs'
import { chooseRepresentativeText } from '@/lib/topic-label'
import { fetchThreadDirectory } from '@/lib/thread-directory'

export interface EntryPreview {
  eyebrow: string
  title: string
  detail: string
}

function parseInviteMatchId(nextPath: string) {
  try {
    const url = new URL(nextPath, 'https://dae.local')

    return url.searchParams.get('invite')
  } catch {
    return null
  }
}

export async function fetchEntryPreview(nextPath: string) {
  if (nextPath.startsWith('/topics/')) {
    const topicKey = nextPath.replace('/topics/', '').split('?')[0]
    const topic = await fetchTopicByKey(decodeURIComponent(topicKey))

    if (!topic) {
      return null
    }

    return {
      eyebrow: 'Topic',
      title: topic.headline,
      detail: topic.summary,
    } satisfies EntryPreview
  }

  const inviteMatchId = parseInviteMatchId(nextPath)
  if (inviteMatchId) {
    const [thread] = await fetchThreadDirectory({
      currentUserId: '__guest__',
      scope: 'all',
      includeState: false,
      includeMessages: false,
      matchIds: [inviteMatchId],
      limit: 1,
    })

    if (!thread) {
      return null
    }

    return {
      eyebrow: 'Invite',
      title: chooseRepresentativeText(thread.participants.map((participant) => participant.daeText).filter(Boolean)),
      detail: `${thread.participantCount} people are already in this room. Add your version and see if it fits.`,
    } satisfies EntryPreview
  }

  return null
}
