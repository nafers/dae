import { createAdminClient } from '@/lib/supabase/server'
import { isMissingRelationError } from '@/lib/supabase-fallback'

interface TopicFollowEventRow {
  event_name: string
  created_at: string
  metadata: Record<string, unknown> | null
}

export interface TopicFollowState {
  topicKey: string
  headline: string
  label: string
  searchQuery: string
  followedAt: string
}

const FOLLOW_EVENTS = ['topic_followed', 'topic_unfollowed'] as const

export async function fetchActiveTopicFollows(userId: string) {
  const admin = createAdminClient()
  const { data: followRows, error: followError } = await admin
    .from('topic_follows')
    .select('topic_key, headline, label, search_query, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (!followError && Array.isArray(followRows)) {
    return new Map(
      followRows.map((row) => [
        row.topic_key,
        {
          topicKey: row.topic_key,
          headline: row.headline,
          label: row.label,
          searchQuery: row.search_query,
          followedAt: row.updated_at ?? row.created_at,
        } satisfies TopicFollowState,
      ])
    )
  }

  if (followError && !isMissingRelationError(followError)) {
    console.error('Topic follow fetch error:', followError)
  }

  const { data } = await admin
    .from('analytics_events')
    .select('event_name, created_at, metadata')
    .eq('user_id', userId)
    .in('event_name', [...FOLLOW_EVENTS])
    .order('created_at', { ascending: false })
    .limit(200)

  const followMap = new Map<string, TopicFollowState>()
  const resolvedKeys = new Set<string>()

  for (const row of (data ?? []) as TopicFollowEventRow[]) {
    const topicKey = typeof row.metadata?.topicKey === 'string' ? row.metadata.topicKey : null

    if (!topicKey || resolvedKeys.has(topicKey)) {
      continue
    }

    resolvedKeys.add(topicKey)

    if (row.event_name !== 'topic_followed') {
      continue
    }

    const headline = typeof row.metadata?.headline === 'string' ? row.metadata.headline : 'Shared idea'
    const label = typeof row.metadata?.label === 'string' ? row.metadata.label : headline
    const searchQuery =
      typeof row.metadata?.searchQuery === 'string' && row.metadata.searchQuery.trim()
        ? row.metadata.searchQuery.trim()
        : headline

    followMap.set(topicKey, {
      topicKey,
      headline,
      label,
      searchQuery,
      followedAt: row.created_at,
    })
  }

  return followMap
}
