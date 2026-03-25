import { fetchCachedBrowseTopics, type BrowseTopicItem } from '@/lib/browse-directory'
import { fetchRoomModerationStates, getRoomModerationState } from '@/lib/moderation-state'
import { scoreTextPair } from '@/lib/text-similarity'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchThreadDirectory } from '@/lib/thread-directory'

interface TopicHubWaitingRow {
  id: string
  text: string
  status: 'matched' | 'unmatched'
  created_at: string
}

export async function fetchTopicByKey(topicKey: string) {
  const topics = await fetchCachedBrowseTopics()
  return topics.find((topic) => topic.topicKey === topicKey) ?? null
}

function scoreTopicAffinity(topic: BrowseTopicItem, text: string) {
  return Math.max(
    scoreTextPair(topic.headline, text),
    scoreTextPair(topic.summary, text),
    ...topic.keywords.map((keyword) => scoreTextPair(keyword, text)),
    scoreTextPair(topic.searchQuery, text)
  )
}

export async function fetchTopicHubData({
  topic,
  currentUserId,
}: {
  topic: BrowseTopicItem
  currentUserId?: string | null
}) {
  const admin = createAdminClient()
  const [{ data: daes }, threads] = await Promise.all([
    admin.from('daes').select('id, text, status, created_at').order('created_at', { ascending: false }).limit(160),
    fetchThreadDirectory({
      currentUserId: currentUserId ?? '__guest__',
      scope: 'all',
      limit: 28,
      includeState: Boolean(currentUserId),
      includeMessages: false,
    }),
  ])
  const roomStates = await fetchRoomModerationStates(threads.map((thread) => thread.matchId))

  const waitingPrompts = ((daes ?? []) as TopicHubWaitingRow[])
    .filter((dae) => dae.status === 'unmatched' && scoreTopicAffinity(topic, dae.text) >= 0.34)
    .slice(0, 8)

  const relatedRooms = threads
    .filter((thread) => !getRoomModerationState(roomStates, thread.matchId).hidden)
    .map((thread) => ({
      thread,
      score: Math.max(...thread.participants.map((participant) => scoreTopicAffinity(topic, participant.daeText)), 0),
    }))
    .filter((entry) => entry.score >= 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.thread)

  return {
    waitingPrompts,
    relatedRooms,
  }
}
