import { createAdminClient } from '@/lib/supabase/server'
import { isMissingRelationError } from '@/lib/supabase-fallback'

interface TopicCurationRow {
  event_name: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface TopicCurationState {
  hidden: boolean
  pinned: boolean
  lastActionAt: string | null
}

const TOPIC_CURATION_EVENTS = [
  'topic_hidden',
  'topic_unhidden',
  'topic_pinned',
  'topic_unpinned',
] as const

export async function fetchTopicCurationStates(topicKeys: string[]) {
  const uniqueTopicKeys = [...new Set(topicKeys.filter(Boolean))]
  const stateMap = new Map<string, TopicCurationState>()

  if (uniqueTopicKeys.length === 0) {
    return stateMap
  }

  const admin = createAdminClient()
  const { data: topicRows, error: topicError } = await admin
    .from('topic_registry_state')
    .select('topic_key, pinned, hidden, updated_at')
    .in('topic_key', uniqueTopicKeys)

  if (!topicError && Array.isArray(topicRows)) {
    for (const topicKey of uniqueTopicKeys) {
      const row = topicRows.find((entry) => entry.topic_key === topicKey)
      stateMap.set(topicKey, {
        hidden: Boolean(row?.hidden),
        pinned: Boolean(row?.pinned),
        lastActionAt: row?.updated_at ?? null,
      })
    }

    return stateMap
  }

  if (topicError && !isMissingRelationError(topicError)) {
    console.error('Topic curation fetch error:', topicError)
  }

  const { data } = await admin
    .from('analytics_events')
    .select('event_name, metadata, created_at')
    .in('event_name', [...TOPIC_CURATION_EVENTS])
    .order('created_at', { ascending: false })
    .limit(600)

  const hiddenResolved = new Set<string>()
  const pinnedResolved = new Set<string>()

  for (const topicKey of uniqueTopicKeys) {
    stateMap.set(topicKey, {
      hidden: false,
      pinned: false,
      lastActionAt: null,
    })
  }

  for (const row of (data ?? []) as TopicCurationRow[]) {
    const topicKey = typeof row.metadata?.topicKey === 'string' ? row.metadata.topicKey : null
    if (!topicKey || !stateMap.has(topicKey)) {
      continue
    }

    const state = stateMap.get(topicKey)
    if (!state) {
      continue
    }

    if (!state.lastActionAt) {
      state.lastActionAt = row.created_at
    }

    if ((row.event_name === 'topic_hidden' || row.event_name === 'topic_unhidden') && !hiddenResolved.has(topicKey)) {
      state.hidden = row.event_name === 'topic_hidden'
      hiddenResolved.add(topicKey)
      continue
    }

    if ((row.event_name === 'topic_pinned' || row.event_name === 'topic_unpinned') && !pinnedResolved.has(topicKey)) {
      state.pinned = row.event_name === 'topic_pinned'
      pinnedResolved.add(topicKey)
    }
  }

  return stateMap
}

export function getTopicCurationState(
  stateMap: Map<string, TopicCurationState>,
  topicKey: string
): TopicCurationState {
  return (
    stateMap.get(topicKey) ?? {
      hidden: false,
      pinned: false,
      lastActionAt: null,
    }
  )
}
