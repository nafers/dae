import { createAdminClient } from '@/lib/supabase/server'

interface JoinRequestEventRow {
  id: string
  event_name: string
  user_id: string | null
  match_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ThreadJoinRequest {
  requestId: string
  matchId: string
  requesterId: string
  daeId: string
  daeText: string
  createdAt: string
  state: 'requested' | 'approved' | 'declined' | 'cancelled'
  resolvedAt: string | null
  responderId: string | null
}

const JOIN_REQUEST_EVENTS = [
  'thread_join_requested',
  'thread_join_request_approved',
  'thread_join_request_declined',
  'thread_join_request_cancelled',
] as const

function buildRequestMap(rows: JoinRequestEventRow[]) {
  const requestMap = new Map<string, ThreadJoinRequest>()

  for (const row of rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
    const requestId =
      typeof row.metadata?.requestId === 'string'
        ? row.metadata.requestId
        : row.event_name === 'thread_join_requested'
          ? row.id
          : null

    if (!requestId) {
      continue
    }

    if (row.event_name === 'thread_join_requested') {
      const requesterId =
        typeof row.metadata?.requesterId === 'string' ? row.metadata.requesterId : row.user_id
      const daeId = typeof row.metadata?.daeId === 'string' ? row.metadata.daeId : null
      const daeText = typeof row.metadata?.daeText === 'string' ? row.metadata.daeText : null
      const matchId = typeof row.metadata?.matchId === 'string' ? row.metadata.matchId : row.match_id

      if (!requesterId || !daeId || !daeText || !matchId) {
        continue
      }

      requestMap.set(requestId, {
        requestId,
        matchId,
        requesterId,
        daeId,
        daeText,
        createdAt: row.created_at,
        state: 'requested',
        resolvedAt: null,
        responderId: null,
      })

      continue
    }

    const existing = requestMap.get(requestId)
    if (!existing) {
      continue
    }

    existing.state =
      row.event_name === 'thread_join_request_approved'
        ? 'approved'
        : row.event_name === 'thread_join_request_declined'
          ? 'declined'
          : 'cancelled'
    existing.resolvedAt = row.created_at
    existing.responderId = row.user_id
    requestMap.set(requestId, existing)
  }

  return requestMap
}

async function fetchJoinRequestRows(limit = 240) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('analytics_events')
    .select('id, event_name, user_id, match_id, metadata, created_at')
    .in('event_name', [...JOIN_REQUEST_EVENTS])
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as JoinRequestEventRow[]
}

export async function fetchJoinRequestsForMatches(matchIds: string[]) {
  const uniqueMatchIds = [...new Set(matchIds.filter(Boolean))]
  if (uniqueMatchIds.length === 0) {
    return []
  }

  const rows = await fetchJoinRequestRows()
  return [...buildRequestMap(rows).values()]
    .filter((request) => uniqueMatchIds.includes(request.matchId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function fetchPendingJoinRequestsForMatch(matchId: string) {
  return (await fetchJoinRequestsForMatches([matchId]))
    .filter((request) => request.state === 'requested')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export async function fetchJoinRequestStatesForUser(userId: string) {
  const rows = await fetchJoinRequestRows()
  return [...buildRequestMap(rows).values()]
    .filter((request) => request.requesterId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
