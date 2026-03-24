const stopWords = new Set([
  'about',
  'after',
  'always',
  'another',
  'around',
  'because',
  'before',
  'being',
  'could',
  'does',
  'else',
  'from',
  'have',
  'into',
  'just',
  'like',
  'maybe',
  'really',
  'some',
  'something',
  'that',
  'their',
  'there',
  'these',
  'thing',
  'this',
  'those',
  'with',
  'would',
  'your',
])

export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractMeaningfulTokens(text: string) {
  return normalizeText(text)
    .split(' ')
    .filter((token) => token.length > 2 && !stopWords.has(token))
}

export function scoreTextPair(sourceText: string, targetText: string) {
  const sourceTokens = extractMeaningfulTokens(sourceText)
  const targetTokens = extractMeaningfulTokens(targetText)

  if (sourceTokens.length === 0 || targetTokens.length === 0) {
    return 0
  }

  const sourceSet = new Set(sourceTokens)
  const targetSet = new Set(targetTokens)
  const sharedTokens = [...sourceSet].filter((token) => targetSet.has(token))
  const sharedCount = sharedTokens.length
  const overlapScore = sharedCount / Math.max(sourceSet.size, targetSet.size)
  const coverageScore = sharedCount / sourceSet.size

  const normalizedSource = normalizeText(sourceText)
  const normalizedTarget = normalizeText(targetText)
  const phraseBonus =
    normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)
      ? 0.35
      : sharedCount >= 2
        ? 0.12
        : 0

  return Math.min(1, coverageScore * 0.65 + overlapScore * 0.35 + phraseBonus)
}

export function scoreThreadForDae(daeText: string, threadTexts: string[]) {
  return threadTexts.reduce((bestScore, threadText) => {
    return Math.max(bestScore, scoreTextPair(daeText, threadText))
  }, 0)
}
