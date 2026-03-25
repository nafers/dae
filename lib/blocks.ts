import { createAdminClient } from '@/lib/supabase/server'

interface BlockEventRow {
  event_name: string
  user_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ActiveBlock {
  targetUserId: string
  targetHandle: string | null
  matchId: string | null
  createdAt: string
}

const BLOCK_EVENTS = ['user_blocked', 'user_unblocked'] as const

function buildPairKey(sourceUserId: string, targetUserId: string) {
  return `${sourceUserId}:${targetUserId}`
}

export async function fetchActiveBlocks(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('analytics_events')
    .select('event_name, user_id, metadata, created_at')
    .eq('user_id', userId)
    .in('event_name', [...BLOCK_EVENTS])
    .order('created_at', { ascending: false })
    .limit(300)

  const blockMap = new Map<string, ActiveBlock>()

  for (const row of (data ?? []) as BlockEventRow[]) {
    const targetUserId = typeof row.metadata?.targetUserId === 'string' ? row.metadata.targetUserId : null
    if (!targetUserId || blockMap.has(targetUserId)) {
      continue
    }

    if (row.event_name !== 'user_blocked') {
      continue
    }

    blockMap.set(targetUserId, {
      targetUserId,
      targetHandle: typeof row.metadata?.targetHandle === 'string' ? row.metadata.targetHandle : null,
      matchId: typeof row.metadata?.matchId === 'string' ? row.metadata.matchId : null,
      createdAt: row.created_at,
    })
  }

  return [...blockMap.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function fetchBlockedUserIdsForUser(userId: string) {
  return new Set((await fetchActiveBlocks(userId)).map((block) => block.targetUserId))
}

export async function fetchActiveBlockPairs(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))]
  const pairSet = new Set<string>()

  if (uniqueUserIds.length === 0) {
    return pairSet
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('analytics_events')
    .select('event_name, user_id, metadata, created_at')
    .in('user_id', uniqueUserIds)
    .in('event_name', [...BLOCK_EVENTS])
    .order('created_at', { ascending: false })
    .limit(600)

  const resolvedPairs = new Set<string>()

  for (const row of (data ?? []) as BlockEventRow[]) {
    if (!row.user_id) {
      continue
    }

    const targetUserId = typeof row.metadata?.targetUserId === 'string' ? row.metadata.targetUserId : null
    if (!targetUserId) {
      continue
    }

    const pairKey = buildPairKey(row.user_id, targetUserId)
    if (resolvedPairs.has(pairKey)) {
      continue
    }

    resolvedPairs.add(pairKey)

    if (row.event_name === 'user_blocked') {
      pairSet.add(pairKey)
    }
  }

  return pairSet
}

export function hasActiveBlockBetween(pairSet: Set<string>, sourceUserId: string, targetUserId: string) {
  return pairSet.has(buildPairKey(sourceUserId, targetUserId)) || pairSet.has(buildPairKey(targetUserId, sourceUserId))
}
