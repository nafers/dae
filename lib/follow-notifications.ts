import { Resend } from 'resend'
import { trackAnalyticsEvents } from '@/lib/analytics'
import { createAdminClient } from '@/lib/supabase/server'
import { scoreTextPair } from '@/lib/text-similarity'
import { fetchUserPreferencesMap } from '@/lib/user-preferences'

interface TopicFollowEventRow {
  event_name: string
  user_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface FollowDigestCandidateRow {
  metadata: Record<string, unknown> | null
  created_at: string
}

interface ActiveFollow {
  userId: string
  topicKey: string
  headline: string
  label: string
  searchQuery: string
  followedAt: string
}

interface CandidateItem {
  topicKey: string
  label: string
  searchQuery: string
  promptText: string
  status: 'matched' | 'unmatched'
  createdAt: string
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FOLLOW_EVENTS = ['topic_followed', 'topic_unfollowed'] as const
const DIGEST_COOLDOWN_MS = 1000 * 60 * 60 * 10
const DIGEST_LOOKBACK_MS = 1000 * 60 * 60 * 24
const FOLLOW_MATCH_THRESHOLD = 0.42
const DIGEST_FROM = 'Hey DAE <hello@heydae.app>'
const DIGEST_SUBJECT = 'New DAE around topics you follow'

function isRecent(timestamp: string | null, windowMs: number) {
  if (!timestamp) {
    return false
  }

  return Date.now() - new Date(timestamp).getTime() < windowMs
}

function buildActiveFollowMap(rows: TopicFollowEventRow[]) {
  const followMap = new Map<string, ActiveFollow[]>()
  const resolvedSelections = new Set<string>()

  for (const row of rows) {
    if (!row.user_id) {
      continue
    }

    const topicKey = typeof row.metadata?.topicKey === 'string' ? row.metadata.topicKey : null
    if (!topicKey) {
      continue
    }

    const selectionKey = `${row.user_id}:${topicKey}`
    if (resolvedSelections.has(selectionKey)) {
      continue
    }

    resolvedSelections.add(selectionKey)

    if (row.event_name !== 'topic_followed') {
      continue
    }

    const headline = typeof row.metadata?.headline === 'string' ? row.metadata.headline : topicKey
    const label = typeof row.metadata?.label === 'string' ? row.metadata.label : headline
    const searchQuery =
      typeof row.metadata?.searchQuery === 'string' && row.metadata.searchQuery.trim()
        ? row.metadata.searchQuery.trim()
        : headline

    const current = followMap.get(row.user_id) ?? []
    current.push({
      userId: row.user_id,
      topicKey,
      headline,
      label,
      searchQuery,
      followedAt: row.created_at,
    })
    followMap.set(row.user_id, current)
  }

  return followMap
}

function scoreFollowMatch(
  daeText: string,
  follow: Pick<ActiveFollow, 'headline' | 'label' | 'searchQuery'>
) {
  return Math.max(
    scoreTextPair(daeText, follow.headline),
    scoreTextPair(daeText, follow.label),
    scoreTextPair(daeText, follow.searchQuery)
  )
}

async function fetchRecentDigestCandidates(userId: string) {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - DIGEST_LOOKBACK_MS).toISOString()
  const { data } = await admin
    .from('analytics_events')
    .select('metadata, created_at')
    .eq('user_id', userId)
    .eq('event_name', 'topic_follow_digest_candidate')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(8)

  const uniqueItems = new Map<string, CandidateItem>()

  for (const row of (data ?? []) as FollowDigestCandidateRow[]) {
    const promptText = typeof row.metadata?.promptText === 'string' ? row.metadata.promptText : null
    const topicKey = typeof row.metadata?.topicKey === 'string' ? row.metadata.topicKey : null
    const label = typeof row.metadata?.label === 'string' ? row.metadata.label : 'Shared idea'
    const searchQuery =
      typeof row.metadata?.searchQuery === 'string' && row.metadata.searchQuery.trim()
        ? row.metadata.searchQuery.trim()
        : label
    const status = row.metadata?.status === 'matched' ? 'matched' : 'unmatched'

    if (!promptText || !topicKey) {
      continue
    }

    const key = `${topicKey}:${promptText}`
    if (!uniqueItems.has(key)) {
      uniqueItems.set(key, {
        topicKey,
        label,
        searchQuery,
        promptText,
        status,
        createdAt: row.created_at,
      })
    }
  }

  return [...uniqueItems.values()].slice(0, 3)
}

function buildDigestHtml(items: CandidateItem[]) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const firstItem = items[0]
  const intro = items.length === 1 ? 'A new prompt just landed.' : `${items.length} new prompts just landed.`

  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1c1917;">
      <p style="font-size: 12px; font-weight: 700; color: #c85863; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px;">DAE</p>
      <h1 style="font-size: 26px; line-height: 1.25; font-weight: 700; margin: 0 0 10px;">New activity in topics you follow.</h1>
      <p style="margin: 0 0 22px; color: #57534e;">${intro}</p>

      ${items
        .map(
          (item) => `
            <div style="background: #fffaf4; border: 1px solid #e8ddd0; border-radius: 20px; padding: 18px; margin-bottom: 14px;">
              <p style="font-size: 12px; font-weight: 700; color: #c85863; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 8px;">${item.label}</p>
              <p style="margin: 0; color: #1c1917;">${item.promptText}</p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #78716c;">
                ${item.status === 'matched' ? 'Already connected in DAE.' : 'Still waiting in the pool.'}
              </p>
            </div>
          `
        )
        .join('')}

