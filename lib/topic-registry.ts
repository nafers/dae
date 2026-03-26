import { fetchCachedBrowseTopics, type BrowseTopicItem } from '@/lib/browse-directory'
import { fetchTopicAliasMap, resolveTopicAlias } from '@/lib/topic-aliases'
import { fetchTopicCurationStates, getTopicCurationState } from '@/lib/topic-curation'
import { fetchActiveTopicFollows } from '@/lib/topic-follows'
import { fetchRoomOutcomeSummaries, getRoomOutcomeSummary } from '@/lib/room-outcomes'
import { scoreTextPair } from '@/lib/text-similarity'
import { fetchThreadDirectory } from './thread-directory'

export interface TopicRegistryItem extends BrowseTopicItem {
  isFollowed: boolean
  isPinned: boolean
  relatedTopicKeys: string[]
  canonicalTopicKey: string
  activeRoomCount: number
  workingRoomCount: number
  roomHealthScore: number
  roomHealthLabel: 'Working' | 'Mixed' | 'Risky'
  roomHealthDetail: string
}

function scoreTopicRelation(source: BrowseTopicItem, candidate: BrowseTopicItem) {
  const keywordOverlap = source.keywords.filter((keyword) => candidate.keywords.includes(keyword)).length * 0.08

  return Math.max(
    scoreTextPair(source.headline, candidate.headline),
    scoreTextPair(source.summary, candidate.summary),
    scoreTextPair(source.searchQuery, candidate.searchQuery),
    ...source.keywords.map((keyword) => scoreTextPair(keyword, candidate.summary)),
    keywordOverlap
  )
}

function scoreThreadRelation(topic: BrowseTopicItem, daeTexts: string[], roomSummary: string) {
  const keywordOverlap = topic.keywords.filter((keyword) =>
    daeTexts.some((text) => text.toLowerCase().includes(keyword))
  ).length

  return Math.max(
    scoreTextPair(topic.headline, roomSummary),
    scoreTextPair(topic.summary, roomSummary),
    scoreTextPair(topic.searchQuery, roomSummary),
    ...daeTexts.map((text) => scoreTextPair(topic.headline, text)),
    ...topic.keywords.map((keyword) => scoreTextPair(keyword, roomSummary)),
    keywordOverlap * 0.08
  )
}

export async function fetchTopicRegistry(currentUserId?: string | null) {
  const topics = await fetchCachedBrowseTopics()
  const [followedTopics, curationStates, aliasMap, recentThreads] = await Promise.all([
    currentUserId ? fetchActiveTopicFollows(currentUserId) : Promise.resolve(new Map()),
    fetchTopicCurationStates(topics.map((topic) => topic.topicKey)),
    fetchTopicAliasMap(),
    fetchThreadDirectory({
      currentUserId: currentUserId ?? '__topic-registry__',
      scope: 'all',
      limit: 48,
      includeState: false,
      includeMessages: false,
    }),
  ])
  const roomOutcomeMap = await fetchRoomOutcomeSummaries(recentThreads.map((thread) => thread.matchId))

  const items = topics.map((topic) => {
    const canonicalTopicKey = resolveTopicAlias(topic.topicKey, aliasMap)
    const curation = getTopicCurationState(curationStates, topic.topicKey)
    const relatedRooms = recentThreads
      .map((thread) => {
        const daeTexts = thread.participants.map((participant) => participant.daeText).filter(Boolean)
        const roomSummary = [thread.lastMessagePreview, ...daeTexts].join(' ')

        return {
          thread,
          relationScore: scoreThreadRelation(topic, daeTexts, roomSummary),
          outcome: getRoomOutcomeSummary(roomOutcomeMap, thread.matchId),
        }
      })
      .filter((candidate) => candidate.relationScore >= 0.22)
      .sort((a, b) => b.relationScore - a.relationScore)
      .slice(0, 6)
    const activeRoomCount = relatedRooms.length
    const workingRoomCount = relatedRooms.filter((room) => room.outcome.label === 'Working').length
    const roomHealthScore =
      activeRoomCount > 0
        ? relatedRooms.reduce((total, room) => total + room.outcome.score, 0) / activeRoomCount
        : 0
    const roomHealthLabel =
      roomHealthScore >= 0.2 ? 'Working' : roomHealthScore <= -0.16 ? 'Risky' : 'Mixed'
    const roomHealthDetail =
      activeRoomCount === 0
        ? 'No room history yet.'
        : roomHealthLabel === 'Working'
          ? `${workingRoomCount}/${activeRoomCount} related rooms are producing healthy signal.`
          : roomHealthLabel === 'Risky'
            ? 'Nearby rooms are showing trust friction or weak-fit signal.'
            : 'Some related rooms are working, but it is still mixed.'
    const relatedTopicKeys = topics
      .filter((candidate) => candidate.topicKey !== topic.topicKey)
      .map((candidate) => ({
        topicKey: candidate.topicKey,
        score: scoreTopicRelation(topic, candidate),
      }))
      .filter((candidate) => candidate.score >= 0.26)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((candidate) => candidate.topicKey)

    return {
      ...topic,
      isFollowed: followedTopics.has(topic.topicKey),
      isPinned: curation.pinned,
      relatedTopicKeys,
      canonicalTopicKey,
      activeRoomCount,
      workingRoomCount,
      roomHealthScore,
      roomHealthLabel,
      roomHealthDetail,
    } satisfies TopicRegistryItem
  })
  const visibleItems = items
    .filter(
      (topic) =>
        topic.canonicalTopicKey === topic.topicKey &&
        !getTopicCurationState(curationStates, topic.topicKey).hidden
    )
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1
      }

      if (b.roomHealthScore !== a.roomHealthScore) {
        return b.roomHealthScore - a.roomHealthScore
      }

      if (b.trendScore !== a.trendScore) {
        return b.trendScore - a.trendScore
      }

      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
    })

  return {
    items: visibleItems,
    followed: visibleItems
      .filter((topic) => topic.isFollowed)
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()),
    rising: [...visibleItems]
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1
        }

        if (b.roomHealthScore !== a.roomHealthScore) {
          return b.roomHealthScore - a.roomHealthScore
        }

        if (b.trendScore !== a.trendScore) {
          return b.trendScore - a.trendScore
        }

        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
      })
      .slice(0, 10),
    fresh: visibleItems
      .filter((topic) => topic.freshCount > 0)
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
      .slice(0, 10),
  }
}

export async function fetchRelatedTopics(topicKey: string, limit = 4) {
  const { items } = await fetchTopicRegistry()
  const currentTopic = items.find((topic) => topic.topicKey === topicKey)

  if (!currentTopic) {
    return []
  }

  return currentTopic.relatedTopicKeys
    .map((relatedKey) => items.find((topic) => topic.topicKey === relatedKey) ?? null)
    .filter((topic): topic is TopicRegistryItem => topic !== null)
    .slice(0, limit)
}
