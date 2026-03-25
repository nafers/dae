import { fetchActiveBlockPairs, hasActiveBlockBetween } from '@/lib/blocks'
import { createAdminClient } from '@/lib/supabase/server'

export async function userHasBlockedParticipantInMatch({
  currentUserId,
  matchId,
}: {
  currentUserId: string
  matchId: string
}) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('thread_participants')
    .select('user_id')
    .eq('match_id', matchId)

  const participantIds = [...new Set((data ?? []).map((participant) => participant.user_id).filter(Boolean))]
  const blockPairs = await fetchActiveBlockPairs([currentUserId, ...participantIds])

  return participantIds.some(
    (participantUserId) =>
      participantUserId !== currentUserId && hasActiveBlockBetween(blockPairs, currentUserId, participantUserId)
  )
}