      <a href="${appUrl}/topics?q=${encodeURIComponent(firstItem?.searchQuery ?? '')}" style="display: inline-block; background: #c85863; color: #ffffff; padding: 12px 18px; border-radius: 999px; text-decoration: none; font-weight: 700;">
        Open DAE
      </a>

      <p style="margin-top: 18px; font-size: 12px; color: #78716c;">
        Followed topics only. No real names are shown.
      </p>
    </div>
  `
}

export async function sendTopicFollowDigest({
  submitterId,
  daeId,
  daeText,
  status,
}: {
  submitterId: string
  daeId: string
  daeText: string
  status: 'matched' | 'unmatched'
}) {
  if (!resend || !process.env.NEXT_PUBLIC_APP_URL) {
    return
  }

  try {
    const admin = createAdminClient()
    const { data: followEvents } = await admin
      .from('analytics_events')
      .select('event_name, user_id, metadata, created_at')
      .in('event_name', [...FOLLOW_EVENTS])
      .order('created_at', { ascending: false })
      .limit(1200)

    const activeFollowMap = buildActiveFollowMap((followEvents ?? []) as TopicFollowEventRow[])
    const candidateAnalytics = []
    const candidateByUser = new Map<
      string,
      {
        label: string
        topicKey: string
        searchQuery: string
      }
    >()

    for (const [userId, follows] of activeFollowMap) {
      if (userId === submitterId) {
        continue
      }

      const bestFollow = follows
        .map((follow) => ({
          follow,
          score: scoreFollowMatch(daeText, follow),
        }))
        .sort((a, b) => b.score - a.score)[0]

      if (!bestFollow || bestFollow.score < FOLLOW_MATCH_THRESHOLD) {
        continue
      }

      candidateByUser.set(userId, {
        label: bestFollow.follow.label,
        topicKey: bestFollow.follow.topicKey,
        searchQuery: bestFollow.follow.searchQuery,
      })

      candidateAnalytics.push({
        eventName: 'topic_follow_digest_candidate',
        userId,
        daeId,
        metadata: {
          topicKey: bestFollow.follow.topicKey,
          label: bestFollow.follow.label,
          searchQuery: bestFollow.follow.searchQuery,
          promptText: daeText,
          status,
        },
      })
    }

    if (candidateAnalytics.length === 0) {
      return
    }

    await trackAnalyticsEvents(candidateAnalytics)

    const targetUserIds = [...candidateByUser.keys()]
    const [{ data: recentDigestEvents }, preferenceMap] = await Promise.all([
      admin
        .from('analytics_events')
        .select('user_id, created_at')
        .eq('event_name', 'topic_follow_digest_sent')
        .in('user_id', targetUserIds)
        .order('created_at', { ascending: false })
        .limit(200),
      fetchUserPreferencesMap(targetUserIds),
    ])

    const latestDigestByUser = new Map<string, string>()
    for (const row of recentDigestEvents ?? []) {
      if (row.user_id && !latestDigestByUser.has(row.user_id)) {
        latestDigestByUser.set(row.user_id, row.created_at)
      }
    }

    const results = []

    for (const userId of targetUserIds) {
      const candidate = candidateByUser.get(userId)
      if (!candidate) {
        continue
      }

      const preferences = preferenceMap.get(userId)
      if (preferences && !preferences.matchEmails) {
        results.push({
          eventName: 'topic_follow_digest_skipped',
          userId,
          daeId,
          metadata: {
            reason: 'match_emails_off',
            topicKey: candidate.topicKey,
          },
        })
        continue
      }

      if (isRecent(latestDigestByUser.get(userId) ?? null, DIGEST_COOLDOWN_MS)) {
        results.push({
          eventName: 'topic_follow_digest_skipped',
          userId,
          daeId,
          metadata: {
            reason: 'cooldown',
            topicKey: candidate.topicKey,
          },
        })
        continue
      }

      const [{ data: authUser }, recentItems] = await Promise.all([
        admin.auth.admin.getUserById(userId),
        fetchRecentDigestCandidates(userId),
      ])
      const email = authUser.user?.email ?? null

      if (!email || recentItems.length === 0) {
        results.push({
          eventName: 'topic_follow_digest_skipped',
          userId,
          daeId,
          metadata: {
            reason: email ? 'no_recent_items' : 'missing_email',
            topicKey: candidate.topicKey,
          },
        })
        continue
      }

      try {
        await resend.emails.send({
          from: DIGEST_FROM,
          to: email,
          subject: `${DIGEST_SUBJECT}: ${candidate.label}`,
          html: buildDigestHtml(recentItems),
        })

        results.push({
          eventName: 'topic_follow_digest_sent',
          userId,
          daeId,
          metadata: {
            topicKey: candidate.topicKey,
            itemCount: recentItems.length,
          },
        })
      } catch (error) {
        console.error('Topic follow digest send failed:', {
          userId,
          daeId,
          topicKey: candidate.topicKey,
          error,
        })

        results.push({
          eventName: 'topic_follow_digest_failed',
          userId,
          daeId,
          metadata: {
            topicKey: candidate.topicKey,
          },
        })
      }
    }

    await trackAnalyticsEvents(results)
  } catch (error) {
    console.error('Unexpected topic follow digest error:', {
      submitterId,
      daeId,
      error,
    })
  }
}
