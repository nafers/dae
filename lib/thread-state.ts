import { createAdminClient } from '@/lib/supabase/server'

interface AnalyticsStateRow {
  event_name: string
  user_id: string | null
  match_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ThreadUserState {
  hidden: boolean
  muted: boolean
  lastSeenAt: string | null
  lastReportedAt: string | null
  lastReportReason: string | null
}

const THREAD_STATE_EVENTS = [
  'thread_opened',
  'thread_seen',
  'message_sent',
  'thread_muted',
  'thread_unmuted',
  'thread_hidden',
  'thread_unhidden',
  'thread_reported',
] as const

const seenEvents = new Set<string>(['thread_opened', 'thread_seen', 'message_sent'])

function buildThreadStateKey(userId: string, matchId: string) {
  return `${userId}:${matchId}`
}

function createDefaultThreadUserState(): ThreadUserState {
  return {
    hidden: false,
    muted: false,
    lastSeenAt: null,
    lastReportedAt: null,
    lastReportReason: null,
  }
}

export function getThreadUserState(
  stateMap: Map<string, ThreadUserState>,
  userId: string,
  matchId: string
) {
  return stateMap.get(buildThreadStateKey(userId, matchId)) ?? createDefaultThreadUserState()
}

export async function fetchThreadUserStates({
  userIds,
  matchIds,
}: {
  userIds: string[]
  matchIds: string[]
}) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))]
  const uniqueMatchIds = [...new Set(matchIds.filter(Boolean))]

  if (uniqueUserIds.length === 0 || uniqueMatchIds.length === 0) {
    return new Map<string, ThreadUserState>()
  }

  const admin = createAdminClient()
  const estimatedLimit = Math.min(240, Math.max(24, uniqueUserIds.length * uniqueMatchIds.length * 8))
  const { data } = await admin
    .from('analytics_events')
    .select('event_name, user_id, match_id, metadata, created_at')
    .in('user_id', uniqueUserIds)
    .in('match_id', uniqueMatchIds)
    .in('event_name', [...THREAD_STATE_EVENTS])
    .order('created_at', { ascending: false })
    .limit(estimatedLimit)

  const stateMap = new Map<string, ThreadUserState>()
  const resolvedMute = new Set<string>()
  const resolvedHidden = new Set<string>()

  for (const row of (data ?? []) as AnalyticsStateRow[]) {
    if (!row.user_id || !row.match_id) {
      continue
    }

    const key = buildThreadStateKey(row.user_id, row.match_id)
    const state = stateMap.get(key) ?? createDefaultThreadUserState()

    if (!state.lastSeenAt && seenEvents.has(row.event_name)) {
      state.lastSeenAt = row.created_at
    }

    if (!resolvedMute.has(key) && (row.event_name === 'thread_muted' || row.event_name === 'thread_unmuted')) {
      state.muted = row.event_name === 'thread_muted'
      resolvedMute.add(key)
    }

    if (!resolvedHidden.has(key) && (row.event_name === 'thread_hidden' || row.event_name === 'thread_unhidden')) {
      state.hidden = row.event_name === 'thread_hidden'
      resolvedHidden.add(key)
    }

    if (!state.lastReportedAt && row.event_name === 'thread_reported') {
      state.lastReportedAt = row.created_at
      const reason = row.metadata?.reason
      state.lastReportReason = typeof reason === 'string' ? reason : null
    }

    stateMap.set(key, state)
  }

  return stateMap
}
