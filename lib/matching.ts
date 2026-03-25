import { cosineSimilarity, parseEmbedding } from '@/lib/embeddings'
import { fetchActiveBlockPairs, hasActiveBlockBetween } from '@/lib/blocks'
import { extractMeaningfulTokens, scoreTextPair } from '@/lib/text-similarity'
import { createAdminClient } from '@/lib/supabase/server'

interface MatchCandidateRow {
  id: string
  user_id: string
  text: string
  embedding: unknown
  created_at: string
}

export interface MatchCandidate {
  id: string
  userId: string
  text: string
  similarity: number
  sharedTerms: string[]
}

const RECENT_ACTIVITY_BONUS_MS = 1000 * 60 * 60 * 24 * 2

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function getSharedTerms(sourceText: string, targetText: string) {
  const sourceTerms = new Set(extractMeaningfulTokens(sourceText))
  const targetTerms = new Set(extractMeaningfulTokens(targetText))

  return [...sourceTerms].filter((term) => targetTerms.has(term)).slice(0, 4)
}

function scoreCandidate({
  sourceText,
  sourceEmbedding,
  candidate,
}: {
  sourceText: string
  sourceEmbedding: unknown
  candidate: MatchCandidateRow
}) {
  const semanticScore = cosineSimilarity(parseEmbedding(sourceEmbedding), parseEmbedding(candidate.embedding))
  const lexicalScore = scoreTextPair(sourceText, candidate.text)
  const sharedTerms = getSharedTerms(sourceText, candidate.text)
  const sharedTermsBonus = sharedTerms.length >= 2 ? 0.025 : sharedTerms.length === 1 ? 0.012 : 0
  const recencyBonus =
    Date.now() - new Date(candidate.created_at).getTime() <= RECENT_ACTIVITY_BONUS_MS ? 0.015 : 0
  const similarity = clamp(semanticScore * 0.84 + lexicalScore * 0.14 + sharedTermsBonus + recencyBonus)

  return {
    similarity,
    sharedTerms,
  }
}

export async function findBestMatchCandidate({
  currentUserId,
  sourceText,
  sourceEmbedding,
  threshold,
}: {
  currentUserId: string
  sourceText: string
  sourceEmbedding: unknown
  threshold: number
}) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('daes')
    .select('id, user_id, text, embedding, created_at')
    .eq('status', 'unmatched')
    .neq('user_id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(180)

  const candidateRows = (data ?? []) as MatchCandidateRow[]
  const blockPairs = await fetchActiveBlockPairs([currentUserId, ...candidateRows.map((candidate) => candidate.user_id)])

  const candidates = candidateRows
    .filter((candidate) => !hasActiveBlockBetween(blockPairs, currentUserId, candidate.user_id))
    .map((candidate) => {
      const scored = scoreCandidate({
        sourceText,
        sourceEmbedding,
        candidate,
      })

      return {
        id: candidate.id,
        userId: candidate.user_id,
        text: candidate.text,
        similarity: scored.similarity,
        sharedTerms: scored.sharedTerms,
      } satisfies MatchCandidate
    })
    .sort((a, b) => b.similarity - a.similarity)

  const bestMatch = candidates[0]
  if (!bestMatch || bestMatch.similarity < threshold) {
    return null
  }

  return bestMatch
}
