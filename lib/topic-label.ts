import { extractMeaningfulTokens, scoreTextPair } from '@/lib/text-similarity'

function uniqueTexts(texts: string[]) {
  return [...new Set(texts.map((text) => text.trim()).filter(Boolean))]
}

function capitalizeWord(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function chooseRepresentativeText(texts: string[]) {
  const unique = uniqueTexts(texts)

  if (unique.length <= 1) {
    return unique[0] ?? ''
  }

  let bestText = unique[0] ?? ''
  let bestScore = -1

  for (const sourceText of unique) {
    const score = unique.reduce((total, targetText) => {
      if (sourceText === targetText) {
        return total + 1
      }

      return total + scoreTextPair(sourceText, targetText)
    }, 0)

    if (score > bestScore || (score === bestScore && sourceText.length < bestText.length)) {
      bestText = sourceText
      bestScore = score
    }
  }

  return bestText
}

export function getTopicKeywords(texts: string[], limit = 4) {
  const counts = new Map<string, number>()

  for (const text of uniqueTexts(texts)) {
    const seen = new Set<string>()

    for (const token of extractMeaningfulTokens(text)) {
      if (seen.has(token)) continue
      seen.add(token)
      counts.set(token, (counts.get(token) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1]
      }

      return a[0].localeCompare(b[0])
    })
    .slice(0, limit)
    .map(([token]) => token)
}

export function getTopicSummary(
  texts: string[],
  options?: { waitingCount?: number; matchedCount?: number }
) {
  const unique = uniqueTexts(texts)
  const keywords = getTopicKeywords(unique, 3)
  const waitingCount = options?.waitingCount ?? 0
  const matchedCount = options?.matchedCount ?? Math.max(unique.length - waitingCount, 0)

  if (unique.length <= 1) {
    return 'One prompt so far.'
  }

  if (keywords.length >= 3) {
    if (waitingCount > 0 && matchedCount > 0) {
      return `People keep landing near ${keywords[0]}, ${keywords[1]}, and ${keywords[2]}. ${waitingCount} still waiting, ${matchedCount} already connected.`
    }

    return `People keep landing near ${keywords[0]}, ${keywords[1]}, and ${keywords[2]}.`
  }

  if (keywords.length === 2) {
    if (waitingCount > 0 && matchedCount > 0) {
      return `People keep landing near ${keywords[0]} and ${keywords[1]}. ${waitingCount} waiting, ${matchedCount} already connected.`
    }

    return `People keep landing near ${keywords[0]} and ${keywords[1]}.`
  }

  if (keywords.length === 1) {
    if (waitingCount > 0 && matchedCount > 0) {
      return `${waitingCount} waiting and ${matchedCount} connected around ${keywords[0]}.`
    }

    return `People keep landing near ${keywords[0]}.`
  }

  return `${unique.length} versions of the same idea.`
}

export function getTopicLabel(texts: string[]) {
  const keywords = getTopicKeywords(texts, 2)

  if (keywords.length === 2) {
    return `${capitalizeWord(keywords[0])} / ${capitalizeWord(keywords[1])}`
  }

  if (keywords.length === 1) {
    return capitalizeWord(keywords[0])
  }

  return chooseRepresentativeText(texts)
}

export function getTopicSamples(texts: string[], limit = 3) {
  const representative = chooseRepresentativeText(texts)

  return [
    representative,
    ...uniqueTexts(texts).filter((text) => text !== representative),
  ]
    .filter(Boolean)
    .slice(0, limit)
}
