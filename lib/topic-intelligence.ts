import { createHash } from 'node:crypto'
import { unstable_cache } from 'next/cache'
import OpenAI from 'openai'
import {
  chooseRepresentativeText,
  getTopicKeywords,
  getTopicLabel,
  getTopicSummary,
} from '@/lib/topic-label'
import { normalizeText } from '@/lib/text-similarity'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export interface TopicPresentation {
  topicKey: string
  label: string
  headline: string
  summary: string
  keywords: string[]
  searchQuery: string
  usedAI: boolean
}

function uniqueTexts(texts: string[]) {
  return [...new Set(texts.map((text) => text.trim()).filter(Boolean))]
}

function toSlug(value: string) {
  return normalizeText(value)
    .split(' ')
    .filter(Boolean)
    .slice(0, 6)
    .join('-')
}

export function buildTopicKey(texts: string[], hint?: string) {
  const normalizedTexts = uniqueTexts(texts)
    .map((text) => normalizeText(text))
    .filter(Boolean)
    .sort()
  const keywordPart = toSlug((hint ?? getTopicKeywords(texts, 3).join(' ')).trim())
  const headlinePart = toSlug(chooseRepresentativeText(texts))
  const hash = createHash('sha1').update(normalizedTexts.join('|')).digest('hex').slice(0, 8)

  return [headlinePart || keywordPart || 'topic', keywordPart, hash].filter(Boolean).join('--')
}

function buildFallbackPresentation(
  texts: string[],
  options?: { waitingCount?: number; matchedCount?: number }
): TopicPresentation {
  const unique = uniqueTexts(texts)
  const headline = chooseRepresentativeText(unique) || 'Shared idea'
  const label = getTopicLabel(unique) || headline
  const keywords = getTopicKeywords(unique, 4)

  return {
    topicKey: buildTopicKey(unique, keywords.join(' ')),
    label,
    headline,
    summary: getTopicSummary(unique, options),
    keywords,
    searchQuery: normalizeText(label || headline).split(' ').slice(0, 5).join(' '),
    usedAI: false,
  }
}

const getCachedAIPresentation = unstable_cache(
  async (
    cacheKey: string,
    serializedTexts: string,
    waitingCount: number,
    matchedCount: number
  ): Promise<Pick<TopicPresentation, 'label' | 'summary' | 'keywords' | 'searchQuery'> | null> => {
    if (!openai) {
      return null
    }

    const texts = JSON.parse(serializedTexts) as string[]

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        temperature: 0.3,
        response_format: {
          type: 'json_object',
        },
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content:
              'You summarize anonymous "Does anyone else?" prompts. Return strict JSON with label, summary, keywords, and searchQuery. label: 2-5 words, title case. summary: one sentence, under 18 words, explain the shared gist only. keywords: up to 4 short lowercase words. searchQuery: 2-5 plain words. Do not mention chat rooms, matching, or private data.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              waitingCount,
              matchedCount,
              prompts: texts,
            }),
          },
        ],
      })

      const rawContent = completion.choices[0]?.message?.content ?? ''
      if (!rawContent) {
        return null
      }

      const parsed = JSON.parse(rawContent) as {
        label?: unknown
        summary?: unknown
        keywords?: unknown
        searchQuery?: unknown
      }
      const label = typeof parsed.label === 'string' ? parsed.label.trim() : ''
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
      const keywords = Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((keyword): keyword is string => typeof keyword === 'string').map((keyword) => normalizeText(keyword)).filter(Boolean).slice(0, 4)
        : []
      const searchQuery = typeof parsed.searchQuery === 'string' ? normalizeText(parsed.searchQuery).split(' ').slice(0, 5).join(' ') : ''

      if (!label || !summary) {
        return null
      }

      return {
        label,
        summary,
        keywords,
        searchQuery: searchQuery || normalizeText(label).split(' ').slice(0, 5).join(' '),
      }
    } catch (error) {
      console.error('AI topic summary failed:', {
        cacheKey,
        error,
      })
      return null
    }
  },
  ['ai-topic-presentation-v1'],
  { revalidate: 60 * 60 * 24 }
)

export async function getTopicPresentation(
  texts: string[],
  options?: { waitingCount?: number; matchedCount?: number; forceAI?: boolean; allowAI?: boolean }
) {
  const fallback = buildFallbackPresentation(texts, options)
  const unique = uniqueTexts(texts)

  if (!openai || unique.length === 0) {
    return fallback
  }

  const shouldUseAI =
    options?.allowAI !== false &&
    (options?.forceAI === true ||
      unique.length > 1 ||
      (options?.matchedCount ?? 0) > 0 ||
      (options?.waitingCount ?? 0) > 1)

  if (!shouldUseAI) {
    return fallback
  }

  const serializedTexts = JSON.stringify(unique)
  const aiPresentation = await getCachedAIPresentation(
    fallback.topicKey,
    serializedTexts,
    options?.waitingCount ?? 0,
    options?.matchedCount ?? 0
  )

  if (!aiPresentation) {
    return fallback
  }

  return {
    ...fallback,
    label: aiPresentation.label,
    summary: aiPresentation.summary,
    keywords: aiPresentation.keywords.length > 0 ? aiPresentation.keywords : fallback.keywords,
    searchQuery: aiPresentation.searchQuery || fallback.searchQuery,
    usedAI: true,
  } satisfies TopicPresentation
}
