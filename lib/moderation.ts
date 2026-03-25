import { createAdminClient } from '@/lib/supabase/server'
import { fetchRoomModerationStates } from '@/lib/moderation-state'
import { fetchThreadDirectory, type ThreadDirectoryItem } from '@/lib/thread-directory'

interface ModerationEventRow {
  event_name: string
  user_id: string | null
  match_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ModerationReportItem {
  reportKey: string
  matchId: string | null
  reporterId: string | null
  reason: string
  createdAt: string
  reviewedAt: string | null
  decision: string | null
  reviewerId: string | null
  notes: string | null
  room: ThreadDirectoryItem | null
  roomHidden: boolean
  joinLocked: boolean
  roomReportCount: number
}

function buildReportKey(row: ModerationEventRow) {
  return [row.match_id ?? 'no-room', row.user_id ?? 'anonymous', row.created_at].join(':')
}

export async function fetchModerationQueue(currentUserId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('analytics_events')
    .select('event_name, user_id, match_id, metadata, created_at')
    .in('event_name', ['thread_reported', 'moderation_report_reviewed'])
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = (data ?? []) as ModerationEventRow[]
  const reviewMap = new Map<
    string,
    {
      reviewedAt: string
      decision: string | null
      reviewerId: string | null
      notes: string | null
    }
  >()

  for (const row of rows) {
    if (row.event_name !== 'moderation_report_reviewed') {
      continue
    }

    const reportKey = typeof row.metadata?.reportKey === 'string' ? row.metadata.reportKey : null
    if (!reportKey || reviewMap.has(reportKey)) {
      continue
    }

    reviewMap.set(reportKey, {
      reviewedAt: row.created_at,
      decision: typeof row.metadata?.decision === 'string' ? row.metadata.decision : null,
      reviewerId: row.user_id,
      notes: typeof row.metadata?.notes === 'string' ? row.metadata.notes : null,
    })
  }

  const reportRows = rows.filter((row) => row.event_name === 'thread_reported')
  const matchIds = [...new Set(reportRows.map((row) => row.match_id).filter(Boolean) as string[])]
  const [rooms, roomStates] = await Promise.all([
    matchIds.length > 0
      ? fetchThreadDirectory({
          currentUserId,
          scope: 'all',
          includeState: false,
          matchIds,
          limit: matchIds.length,
        })
      : Promise.resolve([]),
    fetchRoomModerationStates(matchIds),
  ])
  const roomByMatchId = new Map(rooms.map((room) => [room.matchId, room] as const))

  const items = reportRows.map((row) => {
    const reportKey = buildReportKey(row)
    const review = reviewMap.get(reportKey)

    return {
      reportKey,
      matchId: row.match_id,
      reporterId: row.user_id,
      reason: typeof row.metadata?.reason === 'string' ? row.metadata.reason : 'other',
      createdAt: row.created_at,
      reviewedAt: review?.reviewedAt ?? null,
      decision: review?.decision ?? null,
      reviewerId: review?.reviewerId ?? null,
      notes: review?.notes ?? null,
      room: row.match_id ? roomByMatchId.get(row.match_id) ?? null : null,
      roomHidden: row.match_id ? (roomStates.get(row.match_id)?.hidden ?? false) : false,
      joinLocked: row.match_id ? (roomStates.get(row.match_id)?.joinLocked ?? false) : false,
      roomReportCount: row.match_id ? (roomStates.get(row.match_id)?.reportCount ?? 0) : 0,
    } satisfies ModerationReportItem
  })

  const unresolved = items.filter((item) => !item.reviewedAt)
  const resolved = items.filter((item) => item.reviewedAt)

  return {
    items,
    unresolved,
    resolved,
  }
}
