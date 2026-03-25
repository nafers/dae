import { createAdminClient } from '@/lib/supabase/server'

interface ThreadParticipantRow {
  user_id: string
  handle: string
  dae_id: string
}

interface RemovalVoteEventRow {
  event_name: string
  user_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ThreadRemovalVoteSummary {
  targetUserId: string
  targetHandle: string
  daeId: string
  votesCount: number
  threshold: number
  myVote: boolean
}

const REMOVAL_VOTE_EVENTS = ['thread_member_removal_voted', 'thread_member_removed_by_vote'] as const

export function getThreadRemovalVoteThreshold(participantCount: number) {
  if (participantCount <= 2) {
    return null
  }

  if (participantCount <= 5) {
    return 2
  }

  return Math.min(3, Math.max(2, Math.ceil(participantCount * 0.25)))
}

export async function fetchThreadParticipantsForVotes(matchId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('thread_participants')
    .select('user_id, handle, dae_id')
    .eq('match_id', matchId)

  return (data ?? []) as ThreadParticipantRow[]
}

export async function fetchThreadRemovalVoteSummary({
  matchId,
  currentUserId,
}: {
  matchId: string
  currentUserId: string
}) {
  const admin = createAdminClient()
  const participants = await fetchThreadParticipantsForVotes(matchId)
  const threshold = getThreadRemovalVoteThreshold(participantCountFromRows(participants))

  if (!threshold) {
    return {
      participantCount: participants.length,
      threshold: null,
      items: [] as ThreadRemovalVoteSummary[],
    }
  }

  const { data: voteEvents } = await admin
    .from('analytics_events')
    .select('event_name, user_id, metadata, created_at')
    .eq('match_id', matchId)
    .in('event_name', [...REMOVAL_VOTE_EVENTS])
    .order('created_at', { ascending: true })
    .limit(500)

  const voterSets = new Map<string, Set<string>>()
  const removedAtByTarget = new Map<string, string>()
  const activeParticipantIds = new Set(participants.map((participant) => participant.user_id))

  for (const event of (voteEvents ?? []) as RemovalVoteEventRow[]) {
    const targetUserId =
      typeof event.metadata?.targetUserId === 'string' ? event.metadata.targetUserId : null

    if (!targetUserId) {
      continue
    }

    if (event.event_name === 'thread_member_removed_by_vote') {
      removedAtByTarget.set(targetUserId, event.created_at)
      continue
    }

    if (!event.user_id || event.user_id === targetUserId || !activeParticipantIds.has(event.user_id)) {
      continue
    }

    const removedAt = removedAtByTarget.get(targetUserId)
    if (removedAt && new Date(event.created_at).getTime() <= new Date(removedAt).getTime()) {
      continue
    }

    const voters = voterSets.get(targetUserId) ?? new Set<string>()
    voters.add(event.user_id)
    voterSets.set(targetUserId, voters)
  }

  return {
    participantCount: participants.length,
    threshold,
    items: participants
      .filter((participant) => participant.user_id !== currentUserId)
      .map((participant) => {
        const voters = voterSets.get(participant.user_id) ?? new Set<string>()

        return {
          targetUserId: participant.user_id,
          targetHandle: participant.handle,
          daeId: participant.dae_id,
          votesCount: voters.size,
          threshold,
          myVote: voters.has(currentUserId),
        } satisfies ThreadRemovalVoteSummary
      }),
  }
}

function participantCountFromRows(rows: ThreadParticipantRow[]) {
  return rows.length
}
