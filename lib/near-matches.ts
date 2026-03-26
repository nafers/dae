import { fetchCachedBrowseTopics } from '@/lib/browse-directory'
import { fetchRoomModerationStates, getRoomModerationState } from '@/lib/moderation-state'
import { fetchRoomOutcomeSummaries, getRoomOutcomeSummary } from '@/lib/room-outcomes'
import { canAutoJoinThreadWithFitScore } from '@/lib/thread-join-policy'
import { chooseRepresentativeText, getTopicLabel } from '@/lib/topic-label'
import { scoreTextPair } from '@/lib/text-similarity'
import { fetchThreadDirectory } from '@/lib/thread-directory'
import { scoreThreadAttachmentFit } from '@/lib/thread-fit'

export interface NearTopicMatch {
  topicKey: string
  label: string
  headline: string
  summary: string
  matchPercent: number
}

export interface NearRoomMatch {
  matchId: string
  topicLabel: string
  headline: string
  participantCount: number
  latestActivityAt: string
  confidenceLabel: string
  reason: string
  matchPercent: number
  fitScore: number
  joinMode: 'join_now' | 'request'
  roomHealthLabel: 'Working' | 'Mixed' | 'Risky'
  roomHealthDetail: string
}

export async function fetchNearMatches({
  currentUserId,
  daeText,
  daeEmbedding,
}: {
  currentUserId: string
  daeText: string
  daeEmbedding?: unknown
}) {
  const [topics, discoverThreads] = await Promise.all([
    fetchCachedBrowseTopics(),
    fetchThreadDirectory({
      currentUserId,
      scope: 'discover',
      limit: 18,
      includeEmbeddings: true,
      includeState: false,
      includeMessages: false,
    }),
  ])
  const roomStates = await fetchRoomModerationStates(discoverThreads.map((thread) => thread.matchId))
  const roomOutcomes = await fetchRoomOutcomeSummaries(discoverThreads.map((thread) => thread.matchId))

  const nearTopics = topics
    .map((topic) => ({
      topicKey: topic.topicKey,
      label: topic.label,
      headline: topic.headline,
      summary: topic.summary,
      score: Math.max(
        scoreTextPair(daeText, topic.headline),
        scoreTextPair(daeText, topic.summary),
        scoreTextPair(daeText, topic.searchQuery),
        ...topic.keywords.map((keyword) => scoreTextPair(daeText, keyword))
      ),
    }))
    .filter((topic) => topic.score >= 0.28)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((topic) => ({
      topicKey: topic.topicKey,
      label: topic.label,
      headline: topic.headline,
      summary: topic.summary,
      matchPercent: Math.round(topic.score * 100),
    }) satisfies NearTopicMatch)

  const nearRooms = discoverThreads
    .filter((thread) => !getRoomModerationState(roomStates, thread.matchId).hidden)
    .map((thread) => {
      const fit = scoreThreadAttachmentFit({
        daeText,
        daeEmbedding,
        threadTexts: thread.participants.map((participant) => participant.daeText),
        threadEmbeddings: thread.participants.map((participant) => participant.daeEmbedding),
        latestActivityAt: thread.latestActivityAt,
        participantCount: thread.participantCount,
      })
      const outcome = getRoomOutcomeSummary(roomOutcomes, thread.matchId)

      return {
        matchId: thread.matchId,
        topicLabel: getTopicLabel(thread.participants.map((participant) => participant.daeText).filter(Boolean)),
        headline: chooseRepresentativeText(thread.participants.map((participant) => participant.daeText).filter(Boolean)),
        participantCount: thread.participantCount,
        latestActivityAt: thread.latestActivityAt,
        confidenceLabel: fit.confidenceLabel,
        reason: fit.reason,
        matchPercent: Math.round(fit.score * 100),
        score: fit.score,
        fitScore: fit.score,
        joinMode: canAutoJoinThreadWithFitScore(fit.score) ? ('join_now' as const) : ('request' as const),
        roomHealthLabel: outcome.label,
        roomHealthDetail: outcome.detail,
        rankScore: fit.score + outcome.score * 0.18,
      }
    })
    .filter((thread) => thread.score >= 0.42)
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 3)
    .map((thread) => ({
      matchId: thread.matchId,
      topicLabel: thread.topicLabel,
      headline: thread.headline,
      participantCount: thread.participantCount,
      latestActivityAt: thread.latestActivityAt,
      confidenceLabel: thread.confidenceLabel,
      reason: thread.reason,
      matchPercent: thread.matchPercent,
      fitScore: thread.fitScore,
      joinMode: thread.joinMode,
      roomHealthLabel: thread.roomHealthLabel,
      roomHealthDetail: thread.roomHealthDetail,
    }) satisfies NearRoomMatch)

  return {
    nearTopics,
    nearRooms,
  }
}
