import { createAdminClient } from '@/lib/supabase/server'
import { isMissingRelationError } from '@/lib/supabase-fallback'

interface TopicAliasEventRow {
  event_name: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const TOPIC_ALIAS_EVENTS = ['topic_alias_set', 'topic_alias_cleared'] as const

export async function fetchTopicAliasMap() {
  const admin = createAdminClient()
  const { data: topicRows, error: topicError } = await admin
    .from('topic_registry_state')
    .select('topic_key, alias_target_key')
    .not('alias_target_key', 'is', null)

  if (!topicError && Array.isArray(topicRows)) {
    return new Map(
      topicRows.map((row) => [row.topic_key, row.alias_target_key as string | null] as const)
    )
  }

  if (topicError && !isMissingRelationError(topicError)) {
    console.error('Topic alias fetch error:', topicError)
  }

  const { data } = await admin
    .from('analytics_events')
    .select('event_name, metadata, created_at')
    .in('event_name', [...TOPIC_ALIAS_EVENTS])
    .order('created_at', { ascending: false })
    .limit(400)

  const aliasMap = new Map<string, string | null>()

  for (const row of (data ?? []) as TopicAliasEventRow[]) {
    const sourceTopicKey =
      typeof row.metadata?.sourceTopicKey === 'string'
        ? row.metadata.sourceTopicKey
        : typeof row.metadata?.topicKey === 'string'
          ? row.metadata.topicKey
          : null

    if (!sourceTopicKey || aliasMap.has(sourceTopicKey)) {
      continue
    }

    if (row.event_name === 'topic_alias_cleared') {
      aliasMap.set(sourceTopicKey, null)
      continue
    }

    const targetTopicKey =
      typeof row.metadata?.targetTopicKey === 'string' ? row.metadata.targetTopicKey : null

    aliasMap.set(sourceTopicKey, targetTopicKey)
  }

  return aliasMap
}

export function resolveTopicAlias(topicKey: string, aliasMap: Map<string, string | null>) {
  let currentKey = topicKey
  const visited = new Set<string>()

  while (true) {
    if (visited.has(currentKey)) {
      return currentKey
    }

    visited.add(currentKey)
    const nextKey = aliasMap.get(currentKey)

    if (!nextKey || nextKey === currentKey) {
      return currentKey
    }

    currentKey = nextKey
  }
}

export function getTopicAliasTarget(
  topicKey: string,
  aliasMap: Map<string, string | null>
) {
  return aliasMap.get(topicKey) ?? null
}

export function getTopicAliasSources(
  targetTopicKey: string,
  aliasMap: Map<string, string | null>
) {
  return [...aliasMap.entries()]
    .filter(([sourceTopicKey, aliasTargetKey]) => aliasTargetKey === targetTopicKey && sourceTopicKey !== targetTopicKey)
    .map(([sourceTopicKey]) => sourceTopicKey)
}
