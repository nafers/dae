import { fetchCachedBrowseTopics, type BrowseTopicItem } from '@/lib/browse-directory'
import { fetchTopicCurationStates, getTopicCurationState } from '@/lib/topic-curation'
import { fetchActiveTopicFollows } from '@/lib/topic-follows'
import { scoreTextPair } from '@/lib/text-similarity'

export interface TopicRegistryItem extends BrowseTopicItem {
  isFollowed: boolean
  isPinned: boolean
  relatedTopicKeys: string[]
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

export async function fetchTopicRegistry(currentUserId?: string | null) {
  const topics = await fetchCachedBrowseTopics()
  const [followedTopics, curationStates] = await Promise.all([
    currentUserId ? fetchActiveTopicFollows(currentUserId) : Promise.resolve(new Map()),
    fetchTopicCurationStates(topics.map((topic) => topic.topicKey)),
  ])

  const items = topics.map((topic) => {
    const curation = getTopicCurationState(curationStates, topic.topicKey)
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
    } satisfies TopicRegistryItem
  })
  const visibleItems = items
    .filter((topic) => !getTopicCurationState(curationStates, topic.topicKey).hidden)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1
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
