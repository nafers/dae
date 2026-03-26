import { createAdminClient } from '@/lib/supabase/server'

interface AnalyticsEventRow {
  event_name: string
  match_id: string | null
}

export interface RoomOutcomeSummary {
  matchId: string
  usefulCount: number
  notQuiteCount: number
  reportCount: number
  removalVoteCount: number
  removedCount: number
  attachedFirstMessageCount: number
  autoJoinCount: number
  approvedJoinCount: number
  score: number
  label: 'Working' | 'Mixed' | 'Risky'
  detail: string
}

const OUTCOME_EVENTS = [
  'room_signal_useful',
  'room_signal_not_quite',
  'thread_reported',
  'thread_member_removal_voted',
  'thread_member_removed_by_vote',
  'attached_user_first_message',
  'thread_auto_joined',
  'thread_join_request_approved',
] as const

function clamp(value: number, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function buildOutcomeLabel(score: number): RoomOutcomeSummary['label'] {
  if (score >= 0.24) {
    return 'Working'
  }

  if (score <= -0.2) {
    return 'Risky'
  }

  return 'Mixed'
}

function buildOutcomeDetail(summary: Omit<RoomOutcomeSummary, 'label' | 'detail'>) {
  if (summary.removedCount > 0 || summary.reportCount > 0) {
    return 'Trust friction showed up here.'
  }

  if (summary.usefulCount > summary.notQuiteCount && summary.attachedFirstMessageCount > 0) {
    return 'Rescues here are turning into replies.'
  }

  if (summary.usefulCount > summary.notQuiteCount) {
    return 'People are signaling this room works.'
  }

  if (summary.notQuiteCount > summary.usefulCount) {
    return 'This room gets more weak-fit feedback.'
  }

  if (summary.autoJoinCount + summary.approvedJoinCount > 0) {
    return 'People are joining this room from nearby fits.'
  }

  return 'Not enough room signal yet.'
}

function createSummary(matchId: string): Omit<RoomOutcomeSummary, 'label' | 'detail'> {
  return {
    matchId,
    usefulCount: 0,
    notQuiteCount: 0,
    reportCount: 0,
    removalVoteCount: 0,
    removedCount: 0,
    attachedFirstMessageCount: 0,
    autoJoinCount: 0,
    approvedJoinCount: 0,
    score: 0,
  }
}

function finalizeSummary(summary: Omit<RoomOutcomeSummary, 'label' | 'detail'>): RoomOutcomeSummary {
  const rawScore =
    summary.usefulCount * 0.14 +
    summary.attachedFirstMessageCount * 0.18 +
    summary.autoJoinCount * 0.08 +
    summary.approvedJoinCount * 0.08 -
    summary.notQuiteCount * 0.18 -
    summary.reportCount * 0.2 -
    summary.removedCount * 0.22 -
    summary.removalVoteCount * 0.08

  const score = clamp(rawScore)

  return {
    ...summary,
    score,
    label: buildOutcomeLabel(score),
    detail: buildOutcomeDetail(summary),
  }
}

export async function fetchRoomOutcomeSummaries(matchIds: string[]) {
  const uniqueMatchIds = [...new Set(matchIds.filter(Boolean))]
  const summaryMap = new Map<string, RoomOutcomeSummary>()

  if (uniqueMatchIds.length === 0) {
    return summaryMap
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('analytics_events')
    .select('event_name, match_id')
    .in('match_id', uniqueMatchIds)
    .in('event_name', [...OUTCOME_EVENTS])
    .limit(2000)

  const working = new Map<string, Omit<RoomOutcomeSummary, 'label' | 'detail'>>(
    uniqueMatchIds.map((matchId) => [matchId, createSummary(matchId)] as const)
  )

  for (const row of (data ?? []) as AnalyticsEventRow[]) {
    if (!row.match_id) {
      continue
    }

    const summary = working.get(row.match_id)
    if (!summary) {
      continue
    }

    switch (row.event_name) {
      case 'room_signal_useful':
        summary.usefulCount += 1
        break
      case 'room_signal_not_quite':
        summary.notQuiteCount += 1
        break
      case 'thread_reported':
        summary.reportCount += 1
        break
      case 'thread_member_removal_voted':
        summary.removalVoteCount += 1
        break
      case 'thread_member_removed_by_vote':
        summary.removedCount += 1
        break
      case 'attached_user_first_message':
        summary.attachedFirstMessageCount += 1
        break
      case 'thread_auto_joined':
        summary.autoJoinCount += 1
        break
      case 'thread_join_request_approved':
        summary.approvedJoinCount += 1
        break
      default:
        break
    }
  }

  for (const [matchId, summary] of working) {
    summaryMap.set(matchId, finalizeSummary(summary))
  }

  return summaryMap
}

export function getRoomOutcomeSummary(
  summaryMap: Map<string, RoomOutcomeSummary>,
  matchId: string
): RoomOutcomeSummary {
  return (
    summaryMap.get(matchId) ??
    finalizeSummary(createSummary(matchId))
  )
}
