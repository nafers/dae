import { createAdminClient } from '@/lib/supabase/server'

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
