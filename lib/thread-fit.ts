import { averageEmbeddings, cosineSimilarity, parseEmbedding } from '@/lib/embeddings'
import { extractMeaningfulTokens, scoreTextPair } from '@/lib/text-similarity'
import { chooseRepresentativeText, getTopicKeywords } from '@/lib/topic-label'

interface ThreadFitInput {
  daeText: string
  daeEmbedding?: unknown
  threadTexts: string[]
  threadEmbeddings?: unknown[]
  latestActivityAt?: string
  participantCount?: number
}

export interface ThreadFitResult {
  score: number
  confidenceLabel: 'Strong' | 'Good' | 'Possible'
  sharedTerms: string[]
  reason: string
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function buildReason(sharedTerms: string[], daeText: string, threadTexts: string[]) {
  if (sharedTerms.length > 0) {
    return `Shared: ${sharedTerms.slice(0, 3).join(', ')}`
  }

  const keywords = getTopicKeywords([daeText, ...threadTexts], 3)
  if (keywords.length > 0) {
    return `Nearby topic: ${keywords.join(', ')}`
  }

  return `Closest to: ${chooseRepresentativeText(threadTexts)}`
}

export function scoreThreadAttachmentFit({
  daeText,
  daeEmbedding,
  threadTexts,
  threadEmbeddings = [],
  latestActivityAt,
  participantCount = 0,
}: ThreadFitInput): ThreadFitResult {
  const cleanedThreadTexts = threadTexts.map((text) => text.trim()).filter(Boolean)
  if (cleanedThreadTexts.length === 0) {
    return {
      score: 0,
      confidenceLabel: 'Possible',
      sharedTerms: [],
      reason: 'No similar room yet.',
    }
  }

  const sourceEmbedding = parseEmbedding(daeEmbedding)
  const parsedThreadEmbeddings = threadEmbeddings.map((candidate) => parseEmbedding(candidate))
  const bestSemanticScore = parsedThreadEmbeddings.reduce<number>((bestScore, candidate) => {
    return Math.max(bestScore, cosineSimilarity(sourceEmbedding, candidate))
  }, 0)
  const averageSemanticScore = cosineSimilarity(sourceEmbedding, averageEmbeddings(parsedThreadEmbeddings))
  const semanticScore = bestSemanticScore * 0.7 + averageSemanticScore * 0.3

  const lexicalScores = cleanedThreadTexts
    .map((candidate) => scoreTextPair(daeText, candidate))
    .sort((a, b) => b - a)
  const lexicalScore = lexicalScores[0] ?? 0
  const secondaryLexicalScore =
    lexicalScores.length > 1
      ? lexicalScores.slice(0, Math.min(2, lexicalScores.length)).reduce((sum, score) => sum + score, 0) /
        Math.min(2, lexicalScores.length)
      : lexicalScore

  const topicScore = scoreTextPair(daeText, chooseRepresentativeText(cleanedThreadTexts))
  const sourceTerms = new Set(extractMeaningfulTokens(daeText))
  const sharedTerms = [...sourceTerms].filter((term) =>
    cleanedThreadTexts.some((candidate) => extractMeaningfulTokens(candidate).includes(term))
  )

  const daysSinceActivity = latestActivityAt
    ? (Date.now() - new Date(latestActivityAt).getTime()) / (1000 * 60 * 60 * 24)
    : null
  const recencyBonus =
    daysSinceActivity === null
      ? 0
      : daysSinceActivity <= 1
        ? 0.06
        : daysSinceActivity <= 3
          ? 0.035
          : daysSinceActivity <= 7
            ? 0.015
            : 0
  const crowdBonus = participantCount >= 2 && participantCount <= 4 ? 0.04 : participantCount === 1 ? 0.015 : 0
  const sharedTermsBonus = sharedTerms.length >= 2 ? 0.04 : sharedTerms.length === 1 ? 0.02 : 0

  const score = clamp(
    semanticScore * 0.48 +
      lexicalScore * 0.22 +
      secondaryLexicalScore * 0.08 +
      topicScore * 0.14 +
      recencyBonus +
      crowdBonus +
      sharedTermsBonus
  )

  return {
    score,
    confidenceLabel: score >= 0.74 ? 'Strong' : score >= 0.56 ? 'Good' : 'Possible',
    sharedTerms,
    reason: buildReason(sharedTerms, daeText, cleanedThreadTexts),
  }
}
