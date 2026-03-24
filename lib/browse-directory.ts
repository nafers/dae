import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { normalizeText, scoreTextPair } from '@/lib/text-similarity'
import {
  chooseRepresentativeText,
  getTopicKeywords,
  getTopicSamples,
  getTopicSummary,
} from '@/lib/topic-label'

interface BrowseDaeRow {
  id: string
  user_id: string
  text: string
  status: 'matched' | 'unmatched'
  created_at: string
}

export interface BrowseTopicItem {
  id: string
  headline: string
  summary: string
  sampleDaes: string[]
  keywords: string[]
  daeCount: number
  uniqueUserCount: number
  waitingCount: number
  matchedCount: number
  recentCount: number
  freshCount: number
  trendScore: number
  latestAt: string
}

function scoreRowForGroup(row: BrowseDaeRow, groupRows: BrowseDaeRow[]) {
  return groupRows.reduce<number>((highestScore, candidate) => {
    return Math.max(highestScore, scoreTextPair(row.text, candidate.text))
  }, 0)
}

function groupDaes(rows: BrowseDaeRow[]) {
  const groups: BrowseDaeRow[][] = []

  for (const row of rows) {
    let bestGroup: BrowseDaeRow[] | null = null
    let bestScore = 0

    for (const group of groups) {
      const groupScore = scoreRowForGroup(row, group)

      if (groupScore > bestScore) {
        bestScore = groupScore
        bestGroup = group
      }
    }

    if (bestGroup && bestScore >= 0.2) {
      bestGroup.push(row)
    } else {
      groups.push([row])
    }
  }

  return groups
}

export async function fetchBrowseTopics(limit = 80) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('daes')
    .select('id, user_id, text, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  const rows = ((data ?? []) as BrowseDaeRow[]).filter((row) => normalizeText(row.text).length > 0)
  const groups = groupDaes(rows)
  const now = Date.now()
  const dayMs = 1000 * 60 * 60 * 24
  const weekMs = dayMs * 7

  return groups
    .map((group) => {
      const texts = [...new Set(group.map((row) => row.text.trim()).filter(Boolean))]
      const headline = chooseRepresentativeText(texts)
      const latestAt = group.reduce((latest, row) => {
        return new Date(row.created_at).getTime() > new Date(latest).getTime() ? row.created_at : latest
      }, group[0]?.created_at ?? new Date().toISOString())
      const waitingCount = group.filter((row) => row.status === 'unmatched').length
      const matchedCount = group.length - waitingCount
      const freshCount = group.filter((row) => now - new Date(row.created_at).getTime() <= dayMs).length
      const recentCount = group.filter((row) => now - new Date(row.created_at).getTime() <= weekMs).length
      const uniqueUserCount = new Set(group.map((row) => row.user_id)).size
      const trendScore =
        recentCount * 3 +
        freshCount * 4 +
        waitingCount * 2 +
        matchedCount +
        uniqueUserCount

      return {
        id: group[0]?.id ?? headline,
        headline,
        summary: getTopicSummary(texts, {
          waitingCount,
          matchedCount,
        }),
        sampleDaes: getTopicSamples(texts, 3),
        keywords: getTopicKeywords(texts, 4),
        daeCount: group.length,
        uniqueUserCount,
        waitingCount,
        matchedCount,
        recentCount,
        freshCount,
        trendScore,
        latestAt,
      } satisfies BrowseTopicItem
    })
    .filter((topic) => topic.headline.length > 0)
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
}

export const fetchCachedBrowseTopics = unstable_cache(
  async () => fetchBrowseTopics(80),
  ['browse-topics-v3'],
  { revalidate: 60 }
)
