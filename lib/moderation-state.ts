import { createAdminClient } from '@/lib/supabase/server'
import { isMissingRelationError } from '@/lib/supabase-fallback'

interface ModerationStateRow {
  event_name: string
  match_id: string | null
  created_at: string
}

export interface RoomModerationState {
  hidden: boolean
  joinLocked: boolean
  reportCount: number
  lastActionAt: string | null
}

const ROOM_MODERATION_EVENTS = [
  'thread_reported',
  'moderation_room_hidden',
  'moderation_room_restored',
  'moderation_room_join_locked',
  'moderation_room_join_unlocked',
] as const

export async function fetchRoomModerationStates(matchIds: string[]) {
  const uniqueMatchIds = [...new Set(matchIds.filter(Boolean))]
  const stateMap = new Map<string, RoomModerationState>()

  if (uniqueMatchIds.length === 0) {
    return stateMap
  }

  const admin = createAdminClient()
  const { data: tableRows, error: tableError } = await admin
    .from('room_moderation_states')
    .select('match_id, hidden, join_locked, report_count, updated_at')
    .in('match_id', uniqueMatchIds)

  if (!tableError && Array.isArray(tableRows)) {
    for (const matchId of uniqueMatchIds) {
      const row = tableRows.find((entry) => entry.match_id === matchId)
      stateMap.set(matchId, {
        hidden: Boolean(row?.hidden),
        joinLocked: Boolean(row?.join_locked),
        reportCount: row?.report_count ?? 0,
        lastActionAt: row?.updated_at ?? null,
      })
    }

    return stateMap
  }

  if (tableError && !isMissingRelationError(tableError)) {
    console.error('Room moderation fetch error:', tableError)
  }

  const { data } = await admin
    .from('analytics_events')
    .select('event_name, match_id, created_at')
    .in('match_id', uniqueMatchIds)
    .in('event_name', [...ROOM_MODERATION_EVENTS])
    .order('created_at', { ascending: false })
    .limit(Math.max(300, uniqueMatchIds.length * 24))

  const hiddenResolved = new Set<string>()
  const joinsResolved = new Set<string>()

  for (const matchId of uniqueMatchIds) {
    stateMap.set(matchId, {
      hidden: false,
      joinLocked: false,
      reportCount: 0,
      lastActionAt: null,
    })
  }

  for (const row of (data ?? []) as ModerationStateRow[]) {
    if (!row.match_id) {
      continue
    }

    const state = stateMap.get(row.match_id)
    if (!state) {
      continue
    }

    if (!state.lastActionAt) {
      state.lastActionAt = row.created_at
    }

    if (row.event_name === 'thread_reported') {
      state.reportCount += 1
      continue
    }

    if (
      (row.event_name === 'moderation_room_hidden' || row.event_name === 'moderation_room_restored') &&
      !hiddenResolved.has(row.match_id)
    ) {
      state.hidden = row.event_name === 'moderation_room_hidden'
      hiddenResolved.add(row.match_id)
      continue
    }

    if (
      (row.event_name === 'moderation_room_join_locked' ||
        row.event_name === 'moderation_room_join_unlocked') &&
      !joinsResolved.has(row.match_id)
    ) {
      state.joinLocked = row.event_name === 'moderation_room_join_locked'
      joinsResolved.add(row.match_id)
    }
  }

  return stateMap
}

export function getRoomModerationState(
  stateMap: Map<string, RoomModerationState>,
  matchId: string
): RoomModerationState {
  return (
    stateMap.get(matchId) ?? {
      hidden: false,
      joinLocked: false,
      reportCount: 0,
      lastActionAt: null,
    }
  )
}
