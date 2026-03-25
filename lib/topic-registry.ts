import { fetchCachedBrowseTopics, type BrowseTopicItem } from '@/lib/browse-directory'
import { fetchActiveTopicFollows } from '@/lib/topic-follows'
import { scoreTextPair } from '@/lib/text-similarity'

export interface TopicRegistryItem extends BrowseTopicItem {
  isFollowed: boolean
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
  const [topics, followedTopics] = await Promise.all([
    fetchCachedBrowseTopics(),
    currentUserId ? fetchActiveTopicFollows(currentUserId) : Promise.resolve(new Map()),
  ])

  const items = topics.map((topic) => {
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
      relatedTopicKeys,
    } satisfies TopicRegistryItem
  })

  return {
    items,
    followed: items
      .filter((topic) => topic.isFollowed)
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()),
    rising: [...items]
      .sort((a, b) => {
        if (b.trendScore !== a.trendScore) {
          return b.trendScore - a.trendScore
        }

        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
      })
      .slice(0, 10),
    fresh: items
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
