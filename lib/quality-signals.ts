import { createAdminClient } from '@/lib/supabase/server'

interface QualitySignalRow {
  event_name: string
  user_id: string | null
  match_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type TopicSignalType = 'same_here' | 'not_for_me'
export type RoomSignalType = 'useful' | 'not_quite'

export interface TopicSignalSummary {
  sameHereCount: number
  notForMeCount: number
  mySignal: TopicSignalType | null
}

export interface RoomSignalSummary {
  usefulCount: number
  notQuiteCount: number
  mySignal: RoomSignalType | null
}

const TOPIC_SIGNAL_EVENT_MAP: Record<TopicSignalType, string> = {
  same_here: 'topic_signal_same_here',
  not_for_me: 'topic_signal_not_for_me',
}

const ROOM_SIGNAL_EVENT_MAP: Record<RoomSignalType, string> = {
  useful: 'room_signal_useful',
  not_quite: 'room_signal_not_quite',
}

const TOPIC_SIGNAL_EVENT_TO_TYPE = new Map<string, TopicSignalType>(
  Object.entries(TOPIC_SIGNAL_EVENT_MAP).map(([type, eventName]) => [eventName, type as TopicSignalType])
)

const ROOM_SIGNAL_EVENT_TO_TYPE = new Map<string, RoomSignalType>(
  Object.entries(ROOM_SIGNAL_EVENT_MAP).map(([type, eventName]) => [eventName, type as RoomSignalType])
)

function createTopicSummary(): TopicSignalSummary {
  return {
    sameHereCount: 0,
    notForMeCount: 0,
    mySignal: null,
  }
}

function createRoomSummary(): RoomSignalSummary {
  return {
    usefulCount: 0,
    notQuiteCount: 0,
    mySignal: null,
  }
}

export function getTopicSignalEventName(signal: TopicSignalType) {
  return TOPIC_SIGNAL_EVENT_MAP[signal]
}

export function getRoomSignalEventName(signal: RoomSignalType) {
  return ROOM_SIGNAL_EVENT_MAP[signal]
}

export async function fetchTopicSignalSummaries({
  topicKeys,
  currentUserId,
}: {
  topicKeys: string[]
  currentUserId?: string | null
}) {
  const uniqueTopicKeys = [...new Set(topicKeys.filter(Boolean))]
  const summaryMap = new Map<string, TopicSignalSummary>(
    uniqueTopicKeys.map((topicKey) => [topicKey, createTopicSummary()] as const)
  )

  if (uniqueTopicKeys.length === 0) {
    return summaryMap
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('analytics_events')
    .select('event_name, user_id, metadata, created_at')
    .in('event_name', [...TOPIC_SIGNAL_EVENT_TO_TYPE.keys()])
    .order('created_at', { ascending: false })
    .limit(1200)

  const latestSelectionByTopicUser = new Map<string, TopicSignalType>()

  for (const row of (data ?? []) as QualitySignalRow[]) {
    if (!row.user_id) {
      continue
    }

    const topicKey = typeof row.metadata?.topicKey === 'string' ? row.metadata.topicKey : null
    if (!topicKey || !summaryMap.has(topicKey)) {
      continue
    }

    const signalType = TOPIC_SIGNAL_EVENT_TO_TYPE.get(row.event_name)
    if (!signalType) {
      continue
    }

    const selectionKey = `${topicKey}:${row.user_id}`
    if (!latestSelectionByTopicUser.has(selectionKey)) {
      latestSelectionByTopicUser.set(selectionKey, signalType)
    }
  }

  for (const [selectionKey, signalType] of latestSelectionByTopicUser) {
    const [topicKey, userId] = selectionKey.split(':')
    const summary = summaryMap.get(topicKey)
    if (!summary) {
      continue
    }

    if (signalType === 'same_here') {
      summary.sameHereCount += 1
    } else {
      summary.notForMeCount += 1
    }

    if (currentUserId && userId === currentUserId) {
      summary.mySignal = signalType
    }
  }

  return summaryMap
}

export async function fetchRoomSignalSummary({
  matchId,
  currentUserId,
}: {
  matchId: string
  currentUserId?: string | null
}) {
  const summary = createRoomSummary()

  if (!matchId) {
    return summary
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('analytics_events')
    .select('event_name, user_id, match_id, created_at')
    .eq('match_id', matchId)
    .in('event_name', [...ROOM_SIGNAL_EVENT_TO_TYPE.keys()])
    .order('created_at', { ascending: false })
    .limit(300)

  const latestSelectionByUser = new Map<string, RoomSignalType>()

  for (const row of (data ?? []) as QualitySignalRow[]) {
    if (!row.user_id || row.match_id !== matchId) {
      continue
    }

    const signalType = ROOM_SIGNAL_EVENT_TO_TYPE.get(row.event_name)
    if (!signalType || latestSelectionByUser.has(row.user_id)) {
      continue
    }

    latestSelectionByUser.set(row.user_id, signalType)
  }

  for (const [userId, signalType] of latestSelectionByUser) {
    if (signalType === 'useful') {
      summary.usefulCount += 1
    } else {
      summary.notQuiteCount += 1
    }

    if (currentUserId && userId === currentUserId) {
      summary.mySignal = signalType
    }
  }

  return summary
}
